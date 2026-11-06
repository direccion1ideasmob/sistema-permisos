import { compararPorApellidoPaterno } from '../../../core/utils/ordenNombre';
import { supabase } from '../../../core/api/supabaseClient';
import { enviarNotificacionPushUsuarios } from '../../../core/notificaciones/notificacionesService';
import { resolverCadenaFirmasPorEcualizador } from '../../permisos/services/permisosService';

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
  const lineaHorario = partes.find(p => !/llegada en puerta|^⚠️|^\[|VoBo |Nota /i.test(p)) || partes[0] || '';
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
        id, folio, usuario_id, fecha_permiso, fecha_fin, tipo_permiso, pago, asunto_motivo, observaciones,
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

  const ahoraObj = new Date();
  const ayerObj = new Date(ahoraObj);
  ayerObj.setDate(ahoraObj.getDate() - (ahoraObj.getDay() === 1 ? 3 : 1));
  const fechaAyerHab = new Date(ayerObj.getTime() - ayerObj.getTimezoneOffset() * 60000).toISOString().split('T')[0];

  const usuariosConFaltaSinAvisoAyer = new Set(
    (resPermisos.data || [])
      .filter(p =>
        p.fecha_permiso === fechaAyerHab &&
        (p.tipo_permiso || '').toLowerCase() === 'falta' &&
        /SIN AVISO/i.test(p.asunto_motivo || '') &&
        !String(p.observaciones || '').includes('[REINCORPORACION AUTORIZADA]')
      )
      .map(p => p.usuario_id)
  );

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
    const seRegresaACasa = seRegresaPorDictamen || (tipo === 'retardo' && esRechazado && Boolean(horaLlegadaPuerta));

    const yaSalio = Boolean(horaSalidaCaseta);
    const yaRegreso = Boolean(horaEntradaCaseta);
    const yaSeRetiro = Boolean(horaRetiroCaseta);
    const requiereRegreso = obs.toLowerCase().includes('regresa:');

    const tieneVoBoSubarea = /VoBo Sub[áa]rea:/i.test(obs);
    const f1Resuelta = ['autorizado', 'aprobado', 'auto_aprobado', 'escalado', 'omitido', 'no_aplica'].includes(rawPase.firma_1_estado) || tieneVoBoSubarea;

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
    const mRH = obs.match(/VoBo RH:\s*([^|]+)/i);
    const mSub = obs.match(/VoBo Sub[áa]rea:\s*([^|]+)/i);
    if (mRH) autorizadoPor = mRH[1].trim();
    else if (mGer) autorizadoPor = mGer[1].trim();
    else if (mJefe) autorizadoPor = mJefe[1].trim();
    else if (mSub) autorizadoPor = mSub[1].trim();
    else if (rawPase.firmante1?.nombre_completo && f1Resuelta) autorizadoPor = rawPase.firmante1.nombre_completo;

    const incExistente = mapaIncidenciasHoy[rawPase.usuario_id];
    // Un retardo manda sobre un pase de salida normal: la entrada ocurre antes que la salida
    // y Caseta necesita saber cómo recibir a la persona.
    const retardoDesplazaSalida = tipo === 'retardo' && incExistente?.tipo === 'salida_autorizada';
    const puedeEscribirIncidencia = !incExistente || (esRechazado === false && incExistente.esRechazado) || retardoDesplazaSalida;
    if (puedeEscribirIncidencia) {
      if (tipo === 'vacaciones' && !esRechazado && !(rawPase.estado_general === 'en_firmas' && Boolean(horaLlegadaPuerta))) {
        mapaIncidenciasHoy[rawPase.usuario_id] = {
          tipo: 'ausencia_autorizada',
          paseId: rawPase.id,
          etiqueta: '🏖️ Vacaciones',
          color: '#10b981',
          bg: 'rgba(16,185,129,0.12)'
        };
      } else if (tipo === 'falta' && !esRechazado && !seRegresaACasa && !horaLlegadaPuerta) {
        mapaIncidenciasHoy[rawPase.usuario_id] = {
          tipo: 'ausencia_autorizada',
          paseId: rawPase.id,
          etiqueta: '📋 Falta',
          color: '#8b5cf6',
          bg: 'rgba(139,92,246,0.12)'
        };
      } else if (tipo === 'retardo' || seRegresaACasa || ((tipo === 'falta' || tipo === 'vacaciones') && Boolean(horaLlegadaPuerta))) {
        if (seRegresaACasa) {
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: 'retardo_regresa',
            paseId: rawPase.id,
            yaSeRetiroACasa: yaSeRetiro,
            etiqueta: yaSeRetiro ? '↩️ Se retiró' : '🚫 ACCESO DENEGADO — SE RETIRA',
            color: '#ef4444',
            bg: 'rgba(239,68,68,0.14)'
          };
        } else if (!jefeYaDecidioRetardo && tipo === 'retardo' && !horaLlegadaPuerta) {
          // Retardo pendiente de firma pero la persona aún no llega: NO está retenida.
          // Caseta debe poder registrar su llegada (puntual → se cancela; tarde → queda en puerta).
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: 'retardo_pendiente_sin_llegar',
            paseId: rawPase.id,
            esperandoFirmaDe,
            etiqueta: `⏳ Retardo pendiente de firma (aún no llega) • Firma: ${esperandoFirmaDe}`,
            color: '#d97706',
            bg: 'rgba(245,158,11,0.10)'
          };
        } else if (!jefeYaDecidioRetardo) {
          const esInusualAusencia = /COMPORTAMIENTO INUSUAL EN CASETA/i.test(obs);
          const esFaltaSinAviso = tipo === 'falta' || /FALTA PREVIA SIN AVISO|FALTA SIN AVISO/i.test(rawPase.asunto_motivo || '') || /FALTA PREVIA SIN AVISO/i.test(obs);
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: 'retardo_en_espera',
            paseId: rawPase.id,
            esperandoFirmaDe,
            horaLlegadaPuerta,
            esFaltaSinAviso,
            etiqueta: esInusualAusencia
              ? `🚨 CAMBIO EN PUERTA (${tipo.toUpperCase()}) • Esperando a: ${esperandoFirmaDe}`
              : esFaltaSinAviso
              ? `🚨 RETENIDO POR FALTA SIN AVISO • Esperando a: ${esperandoFirmaDe}`
              : `⏳ RETARDO EN PUERTA • Esperando a: ${esperandoFirmaDe}`,
            color: esFaltaSinAviso ? '#dc2626' : '#d97706',
            bg: esFaltaSinAviso ? 'rgba(220,38,38,0.14)' : 'rgba(245,158,11,0.14)'
          };
        } else if (!esRechazado) {
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: 'retardo_autorizado',
            paseId: rawPase.id,
            tipoPase: tipo,
            horaLlegadaPuerta,
            autorizadoPor: autorizadoPor || 'Jefatura / RH',
            dictamen: rawPase.pago || 'Autorizado',
            yaEntro: yaRegreso,
            etiqueta: '✅ ACCESO AUTORIZADO — DAR PASO',
            color: '#16a34a',
            bg: 'rgba(22,163,74,0.16)'
          };
        }
      } else if (tipo === 'salida' && !esRechazado) {
        const retenidoPorHora = rawPase.estado_general === 'en_firmas' && /\[HORARIO NO COINCIDE EN CASETA/i.test(obs);
        const reautorizadoHora = rawPase.estado_general === 'autorizado' && /\[HORARIO AUTORIZADO EN CASETA\]/i.test(obs);
        const reingresoDefAutorizado = rawPase.estado_general === 'autorizado' && /\[COMPORTAMIENTO INUSUAL AUTORIZADO\]/i.test(obs) && yaSalio && !yaRegreso;
        const estaFuera = yaSalio && (requiereRegreso || reingresoDefAutorizado) && !yaRegreso;
        if (retenidoPorHora) {
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: 'retardo_en_espera',
            paseId: rawPase.id,
            esperandoFirmaDe,
            etiqueta: `⚠️ HORARIO DE PASE NO COINCIDE • Esperando a: ${esperandoFirmaDe}`,
            color: '#dc2626',
            bg: 'rgba(220,38,38,0.14)'
          };
        } else if (reautorizadoHora || reingresoDefAutorizado) {
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: estaFuera ? 'reingreso_autorizado' : 'salida_autorizada',
            paseId: rawPase.id,
            etiqueta: estaFuera ? '✅ REINGRESO AUTORIZADO — DAR PASO' : '✅ SALIDA AUTORIZADA — DAR PASO',
            color: '#16a34a',
            bg: 'rgba(22,163,74,0.16)'
          };
        } else {
          mapaIncidenciasHoy[rawPase.usuario_id] = {
            tipo: estaFuera ? 'salida_fuera' : 'salida_autorizada',
            paseId: rawPase.id,
            etiqueta: estaFuera ? '🔵 Fuera (Pendiente reingreso)' : '🔵 Pase de Salida',
            color: '#0284c7',
            bg: 'rgba(2,132,199,0.12)'
          };
        }
      }
    }

    if (fechaTarget !== hoy) return;
    const esFaltaRetenidaPuerta = (tipo === 'falta' || tipo === 'vacaciones') && Boolean(horaLlegadaPuerta);
    if (tipo !== 'salida' && tipo !== 'retardo' && !seRegresaACasa && !esFaltaRetenidaPuerta) return;

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
      observacionesRaw: obs,
      requiereRegreso,
      seRegresaACasa,
      horaLlegadaPuerta,
      horaRetiroCaseta,
      horaSalidaCaseta,
      horaEntradaCaseta,
      esperandoFirmaDe,
      autorizadoPor,
      etiquetaMotivoPuerta: (() => {
        if (/VACACIONES.*reincorporarse/i.test(obs)) return 'Vacaciones vigentes';
        if (/Tenía FALTA programada/i.test(obs)) return 'Falta programada';
        if (/SALIDA DEFINITIVA.*reingresar/i.test(obs)) return 'Reingreso extraordinario';
        if (/HORARIO NO COINCIDE EN CASETA/i.test(obs)) return 'Horario vencido';
        if (/retardo autorizado para las/i.test(obs)) return 'Tiempo excedido';
        if (tipo === 'falta' || /FALTA PREVIA SIN AVISO|FALTA SIN AVISO/i.test(rawPase.asunto_motivo || '') || /FALTA PREVIA SIN AVISO/i.test(obs)) {
          return 'Falta previa s/aviso';
        }
        return `Retardo${horaLlegadaPuerta ? ' · ' + horaLlegadaPuerta : ''}`;
      })(),
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

    if (
      rawPase.estado_general === 'completado_caseta' ||
      ((tipo === 'retardo' || esFaltaRetenidaPuerta) && !seRegresaACasa && yaRegreso) ||
      (seRegresaACasa && yaSeRetiro) ||
      (tipo === 'salida' && yaSalio && (!requiereRegreso || yaRegreso))
    ) {
      crucesCompletadosHoy.push(p);
      return;
    }

    if (tipo === 'retardo' && esRechazado && !horaLlegadaPuerta && !String(rawPase.folio || '').startsWith('CAS-')) {
      return;
    }

    if ((tipo === 'retardo' || esFaltaRetenidaPuerta) && !jefeYaDecidioRetardo) {
      // Solo está "retenido" quien ya se presentó físicamente en puerta
      if (horaLlegadaPuerta) retenidosEnEspera.push(p);
      return;
    }

    if (tipo === 'salida' && rawPase.estado_general === 'en_firmas') {
      if (/\[HORARIO NO COINCIDE EN CASETA/i.test(obs)) {
        retenidosEnEspera.push(p);
      }
      return;
    }

    if (tipo === 'salida' && yaSalio && requiereRegreso && !yaRegreso) {
      personalFuera.push(p);
      return;
    }

    if (tipo === 'retardo' && !seRegresaACasa && !horaLlegadaPuerta) {
      return;
    }

    pasesPorCruzar.push(p);
  });

  usuariosConFaltaSinAvisoAyer.forEach(uid => {
    if (!mapaIncidenciasHoy[uid]) {
      mapaIncidenciasHoy[uid] = {
        tipo: 'falta_ayer_sin_aviso',
        etiqueta: '🚨 Faltó ayer sin aviso — Retener en puerta',
        color: '#dc2626',
        bg: 'rgba(220,38,38,0.14)'
      };
    }
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

// REGLA MAESTRA RH: Cualquier comportamiento inusual en puerta modifica el permiso existente,
// notifica a las 3 firmas involucradas y permite que cualquiera de ellas lo resuelva.
export const solicitarAutorizacionInusualCaseta = async (permisoId, tipoAnomalia = 'presentacion_en_ausencia', detalleAdicional = '') => {
  const ahora = new Date();
  const horaFormateada = ahora.toTimeString().slice(0, 5);

  const { data: permiso, error: errGet } = await supabase
    .from('permisos')
    .select('*, usuarios:usuario_id (id, nombre_completo, foto_url, rol, departamento_id)')
    .eq('id', permisoId)
    .single();

  if (errGet || !permiso) throw new Error('No se encontró el permiso para re-autorizar.');

  const obsLimpia = (permiso.observaciones || '')
    .replace(/\s*\|\s*\[COMPORTAMIENTO INUSUAL AUTORIZADO\]/gi, '')
    .replace(/\s*\|\s*\[HORARIO AUTORIZADO EN CASETA\]/gi, '')
    .replace(/\s*\|\s*\[LLEGADA EN PUERTA:\s*[^\]]+\]/gi, '')
    .trim();

  let descripcionInusual = detalleAdicional;
  if (tipoAnomalia === 'presentacion_en_falta') {
    descripcionInusual = `Tenía FALTA programada hoy pero se presentó en caseta a las ${horaFormateada} hrs solicitando ingresar a laborar`;
  } else if (tipoAnomalia === 'presentacion_en_vacaciones') {
    descripcionInusual = `Estaba en periodo de VACACIONES pero se presentó en caseta a las ${horaFormateada} hrs solicitando reincorporarse antes`;
  } else if (tipoAnomalia === 'reingreso_salida_definitiva') {
    descripcionInusual = `Tenía SALIDA DEFINITIVA pero regresó a caseta a las ${horaFormateada} hrs solicitando reingresar a planta`;
  }

  const selloInusual = `⚠️ [COMPORTAMIENTO INUSUAL EN CASETA (${horaFormateada} hrs): ${descripcionInusual}]`;
  const nuevasObs = `${obsLimpia} | ${selloInusual} | [LLEGADA EN PUERTA: ${horaFormateada} hrs]`.replace(/^\s*\|\s*/, '').trim();

  const esRetardoAnomalia = (permiso.tipo_permiso || '').toLowerCase() === 'retardo' || tipoAnomalia === 'retardo_excedido';
  const cadena = await resolverCadenaFirmasPorEcualizador({
    userId: permiso.usuario_id,
    rolUsuario: permiso.usuarios?.rol,
    deptoId: permiso.usuarios?.departamento_id,
    tipoPermiso: esRetardoAnomalia ? 'retardo' : permiso.tipo_permiso,
    esMismoDia: true,
    notificarATodosEnPuerta: true
  });

  const f1Id = cadena.jefeFinalId || permiso.firma_1_id || null;
  const f2Id = esRetardoAnomalia ? cadena.gerenteFinalId : (cadena.gerenteFinalId || permiso.firma_2_id || null);
  const f3Id = cadena.rhFinalId || permiso.firma_3_id || null;

  const updates = {
    estado_general: 'en_firmas',
    pago: 'Pendiente de dictamen (Cambio en Caseta)',
    firma_1_id: f1Id,
    firma_1_estado: f1Id ? 'pendiente' : 'omitido',
    firma_2_id: f2Id,
    firma_2_estado: f2Id ? 'pendiente' : 'omitido',
    firma_3_id: f3Id,
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
    f1Id,
    f2Id,
    f3Id,
    ...(rhUsers || []).map(u => u.id)
  ].filter(id => Boolean(id) && id !== permiso.usuario_id);

  if (dest.length > 0) {
    try {
      await enviarNotificacionPushUsuarios([...new Set(dest)], {
        titulo: '🚨 CAMBIO INUSUAL EN CASETA — REQUIERE AUTORIZACIÓN',
        mensaje: `👤 ${permiso.usuarios?.nombre_completo || 'Colaborador'}\n⚠️ ${descripcionInusual}\n⏳ Retenido en Vigilancia esperando decisión.`,
        fotoUrl: permiso.usuarios?.foto_url || null,
        urlDestino: '/aprobaciones'
      });
    } catch (_) {}
  }

  return { resultado: 'retenido_por_inusual', descripcionInusual };
};

export const solicitarReautorizacionHorarioSalida = async (permisoId, tipoMovimiento = 'reingreso', detalleDesfase = '') => {
  const ahora = new Date();
  const horaFormateada = ahora.toTimeString().slice(0, 5);

  const { data: permiso, error: errGet } = await supabase
    .from('permisos')
    .select('*, usuarios:usuario_id (id, nombre_completo, foto_url, rol, departamento_id)')
    .eq('id', permisoId)
    .single();

  if (errGet || !permiso) throw new Error('No se encontró el pase.');

  const obsActual = (permiso.observaciones || '').replace(/\s*\|\s*\[HORARIO AUTORIZADO EN CASETA\]/gi, '');
  const notaDesfase = `⚠️ [HORARIO NO COINCIDE EN CASETA (${horaFormateada} hrs - ${tipoMovimiento.toUpperCase()}): ${detalleDesfase}]`;
  const nuevasObs = `${obsActual} | ${notaDesfase} | [LLEGADA EN PUERTA: ${horaFormateada} hrs]`.trim();

  const f1Id = permiso.firma_1_id || null;
  const f2Id = permiso.firma_2_id || null;
  const f3Id = permiso.firma_3_id || null;

  const updates = {
    estado_general: 'en_firmas',
    pago: 'Pendiente de dictamen (Exceso de horario)',
    firma_1_estado: f1Id ? 'pendiente' : 'omitido',
    firma_2_estado: f2Id ? 'pendiente' : 'omitido',
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
    f1Id,
    f2Id,
    f3Id,
    ...(rhUsers || []).map(u => u.id)
  ].filter(id => Boolean(id) && id !== permiso.usuario_id);

  if (dest.length > 0) {
    try {
      await enviarNotificacionPushUsuarios([...new Set(dest)], {
        titulo: '🚨 HORARIO DE PASE NO COINCIDE EN CASETA',
        mensaje: `👤 ${permiso.usuarios?.nombre_completo || 'Colaborador'}\n🕒 ${detalleDesfase}\n⏳ Retenido en Vigilancia esperando nueva autorización.`,
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
    .select('id, usuario_id, fecha_permiso, tipo_permiso, estado_general, observaciones')
    .eq('id', permisoId)
    .single();

  if (errGet) throw errGet;

  const mov = (tipoMovimiento || '').toLowerCase();
  const obsActual = permiso.observaciones || '';
  const tipo = (permiso.tipo_permiso || '').toLowerCase();
  const requiereRegreso = obsActual.toLowerCase().includes('regresa:');

  const yaReautorizadoHorario = /\[HORARIO AUTORIZADO EN CASETA\]/i.test(obsActual);
  if (tipo === 'salida' && !mov.includes('forzado') && !yaReautorizadoHorario) {
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    if (mov.includes('salida') || (!obsActual.includes('[SALIDA CASETA:') && !mov.includes('reingreso') && !mov.includes('retiro'))) {
      const mSalida = obsActual.match(/Salida(?:\s+definitiva)?:\s*(\d{1,2}):(\d{2})/i);
      if (mSalida) {
        const minSalidaPactada = parseInt(mSalida[1], 10) * 60 + parseInt(mSalida[2], 10);
        const diffSalida = Math.abs(minAhora - minSalidaPactada);
        if (diffSalida > 20) {
          const hSalPactada = `${String(mSalida[1]).padStart(2, '0')}:${mSalida[2]}`;
          return await solicitarReautorizacionHorarioSalida(
            permisoId,
            'salida',
            `Intenta salir a las ${horaFormateada} hrs pero su pase autoriza salida a las ${hSalPactada} hrs (Diferencia de ${diffSalida} min)`
          );
        }
      }
    }
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
            `Regresó a las ${horaFormateada} hrs pero su hora límite de regreso era ${hPactada} hrs (+${minExceso} min tarde)`
          );
        }
      }
    }
  }
  const mLlegadaCongelada = obsActual.match(/\[LLEGADA EN PUERTA:\s*([^\]]+)\]/i);
  const horaCongelada = mLlegadaCongelada ? mLlegadaCongelada[1].trim() : null;

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

  if (mov === 'entrada' && /\[ENTRADA CASETA:/i.test(obsActual)) return { resultado: 'ya_sellado' };
  if (mov.includes('reingreso') && /\[REINGRESO CASETA:/i.test(obsActual)) return { resultado: 'ya_sellado' };

  const horaEfectivaCruce = horaCongelada || `${horaFormateada} hrs`;
  let etiquetaBitacora = `[ENTRADA CASETA: ${horaEfectivaCruce}]`;
  let cierraCicloCaseta = true;
  let totalHorasReales = null;

  const parsearMin = (strHora) => {
    const m = String(strHora || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  if (mov.includes('retiro')) {
    etiquetaBitacora = `[REGRESADO EN PUERTA: ${horaFormateada} hrs]`;
    cierraCicloCaseta = true;
  } else if (mov.includes('salida') || (tipo === 'salida' && !obsActual.includes('[SALIDA CASETA:'))) {
    etiquetaBitacora = `[SALIDA CASETA: ${horaFormateada} hrs]`;
    cierraCicloCaseta = !requiereRegreso;
  } else if (mov.includes('reingreso')) {
    etiquetaBitacora = `[REINGRESO CASETA: ${horaEfectivaCruce}]`;
    cierraCicloCaseta = true;
    const mSalPrevia = obsActual.match(/\[SALIDA CASETA:\s*([^\]]+)\]/i);
    const minSalReal = mSalPrevia ? parsearMin(mSalPrevia[1]) : null;
    const minReingReal = parsearMin(horaEfectivaCruce);
    if (minSalReal !== null && minReingReal !== null && minReingReal > minSalReal) {
      totalHorasReales = parseFloat(((minReingReal - minSalReal) / 60).toFixed(2));
    }
  } else if (tipo === 'retardo') {
    const minLlegadaReal = parsearMin(horaEfectivaCruce);
    if (minLlegadaReal !== null && minLlegadaReal > 7 * 60) {
      totalHorasReales = parseFloat(((minLlegadaReal - 7 * 60) / 60).toFixed(2));
    }
  }

  const nuevasObservaciones = `${obsActual} | ${etiquetaBitacora}`.trim();
  const updates = {
    observaciones: nuevasObservaciones,
    ...(totalHorasReales !== null ? { total_horas: totalHorasReales } : {})
  };

  if ((tipo === 'falta' || tipo === 'vacaciones') && /\[COMPORTAMIENTO INUSUAL AUTORIZADO\]/i.test(obsActual) && !mov.includes('retiro')) {
    const hoyIsoCheck = obtenerFechaLocalHoy();
    if (tipo === 'falta' || permiso.fecha_permiso >= hoyIsoCheck) {
      updates.estado_general = 'rechazado';
      updates.pago = 'Cancelado';
      updates.observaciones = `${nuevasObservaciones} | [PASE CANCELADO: Ingreso a laborar registrado en Caseta]`;
      cierraCicloCaseta = false;
    }
  }

  if (cierraCicloCaseta && ['autorizado', 'aprobado'].includes(permiso.estado_general)) {
    updates.estado_general = 'completado_caseta';
  }

  const { error } = await supabase
    .from('permisos')
    .update(updates)
    .eq('id', permisoId);

  if (error) throw error;

  if ((tipo === 'retardo' || tipo === 'falta' || tipo === 'vacaciones') && !mov.includes('retiro')) {
    try {
      const horaLista = horaCongelada ? horaCongelada.replace(/\s*hrs/i, '').trim() : horaFormateada;
      await registrarAsistenciaListaConHora(permiso.usuario_id, 'entrada', horaLista);
    } catch (_) {}
  } else if (tipo === 'salida' && mov.includes('salida') && !requiereRegreso) {
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

// El corte del día ya no modifica permisos automáticamente.
// Lo abierto en días cerrados se revisa en la bandeja de RH (permisosService → obtenerBandejaCierreRH).

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
    return pagoL !== 'cancelado' && !/CANCELADO por/i.test(obsL) && !/\[PASE CANCELADO/i.test(obsL);
  });

  const yaRegresadoHoy = activosHoy.find(p =>
    (p.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(p.observaciones || '')
  );
  if (yaRegresadoHoy) {
    throw new Error(`El colaborador ya cuenta con dictamen de retiro a casa hoy (Falta por retardo • Folio ${yaRegresadoHoy.folio}). No puede registrarse entrada.`);
  }

  const vacacionesHoy = activosHoy.find(p => (p.tipo_permiso || '').toLowerCase() === 'vacaciones');
  if (vacacionesHoy) {
    return await solicitarAutorizacionInusualCaseta(vacacionesHoy.id, 'presentacion_en_vacaciones');
  }

  const faltaOrdinariaHoy = activosHoy.find(p => (p.tipo_permiso || '').toLowerCase() === 'falta' && p.id !== yaRegresadoHoy?.id && !/FALTA PREVIA SIN AVISO/i.test(p.asunto_motivo || ''));
  if (faltaOrdinariaHoy) {
    return await solicitarAutorizacionInusualCaseta(faltaOrdinariaHoy.id, 'presentacion_en_falta');
  }

  const esPorFaltaSinAviso = Boolean(motivoEspecial && /FALTA/i.test(motivoEspecial));
  const existentes = activosHoy.filter(p => ['retardo', 'falta'].includes((p.tipo_permiso || '').toLowerCase()));

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

    const { data: rhUsers } = await supabase
      .from('usuarios')
      .select('id')
      .in('rol', ['gerente_rh', 'rh_nominas'])
      .eq('activo', true);

    const destExistente = [];
    if (paseActual.firma_1_estado === 'pendiente' && paseActual.firma_1_id) destExistente.push(paseActual.firma_1_id);
    if (paseActual.firma_2_estado === 'pendiente' && paseActual.firma_2_id) destExistente.push(paseActual.firma_2_id);
    if (paseActual.firma_3_estado === 'pendiente') {
      if (paseActual.firma_3_id) destExistente.push(paseActual.firma_3_id);
      if (rhUsers) destExistente.push(...rhUsers.map(u => u.id));
    }

    if (destExistente.length > 0) {
      try {
        await enviarNotificacionPushUsuarios([...new Set(destExistente)], {
          titulo: '🚨 EN PUERTA ESPERANDO ACCESO: RETARDO',
          mensaje: `👤 ${emp.nombre_completo}\n🕒 Llegada en puerta: ${horaActual} hrs\n⏳ Detenido en caseta esperando autorización.`,
          fotoUrl: emp.foto_url || null,
          urlDestino: '/aprobaciones'
        });
      } catch (_) {}
    }
    return { resultado: 'en_espera_rh', data: paseActual };
  }

  // 2. RESOLUCIÓN CENTRALIZADA (Excluye a Pedro Simón en retardos del mismo día y avisa a todas las firmas activas)
  const {
    jefeFinalId,
    gerenteFinalId,
    rhFinalId,
    estadoFirma1,
    estadoFirma2,
    estadoFirma3,
    notificarA
  } = await resolverCadenaFirmasPorEcualizador({
    userId: emp.id,
    rolUsuario: emp.rol,
    deptoId: emp.departamento_id,
    tipoPermiso: 'retardo',
    esMismoDia: true,
    notificarATodosEnPuerta: true
  });

  const folioTemporal = `REQ-${Math.floor(100000 + Math.random() * 900000)}`;
  const [hAct, mAct] = horaActual.split(':').map(Number);
  const diffHoras = Math.max(0, parseFloat((((hAct * 60 + mAct) - (7 * 60)) / 60).toFixed(2)));
  const detalleHorarioTexto = `🕒 Llegada en puerta: ${horaActual} hrs | [LLEGADA EN PUERTA: ${horaActual} hrs]`;

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

  if (notificarA.length > 0) {
    try {
      await enviarNotificacionPushUsuarios([...new Set(notificarA.filter(Boolean))], {
        titulo: esPorFaltaSinAviso ? '🚨 RETENIDO EN PUERTA POR FALTA SIN AVISO' : '🚨 URGENTE EN PUERTA: RETARDO',
        mensaje: `👤 ${emp.nombre_completo}\n🏠 PERSONAL / FAMILIAR\n🕒 Llegada en puerta: ${horaActual} hrs\n⏳ Detenido en caseta esperando autorización.`,
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

  // Consulta por rango (lte fecha_permiso) para detectar también Vacaciones de varios días que cubran hoy
  const { data: pasesRango } = await supabase
    .from('permisos')
    .select('id, folio, fecha_permiso, fecha_fin, tipo_permiso, estado_general, pago, asunto_motivo, observaciones')
    .eq('usuario_id', usuarioId)
    .lte('fecha_permiso', hoyStr)
    .in('estado_general', ['en_firmas', 'autorizado', 'aprobado', 'completado_caseta']);

  const pasesVigentesHoy = (pasesRango || []).filter(p => {
    const fin = p.fecha_fin || p.fecha_permiso;
    if (!(p.fecha_permiso <= hoyStr && fin >= hoyStr)) return false;
    const pagoL = String(p.pago || '').toLowerCase();
    const obsL = String(p.observaciones || '');
    return pagoL !== 'cancelado' && !/CANCELADO por/i.test(obsL) && !/\[PASE CANCELADO/i.test(obsL);
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

    if (!forzarDirectoRH && !retardoHoy && !faltaHoy) {
      const ayer = new Date(ahora);
      ayer.setDate(ahora.getDate() - (ahora.getDay() === 1 ? 3 : 1));
      const fechaAyerStr = new Date(ayer.getTime() - ayer.getTimezoneOffset() * 60000).toISOString().split('T')[0];

      const { data: faltaSinAvisoAyer } = await supabase
        .from('permisos')
        .select('id, folio, asunto_motivo, observaciones')
        .eq('usuario_id', usuarioId)
        .eq('fecha_permiso', fechaAyerStr)
        .eq('tipo_permiso', 'falta')
        .ilike('asunto_motivo', '%SIN AVISO%')
        .maybeSingle();

      if (faltaSinAvisoAyer && !String(faltaSinAvisoAyer.observaciones || '').includes('[REINCORPORACION AUTORIZADA]')) {
        return await registrarRetardoEnPuerta(
          usuarioId,
          guardiaId,
          `[FALTA PREVIA SIN AVISO] El colaborador faltó sin avisar el día ${fechaAyerStr} y se presenta en caseta. Requiere autorización de Jefatura / RH.`
        );
      }
    }
    const vacacionesHoyLista = pasesVigentesHoy.find(p => (p.tipo_permiso || '').toLowerCase() === 'vacaciones');
    if (vacacionesHoyLista && !forzarDirectoRH) {
      return await solicitarAutorizacionInusualCaseta(vacacionesHoyLista.id, 'presentacion_en_vacaciones');
    }
    if (faltaHoy && !forzarDirectoRH && !/FALTA PREVIA SIN AVISO/i.test(faltaHoy.asunto_motivo || '')) {
      return await solicitarAutorizacionInusualCaseta(faltaHoy.id, 'presentacion_en_falta');
    }

    if (minutosDelDia <= LIMITE_TOLERANCIA_MINUTOS || forzarDirectoRH) {
      if (retardoHoy && retardoHoy.estado_general !== 'completado_caseta') {
        await cancelarPasePorInasistenciaOCambio(retardoHoy.id, `Asistió en horario normal (${horaActual} hrs)`);
      }
    } else {
      if (retardoHoy && (retardoHoy.estado_general === 'autorizado' || retardoHoy.estado_general === 'aprobado')) {
        const seRegresa = (retardoHoy.pago || '').toLowerCase().includes('regresa');
        if (seRegresa) {
          return { resultado: 'se_regresa', data: retardoHoy };
        }
        const obsRet = retardoHoy.observaciones || '';
        const mEst = obsRet.match(/Llegada estimada:\s*(\d{1,2}):(\d{2})/i);
        const yaReautorizadoRet = /\[COMPORTAMIENTO INUSUAL AUTORIZADO\]/i.test(obsRet);
        if (mEst && !yaReautorizadoRet) {
          const minEstimados = parseInt(mEst[1], 10) * 60 + parseInt(mEst[2], 10);
          const excesoRet = minutosDelDia - minEstimados;
          if (excesoRet > 15) {
            const hPrometida = `${String(mEst[1]).padStart(2, '0')}:${mEst[2]}`;
            return await solicitarAutorizacionInusualCaseta(
              retardoHoy.id,
              'retardo_excedido',
              `Tenía retardo autorizado para las ${hPrometida} hrs pero llegó a caseta a las ${horaActual} hrs (+${excesoRet} min después de lo avisado)`
            );
          }
        }
        await registrarCheckCaseta(retardoHoy.id, 'entrada');
        return { resultado: 'entrada_registrada', data: retardoHoy };
      }

      return await registrarRetardoEnPuerta(usuarioId, guardiaId);
    }
  }

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

  const { data: pasesRet } = await supabase
    .from("permisos")
    .select("id, estado_general, observaciones")
    .eq("usuario_id", usuarioId)
    .eq("fecha_permiso", hoyStr)
    .eq("tipo_permiso", "retardo");

  for (const pr of (pasesRet || [])) {
    if (/\[(?:ENTRADA CASETA|LLEGADA EN PUERTA):/i.test(pr.observaciones || "")) {
      const obsLimpia = String(pr.observaciones || "")
        .replace(/\s*\|\s*\[ENTRADA CASETA:\s*[^\]]+\]/ig, "")
        .replace(/\[ENTRADA CASETA:\s*[^\]]+\]\s*\|?\s*/ig, "")
        .replace(/\s*\|\s*\[LLEGADA EN PUERTA:\s*[^\]]+\]/ig, "")
        .replace(/🕒\s*Llegada en puerta:\s*[^|]+\|?\s*/ig, "")
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