import { supabase } from '../../../core/api/supabaseClient';
import { enviarNotificacionPushUsuarios } from '../../../core/notificaciones/notificacionesService';

// 1. OBTENER Y CLASIFICAR TODOS LOS PASES DEL DÍA PARA CASETA
export const obtenerDatosCaseta = async (sedeId) => {
  const hoy = new Date().toISOString().split('T')[0];

  const [resEmpleados, resPermisos] = await Promise.all([
    supabase
      .from('usuarios')
      .select('id, numero_empleado, nombre_completo, area, puesto, foto_url, sede_id, activo, departamento_id')
      .eq('sede_id', sedeId)
      .eq('activo', true)
      .order('nombre_completo', { ascending: true }),
    supabase
      .from('permisos')
      .select(`
        *,
        usuarios:usuario_id (
          id, numero_empleado, nombre_completo, area, puesto, foto_url, sede_id,
          departamentos:departamento_id (id, nombre, jefe_id, gerente_id)
        )
      `)
      .eq('fecha_permiso', hoy)
      .order('created_at', { ascending: false })
  ]);

  if (resEmpleados.error) throw resEmpleados.error;
  if (resPermisos.error) throw resPermisos.error;

  const empleadosSede = resEmpleados.data || [];
  const idsSede = new Set(empleadosSede.map(e => e.id));

  // Filtrar permisos que correspondan al personal de esta sede
  const pasesHoy = (resPermisos.data || []).filter(
    p => p.usuarios?.sede_id === sedeId || idsSede.has(p.usuario_id)
  );

  const pasesAutorizados = [];
  const pasesEnEspera = [];
  const pasesRechazados = [];
  const personalFuera = [];
  const faltasProgramadas = [];
  const completados = [];

  pasesHoy.forEach(p => {
    const tipo = (p.tipo_permiso || '').toLowerCase();
    const estado = (p.estado_general || '').toLowerCase();
    const obs = p.observaciones || '';

    const yaSalio = Boolean(p.hora_salida_real) || obs.includes('[SALIDA CASETA:');
    const yaRegreso = Boolean(p.hora_entrada_real) || obs.includes('[ENTRADA CASETA:') || obs.includes('[REINGRESO CASETA:');
    const requiereRegreso = obs.toLowerCase().includes('regresa:');

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
    if (estado === 'completado_caseta' || (tipo === 'retardo' && yaRegreso) || (tipo === 'salida' && yaSalio && (!requiereRegreso || yaRegreso))) {
      completados.push(p);
      return;
    }

    // 4. Personal actualmente fuera de planta (salió y tiene marcado regresar)
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
    .select('id, tipo_permiso, observaciones')
    .eq('id', permisoId)
    .single();

  if (errGet) throw errGet;

  const mov = (tipoMovimiento || '').toLowerCase();
  const obsActual = permiso.observaciones || '';
  let etiquetaBitacora = `[MOVIMIENTO CASETA: ${horaFormateada} hrs]`;

  if (mov.includes('salida')) {
    etiquetaBitacora = `[SALIDA CASETA: ${horaFormateada} hrs]`;
  } else if (mov.includes('regreso') || mov.includes('reingreso') || mov.includes('entrada')) {
    etiquetaBitacora = `[ENTRADA CASETA: ${horaFormateada} hrs]`;
  } else if (permiso.tipo_permiso === 'salida' && !obsActual.includes('[SALIDA CASETA:')) {
    etiquetaBitacora = `[SALIDA CASETA: ${horaFormateada} hrs]`;
  } else {
    etiquetaBitacora = `[ENTRADA CASETA: ${horaFormateada} hrs]`;
  }

  const nuevasObservaciones = `${obsActual} | ${etiquetaBitacora}`.trim();

  const { error } = await supabase
    .from('permisos')
    .update({ observaciones: nuevasObservaciones })
    .eq('id', permisoId);

  if (error) throw error;
};

// 3. GENERAR RETARDO EN PUERTA CUANDO EL EMPLEADO LLEGA SIN PASE PREVIO
export const registrarRetardoEnPuerta = async (usuarioId) => {
  const ahora = new Date();
  const fechaHoy = ahora.toISOString().split('T')[0];
  const horaActual = ahora.toTimeString().slice(0, 5);

  const { data: user, error: errU } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, foto_url, departamento_id, tipo_personal')
    .eq('id', usuarioId)
    .single();

  if (errU || !user) throw new Error("No se encontró al colaborador seleccionado.");

  let jefeId = null;
  let gerenteId = null;
  let rhId = null;

  if (user.departamento_id) {
    const { data: depto } = await supabase
      .from('departamentos')
      .select('jefe_id, gerente_id, rh_id, clasificacion')
      .eq('id', user.departamento_id)
      .maybeSingle();

    if (depto) {
      jefeId = depto.jefe_id;
      gerenteId = depto.gerente_id;
      rhId = depto.rh_id;
    }
  }

  if (!gerenteId) {
    const rolGerente = (user.tipo_personal || '').toLowerCase().includes('admin') ? 'gerente_admin' : 'gerente_produccion';
    const { data: ger } = await supabase.from('usuarios').select('id').eq('rol', rolGerente).limit(1).maybeSingle();
    if (ger) gerenteId = ger.id;
  }

  if (!rhId) {
    const { data: rh } = await supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']).limit(1).maybeSingle();
    if (rh) rhId = rh.id;
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
      asunto_motivo: `[RETARDO EN PUERTA] Registro directo en Caseta a las ${horaActual} hrs sin pase previo.`,
      total_horas: 1,
      observaciones: `🕒 Llegada reportada en caseta: ${horaActual} hrs`,
      firma_empleado: true,
      firma_1_id: jefeId,
      firma_1_estado: jefeId ? 'pendiente' : 'omitido',
      firma_2_id: gerenteId,
      firma_2_estado: gerenteId ? 'pendiente' : 'omitido',
      firma_3_id: rhId,
      firma_3_estado: rhId ? 'pendiente' : 'omitido',
      requiere_caseta: true,
      estado_general: 'en_firmas'
    }]);

  if (errInsert) throw errInsert;

  const destinatarios = [jefeId, gerenteId].filter(Boolean);
  if (destinatarios.length > 0) {
    await enviarNotificacionPushUsuarios(destinatarios, {
      titulo: '🚨 LLEGADA SIN PASE EN CASETA',
      mensaje: `👤 ${user.nombre_completo}\n🕒 Hora en puerta: ${horaActual} hrs\nRequiere autorización de acceso.`,
      fotoUrl: user.foto_url,
      urlDestino: '/aprobaciones'
    });
  }
};
