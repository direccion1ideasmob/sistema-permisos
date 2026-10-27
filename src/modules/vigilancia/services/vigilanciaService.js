import { compararPorApellidoPaterno } from '../../../core/utils/ordenNombre';
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
  await sincronizarCierreTurnoAutomatico();
  const hoy = obtenerFechaLocalHoy();
  const fechaTarget = fechaConsulta || hoy;

  let queryEmpleados = supabase
    .from('usuarios')
    .select('id, numero_empleado, nombre_completo, nombre, apellido_paterno, apellido_materno, foto_url, area, puesto, sede_id, activo, rol, departamentos:departamento_id (nombre)')
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
        usuarios:usuario_id (id, numero_empleado, nombre_completo, nombre, apellido_paterno, apellido_materno, foto_url, area, puesto, sede_id, departamentos:departamento_id (nombre)),
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

  const empleadosSede = (resEmpleados.data || []).slice().sort((a, b) => compararPorApellidoPaterno(a, b));
  const idsSede = new Set(empleadosSede.map(e => e.id));

  // Filtrar permisos que correspondan a la sede y a la fecha consultada (o rango de vacaciones)
  const pasesDelDia = (resPermisos.data || []).filter(p => {
    const perteneceSede = !sedeId || p.usuarios?.sede_id === sedeId || idsSede.has(p.usuario_id);
    if (!perteneceSede) return false;
    const pagoL = String(p.pago || '').toLowerCase();
    const obsL = String(p.observaciones || '');
    if (pagoL === 'cancelado' || /CANCELADO por/i.test(obsL) || /\[PASE CANCELADO/i.test(obsL)) return false;
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

    // Calcular estado de firmas y quién tiene el turno o quién autorizó
    const yaSalio = Boolean(horaSalidaCaseta);
    const yaRegreso = Boolean(horaEntradaCaseta);
    const yaSeRetiro = Boolean(horaRetiroCaseta);
    const requiereRegreso = obs.toLowerCase().includes('regresa:');

    const tieneVoBoSubarea = /VoBo Sub[áa]rea:/i.test(obs);
    const f1Resuelta = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado', 'omitido'].includes(rawPase.firma_1_estado) || tieneVoBoSubarea;
    const f2Resuelta = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado', 'omitido'].includes(rawPase.firma_2_estado);

    const jefeYaDecidioRetardo =
      ['autorizado', 'aprobado', 'completado_caseta', 'rechazado'].includes(rawPase.estado_general) ||
      seRegresaPorDictamen;

    let esperandoFirmaDe = 'Jefatura / RH';
    if (rawPase.firma_1_estado === 'pendiente' && rawPase.firmante1?.nombre_completo) {
      esperandoFirmaDe = rawPase.firmante1.nombre_completo;
    } else if (rawPase.firma_2_estado === 'pendiente' && rawPase.firmante2?.nombre_completo) {
      esperandoFirmaDe = rawPase.firmante2.nombre_completo;
    } else if (rawPase.firma_3_estado === 'pendiente') {
      esperandoFirmaDe = 'Recursos Humanos';
    }

    let autorizadoPor = null;
    const mGer = obs.match(/VoBo Gerencia:\s*([^|]+)/i);
    const mJefe = obs.match(/VoBo Jefe:\s*([^|]+)/i);
    const mSub = obs.match(/VoBo Sub[áa]rea:\s*([^|]+)/i);
    if (mGer) autorizadoPor = mGer[1].trim();
    else if (mJefe) autorizadoPor = mJefe[1].trim();
    else if (mSub) autorizadoPor = mSub[1].trim();
    else if (rawPase.firmante1?.nombre_completo && f1Resuelta) autorizadoPor = rawPase.firmante1.nombre_completo;

    // Guardar en mapaIncidenciasHoy con su 'tipo' exacto para que Caseta.jsx lo muestre siempre
    if (!mapaIncidenciasHoy[rawPase.usuario_id]) {
      if (tipo === 'vacaciones' && !esRechazado) {
        mapaIncidenciasHoy[rawPase.usuario_id] = {
          tipo: 'ausencia_autorizada',
          paseId: rawPase.id,
          etiqueta: '🏖️ Vacaciones',
          color: '#10b981',
          bg: 'rgba(16,185,129,0.12)'
        };
      } else if (tipo === 'falta' && !esRechazado && !seRegresaACasa) {
        mapaIncidenciasHoy[rawPase.usuario_id] = {
          tipo: 'ausencia_autorizada',
          paseId: rawPase.id,
          etiqueta: '📋 Falta',
          color: '#8b5cf6',
          bg: 'rgba(139,92,246,0.12)'
        };
      } else if (tipo === 'retardo' || seRegresaACasa) {
        if (seRegresaACasa) {
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: 'retardo_regresa',
            paseId: rawPase.id,
            yaSeRetiroACasa: yaSeRetiro,
            etiqueta: yaSeRetiro ? '↩️ Se retiró' : '🚫 ACCESO DENEGADO — SE RETIRA',
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.14)'
          };
        } else if (!jefeYaDecidioRetardo) {
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: 'retardo_en_espera',
            paseId: rawPase.id,
            esperandoFirmaDe,
            horaLlegadaPuerta,
            etiqueta: `⏳ Esperando a: ${esperandoFirmaDe}`,
            color: '#d97706',
            bg: 'rgba(245,158,11,0.14)'
          };
        } else {
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: 'retardo_autorizado',
            paseId: rawPase.id,
            autorizadoPor: autorizadoPor || 'Jefatura / RH',
            dictamen: rawPase.pago || 'Autorizado',
            yaEntro: yaRegreso,
            etiqueta: '✅ ACCESO AUTORIZADO — DAR PASO',
            color: '#16a34a',
            bg: 'rgba(22,163,74,0.16)'
          };
        }
      } else if (tipo === 'salida' && !esRechazado) {
        const estaFuera = yaSalio && requiereRegreso && !yaRegreso;
        mapaIncidenciasHoy[rawPase.usuario_id] = {
          tipo: estaFuera ? 'salida_fuera' : 'salida_autorizada',
          paseId: rawPase.id,
          etiqueta: estaFuera ? '🔵 Fuera (Pendiente reingreso)' : '🔵 Pase de Salida',
          color: '#0284c7',
          bg: 'rgba(2,132,199,0.12)'
        };
      }
    }

    // Los pases de puerta solo aplican para hoy y para Salida o Retardo
    if (fechaTarget !== hoy) return;
    if (tipo !== 'salida' && tipo !== 'retardo' && !seRegresaACasa) return;

    // Si es una salida rechazada o cancelada, o si el empleado ya fue regresado a casa hoy en un retardo, no cruza puerta como salida
    if (tipo === 'salida' && (esRechazado || pagoLower === 'cancelado')) return;
    const fueRegresadoHoy = pasesDelDia.some(otro =>
      otro.usuario_id === rawPase.usuario_id &&
      ((otro.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(otro.observaciones || ''))
    );
    if (tipo === 'salida' && fueRegresadoHoy) return;

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
      (seRegresaACasa && yaSeRetiro) ||
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

    // 3. Si es una salida que fue retenida en puerta porque no coincidió la hora de regreso/salida -> Retenido en Espera
    if (tipo === 'salida' && rawPase.estado_general === 'en_firmas') {
      if (/\[HORARIO NO COINCIDE EN CASETA/i.test(obs)) {
        retenidosEnEspera.push(p);
      }
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

  const ordenarPasesPorApellido = (arr) => arr.sort((a, b) => compararPorApellidoPaterno(a.usuarios || a.nombre_completo, b.usuarios || b.nombre_completo));
  ordenarPasesPorApellido(retenidosEnEspera);
  ordenarPasesPorApellido(pasesPorCruzar);
  ordenarPasesPorApellido(personalFuera);
  ordenarPasesPorApellido(crucesCompletadosHoy);

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


export const solicitarReautorizacionHorarioSalida = async (permisoId, tipoMovimiento = 'reingreso', detalleDesfase = '') => {
  const ahora = new Date();
  const horaFormateada = ahora.toTimeString().slice(0, 5);

  const { data: permiso, error: errGet } = await supabase
    .from('permisos')
    .select('*, usuarios:usuario_id (id, nombre_completo, foto_url, departamento_id)')
    .eq('id', permisoId)
    .single();

  if (errGet || !permiso) throw new Error('No se encontró el pase.');

  const obsActual = permiso.observaciones || '';
  const notaDesfase = `⚠️ [HORARIO NO COINCIDE EN CASETA (${horaFormateada} hrs): ${detalleDesfase} — Retenido en puerta para nueva autorización]`;
  const nuevasObs = `${obsActual} | ${notaDesfase} | [LLEGADA EN PUERTA: ${horaFormateada} hrs]`.trim();

  // Reabrir firma de RH (y Jefe si aplica) para que autoricen el exceso de tiempo antes de dejarlo pasar
  const updates = {
    estado_general: 'en_firmas',
    firma_3_estado: 'pendiente',
    observaciones: nuevasObs
  };

  const { error } = await supabase
    .from('permisos')
    .update(updates)
    .eq('id', permisoId);

  if (error) throw error;

  const { data: rhUsers } = await supabase
    .from('usuarios')
    .select('id')
    .in('rol', ['gerente_rh', 'rh_nominas'])
    .eq('activo', true);

  const dest = [
    ...(rhUsers || []).map(u => u.id),
    permiso.firma_1_id
  ].filter(Boolean);

  if (dest.length > 0) {
    try {
      await enviarNotificacionPushUsuarios([...new Set(dest)], {
        titulo: '🚨 HORARIO DE PASE NO COINCIDE EN CASETA',
        mensaje: `👤 ${permiso.usuarios?.nombre_completo || 'Colaborador'}\n🕒 ${detalleDesfase}\n⏳ Retenido en Vigilancia esperando tu autorización para pasar.`,
        fotoUrl: permiso.usuarios?.foto_url || null,
        urlDestino: '/aprobaciones'
      });
    } catch (_) {}
  }

  return { resultado: 'retenido_por_horario', detalleDesfase };
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

  // VALIDACIÓN DE COINCIDENCIA DE HORAS EN PASE DE SALIDA Y REGRESO (Si no trae flag 'forzado')
  if (tipo === 'salida' && !mov.includes('forzado') && !/\[HORARIO NO COINCIDE EN CASETA/i.test(obsActual)) {
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    if (mov.includes('reingreso')) {
      const mRegresa = obsActual.match(/Regresa:\s*(\d{1,2}):(\d{2})/i);
      if (mRegresa) {
        const minRegresoPactado = parseInt(mRegresa[1], 10) * 60 + parseInt(mRegresa[2], 10);
        const minExceso = minAhora - minRegresoPactado;
        if (minExceso > 15) {
          const hPactada = `${String(mRegresa[1]).padStart(2, '0')}:${mRegresa[2]}`;
          return await solicitarReautorizacionHorarioSalida(
            permisoId,
            'reingreso',
            `Regresó a las ${horaFormateada} hrs (Hora límite autorizada: ${hPactada} hrs, +${minExceso} min tarde)`
          );
        }
      }
    }
  }
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
    const { data, error } = await supabase
      .from('configuracion_caseta')
      .select('valor')
      .eq('clave', 'hora_limite_tolerancia')
      .maybeSingle();

    if (!error && data?.valor && /^\d{2}:\d{2}$/.test(data.valor.trim())) {
      localStorage.setItem('hora_limite_retardo_rh', data.valor.trim());
      return data.valor.trim();
    }
  } catch (_) {}
  return localStorage.getItem('hora_limite_retardo_rh') || '07:15';
};

export const guardarHoraLimiteTolerancia = async (nuevaHora) => {
  const limpia = (nuevaHora || '07:15').trim();
  localStorage.setItem('hora_limite_retardo_rh', limpia);
  try {
    await supabase
      .from('configuracion_caseta')
      .upsert([{ clave: 'hora_limite_tolerancia', valor: limpia, updated_at: new Date().toISOString() }], { onConflict: 'clave' });
  } catch (_) {}
  return limpia;
};

export const obtenerHoraSalidaOficial = async () => {
  try {
    const { data, error } = await supabase
      .from('configuracion_caseta')
      .select('valor')
      .eq('clave', 'hora_salida_oficial')
      .maybeSingle();

    if (!error && data?.valor && /^\d{2}:\d{2}$/.test(data.valor.trim())) {
      localStorage.setItem('hora_salida_oficial_rh', data.valor.trim());
      return data.valor.trim();
    }
  } catch (_) {}
  return localStorage.getItem('hora_salida_oficial_rh') || '17:00';
};

export const guardarHoraSalidaOficial = async (nuevaHora) => {
  const limpia = (nuevaHora || '17:00').trim();
  localStorage.setItem('hora_salida_oficial_rh', limpia);
  try {
    await supabase
      .from('configuracion_caseta')
      .upsert([{ clave: 'hora_salida_oficial', valor: limpia, updated_at: new Date().toISOString() }], { onConflict: 'clave' });
  } catch (_) {}
  return limpia;
};

export const sincronizarCierreTurnoAutomatico = async () => {
  try {
    const hoy = obtenerFechaLocalHoy();
    const ahora = new Date();
    const minActuales = ahora.getHours() * 60 + ahora.getMinutes();

    const horaSalidaStr = await obtenerHoraSalidaOficial();
    const [hSal, mSal] = (horaSalidaStr || '17:00').split(':').map(Number);
    const minSalidaOficial = (isNaN(hSal) ? 17 : hSal) * 60 + (isNaN(mSal) ? 0 : mSal);
    const turnoHoyConcluido = minActuales >= minSalidaOficial;

    // Consultar permisos de retardo y salida de los últimos 10 días que ya debieron concluir
    const hace10 = new Date(ahora);
    hace10.setDate(ahora.getDate() - 10);
    const fechaMin = hace10.toISOString().split('T')[0];

    const [{ data: pases }, { data: asistencias }] = await Promise.all([
      supabase
        .from('permisos')
        .select('id, folio, usuario_id, fecha_permiso, tipo_permiso, estado_general, pago, observaciones, total_horas, usuarios:usuario_id (tipo_personal, departamentos:departamento_id (clasificacion))')
        .gte('fecha_permiso', fechaMin)
        .lte('fecha_permiso', hoy)
        .in('tipo_permiso', ['retardo', 'salida'])
        .in('estado_general', ['en_firmas', 'autorizado', 'aprobado', 'completado_caseta']),
      supabase
        .from('asistencias_caseta')
        .select('usuario_id, fecha, hora_entrada, hora_salida')
        .gte('fecha', fechaMin)
        .lte('fecha', hoy)
    ]);

    if (!pases || pases.length === 0) return;

    const mapaAsist = new Map();
    (asistencias || []).forEach(a => {
      mapaAsist.set(`${a.usuario_id}_${a.fecha}`, a);
    });

    for (const p of pases) {
      const fPase = String(p.fecha_permiso || '').slice(0, 10);
      const diaCerrado = fPase < hoy || (fPase === hoy && turnoHoyConcluido);
      if (!diaCerrado) continue;

      const obs = String(p.observaciones || '');
      const pagoLow = String(p.pago || '').toLowerCase();
      if (pagoLow === 'cancelado' || /CANCELADO por/i.test(obs)) continue;

      const tipo = (p.tipo_permiso || '').toLowerCase();
      const regAsist = mapaAsist.get(`${p.usuario_id}_${fPase}`);
      const { horaSalidaCaseta, horaEntradaCaseta, horaLlegadaPuerta, horaRetiroCaseta } = extraerHorasCaseta(obs);

      // CASO 1 (OPCIÓN B): Pidió RETARDO pero terminó el turno y NUNCA llegó a planta -> Convertir a FALTA (Sin goce)
      if (tipo === 'retardo') {
        const seRegreso = pagoLow.includes('regresa') || Boolean(horaRetiroCaseta);
        const siLlego = Boolean(horaEntradaCaseta || horaLlegadaPuerta || regAsist?.hora_entrada);
        if (!seRegreso && !siLlego) {
          const nuevaObs = `${obs} | [Convertido a Falta: Solicitó retardo pero no se presentó en todo el turno]`.replace(/^\s*\|\s*/, '');
          let folioFinal = p.folio;
          if (String(p.folio || '').startsWith('REQ-')) {
            const nominaEmp = (p.usuarios?.tipo_personal || p.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
            const pref = nominaEmp.includes('admin') ? 'A' : (nominaEmp.includes('obra') ? 'O' : 'P');
            const anio2 = new Date().getFullYear().toString().slice(-2);
            const { data: ult } = await supabase.from('permisos').select('folio').ilike('folio', `${pref}-${anio2}-%`).order('created_at', { ascending: false }).limit(1);
            let cons = 1;
            if (ult && ult[0]?.folio) {
              const num = parseInt(ult[0].folio.split('-')[2], 10);
              if (!isNaN(num)) cons = num + 1;
            }
            folioFinal = `${pref}-${anio2}-${String(cons).padStart(4, '0')}`;
          }
          await supabase
            .from('permisos')
            .update({
              folio: folioFinal,
              tipo_permiso: 'falta',
              pago: 'Sin goce de sueldo',
              total_horas: 8,
              estado_general: 'autorizado',
              observaciones: nuevaObs
            })
            .eq('id', p.id);
        }
      }

      // CASO 2: Pidió SALIDA CON REGRESO, sí salió por caseta, pero terminó el turno y NUNCA regresó -> Cerrar como Salida Definitiva
      if (tipo === 'salida') {
        const pediaRegreso = obs.toLowerCase().includes('regresa:');
        if (pediaRegreso && horaSalidaCaseta && !horaEntradaCaseta && !/\[No reingres[óo] a planta/i.test(obs)) {
          const mHoraSal = horaSalidaCaseta.replace(/\s*hrs/i, '').trim();
          const [hS, mS] = mHoraSal.split(':').map(Number);
          let nuevasHoras = p.total_horas || 0;
          if (!isNaN(hS) && !isNaN(mS)) {
            const diff = (minSalidaOficial - (hS * 60 + mS)) / 60;
            if (diff > 0) nuevasHoras = parseFloat(diff.toFixed(2));
          }
          const obsSinRegresa = obs.replace(/\(Regresa:\s*[^)]+\)/ig, '(Sin reingreso — Fin de turno)');
          const nuevaObs = `${obsSinRegresa} | [No reingresó a planta — Salida definitiva: ${mHoraSal} hrs]`;

          await supabase
            .from('permisos')
            .update({
              total_horas: nuevasHoras,
              estado_general: 'completado_caseta',
              observaciones: nuevaObs
            })
            .eq('id', p.id);

          // Asegurar que su hora de salida quede asentada en asistencias_caseta de ese día
          if (!regAsist) {
            await supabase.from('asistencias_caseta').insert([{
              usuario_id: p.usuario_id,
              fecha: fPase,
              hora_entrada: null,
              hora_salida: mHoraSal
            }]);
          } else if (!regAsist.hora_salida) {
            await supabase.from('asistencias_caseta').update({ hora_salida: mHoraSal }).eq('usuario_id', p.usuario_id).eq('fecha', fPase);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Aviso en sincronización automática de fin de turno:', err);
  }
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
      estado_general: 'rechazado',
      pago: 'Cancelado',
      observaciones: nuevasObs
    })
    .eq('id', permisoId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const registrarRetardoEnPuerta = async (usuarioId, guardiaId = null, motivoEspecial = null) => {
  const hoyStr = obtenerFechaLocalHoy();
  const ahora = new Date();
  const horaActual = ahora.toTimeString().slice(0, 5);

  const { data: emp, error: errEmp } = await supabase
    .from('usuarios')
    .select('id, nombre_completo, rol, area, reporta_a_id, tipo_personal, foto_url, departamento_id, sede_id')
    .eq('id', usuarioId)
    .maybeSingle();

  if (errEmp || !emp) throw new Error('No se encontró la información del colaborador.');

  // 1. Verificar si ya tiene un permiso hoy (retardo activo, falta por regreso a casa o ausencia)
  const { data: pasesHoyCheck } = await supabase
    .from('permisos')
    .select('*')
    .eq('usuario_id', usuarioId)
    .lte('fecha_permiso', hoyStr)
    .in('estado_general', ['en_firmas', 'autorizado', 'aprobado', 'completado_caseta']);

  const activosHoy = (pasesHoyCheck || []).filter(p => {
    const fin = p.fecha_fin || p.fecha_permiso;
    if (!(p.fecha_permiso <= hoyStr && fin >= hoyStr)) return false;
    const pagoL = String(p.pago || '').toLowerCase();
    const obsL = String(p.observaciones || '');
    return pagoL !== 'cancelado' && !/CANCELADO por/i.test(obsL);
  });

  const yaRegresadoHoy = activosHoy.find(p =>
    (p.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(p.observaciones || '')
  );
  if (yaRegresadoHoy) {
    throw new Error(`El colaborador ya cuenta con dictamen de retiro a casa hoy (Falta por retardo • Folio ${yaRegresadoHoy.folio}). No puede registrarse entrada.`);
  }

  const vacacionesHoy = activosHoy.find(p => (p.tipo_permiso || '').toLowerCase() === 'vacaciones');
  if (vacacionesHoy) {
    throw new Error(`El colaborador tiene Vacaciones autorizadas hoy (${vacacionesHoy.folio}).`);
  }

  // Si tenía una Falta ordinaria programada hoy pero sí se presentó en caseta, cancelamos la falta previa
  const faltaOrdinariaHoy = activosHoy.find(p => (p.tipo_permiso || '').toLowerCase() === 'falta' && p.id !== yaRegresadoHoy?.id);
  if (faltaOrdinariaHoy) {
    await cancelarPasePorInasistenciaOCambio(faltaOrdinariaHoy.id, `Se presentó a laborar en puerta (${horaActual} hrs)`);
  }

  const existentes = activosHoy.filter(p => (p.tipo_permiso || '').toLowerCase() === 'retardo');

  if (existentes && existentes.length > 0) {
    const paseActual = existentes[0];

    if (paseActual.estado_general === 'autorizado' || paseActual.estado_general === 'aprobado') {
      const seRegresa = (paseActual.pago || '').toLowerCase().includes('regresa');
      if (!seRegresa) {
        await registrarCheckCaseta(paseActual.id, 'entrada');
        return { resultado: 'entrada_registrada', data: paseActual };
      }
      return { resultado: 'se_regresa', data: paseActual };
    }

    const obsPrev = paseActual.observaciones || '';
    if (!/\[LLEGADA EN PUERTA:/i.test(obsPrev)) {
      const nuevaObs = `${obsPrev} | [LLEGADA EN PUERTA: ${horaActual} hrs]`.replace(/^\s*\|\s*/, '');
      await supabase.from('permisos').update({ observaciones: nuevaObs }).eq('id', paseActual.id);
    }
    // Enviar push recordatorio al firmante en turno indicando que ya está en puerta
    const destExistente = [];
    if (paseActual.firma_1_estado === 'pendiente' && paseActual.firma_1_id) destExistente.push(paseActual.firma_1_id);
    else if (paseActual.firma_2_estado === 'pendiente' && paseActual.firma_2_id) destExistente.push(paseActual.firma_2_id);
    else if (paseActual.firma_3_estado === 'pendiente' && paseActual.firma_3_id) destExistente.push(paseActual.firma_3_id);
    if (destExistente.length > 0) {
      try {
        await enviarNotificacionPushUsuarios([...new Set(destExistente)], {
          titulo: '🚨 EN PUERTA ESPERANDO ACCESO: RETARDO',
          mensaje: `👤 ${emp.nombre_completo}\n🕒 Llegada en puerta: ${horaActual} hrs\n⏳ Detenido en caseta esperando tu autorización.`,
          fotoUrl: emp.foto_url || null,
          urlDestino: '/aprobaciones'
        });
      } catch (_) {}
    }
    return { resultado: 'en_espera_rh', data: paseActual };
  }

  // 2. Enrutador idéntico a crearNuevaSolicitudPermiso (Firma 1, Firma 2, Firma 3)
  const [{ data: depto }, { data: todosEmpDepto }] = await Promise.all([
    emp.departamento_id
      ? supabase.from('departamentos').select('id, nombre, clasificacion, jefe_id, gerente_id, rh_id').eq('id', emp.departamento_id).maybeSingle()
      : Promise.resolve({ data: null }),
    emp.departamento_id
      ? supabase.from('usuarios').select('id, area, rol').eq('departamento_id', emp.departamento_id).eq('activo', true)
      : Promise.resolve({ data: [] })
  ]);

  const areaSolicitante = (emp.area || '').trim().toUpperCase();
  const reportaAId = emp.reporta_a_id || null;
  const listaDepto = todosEmpDepto || [];
  const areasEnDepto = new Set(listaDepto.map(u => (u.area || '').trim().toUpperCase()).filter(Boolean));
  const mandosEnDepto = listaDepto.filter(u => ['encargado', 'jefe_area'].includes(u.rol) && u.id !== emp.id);

  let jefeFinalId = null;
  let reportaDirectoAGerente = false;

  if (reportaAId) {
    const { data: supDirecto } = await supabase.from('usuarios').select('id, rol, activo').eq('id', reportaAId).maybeSingle();
    if (supDirecto && supDirecto.activo) {
      if (['encargado', 'jefe_area', 'rh_nominas'].includes(supDirecto.rol)) {
        jefeFinalId = supDirecto.id;
      } else if (['gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(supDirecto.rol)) {
        reportaDirectoAGerente = true;
      }
    }
  }

  if (!jefeFinalId && !reportaDirectoAGerente) {
    const mandoMismaArea =
      mandosEnDepto.find(j => j.rol === 'encargado' && (j.area || '').trim().toUpperCase() === areaSolicitante) ||
      mandosEnDepto.find(j => j.rol === 'jefe_area' && (j.area || '').trim().toUpperCase() === areaSolicitante);

    if (mandoMismaArea) {
      jefeFinalId = mandoMismaArea.id;
    } else if (depto?.jefe_id && depto.jefe_id !== emp.id) {
      jefeFinalId = depto.jefe_id;
    } else if (areasEnDepto.size <= 1 && mandosEnDepto.length > 0) {
      jefeFinalId = mandosEnDepto[0].id;
    }
  }

  const nombreDeptoUpper = (depto?.nombre || '').toUpperCase();
  const esDeptoRH = (depto?.clasificacion || '').toLowerCase().includes('rh') || nombreDeptoUpper.includes('RECURSOS HUMANOS') || nombreDeptoUpper.includes('VIGILANCIA') || nombreDeptoUpper === 'RH';
  const clasificacionDepto = (depto?.clasificacion || emp.tipo_personal || 'produccion').toLowerCase();
  const rolGerenteFallback = clasificacionDepto.includes('admin') ? 'gerente_admin' : (clasificacionDepto.includes('rh') ? 'gerente_rh' : 'gerente_produccion');

  const [{ data: gerenteDeptoData }, { data: gerenteFallbackData }, { data: rhUsersData }] = await Promise.all([
    depto?.gerente_id ? supabase.from('usuarios').select('id, rol').eq('id', depto.gerente_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('usuarios').select('id, rol').eq('rol', rolGerenteFallback).eq('activo', true).limit(1).maybeSingle(),
    supabase.from('usuarios').select('id, rol').in('rol', ['gerente_rh', 'rh_nominas']).eq('activo', true)
  ]);

  const listaRH = rhUsersData || [];
  const gerenteRH = listaRH.find(u => u.rol === 'gerente_rh') || listaRH[0];
  const rhFinalId = gerenteRH?.id || depto?.rh_id || null;

  let gerenteFinalId = gerenteDeptoData?.id || (esDeptoRH ? rhFinalId : gerenteFallbackData?.id) || null;
  let rolDelGerenteDepto = gerenteDeptoData?.rol || (esDeptoRH ? 'gerente_rh' : gerenteFallbackData?.rol);

  let estadoFirma1 = jefeFinalId ? (jefeFinalId === emp.id ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let estadoFirma2 = gerenteFinalId ? (gerenteFinalId === emp.id ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let estadoFirma3 = rhFinalId ? (rhFinalId === emp.id ? 'auto_aprobado' : 'pendiente') : 'omitido';

  const esRetardoAdmin = rolDelGerenteDepto === 'gerente_admin' || clasificacionDepto.includes('admin');
  if (esDeptoRH || rolDelGerenteDepto === 'gerente_rh' || gerenteFinalId === rhFinalId || esRetardoAdmin) {
    estadoFirma2 = 'omitido';
  }

  const folioTemporal = `REQ-${Math.floor(100000 + Math.random() * 900000)}`;
  const [hAct, mAct] = horaActual.split(':').map(Number);
  const diffHoras = Math.max(0, parseFloat((((hAct * 60 + mAct) - (7 * 60)) / 60).toFixed(2)));
  const detalleHorarioTexto = `🕒 Llegada en puerta: ${horaActual} hrs | [LLEGADA EN PUERTA: ${horaActual} hrs]`;

  // INSERT CON LAS 19 COLUMNAS EXACTAS DE PUBLIC.PERMISOS
  const payload = {
    folio: folioTemporal,
    usuario_id: emp.id,
    fecha_elaboracion: hoyStr,
    fecha_permiso: hoyStr,
    fecha_fin: null,
    tipo_permiso: 'retardo',
    pago: 'Pendiente de dictamen',
    asunto_motivo: motivoEspecial || '[PERSONAL] Llegada posterior al límite de tolerancia registrada en caseta.',
    total_horas: diffHoras,
    observaciones: detalleHorarioTexto,
    firma_empleado: true,
    firma_1_id: jefeFinalId,
    firma_1_estado: estadoFirma1,
    firma_2_id: gerenteFinalId,
    firma_2_estado: estadoFirma2,
    firma_3_id: rhFinalId,
    firma_3_estado: estadoFirma3,
    requiere_caseta: true,
    estado_general: 'en_firmas'
  };

  const { data: creado, error: errInsert } = await supabase
    .from('permisos')
    .insert([payload])
    .select()
    .single();

  if (errInsert) throw errInsert;

  // Determinar a quién enviarle la Notificación Push al celular (idéntico a crearNuevaSolicitudPermiso)
  let notificarA = [];
  if (estadoFirma1 === 'pendiente' && jefeFinalId) {
    notificarA = [jefeFinalId];
  } else if (estadoFirma2 === 'pendiente' && gerenteFinalId) {
    notificarA = [gerenteFinalId];
  } else if (estadoFirma3 === 'pendiente') {
    const destinatariosRH = listaRH.filter(u => u.id !== emp.id).map(u => u.id);
    notificarA = destinatariosRH.length > 0 ? destinatariosRH : [rhFinalId].filter(Boolean);
  }

  if (notificarA.length > 0) {
    try {
      await enviarNotificacionPushUsuarios([...new Set(notificarA.filter(Boolean))], {
        titulo: '🚨 URGENTE EN PUERTA: RETARDO',
        mensaje: `👤 ${emp.nombre_completo}\n🏠 PERSONAL / FAMILIAR\n🕒 Llegada en puerta: ${horaActual} hrs\n⏳ Detenido en caseta esperando tu autorización.`,
        fotoUrl: emp.foto_url || null,
        urlDestino: '/aprobaciones'
      });
    } catch (ePush) {
      console.warn('Error enviando push de retardo en puerta:', ePush);
    }
  }

  return { resultado: 'en_espera_rh', data: creado };
};

export const registrarAsistenciaLista = async (usuarioId, tipoMarca = 'entrada', guardiaId = null, forzarDirectoRH = false) => {
  const hoyStr = obtenerFechaLocalHoy();
  const ahora = new Date();
  const horaActual = ahora.toTimeString().slice(0, 5);
  const minutosDelDia = ahora.getHours() * 60 + ahora.getMinutes();

  const horaLimiteStr = await obtenerHoraLimiteTolerancia();
  const [hLim, mLim] = (horaLimiteStr || '07:15').split(':').map(Number);
  const LIMITE_TOLERANCIA_MINUTOS = (isNaN(hLim) ? 7 : hLim) * 60 + (isNaN(mLim) ? 15 : mLim);

  // 1. Revisar si el colaborador ya tenía un permiso hoy
  const { data: pasesHoy } = await supabase
    .from('permisos')
    .select('id, tipo_permiso, estado_general, pago, observaciones')
    .eq('usuario_id', usuarioId)
    .eq('fecha_permiso', hoyStr)
    .in('estado_general', ['en_firmas', 'autorizado', 'aprobado', 'completado_caseta']);

  const pasesVigentesHoy = (pasesHoy || []).filter(p => {
    const pagoL = String(p.pago || '').toLowerCase();
    const obsL = String(p.observaciones || '');
    return pagoL !== 'cancelado' && !/CANCELADO por/i.test(obsL);
  });
  const regresadoHoy = pasesVigentesHoy.find(p =>
    (p.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(p.observaciones || '')
  );
  const retardoHoy = pasesVigentesHoy.find(p => (p.tipo_permiso || '').toLowerCase() === 'retardo');
  const faltaHoy = pasesVigentesHoy.find(p => (p.tipo_permiso || '').toLowerCase() === 'falta' && p.id !== regresadoHoy?.id);

  if (tipoMarca === 'entrada') {
    if (regresadoHoy) {
      throw new Error('Este colaborador ya fue regresado a casa hoy (Falta por retardo). No es posible registrarle entrada.');
    }

    // VERIFICAR SI EL TRABAJADOR TIENE UNA FALTA SIN AVISO RECIENTE PENDIENTE DE JUSTIFICAR O FALTÓ AYER SIN AVISAR
    if (!forzarDirectoRH && !retardoHoy) {
      const ayer = new Date(ahora);
      ayer.setDate(ahora.getDate() - (ahora.getDay() === 1 ? 3 : 1)); // Si hoy es lunes revisa viernes, si no revisa ayer
      const offsetAyer = ayer.getTimezoneOffset() * 60000;
      const fechaAyerStr = new Date(ayer.getTime() - offsetAyer).toISOString().split('T')[0];

      const [{ data: huboAsistAyer }, { data: asisAyerEmp }, { data: permAyerEmp }] = await Promise.all([
        supabase.from('asistencias_caseta').select('id').eq('fecha', fechaAyerStr).limit(1),
        supabase.from('asistencias_caseta').select('id, hora_entrada').eq('usuario_id', usuarioId).eq('fecha', fechaAyerStr).maybeSingle(),
        supabase.from('permisos').select('id, tipo_permiso, estado_general, pago').eq('usuario_id', usuarioId).lte('fecha_permiso', fechaAyerStr).in('estado_general', ['autorizado', 'aprobado', 'completado_caseta'])
      ]);

      // Solo si ayer hubo operación en planta (hubo pase de lista en caseta) y este trabajador NO entró ni tuvo permiso autorizado
      if (huboAsistAyer && huboAsistAyer.length > 0 && !asisAyerEmp?.hora_entrada) {
        const tuvoPermisoValidoAyer = (permAyerEmp || []).some(pa => {
          const finPa = pa.fecha_fin || pa.fecha_permiso || fechaAyerStr;
          return finPa >= fechaAyerStr && String(pa.pago || '').toLowerCase() !== 'cancelado';
        });
        if (!tuvoPermisoValidoAyer) {
          return await registrarRetardoEnPuerta(
            usuarioId,
            guardiaId,
            `[FALTA PREVIA SIN AVISO] El colaborador faltó sin avisar el día ${fechaAyerStr} y se presenta en caseta. Requiere autorización de Jefatura / RH.`
          );
        }
      }
    }
    // CASO A: Llega en tiempo (<= hora límite de RH) o RH lo valida directamente desde su panel
    if (minutosDelDia <= LIMITE_TOLERANCIA_MINUTOS || forzarDirectoRH) {
      if (retardoHoy && retardoHoy.estado_general !== 'completado_caseta') {
        await cancelarPasePorInasistenciaOCambio(retardoHoy.id, `Asistió en horario normal (${horaActual} hrs)`);
      }
      if (faltaHoy) {
        await cancelarPasePorInasistenciaOCambio(faltaHoy.id, `Asistió a laborar (${horaActual} hrs)`);
      }
    } else {
      // CASO B: Llega DESPUÉS del límite de tolerancia de RH (> 07:15) marcado por Caseta
      if (retardoHoy && (retardoHoy.estado_general === 'autorizado' || retardoHoy.estado_general === 'aprobado')) {
        const seRegresa = (retardoHoy.pago || '').toLowerCase().includes('regresa');
        if (seRegresa) {
          return { resultado: 'se_regresa', data: retardoHoy };
        }
        // Ya tenía su retardo autorizado -> sella el pase y registra en asistencias_caseta
        await registrarCheckCaseta(retardoHoy.id, 'entrada');
        return { resultado: 'entrada_registrada', data: retardoHoy };
      }

      // NO tiene retardo autorizado aún -> Se detiene en puerta y manda el Retardo a Aprobaciones de RH/Jefe
      return await registrarRetardoEnPuerta(usuarioId, guardiaId);
    }
  }

  // 2. Guardar en public.asistencias_caseta
  const { data: existente, error: errBusqueda } = await supabase
    .from('asistencias_caseta')
    .select('id, usuario_id, fecha, hora_entrada, hora_salida, registrado_por')
    .eq('usuario_id', usuarioId)
    .eq('fecha', hoyStr)
    .maybeSingle();

  if (errBusqueda) throw errBusqueda;

  if (existente) {
    const cambios = {};
    if (tipoMarca === 'entrada' && !existente.hora_entrada) cambios.hora_entrada = horaActual;
    if (tipoMarca === 'salida') cambios.hora_salida = horaActual;
    if (guardiaId) cambios.registrado_por = guardiaId;

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
      registrado_por: guardiaId || null
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


export const deshacerSalidaReciente = async (usuarioId) => {
  const hoyStr = obtenerFechaLocalHoy();
  const { data: reg } = await supabase
    .from("asistencias_caseta")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("fecha", hoyStr)
    .maybeSingle();

  if (reg) {
    await supabase.from("asistencias_caseta").update({ hora_salida: null }).eq("id", reg.id);
  }
  return { ok: true };
};

export const deshacerEntradaReciente = async (usuarioId) => {
  const hoyStr = obtenerFechaLocalHoy();
  const { data: reg } = await supabase
    .from("asistencias_caseta")
    .select("id")
    .eq("usuario_id", usuarioId)
    .eq("fecha", hoyStr)
    .maybeSingle();

  if (reg) {
    await supabase.from("asistencias_caseta").delete().eq("id", reg.id);
  }

  // Si tenía un pase de retardo hoy que se había marcado con [ENTRADA CASETA:...], revertir ese sello
  const { data: pasesRet } = await supabase
    .from("permisos")
    .select("id, estado_general, observaciones")
    .eq("usuario_id", usuarioId)
    .eq("fecha_permiso", hoyStr)
    .eq("tipo_permiso", "retardo");

  for (const pr of (pasesRet || [])) {
    if (/\[ENTRADA CASETA:/i.test(pr.observaciones || "")) {
      const obsLimpia = String(pr.observaciones || "")
        .replace(/\s*\|\s*\[ENTRADA CASETA:\s*[^\]]+\]/ig, "")
        .replace(/\[ENTRADA CASETA:\s*[^\]]+\]\s*\|?\s*/ig, "")
        .trim();
      await supabase
        .from("permisos")
        .update({
          estado_general: pr.estado_general === "completado_caseta" ? "autorizado" : pr.estado_general,
          observaciones: obsLimpia
        })
        .eq("id", pr.id);
    }
  }

  return { ok: true };
};
