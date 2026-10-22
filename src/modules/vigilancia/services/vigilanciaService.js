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

// =========================================================================
// CONFIGURACIÓN DINÁMICA DE HORA LÍMITE DE TOLERANCIA (CONTROL EXCLUSIVO RH)
// Se sincroniza usando la tabla sedes (o fallback en localStorage) para que
// cualquier cambio hecho por RH aplique en todos los dispositivos de caseta.
// =========================================================================
export const obtenerHoraLimiteTolerancia = async () => {
  try {
    const { data } = await supabase
      .from('notificaciones')
      .select('mensaje')
      .eq('titulo', '__CONFIG_TOLERANCIA_CASETA__')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.mensaje && /^\d{2}:\d{2}$/.test(data.mensaje.trim())) {
      const h = data.mensaje.trim();
      localStorage.setItem('hora_limite_retardo_rh', h);
      return h;
    }
  } catch (_) {}

  const local = localStorage.getItem('hora_limite_retardo_rh');
  if (local && /^\d{2}:\d{2}$/.test(local)) return local;
  return '07:15';
};

export const guardarHoraLimiteTolerancia = async (nuevaHora, usuarioId) => {
  const limpia = (nuevaHora || '07:15').trim();
  localStorage.setItem('hora_limite_retardo_rh', limpia);

  try {
    // Limpiar configuraciones previas y guardar la nueva para todos los dispositivos
    await supabase
      .from('notificaciones')
      .delete()
      .eq('titulo', '__CONFIG_TOLERANCIA_CASETA__');

    if (usuarioId) {
      await supabase
        .from('notificaciones')
        .insert([{
          usuario_id: usuarioId,
          titulo: '__CONFIG_TOLERANCIA_CASETA__',
          mensaje: limpia,
          tipo: 'sistema',
          leida: true
        }]);
    }
  } catch (e) {
    console.warn('Guardado en modo local:', e.message);
  }
  return limpia;
};

export const cancelarPasePorInasistenciaOCambio = async (permisoId, motivoCancelacion = 'El colaborador no utilizó el pase o nunca se presentó en caseta') => {
  const ahora = new Date();
  const horaStr = ahora.toTimeString().slice(0, 5);

  const { data: perm, error: errFetch } = await supabase
    .from('permisos')
    .select('*')
    .eq('id', permisoId)
    .single();

  if (errFetch || !perm) throw new Error('No se encontró el pase.');

  const obsActuales = perm.observaciones ? perm.observaciones.trim() : '';
  const selloCancel = `[PASE CANCELADO (${horaStr} hrs): ${motivoCancelacion}]`;
  const nuevasObs = obsActuales ? `${obsActuales} | ${selloCancel}` : selloCancel;

  const { data, error } = await supabase
    .from('permisos')
    .update({
      estado_general: 'cancelado',
      observaciones: nuevasObs
    })
    .eq('id', permisoId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const registrarRetardoEnPuerta = async (empleadoId) => {
  const hoyStr = obtenerFechaLocalHoy();
  const ahora = new Date();
  const horaCongelada = ahora.toTimeString().slice(0, 5);

  const { data: existentes } = await supabase
    .from('permisos')
    .select('id, estado_general, observaciones')
    .eq('usuario_id', empleadoId)
    .eq('tipo_permiso', 'retardo')
    .gte('fecha_inicio', `${hoyStr}T00:00:00`)
    .lte('fecha_inicio', `${hoyStr}T23:59:59`)
    .in('estado_general', ['en_firmas', 'autorizado', 'aprobado', 'completado_caseta']);

  if (existentes && existentes.length > 0) {
    const existente = existentes[0];
    if (existente.estado_general === 'en_firmas') {
      await registrarCheckCaseta(existente.id, 'congelar_llegada');
      return { modo: 'en_espera_rh', id: existente.id };
    }
    if (existente.estado_general === 'autorizado' || existente.estado_general === 'aprobado') {
      const seRegresa = String(existente.observaciones || '').toLowerCase().includes('se regresa');
      if (seRegresa) {
        return { modo: 'se_regresa', id: existente.id };
      }
      await registrarCheckCaseta(existente.id, 'entrada');
      return { modo: 'entrada_registrada', id: existente.id };
    }
  }

  const { data: emp, error: errEmp } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, rol, sede_id, departamento_id, area_id, subarea_id, sin_celular')
    .eq('id', empleadoId)
    .single();

  if (errEmp || !emp) throw new Error('No se encontró la información del colaborador.');

  const { data: candidatos } = await supabase
    .from('usuarios')
    .select('id, rol, sede_id, departamento_id, area_id, subarea_id')
    .eq('activo', true);

  const todos = candidatos || [];
  let firma1 = null;
  let firma2 = null;
  let firmaRH = null;

  if (emp.subarea_id) {
    const sup = todos.find(u => u.rol === 'supervisor_subarea' && String(u.subarea_id) === String(emp.subarea_id));
    if (sup && sup.id !== emp.id) firma1 = sup.id;
  }
  if (!firma1 && emp.area_id) {
    const jefe = todos.find(u => u.rol === 'jefe_area' && String(u.area_id) === String(emp.area_id));
    if (jefe && jefe.id !== emp.id) firma1 = jefe.id;
  }
  if (emp.departamento_id) {
    const ger = todos.find(u => u.rol === 'gerente_division' && String(u.departamento_id) === String(emp.departamento_id));
    if (ger && ger.id !== emp.id) {
      if (!firma1) firma1 = ger.id;
      else if (ger.id !== firma1) firma2 = ger.id;
    }
  }

  const rhSede = todos.find(u => (u.rol === 'gerente_rh' || u.rol === 'rh_nominas') && String(u.sede_id) === String(emp.sede_id));
  const rhGlobal = todos.find(u => u.rol === 'gerente_rh' || u.rol === 'rh_nominas');
  firmaRH = rhSede?.id || rhGlobal?.id || null;

  if (!firma1 && firmaRH) {
    firma1 = firmaRH;
  }

  const folio = `RET-${Math.floor(100000 + Math.random() * 900000)}`;
  const observaciones = `🕒 Llegada en puerta: ${horaCongelada} hrs | [LLEGADA EN PUERTA: ${horaCongelada} hrs] | Registro automático en caseta`;

  const payload = {
    folio,
    usuario_id: emp.id,
    tipo_permiso: 'retardo',
    naturaleza: 'Solicitado en Caseta',
    motivo: 'Llegada posterior al cierre de entrada. En espera de veredicto de RH / Jefatura.',
    observaciones,
    fecha_inicio: `${hoyStr}T${horaCongelada}:00`,
    fecha_fin: `${hoyStr}T${horaCongelada}:00`,
    dias_solicitados: 0,
    con_goce: false,
    estado_general: 'en_firmas',
    firma_1_id: firma1,
    firma_1_estado: firma1 ? 'pendiente' : 'no_requerida',
    firma_2_id: firma2,
    firma_2_estado: firma2 ? 'pendiente' : 'no_requerida',
    firma_rh_id: firmaRH,
    firma_rh_estado: 'pendiente'
  };

  const { data: creado, error: errInsert } = await supabase
    .from('permisos')
    .insert([payload])
    .select()
    .single();

  if (errInsert) throw errInsert;

  const destinatariosSet = new Set();
  if (firma1) destinatariosSet.add(firma1);
  if (firma2) destinatariosSet.add(firma2);
  if (firmaRH) destinatariosSet.add(firmaRH);
  todos
    .filter(u => (u.rol === 'gerente_rh' || u.rol === 'rh_nominas') && (!emp.sede_id || String(u.sede_id) === String(emp.sede_id)))
    .forEach(u => destinatariosSet.add(u.id));

  for (const destId of destinatariosSet) {
    await enviarNotificacion({
      usuario_id: destId,
      titulo: '⏳ En puerta esperando veredicto',
      mensaje: `${emp.nombre_completo} se encuentra en caseta (${horaCongelada} hrs). Autoriza su entrada o indica si se regresa.`,
      tipo: 'solicitud',
      permiso_id: creado.id
    });
  }

  return { modo: 'en_espera_rh', permiso: creado };
};

export const deshacerSalidaReciente = async (usuarioId) => {
  const hoyStr = obtenerFechaLocalHoy();
  const { data: reg } = await supabase
    .from('asistencias_caseta')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('fecha', hoyStr)
    .maybeSingle();

  if (reg) {
    await supabase.from('asistencias_caseta').update({ hora_salida: null }).eq('id', reg.id);
  }
  return { ok: true };
};

export const deshacerEntradaReciente = async (usuarioId) => {
  const hoyStr = obtenerFechaLocalHoy();
  const { data: reg } = await supabase
    .from('asistencias_caseta')
    .select('id, hora_salida')
    .eq('usuario_id', usuarioId)
    .eq('fecha', hoyStr)
    .maybeSingle();

  if (reg && !reg.hora_salida) {
    await supabase.from('asistencias_caseta').delete().eq('id', reg.id);
  }
  return { ok: true };
};

export const registrarAsistenciaLista = async (usuarioId, tipoMarca = 'entrada', guardiaId = null, forzarDirectoRH = false) => {
  const hoyStr = obtenerFechaLocalHoy();
  const ahora = new Date();
  const horaActual = ahora.toTimeString().slice(0, 5);
  const minutosDelDia = ahora.getHours() * 60 + ahora.getMinutes();

  // Obtener la hora límite configurada por RH (por defecto 07:15)
  const horaLimiteStr = await obtenerHoraLimiteTolerancia();
  const [hLim, mLim] = horaLimiteStr.split(':').map(Number);
  const LIMITE_TOLERANCIA_MINUTOS = (isNaN(hLim) ? 7 : hLim) * 60 + (isNaN(mLim) ? 15 : mLim);

  if (tipoMarca === 'entrada') {
    const { data: pasesHoy } = await supabase
      .from('permisos')
      .select('id, tipo_permiso, estado_general, observaciones')
      .eq('usuario_id', usuarioId)
      .gte('fecha_inicio', `${hoyStr}T00:00:00`)
      .lte('fecha_inicio', `${hoyStr}T23:59:59`)
      .in('estado_general', ['en_firmas', 'autorizado', 'aprobado', 'completado_caseta']);

    const retardoHoy = (pasesHoy || []).find(p => (p.tipo_permiso || '').toLowerCase() === 'retardo');
    const faltaHoy = (pasesHoy || []).find(p => (p.tipo_permiso || '').toLowerCase() === 'falta');

    // CASO ESPECIAL 1: El colaborador había pedido permiso de Retardo (o Falta), pero SÍ llegó temprano (<= hora límite) o RH forzó su entrada puntual
    if (minutosDelDia <= LIMITE_TOLERANCIA_MINUTOS || forzarDirectoRH) {
      if (retardoHoy && retardoHoy.estado_general !== 'completado_caseta') {
        await cancelarPasePorInasistenciaOCambio(
          retardoHoy.id,
          `Asistió en horario normal (${horaActual} hrs) — Retardo sin efecto`
        );
      }
      if (faltaHoy) {
        await cancelarPasePorInasistenciaOCambio(
          faltaHoy.id,
          `El colaborador sí se presentó a laborar (${horaActual} hrs)`
        );
      }
    } else {
      // CASO 2: Llegó después de la hora límite (> 07:15 o la hora fijada por RH)
      if (faltaHoy) {
        await cancelarPasePorInasistenciaOCambio(
          faltaHoy.id,
          `El colaborador se presentó en planta (${horaActual} hrs)`
        );
      }

      if (retardoHoy) {
        const obsLow = String(retardoHoy.observaciones || '').toLowerCase();
        if (obsLow.includes('se regresa')) {
          return { resultado: 'se_regresa', id: retardoHoy.id };
        }
        if (retardoHoy.estado_general === 'autorizado' || retardoHoy.estado_general === 'aprobado') {
          await registrarCheckCaseta(retardoHoy.id, 'entrada');
          return { resultado: 'entrada_registrada' };
        }
        if (retardoHoy.estado_general === 'en_firmas') {
          await registrarCheckCaseta(retardoHoy.id, 'congelar_llegada');
          return { resultado: 'en_espera_rh', id: retardoHoy.id };
        }
      }

      // No tenía pase previo autorizado -> Poner automáticamente en espera de veredicto de RH
      const resp = await registrarRetardoEnPuerta(usuarioId);
      return { resultado: resp.modo || 'en_espera_rh' };
    }
  }

  if (tipoMarca === 'salida') {
    const { data: pasesSalida } = await supabase
      .from('permisos')
      .select('id, observaciones')
      .eq('usuario_id', usuarioId)
      .eq('tipo_permiso', 'salida')
      .in('estado_general', ['autorizado', 'aprobado'])
      .gte('fecha_inicio', `${hoyStr}T00:00:00`)
      .lte('fecha_inicio', `${hoyStr}T23:59:59`);

    if (pasesSalida && pasesSalida.length > 0) {
      const paseDef = pasesSalida.find(ps => !String(ps.observaciones || '').toLowerCase().includes('regresa:'));
      if (paseDef && !/\[SALIDA CASETA:/i.test(paseDef.observaciones || '')) {
        await registrarCheckCaseta(paseDef.id, 'salida');
        return { resultado: 'salida_registrada' };
      }
    }
  }

  const { data: existente } = await supabase
    .from('asistencias_caseta')
    .select('*')
    .eq('usuario_id', usuarioId)
    .eq('fecha', hoyStr)
    .maybeSingle();

  if (existente) {
    const cambios = {};
    if (tipoMarca === 'entrada' && !existente.hora_entrada) cambios.hora_entrada = horaActual;
    if (tipoMarca === 'salida') cambios.hora_salida = horaActual;

    const { data, error } = await supabase
      .from('asistencias_caseta')
      .update(cambios)
      .eq('id', existente.id)
      .select()
      .single();

    if (error) throw error;
    return { resultado: 'ok', data };
  } else {
    const nuevo = {
      usuario_id: usuarioId,
      fecha: hoyStr,
      hora_entrada: tipoMarca === 'entrada' ? horaActual : null,
      hora_salida: tipoMarca === 'salida' ? horaActual : null,
      registrado_por: guardiaId
    };

    const { data, error } = await supabase
      .from('asistencias_caseta')
      .insert([nuevo])
      .select()
      .single();

    if (error) throw error;
    return { resultado: 'ok', data };
  }
};
