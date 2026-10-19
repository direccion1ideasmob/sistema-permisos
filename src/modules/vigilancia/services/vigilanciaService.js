import { supabase } from '../../../core/api/supabaseClient';
import { enviarNotificacionPushUsuarios } from '../../../core/notificaciones/notificacionesService';

// Fecha local YYYY-MM-DD (evita desfase UTC después de las 18:00 hrs)
export const obtenerFechaLocalHoy = () => {
  const ahora = new Date();
  const offsetMs = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - offsetMs).toISOString().split('T')[0];
};

const extraerHorasCaseta = (obs = '') => {
  const mSalida = obs.match(/\[SALIDA CASETA:\s*([^\]]+)\]/i);
  const mEntrada = obs.match(/\[(?:ENTRADA\vert{}REINGRESO) CASETA:\s*([^\]]+)\]/i);
  return {
    horaSalidaCaseta: mSalida ? mSalida[1].trim() : null,
    horaEntradaCaseta: mEntrada ? mEntrada[1].trim() : null
  };
};

const extraerHorarioProgramado = (obs = '') => {
  const primeraParte = String(obs).split('|')[0]?.trim() || '';
  return primeraParte || 'Horario autorizado';
};

// 1. OBTENER DATOS ESTRICTAMENTE ACOTADOS PARA VIGILANCIA (SIN FOTOS, SIN DEPTOS, SIN MOTIVOS)
export const obtenerDatosCaseta = async (sedeId, fechaConsulta = null) => {
  const hoy = obtenerFechaLocalHoy();
  const fechaTarget = fechaConsulta || hoy;

  // Solo pedimos id, numero_empleado y nombre_completo (Cero fotos, cero departamentos, cero puestos)
  let queryEmpleados = supabase
    .from('usuarios')
    .select('id, numero_empleado, nombre_completo, sede_id, activo, rol')
    .eq('activo', true)
    .neq('rol', 'caseta')
    .order('nombre_completo', { ascending: true });

  if (sedeId) {
    queryEmpleados = queryEmpleados.eq('sede_id', sedeId);
  }

  const [resEmpleados, resPermisos, resAsistencias] = await Promise.all([
    queryEmpleados,
    supabase
      .from('permisos')
      .select(`
        id, folio, usuario_id, fecha_permiso, fecha_fin, tipo_permiso, observaciones, estado_general, created_at,
        usuarios:usuario_id (id, numero_empleado, nombre_completo, sede_id)
      `)
      .eq('fecha_permiso', hoy)
      .in('estado_general', ['autorizado', 'aprobado', 'completado_caseta'])
      .order('created_at', { ascending: false }),
    supabase
      .from('asistencias_caseta')
      .select('id, usuario_id, fecha, hora_entrada, hora_salida')
      .eq('fecha', fechaTarget)
  ]);

  if (resEmpleados.error) throw resEmpleados.error;
  if (resPermisos.error) throw resPermisos.error;

  const empleadosSede = resEmpleados.data || [];
  const idsSede = new Set(empleadosSede.map(e => e.id));

  const pasesHoy = (resPermisos.data || []).filter(
    p => !sedeId || p.usuarios?.sede_id === sedeId || idsSede.has(p.usuario_id)
  );

  const pasesPorCruzar = [];
  const personalFuera = [];
  const crucesCompletadosHoy = [];

  pasesHoy.forEach(rawPase => {
    const tipo = (rawPase.tipo_permiso || '').toLowerCase();
    if (tipo !== 'salida' && tipo !== 'retardo') return; // Vigilancia solo opera Salidas y Retardos autorizados

    const obs = rawPase.observaciones || '';
    const { horaSalidaCaseta, horaEntradaCaseta } = extraerHorasCaseta(obs);
    const yaSalio = Boolean(horaSalidaCaseta);
    const yaRegreso = Boolean(horaEntradaCaseta);
    const requiereRegreso = obs.toLowerCase().includes('regresa:');

    const p = {
      id: rawPase.id,
      folio: rawPase.folio,
      usuario_id: rawPase.usuario_id,
      tipo_permiso: tipo,
      horarioProgramado: extraerHorarioProgramado(obs),
      requiereRegreso,
      horaSalidaCaseta,
      horaEntradaCaseta,
      usuarios: {
        id: rawPase.usuarios?.id,
        numero_empleado: rawPase.usuarios?.numero_empleado,
        nombre_completo: rawPase.usuarios?.nombre_completo
      }
    };

    // 1. Ya concluyó su movimiento en puerta
    if (
      rawPase.estado_general === 'completado_caseta' ||
      (tipo === 'retardo' && yaRegreso) ||
      (tipo === 'salida' && yaSalio && (!requiereRegreso || yaRegreso))
    ) {
      crucesCompletadosHoy.push(p);
      return;
    }

    // 2. Salió con pase temporal y está pendiente su reingreso
    if (tipo === 'salida' && yaSalio && requiereRegreso && !yaRegreso) {
      personalFuera.push(p);
      return;
    }

    // 3. Autorizado por RH listo para cruzar puerta
    pasesPorCruzar.push(p);
  });

  // Mapa de asistencias de la fecha consultada
  const mapaAsistencias = {};
  (resAsistencias.data || []).forEach(a => {
    mapaAsistencias[a.usuario_id] = a;
  });

  return {
    pasesPorCruzar,
    personalFuera,
    crucesCompletadosHoy,
    empleadosSede,
    mapaAsistencias
  };
};

// 2. SELLAR HORA DE SALIDA / ENTRADA / REINGRESO EN PUERTA (SOBRE PASE AUTORIZADO)
export const registrarCheckCaseta = async (permisoId, tipoMovimiento = 'check') => {
  const ahora = new Date();
  const horaFormateada = ahora.toTimeString().slice(0, 5);

  const { data: permiso, error: errGet } = await supabase
    .from('permisos')
    .select('id, usuario_id, tipo_permiso, observaciones')
    .eq('id', permisoId)
    .single();

  if (errGet) throw errGet;

  const mov = (tipoMovimiento || '').toLowerCase();
  const obsActual = permiso.observaciones || '';
  const tipo = (permiso.tipo_permiso || '').toLowerCase();
  const requiereRegreso = obsActual.toLowerCase().includes('regresa:');

  let etiquetaBitacora = `[ENTRADA CASETA: ${horaFormateada} hrs]`;
  let cierraCicloCaseta = true;

  if (mov.includes('salida') || (tipo === 'salida' && !obsActual.includes('[SALIDA CASETA:'))) {
    etiquetaBitacora = `[SALIDA CASETA: ${horaFormateada} hrs]`;
    cierraCicloCaseta = !requiereRegreso;
  }

  const nuevasObservaciones = `${obsActual} | ${etiquetaBitacora}`.trim();
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

// 3. REGISTRAR ENTRADA O SALIDA EN EL PASE DE LISTA DIARIO
export const registrarAsistenciaLista = async (usuarioId, tipoMarca = 'entrada', guardiaId = null) => {
  const hoy = obtenerFechaLocalHoy();
  const horaActual = new Date().toTimeString().slice(0, 5);

  const { data: existente } = await supabase
    .from('asistencias_caseta')
    .select('id, hora_entrada, hora_salida')
    .eq('usuario_id', usuarioId)
    .eq('fecha', hoy)
    .maybeSingle();

  if (!existente) {
    const payload = {
      usuario_id: usuarioId,
      fecha: hoy,
      hora_entrada: tipoMarca === 'entrada' ? horaActual : null,
      hora_salida: tipoMarca === 'salida' ? horaActual : null,
      registrado_por: guardiaId
    };
    const { error } = await supabase.from('asistencias_caseta').insert([payload]);
    if (error) throw error;
  } else {
    const updates = tipoMarca === 'salida'
      ? { hora_salida: horaActual }
      : { hora_entrada: existente.hora_entrada || horaActual };
    const { error } = await supabase
      .from('asistencias_caseta')
      .update(updates)
      .eq('id', existente.id);
    if (error) throw error;
  }
};

// 4. APOYO AL TRABAJADOR SIN INTERNET: GENERAR PASE DE RETARDO EN PUERTA
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

  const folioTemporal = `CAS-${Math.floor(100000 + Math.random() * 900000)}`;

  const { error: errInsert } = await supabase
    .from('permisos')
    .insert([{
      folio: folioTemporal,
      usuario_id: user.id,
      fecha_elaboracion: fechaHoy,
      fecha_permiso: fechaHoy,
      tipo_permiso: 'retardo',
      pago: 'Pendiente de dictamen',
      asunto_motivo: `[APOYO CASETA] Solicitud de retardo generada en puerta a las ${horaActual} hrs.`,
      total_horas: 1,
      observaciones: `🕒 Llegada registrada en caseta: ${horaActual} hrs`,
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

  // También dejamos marcada su hora de entrada en la lista de asistencia de hoy
  try {
    await registrarAsistenciaLista(user.id, 'entrada', null);
  } catch (_) {}

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
      titulo: '🕒 RETARDO GENERADO EN CASETA',
      mensaje: `👤 ${user.nombre_completo}\n🕒 Hora de llegada: ${horaActual} hrs\nPendiente de autorización.`,
      fotoUrl: user.foto_url,
      urlDestino: '/aprobaciones'
    });
  }
};
