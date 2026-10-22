import { supabase } from '../../../core/api/supabaseClient';
import { enviarNotificacionPushUsuarios } from '../../../core/notificaciones/notificacionesService';

export const obtenerFechaLocalHoy = () => {
  const ahora = new Date();
  const offsetMs = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - offsetMs).toISOString().split('T')[0];
};

const extraerHorasCaseta = (obs = '') => {
  const mSalida = obs.match(/\[SALIDA CASETA:\s*([^\]]+)\]/i);
  const mEntrada = obs.match(/\[(?:ENTRADA|REINGRESO) CASETA:\s*([^\]]+)\]/i);
  const mLlegadaPuerta = obs.match(/\[LLEGADA EN PUERTA:\s*([^\]]+)\]/i);
  const mRetiro = obs.match(/\[REGRESADO EN PUERTA:\s*([^\]]+)\]/i);
  return {
    horaSalidaCaseta: mSalida ? mSalida[1].trim() : null,
    horaEntradaCaseta: mEntrada ? mEntrada[1].trim() : null,
    horaLlegadaPuerta: mLlegadaPuerta ? mLlegadaPuerta[1].trim() : null,
    horaRetiroCaseta: mRetiro ? mRetiro[1].trim() : null
  };
};

const extraerHorarioProgramado = (obs = '') => {
  const partes = String(obs).split('|').map(p => p.trim()).filter(Boolean);
  const lineaHorario = partes.find(p => !p.toLowerCase().includes('llegada en puerta')) || partes[0] || '';
  return lineaHorario
    .replace(/🕒|📅/g, '')
    .replace(/^Llegada estimada:\s*/i, 'Estimada: ')
    .replace(/^Salida definitiva:\s*/i, 'Salida def.: ')
    .trim() || 'Horario del día';
};

// 1. OBTENER DATOS DE CASETA (CON TODAS LAS VARIANTES DE RETARDO, RETIRO, SALIDA Y LISTA)
export const obtenerDatosCaseta = async (sedeId, fechaConsulta = null) => {
  const hoy = obtenerFechaLocalHoy();
  const fechaTarget = fechaConsulta || hoy;

  let queryEmpleados = supabase
    .from('usuarios')
    .select('id, numero_empleado, nombre_completo, foto_url, area, puesto, sede_id, activo, rol, departamentos:departamento_id (nombre)')
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
        id, folio, usuario_id, fecha_permiso, fecha_fin, tipo_permiso, pago, observaciones,
        firma_1_id, firma_1_estado, firma_2_id, firma_2_estado, firma_3_id, firma_3_estado,
        estado_general, created_at,
        usuarios:usuario_id (id, numero_empleado, nombre_completo, foto_url, area, puesto, sede_id, departamentos:departamento_id (nombre)),
        firmante1:firma_1_id (nombre_completo),
        firmante2:firma_2_id (nombre_completo)
      `)
      .lte('fecha_permiso', fechaTarget)
      .in('estado_general', ['en_firmas', 'autorizado', 'aprobado', 'completado_caseta', 'rechazado'])
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

  // Filtrar permisos que correspondan a la sede y a la fecha consultada (o rango de vacaciones)
  const pasesDelDia = (resPermisos.data || []).filter(p => {
    const perteneceSede = !sedeId || p.usuarios?.sede_id === sedeId || idsSede.has(p.usuario_id);
    if (!perteneceSede) return false;
    const fin = p.fecha_fin || p.fecha_permiso;
    return p.fecha_permiso <= fechaTarget && fin >= fechaTarget;
  });

  const retenidosEnEspera = [];
  const pasesPorCruzar = [];
  const personalFuera = [];
  const crucesCompletadosHoy = [];
  const mapaIncidenciasHoy = {};

  pasesDelDia.forEach(rawPase => {
    const tipo = (rawPase.tipo_permiso || '').toLowerCase();
    const obs = rawPase.observaciones || '';
    const {
      horaSalidaCaseta,
      horaEntradaCaseta,
      horaLlegadaPuerta,
      horaRetiroCaseta
    } = extraerHorasCaseta(obs);

    const esRechazado = rawPase.estado_general === 'rechazado';
    const pagoLower = (rawPase.pago || '').toLowerCase();
    const seRegresaPorDictamen = pagoLower.includes('regresa');
    const seRegresaACasa = seRegresaPorDictamen || (tipo === 'retardo' && esRechazado);

    // Guardar en mapaIncidenciasHoy para mostrar badges informativos en el Pase de Lista
    if (!mapaIncidenciasHoy[rawPase.usuario_id]) {
      if (tipo === 'vacaciones' && !esRechazado) {
        mapaIncidenciasHoy[rawPase.usuario_id] = { etiqueta: '🌴 Vacaciones', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
      } else if (tipo === 'falta' && !esRechazado) {
        mapaIncidenciasHoy[rawPase.usuario_id] = { etiqueta: '📅 Falta Justificada', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' };
      } else if (tipo === 'retardo' && seRegresaACasa) {
        mapaIncidenciasHoy[rawPase.usuario_id] = { etiqueta: '↩️ Se regresó a casa', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
      } else if (tipo === 'salida' && !esRechazado) {
        mapaIncidenciasHoy[rawPase.usuario_id] = { etiqueta: '🚪 Pase de Salida', color: '#0284c7', bg: 'rgba(2,132,199,0.12)' };
      }
    }

    // Los pases de puerta solo aplican para hoy y para Salida o Retardo
    if (fechaTarget !== hoy) return;
    if (tipo !== 'salida' && tipo !== 'retardo') return;

    // Si es una salida rechazada, no cruza puerta
    if (tipo === 'salida' && esRechazado) return;

    const yaSalio = Boolean(horaSalidaCaseta);
    const yaRegreso = Boolean(horaEntradaCaseta);
    const yaSeRetiro = Boolean(horaRetiroCaseta);
    const requiereRegreso = obs.toLowerCase().includes('regresa:');

    // En retardos: basta con que el Supervisor de Subárea haya dado VoBo, o Firma 1 esté resuelta, o ya se haya dictaminado/rechazado
    const tieneVoBoSubarea = /VoBo Sub[áa]rea:/i.test(obs);
    const f1Resuelta = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado', 'omitido'].includes(rawPase.firma_1_estado) || tieneVoBoSubarea;
    const f2Resuelta = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado', 'omitido'].includes(rawPase.firma_2_estado);

    const jefeYaDecidioRetardo =
      ['autorizado', 'aprobado', 'completado_caseta', 'rechazado'].includes(rawPase.estado_general) ||
      seRegresaPorDictamen ||
      (tipo === 'retardo' && f1Resuelta && (rawPase.firma_1_id ? true : f2Resuelta));

    let esperandoFirmaDe = 'Jefatura / RH';
    if (rawPase.firma_1_estado === 'pendiente' && rawPase.firmante1?.nombre_completo) {
      esperandoFirmaDe = rawPase.firmante1.nombre_completo;
    } else if (rawPase.firma_2_estado === 'pendiente' && rawPase.firmante2?.nombre_completo) {
      esperandoFirmaDe = rawPase.firmante2.nombre_completo;
    } else if (rawPase.firma_3_estado === 'pendiente') {
      esperandoFirmaDe = 'Recursos Humanos';
    }

    // Extraer quién dio la instrucción para mostrárselo al guardia
    let autorizadoPor = null;
    const mGer = obs.match(/VoBo Gerencia:\s*([^|]+)/i);
    const mJefe = obs.match(/VoBo Jefe:\s*([^|]+)/i);
    const mSub = obs.match(/VoBo Sub[áa]rea:\s*([^|]+)/i);
    if (mGer) autorizadoPor = mGer[1].trim();
    else if (mJefe) autorizadoPor = mJefe[1].trim();
    else if (mSub) autorizadoPor = mSub[1].trim();
    else if (rawPase.firmante1?.nombre_completo && f1Resuelta) autorizadoPor = rawPase.firmante1.nombre_completo;

    const p = {
      id: rawPase.id,
      folio: rawPase.folio,
      usuario_id: rawPase.usuario_id,
      tipo_permiso: tipo,
      pago: rawPase.pago,
      estado_general: rawPase.estado_general,
      esRechazado,
      created_at: rawPase.created_at,
      horarioProgramado: extraerHorarioProgramado(obs),
      requiereRegreso,
      seRegresaACasa,
      horaLlegadaPuerta,
      horaRetiroCaseta,
      horaSalidaCaseta,
      horaEntradaCaseta,
      esperandoFirmaDe,
      autorizadoPor,
      usuarios: {
        id: rawPase.usuarios?.id,
        numero_empleado: rawPase.usuarios?.numero_empleado,
        nombre_completo: rawPase.usuarios?.nombre_completo,
        foto_url: rawPase.usuarios?.foto_url,
        area: rawPase.usuarios?.area,
        puesto: rawPase.usuarios?.puesto,
        departamento: rawPase.usuarios?.departamentos?.nombre || ''
      }
    };

    // 1. Si ya completó su ciclo físico en caseta hoy
    if (
      rawPase.estado_general === 'completado_caseta' ||
      (tipo === 'retardo' && !seRegresaACasa && yaRegreso) ||
      (tipo === 'retardo' && seRegresaACasa && yaSeRetiro) ||
      (tipo === 'salida' && yaSalio && (!requiereRegreso || yaRegreso))
    ) {
      crucesCompletadosHoy.push(p);
      return;
    }

    // Si fue un retardo rechazado desde antes de llegar a puerta (no tiene horaLlegadaPuerta y no fue generado en caseta), no estorba en puerta
    if (tipo === 'retardo' && esRechazado && !horaLlegadaPuerta && !String(rawPase.folio || '').startsWith('CAS-')) {
      return;
    }

    // 2. Si es un retardo que AÚN NO tiene decisión del Jefe -> Retenido en Espera
    if (tipo === 'retardo' && !jefeYaDecidioRetardo) {
      retenidosEnEspera.push(p);
      return;
    }

    // 3. Si es una salida que aún está en firmas, no puede salir todavía
    if (tipo === 'salida' && rawPase.estado_general === 'en_firmas') {
      return;
    }

    // 4. Si es una salida con regreso que ya salió y está en la calle pendiente de volver
    if (tipo === 'salida' && yaSalio && requiereRegreso && !yaRegreso) {
      personalFuera.push(p);
      return;
    }

    // 5. Listo para acción inmediata en puerta (Sellar Salida, Sellar Entrada o Confirmar Retiro a Casa)
    pasesPorCruzar.push(p);
  });

  const mapaAsistencias = {};
  (resAsistencias.data || []).forEach(a => {
    mapaAsistencias[a.usuario_id] = a;
  });

  return {
    retenidosEnEspera,
    pasesPorCruzar,
    personalFuera,
    crucesCompletadosHoy,
    empleadosSede,
    mapaAsistencias,
    mapaIncidenciasHoy
  };
};

// 2. SELLAR MOVIMIENTO EN PUERTA (CONGELAR LLEGADA / ENTRADA / SALIDA / REINGRESO / RETIRO A CASA)
export const registrarCheckCaseta = async (permisoId, tipoMovimiento = 'check') => {
  const ahora = new Date();
  const horaFormateada = ahora.toTimeString().slice(0, 5);

  const { data: permiso, error: errGet } = await supabase
    .from('permisos')
    .select('id, usuario_id, tipo_permiso, estado_general, observaciones')
    .eq('id', permisoId)
    .single();

  if (errGet) throw errGet;

  const mov = (tipoMovimiento || '').toLowerCase();
  const obsActual = permiso.observaciones || '';
  const tipo = (permiso.tipo_permiso || '').toLowerCase();
  const requiereRegreso = obsActual.toLowerCase().includes('regresa:');
  const mLlegadaCongelada = obsActual.match(/\[LLEGADA EN PUERTA:\s*([^\]]+)\]/i);
  const horaCongelada = mLlegadaCongelada ? mLlegadaCongelada[1].trim() : null;

  // CASO A: El trabajador acaba de llegar a caseta y el guardia congela su hora exacta de llegada mientras espera firma
  if (mov === 'congelar_llegada') {
    if (horaCongelada) return;
    const obsConLlegada = `🕒 Llegada en puerta: ${horaFormateada} hrs | ${obsActual} | [LLEGADA EN PUERTA: ${horaFormateada} hrs]`.trim();
    const { error } = await supabase
      .from('permisos')
      .update({ observaciones: obsConLlegada })
      .eq('id', permisoId);
    if (error) throw error;
    return;
  }

  let etiquetaBitacora = `[ENTRADA CASETA: ${horaCongelada || `${horaFormateada} hrs`}]`;
  let cierraCicloCaseta = true;

  if (mov.includes('retiro')) {
    etiquetaBitacora = `[REGRESADO EN PUERTA: ${horaFormateada} hrs]`;
    cierraCicloCaseta = true;
  } else if (mov.includes('salida') || (tipo === 'salida' && !obsActual.includes('[SALIDA CASETA:'))) {
    etiquetaBitacora = `[SALIDA CASETA: ${horaFormateada} hrs]`;
    cierraCicloCaseta = !requiereRegreso;
  } else if (mov.includes('reingreso')) {
    etiquetaBitacora = `[REINGRESO CASETA: ${horaFormateada} hrs]`;
    cierraCicloCaseta = true;
  }

  const nuevasObservaciones = `${obsActual} | ${etiquetaBitacora}`.trim();
  const updates = { observaciones: nuevasObservaciones };

  // Solo cambiamos estado_general a 'completado_caseta' si ya tenía folio oficial ('autorizado' / 'aprobado').
  // Si seguía 'en_firmas', se conserva 'en_firmas' para que RH cierre la cadena y genere su folio oficial.
  if (cierraCicloCaseta && ['autorizado', 'aprobado'].includes(permiso.estado_general)) {
    updates.estado_general = 'completado_caseta';
  }

  const { error } = await supabase
    .from('permisos')
    .update(updates)
    .eq('id', permisoId);

  if (error) throw error;

  // Sincronización automática con la tabla asistencias_caseta (Pase de Lista)
  if (tipo === 'retardo' && !mov.includes('retiro')) {
    try {
      const horaLista = horaCongelada ? horaCongelada.replace(/\s*hrs/i, '').trim() : horaFormateada;
      await registrarAsistenciaListaConHora(permiso.usuario_id, 'entrada', horaLista);
    } catch (_) {}
  } else if (tipo === 'salida' && mov.includes('salida') && !requiereRegreso) {
    // Si es una Salida Definitiva, marcamos su hora de salida en el Pase de Lista
    try {
      await registrarAsistenciaListaConHora(permiso.usuario_id, 'salida', horaFormateada);
    } catch (_) {}
  }
};

const registrarAsistenciaListaConHora = async (usuarioId, tipoMarca, horaEspecifica) => {
  const hoy = obtenerFechaLocalHoy();
  const { data: existente } = await supabase
    .from('asistencias_caseta')
    .select('id, hora_entrada, hora_salida')
    .eq('usuario_id', usuarioId)
    .eq('fecha', hoy)
    .maybeSingle();

  if (!existente) {
    await supabase.from('asistencias_caseta').insert([{
      usuario_id: usuarioId,
      fecha: hoy,
      hora_entrada: tipoMarca === 'entrada' ? horaEspecifica : null,
      hora_salida: tipoMarca === 'salida' ? horaEspecifica : null
    }]);
  } else if (tipoMarca === 'entrada' && !existente.hora_entrada) {
    await supabase
      .from('asistencias_caseta')
      .update({ hora_entrada: horaEspecifica })
      .eq('id', existente.id);
  } else if (tipoMarca === 'salida' && !existente.hora_salida) {
    await supabase
      .from('asistencias_caseta')
      .update({ hora_salida: horaEspecifica })
      .eq('id', existente.id);
  }
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

// 4. APOYO EN CASETA: CONGELA HORA DE LLEGADA EN PUERTA Y LO DEJA RETENIDO EN ESPERA DE AUTORIZACIÓN
export const registrarRetardoEnPuerta = async (usuarioId) => {
  const ahora = new Date();
  const fechaHoy = obtenerFechaLocalHoy();
  const horaActual = ahora.toTimeString().slice(0, 5);

  // Evitar duplicar un retardo si el trabajador ya tiene uno activo hoy en puerta
  const { data: retardoExistente } = await supabase
    .from('permisos')
    .select('id, folio')
    .eq('usuario_id', usuarioId)
    .eq('fecha_permiso', fechaHoy)
    .eq('tipo_permiso', 'retardo')
    .in('estado_general', ['en_firmas', 'autorizado', 'aprobado'])
    .limit(1);

  if (retardoExistente && retardoExistente.length > 0) {
    throw new Error(`Este colaborador ya tiene un pase de retardo activo hoy (${retardoExistente[0].folio}). Revísalo en la pestaña de Pases de Puerta.`);
  }

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

  let firma1Id = null;

  if (user.reporta_a_id) {
    const { data: supDirecto } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', user.reporta_a_id)
      .maybeSingle();

    if (supDirecto && supDirecto.activo && ['encargado', 'jefe_area', 'rh_nominas'].includes(supDirecto.rol)) {
      firma1Id = supDirecto.id;
    }
  }

  if (!firma1Id) {
    const mandoMismaSubarea =
      mandosEnDepto.find(j => j.rol === 'encargado' && (j.area || '').trim().toUpperCase() === areaSolicitante) ||
      mandosEnDepto.find(j => j.rol === 'jefe_area' && (j.area || '').trim().toUpperCase() === areaSolicitante);

    if (mandoMismaSubarea) {
      firma1Id = mandoMismaSubarea.id;
    } else if (depto?.jefe_id && depto.jefe_id !== user.id) {
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
      observaciones: `🕒 Llegada en puerta: ${horaActual} hrs | [LLEGADA EN PUERTA: ${horaActual} hrs]`,
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
      titulo: '⏳ TRABAJADOR EN CASETA (RETARDO)',
      mensaje: `👤 ${user.nombre_completo}\n🕒 Llegada congelada en puerta: ${horaActual} hrs\nEsperando tu instrucción para dar acceso o regresar a casa.`,
      fotoUrl: user.foto_url,
      urlDestino: '/aprobaciones'
    });
  }
};
