import { supabase } from '../../../core/api/supabaseClient';
import { enviarNotificacionPushUsuarios } from '../../../core/notificaciones/notificacionesService';

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
        id, folio, usuario_id, fecha_permiso, fecha_fin, tipo_permiso, pago, observaciones, estado_general, created_at,
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
    if (tipo !== 'salida' && tipo !== 'retardo') return;

    const obs = rawPase.observaciones || '';
    const { horaSalidaCaseta, horaEntradaCaseta } = extraerHorasCaseta(obs);
    const mRetiro = obs.match(/\[REGRESADO EN PUERTA:\s*([^\]]+)\]/i);
    const horaRetiroCaseta = mRetiro ? mRetiro[1].trim() : null;
    const seRegresaACasa = (rawPase.pago || "").toLowerCase().includes("regresa");
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
      seRegresaACasa,
      horaRetiroCaseta,
      seRegresaACasa,
      horaRetiroCaseta,
      horaSalidaCaseta,
      horaEntradaCaseta,
      usuarios: {
        id: rawPase.usuarios?.id,
        numero_empleado: rawPase.usuarios?.numero_empleado,
        nombre_completo: rawPase.usuarios?.nombre_completo
      }
    };

    if (
      rawPase.estado_general === 'completado_caseta' ||
      (tipo === 'retardo' && !seRegresaACasa && yaRegreso) ||
      (tipo === 'retardo' && seRegresaACasa && Boolean(horaRetiroCaseta)) ||
      (tipo === 'salida' && yaSalio && (!requiereRegreso || yaRegreso))
    ) {
      crucesCompletadosHoy.push(p);
      return;
    }

    if (tipo === 'salida' && yaSalio && requiereRegreso && !yaRegreso) {
      personalFuera.push(p);
      return;
    }

    pasesPorCruzar.push(p);
  });

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

// 2. SELLAR HORA DE SALIDA / ENTRADA / REINGRESO EN PUERTA
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

  if (mov.includes('retiro')) {
    etiquetaBitacora = `[REGRESADO EN PUERTA: ${horaFormateada} hrs]`;
    cierraCicloCaseta = true;
  } else if (mov.includes('salida') || (tipo === 'salida' && !obsActual.includes('[SALIDA CASETA:'))) {
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

// 4. APOYO AL TRABAJADOR SIN INTERNET: GENERAR PASE DE RETARDO EN PUERTA CON ENRUTADOR DE 4 NIVELES
export const registrarRetardoEnPuerta = async (usuarioId) => {
  const ahora = new Date();
  const fechaHoy = obtenerFechaLocalHoy();
  const horaActual = ahora.toTimeString().slice(0, 5);

  const { data: user, error: errU } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, foto_url, rol, area, reporta_a_id, departamento_id, tipo_personal')
    .eq('id', usuarioId)
    .single();

  if (errU || !user) throw new Error("No se encontró al colaborador seleccionado.");

  const [{ data: depto }, { data: todosEmpDepto }] = await Promise.all([
    user.departamento_id
      ? supabase.from('departamentos').select('id, nombre, clasificacion, jefe_id, gerente_id, rh_id').eq('id', user.departamento_id).maybeSingle()
      : Promise.resolve({ data: null }),
    user.departamento_id
      ? supabase.from('usuarios').select('id, area, rol, activo').eq('departamento_id', user.departamento_id).eq('activo', true)
      : Promise.resolve({ data: [] })
  ]);

  const areaSolicitante = (user.area || '').trim().toUpperCase();
  const listaDepto = todosEmpDepto || [];
  const mandosEnDepto = listaDepto.filter(u => ['encargado', 'jefe_area'].includes(u.rol) && u.id !== user.id);

  // PASO 1: VALIDAR SI SU JEFE DIRECTO (reporta_a_id) SIGUE TENIENDO ROL DE MANDO ACTIVO
  let firma1Id = null;

  if (user.reporta_a_id) {
    const { data: supDirecto } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', user.reporta_a_id)
      .maybeSingle();

    // Si lo degradaron a 'empleado' o está inactivo, NO se le asigna y cae al fallback del departamento
    if (supDirecto && supDirecto.activo && ['encargado', 'jefe_area', 'rh_nominas'].includes(supDirecto.rol)) {
      firma1Id = supDirecto.id;
    }
  }

  // Fallback inteligente si no tenía reporta_a_id o si su supervisor fue cambiado a 'empleado'
  if (!firma1Id) {
    const mandoMismaSubarea =
      mandosEnDepto.find(j => j.rol === 'encargado' && (j.area || '').trim().toUpperCase() === areaSolicitante) ||
      mandosEnDepto.find(j => j.rol === 'jefe_area' && (j.area || '').trim().toUpperCase() === areaSolicitante);

    if (mandoMismaSubarea) {
      firma1Id = mandoMismaSubarea.id;
    } else if (depto?.jefe_id && depto.jefe_id !== user.id) {
      // Verificar que el jefe del depto también siga siendo mando activo
      const { data: jefeDeptoData } = await supabase
        .from('usuarios')
        .select('id, rol, activo')
        .eq('id', depto.jefe_id)
        .maybeSingle();
      if (jefeDeptoData && jefeDeptoData.activo && ['encargado', 'jefe_area', 'rh_nominas'].includes(jefeDeptoData.rol)) {
        firma1Id = jefeDeptoData.id;
      }
    }
  }

  // PASO 2: DETERMINAR GERENCIA (FIRMA 2) Y RH (FIRMA 3)
  const nomDeptoUpper = (depto?.nombre || '').toUpperCase();
  const clasifLower = (depto?.clasificacion || user.tipo_personal || 'produccion').toLowerCase();
  const esDeptoRH = clasifLower.includes('rh') || nomDeptoUpper.includes('RECURSOS HUMANOS') || nomDeptoUpper.includes('VIGILANCIA') || nomDeptoUpper === 'RH';
  const rolGerenteFallback = clasifLower.includes('admin') ? 'gerente_admin' : (clasifLower.includes('rh') ? 'gerente_rh' : 'gerente_produccion');

  const [{ data: gerenteDeptoData }, { data: gerenteFallbackData }, { data: rhUsersData }] = await Promise.all([
    depto?.gerente_id ? supabase.from('usuarios').select('id, rol').eq('id', depto.gerente_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('usuarios').select('id, rol').eq('rol', rolGerenteFallback).eq('activo', true).limit(1).maybeSingle(),
    supabase.from('usuarios').select('id, rol').in('rol', ['gerente_rh', 'rh_nominas']).eq('activo', true)
  ]);

  const listaRH = rhUsersData || [];
  const gerenteRH = listaRH.find(u => u.rol === 'gerente_rh') || listaRH[0];
  const rhId = gerenteRH?.id || depto?.rh_id || null;

  let gerenteId = gerenteDeptoData?.id || (esDeptoRH ? rhId : gerenteFallbackData?.id) || null;
  const rolDelGerenteDepto = gerenteDeptoData?.rol || (esDeptoRH ? 'gerente_rh' : gerenteFallbackData?.rol);

  // PASO 3: ÁRBITRO DE ESTADOS
  let f1Estado = firma1Id ? (firma1Id === user.id ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let f2Estado = gerenteId ? (gerenteId === user.id ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let f3Estado = rhId ? (rhId === user.id ? 'auto_aprobado' : 'pendiente') : 'omitido';

  if (esDeptoRH || rolDelGerenteDepto === 'gerente_rh' || gerenteId === rhId) {
    f2Estado = 'omitido';
  }

  if (['gerente_produccion', 'gerente_admin', 'gerente_rh', 'superadmin'].includes(user.rol)) {
    f1Estado = 'auto_aprobado';
    f2Estado = 'auto_aprobado';
  }

  const folioTemporal = `CAS-${Math.floor(100000 + Math.random() * 900000)}`;

  // Guardamos desde el inicio el sello real [ENTRADA CASETA: HH:MM hrs] para que RH lo vea en el Historial y en la Papeleta PDF
  const { error: errInsert } = await supabase
    .from('permisos')
    .insert([{
      folio: folioTemporal,
      usuario_id: user.id,
      fecha_elaboracion: fechaHoy,
      fecha_permiso: fechaHoy,
      tipo_permiso: 'retardo',
      pago: 'Pendiente de dictamen',
      asunto_motivo: `[APOYO CASETA] Pase de retardo tramitado con apoyo de caseta de vigilancia.`,
      total_horas: 1,
      observaciones: `🕒 Llegada en puerta: ${horaActual} hrs | [ENTRADA CASETA: ${horaActual} hrs]`,
      firma_empleado: true,
      firma_1_id: firma1Id,
      firma_1_estado: f1Estado,
      firma_2_id: gerenteId,
      firma_2_estado: f2Estado,
      firma_3_id: rhId,
      firma_3_estado: f3Estado,
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
  } else if (f3Estado === 'pendiente') {
    destinatarios = listaRH.length > 0 ? listaRH.map(u => u.id) : [rhId];
  }

  if (destinatarios.length > 0) {
    await enviarNotificacionPushUsuarios([...new Set(destinatarios.filter(Boolean))], {
      titulo: '🕒 RETARDO GENERADO EN CASETA',
      mensaje: `👤 ${user.nombre_completo}\n🕒 Hora de llegada: ${horaActual} hrs\nPendiente de autorización.`,
      fotoUrl: user.foto_url,
      urlDestino: '/aprobaciones'
    });
  }
};
