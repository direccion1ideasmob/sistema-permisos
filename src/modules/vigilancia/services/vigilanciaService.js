import { supabase } from '../../../core/api/supabaseClient';
import { enviarNotificacionPushUsuarios } from '../../../core/notificaciones/notificacionesService';

// Obtener fecha local YYYY-MM-DD (evita el salto de día a las 6:00 PM por UTC)
const obtenerFechaLocalHoy = () => {
  const ahora = new Date();
  const offsetMs = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - offsetMs).toISOString().split('T')[0];
};

// Extraer quién falta por firmar con nombre real
const calcularNivelEspera = (p) => {
  const f1Listo = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(p.firma_1_estado);
  const f2Listo = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(p.firma_2_estado);

  if (!f1Listo) {
    return p.firmante1?.nombre_completo
      ? `Jefe / Supervisor (\${p.firmante1.nombre_completo})`
      : 'Jefe de Área / Supervisor';
  }
  if (!f2Listo) {
    return p.firmante2?.nombre_completo
      ? `Gerencia (\${p.firmante2.nombre_completo})`
      : 'Gerencia';
  }
  return 'Recursos Humanos (Dictamen Final)';
};

// Extraer horas registradas en caseta desde observaciones
const extraerHorasCaseta = (obs = '') => {
  const mSalida = obs.match(/\[SALIDA CASETA:\s*([^\]]+)\]/i);
  const mEntrada = obs.match(/\[(?:ENTRADA|REINGRESO) CASETA:\s*([^\]]+)\]/i);
  return {
    horaSalidaCaseta: mSalida ? mSalida[1].trim() : null,
    horaEntradaCaseta: mEntrada ? mEntrada[1].trim() : null
  };
};

// 1. OBTENER Y CLASIFICAR TODOS LOS PASES DEL DÍA PARA CASETA
export const obtenerDatosCaseta = async (sedeId) => {
  const hoy = obtenerFechaLocalHoy();

  let queryEmpleados = supabase
    .from('usuarios')
    .select('id, numero_empleado, nombre_completo, area, puesto, foto_url, sede_id, activo, departamento_id')
    .eq('activo', true)
    .order('nombre_completo', { ascending: true });

  if (sedeId) {
    queryEmpleados = queryEmpleados.eq('sede_id', sedeId);
  }

  const [resEmpleados, resPermisos] = await Promise.all([
    queryEmpleados,
    supabase
      .from('permisos')
      .select(`
        *,
        usuarios:usuario_id (
          id, numero_empleado, nombre_completo, area, puesto, foto_url, sede_id,
          departamentos:departamento_id (id, nombre, jefe_id, gerente_id)
        ),
        firmante1:firma_1_id (id, nombre_completo, rol),
        firmante2:firma_2_id (id, nombre_completo, rol),
        firmante3:firma_3_id (id, nombre_completo, rol)
      `)
      .lte('fecha_permiso', hoy)
      .order('created_at', { ascending: false })
  ]);

  if (resEmpleados.error) throw resEmpleados.error;
  if (resPermisos.error) throw resPermisos.error;

  const empleadosSede = resEmpleados.data || [];
  const idsSede = new Set(empleadosSede.map(e => e.id));

  // Filtrar permisos vigentes hoy (fecha exacta hoy, o vacaciones/faltas cuyo rango cubra hoy)
  const pasesHoy = (resPermisos.data || []).filter(p => {
    const perteneceASede = !sedeId || p.usuarios?.sede_id === sedeId || idsSede.has(p.usuario_id);
    if (!perteneceASede) return false;

    const inicio = p.fecha_permiso;
    const fin = p.fecha_fin || p.fecha_permiso;
    return inicio <= hoy && fin >= hoy;
  });

  const pasesAutorizados = [];
  const pasesEnEspera = [];
  const pasesRechazados = [];
  const personalFuera = [];
  const faltasProgramadas = [];
  const completados = [];

  pasesHoy.forEach(rawPase => {
    const tipo = (rawPase.tipo_permiso || '').toLowerCase();
    const estado = (rawPase.estado_general || '').toLowerCase();
    const obs = rawPase.observaciones || '';

    const { horaSalidaCaseta, horaEntradaCaseta } = extraerHorasCaseta(obs);
    const yaSalio = Boolean(rawPase.hora_salida_real) || Boolean(horaSalidaCaseta);
    const yaRegreso = Boolean(rawPase.hora_entrada_real) || Boolean(horaEntradaCaseta);
    const requiereRegreso = obs.toLowerCase().includes('regresa:');

    // Limpiar el horario para mostrarlo al guardia sin códigos internos
    const horarioLimpio = obs
      .split('|')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('✅') && !s.startsWith('Res:'))
      .join(' • ');

    const p = {
      ...rawPase,
      nivelEspera: calcularNivelEspera(rawPase),
      horarioLimpio: horarioLimpio || 'Horario estándar',
      horaSalidaCaseta,
      horaEntradaCaseta
    };

    // 1. Faltas y Vacaciones
    if (tipo === 'falta' || tipo === 'vacaciones') {
      faltasProgramadas.push(p);
      return;
    }

    // 2. Rechazados
    if (estado === 'rechazado') {
      pasesRechazados.push(p);
      return;
    }

    // 3. Movimientos ya concluidos en puerta
    if (
      estado === 'completado_caseta' ||
      (tipo === 'retardo' && yaRegreso) ||
      (tipo === 'salida' && yaSalio && (!requiereRegreso || yaRegreso))
    ) {
      completados.push(p);
      return;
    }

    // 4. Personal actualmente fuera de planta (salió y tiene marcado regresar hoy)
    if (tipo === 'salida' && yaSalio && requiereRegreso && !yaRegreso) {
      personalFuera.push(p);
      return;
    }

    // 5. Autorizados listos para ejecutar en puerta
    if (['autorizado', 'aprobado'].includes(estado)) {
      pasesAutorizados.push(p);
      return;
    }

    // 6. En espera de firmas
    pasesEnEspera.push(p);
  });

  return {
    pasesAutorizados,
    pasesEnEspera,
    pasesRechazados,
    personalFuera,
    faltasProgramadas,
    completados,
    empleadosSede
  };
};

// 2. REGISTRAR CHECK-IN / CHECK-OUT EN PUERTA
export const registrarCheckCaseta = async (permisoId, tipoMovimiento = 'check') => {
  const ahora = new Date();
  const horaFormateada = ahora.toTimeString().slice(0, 5);

  const { data: permiso, error: errGet } = await supabase
    .from('permisos')
    .select('id, usuario_id, folio, tipo_permiso, observaciones')
    .eq('id', permisoId)
    .single();

  if (errGet) throw errGet;

  const mov = (tipoMovimiento || '').toLowerCase();
  const obsActual = permiso.observaciones || '';
  const tipo = (permiso.tipo_permiso || '').toLowerCase();
  const requiereRegreso = obsActual.toLowerCase().includes('regresa:');

  let etiquetaBitacora = `[MOVIMIENTO CASETA: \${horaFormateada} hrs]`;
  let cierraCicloCaseta = false;

  if (mov.includes('salida') || (tipo === 'salida' && !obsActual.includes('[SALIDA CASETA:'))) {
    etiquetaBitacora = `[SALIDA CASETA: \${horaFormateada} hrs]`;
    cierraCicloCaseta = !requiereRegreso;
  } else {
    etiquetaBitacora = `[ENTRADA CASETA: \${horaFormateada} hrs]`;
    cierraCicloCaseta = true;
  }

  const nuevasObservaciones = `${obsActual} \vert{}${etiquetaBitacora}`.trim();
  const updates = { observaciones: nuevasObservaciones };

  if (cierraCicloCaseta) {
    updates.estado_general = 'completado_caseta';
  }

  const { error } = await supabase
    .from('permisos')
    .update(updates)
    .eq('id', permisoId);

  if (error) throw error;
};

// 3. GENERAR RETARDO EN PUERTA CUANDO EL EMPLEADO LLEGA SIN PASE PREVIO (CON JERARQUÍA DE 4 NIVELES)
export const registrarRetardoEnPuerta = async (usuarioId) => {
  const ahora = new Date();
  const fechaHoy = obtenerFechaLocalHoy();
  const horaActual = ahora.toTimeString().slice(0, 5);

  const { data: user, error: errU } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, foto_url, rol, reporta_a_id, departamento_id, tipo_personal')
    .eq('id', usuarioId)
    .single();

  if (errU || !user) throw new Error("No se encontró al colaborador seleccionado.");

  let firma1Id = user.reporta_a_id || null;
  let gerenteId = null;
  let rhId = null;
  let clasificacionDepto = '';

  if (user.departamento_id) {
    const { data: depto } = await supabase
      .from('departamentos')
      .select('jefe_id, gerente_id, rh_id, clasificacion')
      .eq('id', user.departamento_id)
      .maybeSingle();

    if (depto) {
      if (!firma1Id) firma1Id = depto.jefe_id;
      gerenteId = depto.gerente_id;
      rhId = depto.rh_id;
      clasificacionDepto = (depto.clasificacion || '').toLowerCase();
    }
  }

  const nomina = (user.tipo_personal || clasificacionDepto || 'produccion').toLowerCase();

  if (!gerenteId) {
    const rolGerente = nomina.includes('admin') ? 'gerente_admin' : 'gerente_produccion';
    const { data: ger } = await supabase
      .from('usuarios')
      .select('id')
      .eq('rol', rolGerente)
      .eq('activo', true)
      .limit(1)
      .maybeSingle();
    if (ger) gerenteId = ger.id;
  }

  if (!rhId) {
    const { data: rh } = await supabase
      .from('usuarios')
      .select('id')
      .in('rol', ['gerente_rh', 'rh_nominas'])
      .eq('activo', true)
      .order('rol', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (rh) rhId = rh.id;
  }

  // Reglas de auto-aprobación si quien llega tarde es Jefe o Gerente
  let f1Estado = firma1Id ? 'pendiente' : 'omitido';
  let f2Estado = gerenteId ? 'pendiente' : 'omitido';

  if (['jefe_area', 'encargado'].includes(user.rol) && (!user.reporta_a_id || user.reporta_a_id === gerenteId || firma1Id === user.id)) {
    firma1Id = user.id;
    f1Estado = 'auto_aprobado';
  }
  if (['gerente_produccion', 'gerente_admin', 'gerente_rh', 'superadmin'].includes(user.rol)) {
    firma1Id = user.id;
    f1Estado = 'auto_aprobado';
    gerenteId = user.id;
    f2Estado = 'auto_aprobado';
  }

  const folioTemporal = `CAS-\${Math.floor(100000 + Math.random() * 900000)}`;

  const { error: errInsert } = await supabase
    .from('permisos')
    .insert([{
      folio: folioTemporal,
      usuario_id: user.id,
      fecha_elaboracion: fechaHoy,
      fecha_permiso: fechaHoy,
      tipo_permiso: 'retardo',
      pago: 'Pendiente de dictamen',
      asunto_motivo: `[RETARDO EN PUERTA] Registro directo en Caseta a las \${horaActual} hrs sin pase previo.`,
      total_horas: 1,
      observaciones: `🕒 Llegada reportada en caseta: \${horaActual} hrs`,
      firma_empleado: true,
      firma_1_id: firma1Id,
      firma_1_estado: f1Estado,
      firma_2_id: gerenteId,
      firma_2_estado: f2Estado,
      firma_3_id: rhId,
      firma_3_estado: 'pendiente',
      requiere_caseta: true,
      estado_general: 'en_firmas'
    }]);

  if (errInsert) throw errInsert;

  // Notificar únicamente a la autoridad inmediata que le toca autorizar
  let destinatarios = [];
  if (f1Estado === 'pendiente' && firma1Id) {
    destinatarios = [firma1Id];
  } else if (f2Estado === 'pendiente' && gerenteId) {
    destinatarios = [gerenteId];
  } else if (rhId) {
    destinatarios = [rhId];
  }

  if (destinatarios.length > 0) {
    await enviarNotificacionPushUsuarios(destinatarios, {
      titulo: '🚨 LLEGADA SIN PASE EN CASETA',
      mensaje: `👤 \${user.nombre_completo}\n🕒 Hora en puerta: \${horaActual} hrs\nRequiere autorización de acceso.`,
      fotoUrl: user.foto_url,
      urlDestino: '/aprobaciones'
    });
  }
};
