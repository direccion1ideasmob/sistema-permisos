import { registrarCheckCaseta, sincronizarCierreTurnoAutomatico } from '../../vigilancia/services/vigilanciaService';
import { supabase } from '../../../core/api/supabaseClient';
import { enviarNotificacionPushUsuarios } from '../../../core/notificaciones/notificacionesService';
import { esRolValidadorSuperior } from '../../directorio/utils/directorioHelpers';

const obtenerFechaLocalHoyISO = () => {
  const ahora = new Date();
  const offsetMs = ahora.getTimezoneOffset() * 60000;
  return new Date(ahora.getTime() - offsetMs).toISOString().split('T')[0];
};

const esUsuarioPedroSimon = (u) => {
  if (!u) return false;
  const nom = String(u.nombre_completo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const rol = String(u.rol || '').toLowerCase();
  return rol === 'gerente_admin' || (nom.includes('PEDRO') && nom.includes('SIMON'));
};

const cancelarSalidasMismoDiaPorRetiro = async (usuarioId, fechaPermiso, folioRetardo = '') => {
  if (!usuarioId || !fechaPermiso) return;
  try {
    const { data: salidasHoy } = await supabase
      .from('permisos')
      .select('id, folio, observaciones, estado_general, pago')
      .eq('usuario_id', usuarioId)
      .eq('fecha_permiso', fechaPermiso)
      .eq('tipo_permiso', 'salida')
      .in('estado_general', ['en_firmas', 'autorizado', 'aprobado']);

    for (const sal of (salidasHoy || [])) {
      const pagoL = String(sal.pago || '').toLowerCase();
      const obsL = String(sal.observaciones || '');
      if (pagoL === 'cancelado' || /CANCELADO por/i.test(obsL) || /\[PASE CANCELADO/i.test(obsL)) continue;
      if (/\[SALIDA CASETA:/i.test(obsL)) continue;

      const nuevaObs = `${obsL} | CANCELADO por Sistema: [PASE CANCELADO: El colaborador fue regresado a casa en puerta (${folioRetardo || 'Retardo'})]`.replace(/^\s*\|\s*/, '');

      const { error: err1 } = await supabase
        .from('permisos')
        .update({
          estado_general: 'rechazado',
          pago: 'Cancelado',
          observaciones: nuevaObs
        })
        .eq('id', sal.id);

      if (err1) {
        await supabase
          .from('permisos')
          .update({
            estado_general: 'rechazado',
            pago: 'Sin goce',
            observaciones: nuevaObs
          })
          .eq('id', sal.id);
      }
    }
  } catch (err) {
    console.warn('Aviso al cancelar salidas del mismo día:', err);
  }
};

// ============================================================================
// MOTOR DE FIRMAS DIRECTO (RESPETA JEFE INMEDIATO INDIVIDUAL, TABLA Y REGLA PEDRO SIMÓN)
// ============================================================================
export const resolverCadenaFirmasPorEcualizador = async ({
  userId,
  rolUsuario,
  deptoId,
  tipoPermiso = '',
  esMismoDia = false,
  notificarATodosEnPuerta = false
}) => {
  const [resDepto, resSolicitante, resTodosEmpDepto, resRHUsers] = await Promise.all([
    deptoId
      ? supabase
          .from('departamentos')
          .select('id, nombre, clasificacion, jefe_id, gerente_id, rh_id, emp_requiere_jefe, emp_requiere_gerente, jefe_requiere_gerente')
          .eq('id', deptoId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('usuarios').select('id, area, rol, reporta_a_id, tipo_personal').eq('id', userId).maybeSingle(),
    deptoId
      ? supabase.from('usuarios').select('id, area, rol, activo, reporta_a_id').eq('departamento_id', deptoId).eq('activo', true)
      : Promise.resolve({ data: [] }),
    supabase.from('usuarios').select('id, rol').in('rol', ['gerente_rh', 'rh_nominas']).eq('activo', true)
  ]);

  const depto = resDepto.data;
  const solicitante = resSolicitante.data;
  const listaDepto = resTodosEmpDepto.data || [];
  const listaRH = resRHUsers.data || [];

  const gerenteRH = listaRH.find(u => u.rol === 'gerente_rh') || listaRH[0] || null;
  const rhFinalId = gerenteRH?.id || depto?.rh_id || null;

  const rolSol = (rolUsuario || solicitante?.rol || 'empleado').toLowerCase().trim();
  const reportaAId = solicitante?.reporta_a_id || null;

  const esSolicitanteGerenteDiv =
    esRolValidadorSuperior(rolSol) ||
    rolSol === 'superadmin';

  const tieneSubordinadosDirectos = listaDepto.some(u => u.reporta_a_id === userId && u.id !== userId);
  const esSolicitanteJefe =
    !esSolicitanteGerenteDiv &&
    ((depto?.jefe_id && depto.jefe_id === userId) ||
      rolSol === 'jefe_area' ||
      rolSol === 'rh_nominas' ||
      tieneSubordinadosDirectos);

  let jefeFinalId = null;
  let gerenteFinalId = null;

  if (esSolicitanteGerenteDiv) {
    // 1. Si pide un Gerente (Pedro, Reynaldo, Coca) -> Directo a RH
    jefeFinalId = null;
    gerenteFinalId = null;
  } else if (esSolicitanteJefe) {
    // 2. Si pide un Jefe de Área (ej. Rubén Beltrán, Suheilli, Juan Antonio):
    jefeFinalId = null;
    if (depto?.jefe_requiere_gerente !== false) {
      // Primero: Si en su tarjeta individual tiene asignado un Jefe específico (ej. Rubén -> Pedro Simón), respetarlo:
      if (reportaAId && reportaAId !== userId && reportaAId !== rhFinalId) {
        const { data: supPersonalizado } = await supabase.from('usuarios').select('id, nombre_completo, rol, activo').eq('id', reportaAId).maybeSingle();
        if (supPersonalizado && supPersonalizado.activo !== false && supPersonalizado.rol !== 'gerente_rh') {
          gerenteFinalId = supPersonalizado.id;
        }
      }
      // Segundo: Si no tiene excepción individual, usar el Gerente del departamento en la Tabla:
      if (!gerenteFinalId && depto?.gerente_id && depto.gerente_id !== userId && depto.gerente_id !== rhFinalId) {
        gerenteFinalId = depto.gerente_id;
      }
    }
  } else {
    // 3. Si pide un Empleado:
    if (reportaAId && reportaAId !== userId) {
      const { data: supEmp } = await supabase.from('usuarios').select('id, nombre_completo, rol, activo').eq('id', reportaAId).maybeSingle();
      if (supEmp && supEmp.activo !== false && supEmp.rol !== 'gerente_rh' && supEmp.id !== rhFinalId) {
        jefeFinalId = supEmp.id;
      }
    } else if (depto?.emp_requiere_jefe !== false) {
      if (depto?.jefe_id && depto.jefe_id !== userId) {
        jefeFinalId = depto.jefe_id;
      } else {
        const jefeEnDepto = listaDepto.find(u => u.rol === 'jefe_area' && u.id !== userId) ||
                            listaDepto.find(u => u.rol === 'encargado' && u.id !== userId);
        if (jefeEnDepto) jefeFinalId = jefeEnDepto.id;
      }
    }

    if (depto?.emp_requiere_gerente && depto?.gerente_id && depto.gerente_id !== userId && depto.gerente_id !== jefeFinalId && depto.gerente_id !== rhFinalId) {
      gerenteFinalId = depto.gerente_id;
    }
  }

  // REGLA EXCLUSIVA PEDRO SIMÓN: No incluirlo en retardos del mismo día (solo en retardos anticipados u otros permisos)
  const esRetardoMismoDia = String(tipoPermiso || '').toLowerCase() === 'retardo' && Boolean(esMismoDia);
  if (esRetardoMismoDia && (jefeFinalId || gerenteFinalId)) {
    const idsVerificar = [jefeFinalId, gerenteFinalId].filter(Boolean);
    const { data: datosFirmantes } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, rol')
      .in('id', idsVerificar);

    const mapaFirm = new Map((datosFirmantes || []).map(u => [u.id, u]));
    if (jefeFinalId && esUsuarioPedroSimon(mapaFirm.get(jefeFinalId))) {
      jefeFinalId = null;
    }
    if (gerenteFinalId && esUsuarioPedroSimon(mapaFirm.get(gerenteFinalId))) {
      gerenteFinalId = null;
    }
  }

  let estadoFirma1 = jefeFinalId ? (jefeFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let estadoFirma2 = gerenteFinalId ? (gerenteFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let estadoFirma3 = rhFinalId ? (rhFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';

  if (rolSol === 'superadmin') {
    estadoFirma1 = 'auto_aprobado';
    estadoFirma2 = 'auto_aprobado';
    estadoFirma3 = 'auto_aprobado';
  }

  const destinatariosRH = listaRH.filter(u => u.id !== userId).map(u => u.id);
  const idsRH = destinatariosRH.length > 0 ? destinatariosRH : [rhFinalId].filter(id => id && id !== userId);

  let notificarA = [];
  if (notificarATodosEnPuerta) {
    // En puerta / anomalía: avisar a todas las firmas activas para que se coordinen
    if (estadoFirma1 === 'pendiente' && jefeFinalId) notificarA.push(jefeFinalId);
    if (estadoFirma2 === 'pendiente' && gerenteFinalId) notificarA.push(gerenteFinalId);
    if (estadoFirma3 === 'pendiente') notificarA.push(...idsRH);
    notificarA = [...new Set(notificarA)];
  } else {
    if (estadoFirma1 === 'pendiente' && jefeFinalId) {
      notificarA = [jefeFinalId];
    } else if (estadoFirma2 === 'pendiente' && gerenteFinalId) {
      notificarA = [gerenteFinalId];
    } else if (estadoFirma3 === 'pendiente') {
      notificarA = idsRH;
    }
  }

  return {
    depto,
    listaRH,
    jefeFinalId,
    gerenteFinalId,
    rhFinalId,
    estadoFirma1,
    estadoFirma2,
    estadoFirma3,
    notificarA
  };
};

// 1. OBTENER PERMISOS DE UN EMPLEADO (MisPermisos)
export const obtenerPermisosUsuario = async (usuarioId) => {
  if (!usuarioId) return [];
  const { data, error } = await supabase
    .from('permisos')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// 2. ESCALAR PERMISO POR INACTIVIDAD DEL JEFE (MisPermisos)
export const escalarPermisoAGerencia = async (permiso) => {
  if (permiso.firma_1_id) {
    const { data: f1User } = await supabase.from('usuarios').select('id, rol').eq('id', permiso.firma_1_id).maybeSingle();
    if (f1User?.rol === 'encargado') {
      const jefeDeptoId = await buscarJefeDeptoSuperior(f1User.id, permiso.usuarios?.departamento_id);
      if (jefeDeptoId && jefeDeptoId !== f1User.id) {
        const { error: errRel } = await supabase
          .from('permisos')
          .update({
            firma_1_id: jefeDeptoId,
            firma_1_estado: 'pendiente',
            observaciones: `${permiso.observaciones || ''} | ⚠️ Escalado a Jefatura de Departamento por inactividad de Subárea.`
          })
          .eq('id', permiso.id);
        if (errRel) throw errRel;
        await enviarNotificacionPushUsuarios(jefeDeptoId, {
          titulo: `⚠️ ESCALAMIENTO: ${permiso.tipo_permiso.toUpperCase()}`,
          mensaje: `El Supervisor de Subárea no respondió a tiempo. Se requiere tu autorización para el folio ${permiso.folio}.`,
          urlDestino: '/aprobaciones'
        });
        return;
      }
    }
  }

  const vaAGerencia = permiso.firma_2_estado === 'pendiente' && Boolean(permiso.firma_2_id);
  const etiquetaDestino = vaAGerencia ? 'Gerencia' : 'Recursos Humanos';

  const { error } = await supabase
    .from('permisos')
    .update({
      firma_1_estado: 'escalado',
      observaciones: `${permiso.observaciones || ''} | ⚠️ Escalado a ${etiquetaDestino} por inactividad del Jefe.`
    })
    .eq('id', permiso.id);

  if (error) throw error;

  let destinatarios = [];
  if (vaAGerencia) {
    destinatarios = [permiso.firma_2_id];
  } else {
    const { data: rhUsers } = await supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']).eq('activo', true);
    destinatarios = (rhUsers || []).map(u => u.id);
    if (destinatarios.length === 0 && permiso.firma_3_id) destinatarios = [permiso.firma_3_id];
  }

  if (destinatarios.length > 0) {
    await enviarNotificacionPushUsuarios([...new Set(destinatarios)], {
      titulo: `⚠️ ESCALAMIENTO: ${permiso.tipo_permiso.toUpperCase()}`,
      mensaje: `El Jefe de Área no respondió a tiempo. Se requiere tu autorización para el folio ${permiso.folio}.`,
      urlDestino: '/aprobaciones'
    });
  }
};

// 3. VERIFICAR REINCIDENCIA DE RETARDOS (Últimos 15 días, incluyendo retardos donde fue regresado a casa)
export const contarReincidenciasRetardo = async (usuarioId, permisoId = null, fechaBase = new Date()) => {
  if (!usuarioId) return 0;
  const fechaLimite = new Date(fechaBase);
  fechaLimite.setDate(fechaLimite.getDate() - 15);
  const fechaMinStr = `${fechaLimite.getFullYear()}-${String(fechaLimite.getMonth() + 1).padStart(2, '0')}-${String(fechaLimite.getDate()).padStart(2, '0')}`;

  let query = supabase
    .from('permisos')
    .select('id, tipo_permiso, estado_general, pago, observaciones')
    .eq('usuario_id', usuarioId)
    .gte('fecha_permiso', fechaMinStr);

  if (permisoId) {
    query = query.neq('id', permisoId);
  }

  const { data } = await query;
  const total = (data || []).filter(p => {
    const pagoL = String(p.pago || '').toLowerCase();
    const obsL = String(p.observaciones || '');
    if (pagoL === 'cancelado' || /CANCELADO por/i.test(obsL) || /\[PASE CANCELADO/i.test(obsL)) return false;
    const tipoL = (p.tipo_permiso || '').toLowerCase();
    const fueRegresado = pagoL.includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(obsL);
    if (tipoL === 'retardo' && p.estado_general !== 'rechazado') return true;
    if (tipoL === 'falta' && fueRegresado) return true;
    return false;
  }).length;

  return total;
};

// 3.B VERIFICAR ACUMULACIÓN DE FALTAS (Últimos 30 días — Alerta RH a las 3 faltas)
export const contarFaltasRecientes30Dias = async (usuarioId, permisoId = null, fechaBase = new Date()) => {
  if (!usuarioId) return 0;
  const fechaLimite = new Date(fechaBase);
  fechaLimite.setDate(fechaLimite.getDate() - 30);
  const fechaMinStr = `${fechaLimite.getFullYear()}-${String(fechaLimite.getMonth() + 1).padStart(2, '0')}-${String(fechaLimite.getDate()).padStart(2, '0')}`;

  let query = supabase
    .from('permisos')
    .select('id, tipo_permiso, estado_general, pago, observaciones')
    .eq('usuario_id', usuarioId)
    .gte('fecha_permiso', fechaMinStr);

  if (permisoId) {
    query = query.neq('id', permisoId);
  }

  const { data } = await query;
  const total = (data || []).filter(p => {
    const pagoL = String(p.pago || '').toLowerCase();
    const obsL = String(p.observaciones || '');
    if (pagoL === 'cancelado' || /CANCELADO por/i.test(obsL) || /\[PASE CANCELADO/i.test(obsL)) return false;
    const tipoL = (p.tipo_permiso || '').toLowerCase();
    if (tipoL === 'falta' && p.estado_general !== 'rechazado') return true;
    return false;
  }).length;

  return total;
};

export const enviarRecordatorioPermisosRezagados = async (listaPermisos = []) => {
  let enviados = 0;
  for (const p of listaPermisos) {
    const dest = [];
    if (p.firma_1_estado === 'pendiente' && p.firma_1_id) dest.push(p.firma_1_id);
    else if (p.firma_2_estado === 'pendiente' && p.firma_2_id) dest.push(p.firma_2_id);
    else if (p.firma_3_estado === 'pendiente' && p.firma_3_id) dest.push(p.firma_3_id);
    if (dest.length > 0) {
      try {
        await enviarNotificacionPushUsuarios([...new Set(dest)], {
          titulo: `⏰ RECORDATORIO: PASE PENDIENTE DE FIRMA (${p.folio})`,
          mensaje: `👤 ${p.usuarios?.nombre_completo || 'Colaborador'}\n📅 Fecha del pase: ${p.fecha_permiso}\n⚠️ Esta solicitud sigue en espera de tu dictamen.`,
          urlDestino: '/aprobaciones'
        });
        enviados++;
      } catch (_) {}
    }
  }
  return enviados;
};

// 4. OBTENER TODAS LAS SOLICITUDES PARA BANDEJA DE APROBACIONES
export const obtenerSolicitudesAprobacion = async ({ soloEnFirmas = false, usuarioId = null, rol = null } = {}) => {
  await sincronizarCierreTurnoAutomatico();
  let query = supabase
    .from("permisos")
    .select(`
      *,
      usuarios:usuario_id (
        id, numero_empleado, nombre_completo, area, puesto, tipo_personal, foto_url, firma_url, departamento_id, reporta_a_id, sedes:sede_id (nombre), supervisor:reporta_a_id (id, nombre_completo, rol, puesto, firma_url),
        departamentos:departamento_id (id, nombre, clasificacion, jefe_id, gerente_id, emp_requiere_jefe, emp_requiere_gerente, jefe_requiere_gerente)
      ),
      firmante1:firma_1_id (id, nombre_completo, rol, puesto, firma_url),
      firmante2:firma_2_id (id, nombre_completo, rol, puesto, firma_url),
      firmante3:firma_3_id (id, nombre_completo, rol, puesto, firma_url)
    `);

  if (soloEnFirmas) {
    query = query.eq("estado_general", "en_firmas");
  } else if (usuarioId && (rol === "jefe_area" || rol === "encargado")) {
    query = query.or(`firma_1_id.eq.${usuarioId},firma_2_id.eq.${usuarioId}`).limit(100);
  } else if (usuarioId && rol && (rol.includes("gerente") || rol === "validador_superior")) {
    query = query.or(`firma_2_id.eq.${usuarioId},firma_1_id.eq.${usuarioId}`).limit(100);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

// 5. GENERADOR DE FOLIO OFICIAL (A-26-0001 / P-26-0001 / O-26-0001)
const generarFolioOficial = async (prefijoLetra, anio2Digitos) => {
  const patron = `${prefijoLetra}-${anio2Digitos}-%`;
  const { data } = await supabase
    .from('permisos')
    .select('folio')
    .ilike('folio', patron)
    .order('created_at', { ascending: false })
    .limit(1);

  let consecutivo = 1;
  if (data && data.length > 0 && data[0].folio) {
    const partes = data[0].folio.split('-');
    if (partes.length === 3) {
      const num = parseInt(partes[2], 10);
      if (!isNaN(num)) consecutivo = num + 1;
    }
  }
  return `${prefijoLetra}-${anio2Digitos}-${String(consecutivo).padStart(4, '0')}`;
};

// AUXILIAR: BUSCAR SI UN SUPERVISOR DE SUBÁREA (encargado) TIENE ARRIBA UN JEFE DE DEPTO (jefe_area)
const buscarJefeDeptoSuperior = async (supervisorId, deptoId) => {
  if (!supervisorId) return null;
  const { data: sup } = await supabase
    .from('usuarios')
    .select('id, reporta_a_id, departamento_id')
    .eq('id', supervisorId)
    .maybeSingle();

  if (sup?.reporta_a_id) {
    const { data: jefeArriba } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', sup.reporta_a_id)
      .maybeSingle();
    if (jefeArriba && jefeArriba.activo && jefeArriba.rol === 'jefe_area') {
      return jefeArriba.id;
    }
  }

  const targetDeptoId = deptoId || sup?.departamento_id;
  if (targetDeptoId) {
    const { data: depto } = await supabase
      .from('departamentos')
      .select('jefe_id')
      .eq('id', targetDeptoId)
      .maybeSingle();
    if (depto?.jefe_id && depto.jefe_id !== supervisorId) {
      return depto.jefe_id;
    }
  }
  return null;
};

// AUXILIAR: NOTIFICAR RETROALIMENTACIÓN A LAS OTRAS FIRMAS CUANDO ALGUIEN RESUELVE UNA URGENCIA EN CASETA
const notificarRetroalimentacionFirmantes = async ({ solicitud, usuarioResolvio, veredictoTexto, comentarioTexto }) => {
  try {
    const { data: rhUsers } = await supabase
      .from('usuarios')
      .select('id')
      .in('rol', ['gerente_rh', 'rh_nominas'])
      .eq('activo', true);

    const involucrados = [
      solicitud.firma_1_id,
      solicitud.firma_2_id,
      solicitud.firma_3_id,
      ...(rhUsers || []).map(u => u.id)
    ].filter(id => Boolean(id) && id !== usuarioResolvio.id && id !== solicitud.usuario_id);

    const unicos = [...new Set(involucrados)];
    if (unicos.length === 0) return;

    const nomTrab = solicitud.usuarios?.nombre_completo || 'Colaborador';
    const quien = usuarioResolvio.nombre_completo || 'Un validador';
    const notaLinea = comentarioTexto && String(comentarioTexto).trim()
      ? `\n💬 Comentario: ${String(comentarioTexto).trim()}`
      : '';

    await enviarNotificacionPushUsuarios(unicos, {
      titulo: `ℹ️ RESOLUCIÓN EN CASETA: ${veredictoTexto}`,
      mensaje: `👤 ${nomTrab}\n✅ Resuelto por: ${quien}${notaLinea}`,
      fotoUrl: solicitud.usuarios?.foto_url || null,
      urlDestino: '/aprobaciones'
    });
  } catch (e) {
    console.warn('Aviso al enviar retroalimentación a firmantes:', e);
  }
};

// 6. PROCESAR APROBACIÓN Y ENRUTAMIENTO INTELIGENTE (Aprobaciones)
export const aprobarSolicitudPermiso = async ({ solicitud, usuario, dictamenPago, comentarios }) => {
  if (solicitud.usuario_id === usuario.id && usuario.rol !== "superadmin") {
    throw new Error("Por control interno, no puedes autorizar ni dictaminar tu propia solicitud.");
  }

  const { data: actualBD, error: errCheck } = await supabase
    .from('permisos')
    .select('id, folio, usuario_id, fecha_permiso, tipo_permiso, estado_general, pago, observaciones, firma_1_id, firma_1_estado, firma_2_id, firma_2_estado, firma_3_id, firma_3_estado')
    .eq('id', solicitud.id)
    .single();

  if (errCheck || !actualBD) {
    throw new Error('No se pudo verificar el estado actual de la solicitud.');
  }
  if (['autorizado', 'aprobado', 'completado_caseta', 'rechazado', 'cancelado'].includes(actualBD.estado_general)) {
    throw new Error(`Esta solicitud ya fue dictaminada hace unos instantes (Folio ${actualBD.folio} • ${actualBD.pago || actualBD.estado_general}). Actualiza tu bandeja.`);
  }
  solicitud = { ...solicitud, ...actualBD };

  const obsActual = solicitud.observaciones || '';
  const esUrgenciaEnPuerta = /\[(?:LLEGADA EN PUERTA|COMPORTAMIENTO INUSUAL EN CASETA|HORARIO NO COINCIDE EN CASETA):/i.test(obsActual);

  const esFirmante1Actual =
    solicitud.firma_1_estado === 'pendiente' &&
    (solicitud.firma_1_id === usuario.id || (!solicitud.firma_1_id && ['encargado', 'jefe_area'].includes(usuario.rol)));

  const esGerente = solicitud.firma_2_id === usuario.id && solicitud.firma_2_estado === 'pendiente';
  const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh' || usuario.rol === 'superadmin';

  const esRetardoRegresaAprob = ['retardo', 'falta'].includes((solicitud.tipo_permiso || '').toLowerCase()) && String(dictamenPago || '').toLowerCase().includes('regresa');
  const pagoEfectivo = (esRH && (!dictamenPago || String(dictamenPago).toLowerCase() === 'pendiente')) ? 'Con goce' : dictamenPago;

  const updates = {
    pago: esRetardoRegresaAprob ? 'Sin goce (Se regresa)' : pagoEfectivo,
    ...(esRetardoRegresaAprob ? { tipo_permiso: 'falta', total_horas: 8 } : {})
  };
  let siguientesEnFirmar = [];
  let nuevoFolioGenerado = null;
  let huboRelevoSubareaADepto = false;

  const obtenerUsuariosRH = async () => {
    const { data: rhUsers } = await supabase
      .from('usuarios')
      .select('id, rol')
      .in('rol', ['gerente_rh', 'rh_nominas'])
      .eq('activo', true);
    return rhUsers || [];
  };

  // SI ES UNA ANOMALÍA O DETENIDO EN PUERTA DE CASETA: CUALQUIERA DE LAS 3 FIRMAS QUE VALIDE LIBERA EL PASE Y NOTIFICA A LOS DEMÁS
  if (esUrgenciaEnPuerta && (esFirmante1Actual || esGerente || esRH)) {
    const obsBaseU = solicitud.observaciones || '';
    let etiquetaQuienU = 'Jefe';
    if (esRH && !esFirmante1Actual) etiquetaQuienU = 'RH';
    else if (esGerente) etiquetaQuienU = 'Gerencia';

    if (!obsBaseU.includes(usuario.nombre_completo)) {
      updates.observaciones = `${obsBaseU} | ✅ VoBo ${etiquetaQuienU}: ${usuario.nombre_completo}`;
    }

    if (esFirmante1Actual) {
      updates.firma_1_id = usuario.id;
      updates.firma_1_estado = 'autorizado';
      if (solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
      if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
    } else if (esGerente) {
      updates.firma_2_id = usuario.id;
      updates.firma_2_estado = 'autorizado';
      if (solicitud.firma_1_estado === 'pendiente') updates.firma_1_estado = 'omitido';
      if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
    } else if (esRH) {
      updates.firma_3_id = usuario.id;
      updates.firma_3_estado = 'autorizado';
      if (solicitud.firma_1_estado === 'pendiente') updates.firma_1_estado = 'omitido';
      if (solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
    }

    if (!updates.pago || String(updates.pago).toLowerCase().includes('pendiente')) {
      updates.pago = esRetardoRegresaAprob ? 'Sin goce (Se regresa)' : 'Con goce';
    }

    updates.estado_general = 'autorizado';
    siguientesEnFirmar = [];

    const nominaEmpleado = (solicitud.usuarios?.tipo_personal || solicitud.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
    const letra = nominaEmpleado.includes('admin') ? 'A' : (nominaEmpleado.includes('obra') ? 'O' : 'P');
    const anio = new Date().getFullYear().toString().slice(-2);
    if (!solicitud.folio || String(solicitud.folio).startsWith('REQ-') || String(solicitud.folio).startsWith('CAS-')) {
      nuevoFolioGenerado = await generarFolioOficial(letra, anio);
      updates.folio = nuevoFolioGenerado;
    } else {
      nuevoFolioGenerado = solicitud.folio;
    }
  } else {
    // FLUJO SECUENCIAL NORMAL PARA PERMISOS ORDINARIOS
    if (esFirmante1Actual) {
      if (usuario.rol === 'encargado') {
        const jefeDeptoId = await buscarJefeDeptoSuperior(usuario.id, solicitud.usuarios?.departamento_id);
        if (jefeDeptoId && jefeDeptoId !== usuario.id) {
          huboRelevoSubareaADepto = true;
          updates.firma_1_id = jefeDeptoId;
          updates.firma_1_estado = 'pendiente';
          updates.observaciones = `${solicitud.observaciones || ''} | ✅ VoBo Subárea: ${usuario.nombre_completo}`;
          siguientesEnFirmar.push(jefeDeptoId);
        }
      }

      if (!huboRelevoSubareaADepto) {
        updates.firma_1_estado = "autorizado";
        if (!solicitud.firma_1_id) updates.firma_1_id = usuario.id;
        const obsBase1 = updates.observaciones || solicitud.observaciones || "";
        if (!obsBase1.includes(usuario.nombre_completo)) {
          updates.observaciones = `${obsBase1} | ✅ VoBo Jefe: ${usuario.nombre_completo}`;
        }

        if (solicitud.firma_2_estado === 'pendiente' && solicitud.firma_2_id) {
          siguientesEnFirmar.push(solicitud.firma_2_id);
        } else if (solicitud.firma_3_estado === 'pendiente') {
          const rhUsers = await obtenerUsuariosRH();
          const filtrados = usuario.rol === 'rh_nominas'
            ? rhUsers.filter(u => u.id !== usuario.id).map(u => u.id)
            : rhUsers.map(u => u.id);
          if (filtrados.length > 0) siguientesEnFirmar.push(...filtrados);
          else if (solicitud.firma_3_id) siguientesEnFirmar.push(solicitud.firma_3_id);
        }
      }
    } else if (esGerente) {
      updates.firma_2_estado = "autorizado";
      const obsBase2 = updates.observaciones || solicitud.observaciones || "";
      if (!obsBase2.includes(usuario.nombre_completo)) {
        updates.observaciones = `${obsBase2} | ✅ VoBo Gerencia: ${usuario.nombre_completo}`;
      }
      if (solicitud.firma_3_estado === 'pendiente') {
        const rhUsers = await obtenerUsuariosRH();
        if (rhUsers.length > 0) siguientesEnFirmar.push(...rhUsers.map(u => u.id));
        else if (solicitud.firma_3_id) siguientesEnFirmar.push(solicitud.firma_3_id);
      }
    }

    const firma1EstabaListaAntes = ['autorizado', 'aprobado', 'auto_aprobado', 'omitido', 'no_aplica', 'escalado'].includes(solicitud.firma_1_estado);
    const firma1Lista = !huboRelevoSubareaADepto && ['autorizado', 'aprobado', 'auto_aprobado', 'omitido', 'no_aplica', 'escalado'].includes(updates.firma_1_estado || solicitud.firma_1_estado);
    const firma2Lista = ['autorizado', 'aprobado', 'auto_aprobado', 'omitido', 'no_aplica', 'escalado'].includes(updates.firma_2_estado || solicitud.firma_2_estado);

    const puedeCerrarFirma3EnEsteClic = usuario.rol === 'gerente_rh' || usuario.rol === 'superadmin' || firma1EstabaListaAntes;

    if (esRetardoRegresaAprob && !esRH) {
      updates.estado_general = 'autorizado';
      if (updates.firma_2_estado !== 'autorizado' && solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
      if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
      siguientesEnFirmar = [];
      const nominaEmpleado = (solicitud.usuarios?.tipo_personal || solicitud.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
      let letra = nominaEmpleado.includes('admin') ? 'A' : (nominaEmpleado.includes('obra') ? 'O' : 'P');
      const anio = new Date().getFullYear().toString().slice(-2);
      if (!solicitud.folio || String(solicitud.folio).startsWith('REQ-') || String(solicitud.folio).startsWith('CAS-')) {
        nuevoFolioGenerado = await generarFolioOficial(letra, anio);
        updates.folio = nuevoFolioGenerado;
      } else {
        nuevoFolioGenerado = solicitud.folio;
      }
    } else if (esRH && firma1Lista && firma2Lista && puedeCerrarFirma3EnEsteClic) {
      updates.firma_3_estado = 'autorizado';
      updates.estado_general = 'autorizado';
      updates.firma_3_id = usuario.id;
      siguientesEnFirmar = [];

      const nominaEmpleado = (solicitud.usuarios?.tipo_personal || solicitud.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
      let letra = 'P';
      if (nominaEmpleado.includes('admin')) letra = 'A';
      else if (nominaEmpleado.includes('obra')) letra = 'O';

      const anio = new Date().getFullYear().toString().slice(-2);
      if (!solicitud.folio || String(solicitud.folio).startsWith('REQ-') || String(solicitud.folio).startsWith('CAS-')) {
        nuevoFolioGenerado = await generarFolioOficial(letra, anio);
        updates.folio = nuevoFolioGenerado;
      } else {
        nuevoFolioGenerado = solicitud.folio;
      }
    }
  }

  if (comentarios && String(comentarios).trim()) {
    const partesNom = String(usuario.nombre_completo || '').trim().split(/\s+/).filter(Boolean);
    const nomCorto = partesNom.length > 2 ? `${partesNom[0]} ${partesNom[partesNom.length - 2]}` : partesNom.join(' ');
    let etiquetaRolNota = 'Jefe';
    if (usuario.rol === 'encargado') etiquetaRolNota = 'Subárea';
    else if ((esRH || usuario.rol === 'superadmin') && !esFirmante1Actual) etiquetaRolNota = 'RH';
    else if (esGerente) etiquetaRolNota = 'Gerencia';
    const comentarioLimpio = String(comentarios).replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();
    const baseObsNota = updates.observaciones || solicitud.observaciones || '';
    updates.observaciones = `${baseObsNota} | Nota ${etiquetaRolNota} (${nomCorto}): ${comentarioLimpio}`;
  }

  const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
  if (error) throw error;

  const tipoLower = (solicitud.tipo_permiso || '').toLowerCase();
  const estaEnPuerta = /\[LLEGADA EN PUERTA:/i.test(solicitud.observaciones || '');
  const seRegresaDictamen = String(dictamenPago || '').toLowerCase().includes('regresa');

  if (seRegresaDictamen) {
    await cancelarSalidasMismoDiaPorRetiro(solicitud.usuario_id, solicitud.fecha_permiso, updates.folio || solicitud.folio);
  }

  const obsOriginalInusual = solicitud.observaciones || '';
  const esInusualCaseta = /\[COMPORTAMIENTO INUSUAL EN CASETA/i.test(obsOriginalInusual);
  if (esInusualCaseta && updates.estado_general === 'autorizado' && !seRegresaDictamen) {
    try {
      const mLlegadaP = obsOriginalInusual.match(/\[LLEGADA EN PUERTA:\s*([^\]]+)\]/i);
      const horaRealPuerta = mLlegadaP ? mLlegadaP[1].replace(/\s*hrs/i, '').trim() : new Date().toTimeString().slice(0, 5);
      const obsConAvalInusual = `${updates.observaciones || obsOriginalInusual} | [COMPORTAMIENTO INUSUAL AUTORIZADO]`;

      if (/presentó en caseta.*FALTA|Tenía FALTA programada/i.test(obsOriginalInusual)) {
        await supabase.from('permisos').update({
          observaciones: `${obsConAvalInusual} | [ Reincorporación en día de falta autorizada a las ${horaRealPuerta} hrs ]`
        }).eq('id', solicitud.id);
      } else if (/VACACIONES.*reincorporarse antes/i.test(obsOriginalInusual)) {
        const hoyIso = obtenerFechaLocalHoyISO();
        if (solicitud.fecha_permiso < hoyIso) {
          const ayerDate = new Date();
          ayerDate.setDate(ayerDate.getDate() - 1);
          const ayerIso = new Date(ayerDate.getTime() - ayerDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
          await supabase.from('permisos').update({
            fecha_fin: ayerIso,
            observaciones: `${obsConAvalInusual} | [Vacaciones recortadas al ${ayerIso} por reincorporación autorizada en puerta]`
          }).eq('id', solicitud.id);
        } else {
          await supabase.from('permisos').update({
            observaciones: `${obsConAvalInusual} | [Reincorporación anticipada de vacaciones autorizada el ${hoyIso}]`
          }).eq('id', solicitud.id);
        }
      } else if (/SALIDA DEFINITIVA.*reingresar/i.test(obsOriginalInusual)) {
        await supabase.from('permisos').update({
          observaciones: `${obsConAvalInusual} (Regresa: ${horaRealPuerta} hrs)`
        }).eq('id', solicitud.id);
      } else {
        await supabase.from('permisos').update({ observaciones: obsConAvalInusual }).eq('id', solicitud.id);
      }
    } catch (eIn) {
      console.warn('Aviso al resolver comportamiento inusual:', eIn);
    }
  }

  if (tipoLower === 'salida' && /\[HORARIO NO COINCIDE EN CASETA/i.test(solicitud.observaciones || '') && updates.estado_general === 'autorizado') {
    try {
      const obsConAvalHorario = `${updates.observaciones || solicitud.observaciones || ''} | [HORARIO AUTORIZADO EN CASETA]`;
      await supabase.from('permisos').update({ observaciones: obsConAvalHorario }).eq('id', solicitud.id);
    } catch (_) {}
  }

  if (/FALTA PREVIA SIN AVISO/i.test(solicitud.asunto_motivo || '') && updates.estado_general === 'autorizado' && !seRegresaDictamen) {
    try {
      const { data: faltasPrevias } = await supabase
        .from('permisos')
        .select('id, observaciones')
        .eq('usuario_id', solicitud.usuario_id)
        .eq('tipo_permiso', 'falta')
        .ilike('asunto_motivo', '%SIN AVISO%');
      for (const fp of (faltasPrevias || [])) {
        if (!String(fp.observaciones || '').includes('[REINCORPORACION AUTORIZADA]')) {
          await supabase
            .from('permisos')
            .update({ observaciones: `${fp.observaciones || ''} | [REINCORPORACION AUTORIZADA]` })
            .eq('id', fp.id);
        }
      }
    } catch (_) {}
  }

  if (esUrgenciaEnPuerta && updates.estado_general === 'autorizado') {
    await notificarRetroalimentacionFirmantes({
      solicitud,
      usuarioResolvio: usuario,
      veredictoTexto: seRegresaDictamen ? 'SE REGRESA A CASA' : `ACCESO AUTORIZADO (${updates.pago})`,
      comentarioTexto: comentarios
    });
  }

  if ((tipoLower === 'retardo' || tipoLower === 'falta' || esInusualCaseta) && estaEnPuerta) {
    const yaResolvioJefeORH =
      updates.estado_general === 'autorizado' ||
      seRegresaDictamen;

    if (yaResolvioJefeORH) {
      try {
        const { data: guardias } = await supabase.from('usuarios').select('id').eq('rol', 'caseta').eq('activo', true);
        if (guardias && guardias.length > 0) {
          const nomTrab = solicitud.usuarios?.nombre_completo || 'Colaborador';
          await enviarNotificacionPushUsuarios(guardias.map(g => g.id), {
            titulo: seRegresaDictamen ? '🚫 ACCESO DENEGADO' : '🟢 ACCESO AUTORIZADO',
            mensaje: seRegresaDictamen
              ? `👤 ${nomTrab} • Se retira de planta.`
              : `👤 ${nomTrab} • Dar paso a planta.`,
            fotoUrl: solicitud.usuarios?.foto_url || null,
            urlDestino: '/caseta/asistencia'
          });
        }
      } catch (_) {}
    }
  }

  if (tipoLower === 'salida' && updates.estado_general === 'autorizado') {
    try {
      const { data: guardias } = await supabase.from('usuarios').select('id').eq('rol', 'caseta').eq('activo', true);
      if (guardias && guardias.length > 0) {
        const nomTrab = solicitud.usuarios?.nombre_completo || 'Colaborador';
        await enviarNotificacionPushUsuarios(guardias.map(g => g.id), {
          titulo: '🔵 PASE DE SALIDA AUTORIZADO',
          mensaje: `👤 ${nomTrab} • Autorizado para salir de planta.`,
          fotoUrl: solicitud.usuarios?.foto_url || null,
          urlDestino: '/caseta'
        });
      }
    } catch (_) {}
  }

  if (updates.estado_general === 'autorizado') {
    const tipoPase = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
    await enviarNotificacionPushUsuarios(solicitud.usuario_id, {
      titulo: seRegresaDictamen ? '↩️ Acceso no autorizado' : `✅ ${tipoPase} Autorizado`,
      mensaje: seRegresaDictamen
        ? `Folio: ${nuevoFolioGenerado} • Instrucción: Retirarse de planta.`
        : `Folio Oficial: ${nuevoFolioGenerado} • Tu solicitud ha sido autorizada.`,
      urlDestino: '/mis-permisos'
    });
  } else if (siguientesEnFirmar.length > 0) {
    const nombreSolicitante = solicitud.usuarios?.nombre_completo || 'Un colaborador';
    const fotoSolicitante = solicitud.usuarios?.foto_url || null;
    const asuntoRaw = solicitud.asunto_motivo || '';
    const matchMotivo = asuntoRaw.match(/\[(.*?)\]\s*(.*)/);
    const naturalezaClean = matchMotivo ? matchMotivo[1].toUpperCase() : '';
    const motivoLimpio = matchMotivo ? matchMotivo[2] : asuntoRaw;

    const mapaTitulos = { salida: 'SALIDA ANTICIPADA', retardo: 'RETARDO', falta: 'FALTA PROGRAMADA', vacaciones: 'VACACIONES' };
    const titNotif = mapaTitulos[solicitud.tipo_permiso] || solicitud.tipo_permiso.toUpperCase();

    let etiquetaNaturaleza = '🏠 PERSONAL / FAMILIAR';
    if (naturalezaClean === 'ASUNTO DE TRABAJO') etiquetaNaturaleza = '💼 ASUNTO LABORAL';
    else if (naturalezaClean.includes('CITA')) etiquetaNaturaleza = '🏥 CITA MÉDICA';
    else if (naturalezaClean === 'VACACIONES' || solicitud.tipo_permiso === 'vacaciones') etiquetaNaturaleza = '🌴 PERIODO VACACIONAL';
    else if (naturalezaClean) etiquetaNaturaleza = `🏠 ${naturalezaClean}`;

    const horarioLimpio = (solicitud.observaciones || '').split(' | ')[0];

    await enviarNotificacionPushUsuarios([...new Set(siguientesEnFirmar)], {
      titulo: titNotif,
      mensaje: `👤 ${nombreSolicitante}\n${etiquetaNaturaleza}\n${horarioLimpio}\n💬 ${motivoLimpio}`,
      fotoUrl: fotoSolicitante,
      urlDestino: '/aprobaciones'
    });
  }
};

// 7. RECHAZAR SOLICITUD O DICTAMINAR REGRESO A CASA (Aprobaciones)
export const rechazarSolicitudPermiso = async ({ solicitud, usuario, motivoRechazo }) => {
  const { data: actualBD, error: errCheck } = await supabase
    .from('permisos')
    .select('id, folio, usuario_id, fecha_permiso, tipo_permiso, estado_general, pago, observaciones, firma_1_id, firma_1_estado, firma_2_id, firma_2_estado, firma_3_id, firma_3_estado')
    .eq('id', solicitud.id)
    .single();

  if (errCheck || !actualBD) {
    throw new Error('No se pudo verificar el estado actual de la solicitud.');
  }
  if (['autorizado', 'aprobado', 'completado_caseta', 'rechazado', 'cancelado'].includes(actualBD.estado_general)) {
    throw new Error(`Esta solicitud ya fue dictaminada hace unos instantes (Folio ${actualBD.folio} • ${actualBD.pago || actualBD.estado_general}). Actualiza tu bandeja.`);
  }
  solicitud = { ...solicitud, ...actualBD };

  const esFirmante1 = ['encargado', 'jefe_area'].includes(usuario.rol) || solicitud.firma_1_id === usuario.id;
  const esGerente = solicitud.firma_2_id === usuario.id;
  const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh' || usuario.rol === 'superadmin';

  const hoyIso = obtenerFechaLocalHoyISO();
  const tipoRechLower = (solicitud.tipo_permiso || '').toLowerCase();
  const obsRechActual = String(solicitud.observaciones || '');
  const estaEnPuertaRech = /\[LLEGADA EN PUERTA:/i.test(obsRechActual);
  const esInusualRech = /\[COMPORTAMIENTO INUSUAL EN CASETA/i.test(obsRechActual);
  const esDesfaseSalidaRech = tipoRechLower === 'salida' && /\[HORARIO NO COINCIDE EN CASETA/i.test(obsRechActual);

  // Diferenciar Retardo del Día/En Puerta (Se regresa a casa -> Falta) vs Retardo Anticipado de días futuros (Rechazo simple)
  const esRetardoDelDiaOEnPuerta =
    (tipoRechLower === 'retardo' && (solicitud.fecha_permiso <= hoyIso || estaEnPuertaRech)) ||
    (tipoRechLower === 'falta' && /FALTA PREVIA SIN AVISO/i.test(solicitud.asunto_motivo || ''));

  const partesNomRech = String(usuario.nombre_completo || '').trim().split(/\s+/).filter(Boolean);
  const nomCortoRech = partesNomRech.length > 2 ? `${partesNomRech[0]} ${partesNomRech[partesNom.length - 2]}` : partesNom.join(' ');
  const motivoLimpioRech = String(motivoRechazo || '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();

  const etiquetaBitacora = esRetardoDelDiaOEnPuerta
    ? `Nota Dictamen (${nomCortoRech}): Se regresa a casa — ${motivoLimpioRech}`
    : `RECHAZO (${nomCortoRech}): ${motivoLimpioRech}`;

  let updates = {
    estado_general: (esRetardoDelDiaOEnPuerta || esInusualRech || esDesfaseSalidaRech) ? 'autorizado' : 'rechazado',
    ...(esRetardoDelDiaOEnPuerta ? {
      tipo_permiso: 'falta',
      pago: 'Sin goce (Se regresa)',
      total_horas: 8
    } : {}),
    observaciones: `${solicitud.observaciones || ''} | ${etiquetaBitacora}`
  };

  if (esInusualRech && (tipoRechLower === 'vacaciones' || tipoRechLower === 'falta')) {
    const obsRestaurada = obsRechActual
      .replace(/\s*\|\s*⚠️\s*\[COMPORTAMIENTO INUSUAL EN CASETA[^\]]*\]/gi, '')
      .replace(/\s*\|\s*\[LLEGADA EN PUERTA:[^\]]*\]/gi, '')
      .trim();
    updates = {
      estado_general: 'autorizado',
      pago: tipoRechLower === 'vacaciones' ? 'Con goce' : (solicitud.pago && !solicitud.pago.includes('Cambio en Caseta') ? solicitud.pago : 'Sin goce'),
      observaciones: `${obsRestaurada} | ${etiquetaBitacora}`
    };
  } else if (esDesfaseSalidaRech) {
    const yaHabiaSalido = /\[SALIDA CASETA:/i.test(obsRechActual);
    updates = {
      estado_general: yaHabiaSalido ? 'autorizado' : 'rechazado',
      pago: yaHabiaSalido ? 'Sin goce (Se regresa)' : 'Rechazado',
      observaciones: `${obsRechActual} | ${etiquetaBitacora}`
    };
  }

  if (esRetardoDelDiaOEnPuerta && String(solicitud.folio || '').startsWith('REQ-')) {
    const nominaEmpleado = (solicitud.usuarios?.tipo_personal || solicitud.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
    let letra = 'P';
    if (nominaEmpleado.includes('admin')) letra = 'A';
    else if (nominaEmpleado.includes('obra')) letra = 'O';
    const anio = new Date().getFullYear().toString().slice(-2);
    updates.folio = await generarFolioOficial(letra, anio);
  }

  if (esRH && solicitud.firma_3_estado === 'pendiente' && solicitud.firma_1_id !== usuario.id) {
    updates.firma_3_id = usuario.id;
    updates.firma_3_estado = esRetardoDelDiaOEnPuerta ? 'autorizado' : 'rechazado';
    if (solicitud.firma_1_estado === 'pendiente') updates.firma_1_estado = 'omitido';
    if (solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
  } else if (esGerente && solicitud.firma_2_estado === 'pendiente') {
    updates.firma_2_id = usuario.id;
    updates.firma_2_estado = esRetardoDelDiaOEnPuerta ? 'autorizado' : 'rechazado';
    if (solicitud.firma_1_estado === 'pendiente') updates.firma_1_estado = 'omitido';
    if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
  } else if (esFirmante1 && solicitud.firma_1_estado === 'pendiente') {
    updates.firma_1_id = usuario.id;
    updates.firma_1_estado = esRetardoDelDiaOEnPuerta ? 'autorizado' : 'rechazado';
    if (solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
    if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
  } else {
    updates.firma_1_id = usuario.id;
    updates.firma_1_estado = esRetardoDelDiaOEnPuerta ? 'autorizado' : 'rechazado';
    if (solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
    if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
  }

  const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
  if (error) throw error;

  if (esRetardoDelDiaOEnPuerta) {
    await cancelarSalidasMismoDiaPorRetiro(solicitud.usuario_id, solicitud.fecha_permiso, updates.folio || solicitud.folio);
  }

  if (estaEnPuertaRech || esInusualRech || esDesfaseSalidaRech) {
    await notificarRetroalimentacionFirmantes({
      solicitud,
      usuarioResolvio: usuario,
      veredictoTexto: esRetardoDelDiaOEnPuerta ? 'SE REGRESA A CASA (SIN ACCESO)' : 'ACCESO / CAMBIO DENEGADO',
      comentarioTexto: motivoLimpioRech
    });
  }

  if (estaEnPuertaRech) {
    try {
      const { data: guardias } = await supabase.from('usuarios').select('id').eq('rol', 'caseta').eq('activo', true);
      if (guardias && guardias.length > 0) {
        const nomTrab = solicitud.usuarios?.nombre_completo || 'Colaborador';
        await enviarNotificacionPushUsuarios(guardias.map(g => g.id), {
          titulo: '🚫 ACCESO DENEGADO',
          mensaje: `👤 ${nomTrab} • Se retira de planta.`,
          fotoUrl: solicitud.usuarios?.foto_url || null,
          urlDestino: '/caseta/asistencia'
        });
      }
    } catch (_) {}
  }

  const tipoPaseR = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
  await enviarNotificacionPushUsuarios(solicitud.usuario_id, {
    titulo: esRetardoDelDiaOEnPuerta ? '↩️ Acceso no autorizado (Se regresa)' : `❌ ${tipoPaseR} Rechazado`,
    mensaje: esRetardoDelDiaOEnPuerta
      ? `Falta por retardo (${updates.folio || solicitud.folio}) • Motivo: ${motivoRechazo}`
      : `Motivo: ${motivoRechazo}`,
    urlDestino: '/mis-permisos'
  });
};

// 8. FORZAR SALTO DE FIRMA POR RH (Override)
export const forzarSaltoFirmaRH = async (solicitud) => {
  let updates = {};
  let siguienteFirmanteId = null;

  if (solicitud.firma_1_estado === 'pendiente') {
    updates = { firma_1_estado: 'escalado', observaciones: `${solicitud.observaciones || ''} | 🛡️ RH forzó salto de Jefe.` };
    siguienteFirmanteId = solicitud.firma_2_estado === 'pendiente' ? solicitud.firma_2_id : solicitud.firma_3_id;
  } else if (solicitud.firma_2_estado === 'pendiente') {
    updates = { firma_2_estado: 'escalado', observaciones: `${solicitud.observaciones || ''} | 🛡️ RH forzó salto de Gerencia.` };
    siguienteFirmanteId = solicitud.firma_3_id;
  }

  const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
  if (error) throw error;

  if (siguienteFirmanteId) {
    await enviarNotificacionPushUsuarios(siguienteFirmanteId, {
      titulo: "🚨 Pase Escalado por RH",
      mensaje: `El pase de ${solicitud.usuarios?.nombre_completo} requiere tu atención urgente.`,
      urlDestino: "/aprobaciones"
    });
  }
};

// 9. CREAR NUEVA SOLICITUD DE PASE
export const crearNuevaSolicitudPermiso = async ({
  userId, rolUsuario, deptoId, sedeId, tipoPersonal, nombreSolicitante, fotoSolicitante,
  tipoPermiso, naturaleza, fechaHoy, fechaPermiso, fechaFinVacaciones,
  horaSalida, regresaMismoDia, horaRegreso, horaLlegadaRetardo, motivo, totalHoras, esRetardoUrgente
}) => {
  const fechaInicioNueva = fechaPermiso;
  const fechaFinNueva = tipoPermiso === 'vacaciones' ? (fechaFinVacaciones || fechaPermiso) : fechaPermiso;

  const [{ data: pasesUsuario }, { data: asistenciaDia }] = await Promise.all([
    supabase
      .from('permisos')
      .select('id, folio, fecha_permiso, fecha_fin, tipo_permiso, estado_general, pago, observaciones')
      .eq('usuario_id', userId)
      .lte('fecha_permiso', fechaFinNueva),
    supabase
      .from('asistencias_caseta')
      .select('hora_entrada, hora_salida')
      .eq('usuario_id', userId)
      .eq('fecha', fechaPermiso)
      .maybeSingle()
  ]);

  const activosMismaFecha = (pasesUsuario || []).filter(p => {
    const finPase = p.fecha_fin || p.fecha_permiso;
    const seTraslapa = p.fecha_permiso <= fechaFinNueva && finPase >= fechaInicioNueva;
    if (!seTraslapa) return false;

    const pagoL = String(p.pago || '').toLowerCase();
    const obsL = String(p.observaciones || '');
    const esCancelado = pagoL === 'cancelado' || /CANCELADO por/i.test(obsL) || /\[PASE CANCELADO/i.test(obsL);
    if (esCancelado) return false;

    const esRegresoCasa = pagoL.includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(obsL);
    if (p.estado_general === 'rechazado' && !esRegresoCasa) return false;

    return true;
  });

  const paseRegresadoACasa = activosMismaFecha.find(p =>
    (p.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(p.observaciones || '')
  );
  const paseAusenciaCompleta = activosMismaFecha.find(p =>
    ['falta', 'vacaciones'].includes((p.tipo_permiso || '').toLowerCase())
  );
  const retardoPrevio = activosMismaFecha.find(p => (p.tipo_permiso || '').toLowerCase() === 'retardo');
  const salidasPrevias = activosMismaFecha.filter(p => (p.tipo_permiso || '').toLowerCase() === 'salida');

  if (paseRegresadoACasa) {
    throw new Error(`No es posible generar otro permiso para esta fecha porque ya existe un dictamen de retiro de planta (Falta por retardo • Folio ${paseRegresadoACasa.folio}).`);
  }

  if (paseAusenciaCompleta) {
    const etiquetaExistente = (paseAusenciaCompleta.tipo_permiso || '').toUpperCase();
    throw new Error(`No es posible registrar este permiso porque ya existe un registro de ${etiquetaExistente} (${paseAusenciaCompleta.folio} del ${paseAusenciaCompleta.fecha_permiso}) en ese rango de fechas.`);
  }

  if (tipoPermiso === 'retardo') {
    if (retardoPrevio) {
      throw new Error(`Ya existe un registro de retardo (${retardoPrevio.folio}) para esta fecha. No es posible generar dos retardos el mismo día.`);
    }
    if (asistenciaDia?.hora_entrada) {
      throw new Error(`No es posible solicitar un Retardo para esta fecha porque ya cuentas con registro de entrada en planta (${asistenciaDia.hora_entrada} hrs).`);
    }
  }

  if (tipoPermiso === 'salida') {
    if (asistenciaDia?.hora_salida) {
      throw new Error(`No es posible solicitar una Salida porque ya registraste tu salida definitiva de planta hoy (${asistenciaDia.hora_salida} hrs).`);
    }
    if (retardoPrevio && retardoPrevio.estado_general === 'en_firmas') {
      throw new Error(`Tienes un pase de Retardo (${retardoPrevio.folio}) pendiente de autorización. Podrás solicitar una Salida una vez que tu entrada haya sido autorizada.`);
    }
    const salidaAbierta = salidasPrevias.find(s => !/\[(?:REINGRESO|ENTRADA) CASETA:/i.test(String(s.observaciones || '')) && s.estado_general !== 'completado_caseta');
    if (salidaAbierta) {
      throw new Error(`Ya cuentas con un pase de Salida activo (${salidaAbierta.folio}) para esta fecha. No es posible duplicar pases de salida.`);
    }
  }

  if (tipoPermiso === 'falta' || tipoPermiso === 'vacaciones') {
    if (asistenciaDia?.hora_entrada) {
      throw new Error(`No es posible registrar ${tipoPermiso} para esta fecha porque ya tienes registro de entrada en planta (${asistenciaDia.hora_entrada} hrs).`);
    }
    if (salidasPrevias.length > 0) {
      throw new Error(`No es posible registrar ${tipoPermiso} porque ya cuentas con un pase de Salida Anticipada (${salidasPrevias[0].folio} el ${salidasPrevias[0].fecha_permiso}) en las fechas seleccionadas.`);
    }
    if (retardoPrevio && tieneSelloFisicoCaseta(retardoPrevio)) {
      throw new Error(`No es posible registrar ${tipoPermiso} porque ya tienes un registro de llegada en Caseta (${retardoPrevio.folio}).`);
    }
    if (tipoPermiso === 'vacaciones' && retardoPrevio) {
      throw new Error(`El periodo de vacaciones se traslapa con un pase de Retardo previo (${retardoPrevio.folio} del ${retardoPrevio.fecha_permiso}). Cancela primero ese pase si tomarás vacaciones.`);
    }
    const pasesSinSello = (tipoPermiso === 'falta' && retardoPrevio && !tieneSelloFisicoCaseta(retardoPrevio)) ? [retardoPrevio] : [];
    for (const pPrev of pasesSinSello) {
      const obsSustituida = `${pPrev.observaciones || ''} | CANCELADO por Sistema: Sustituido por reporte de ${tipoPermiso.toUpperCase()} del mismo día`;
      const { error: errSust } = await supabase
        .from('permisos')
        .update({
          estado_general: 'rechazado',
          pago: 'Cancelado',
          observaciones: obsSustituida
        })
        .eq('id', pPrev.id);

      if (errSust) {
        await supabase
          .from('permisos')
          .update({
            estado_general: 'rechazado',
            pago: 'Sin goce',
            observaciones: obsSustituida
          })
          .eq('id', pPrev.id);
      }
    }
  }

  const esMismoDiaSolicitud = fechaPermiso === fechaHoy;

  const {
    depto,
    jefeFinalId,
    gerenteFinalId,
    rhFinalId,
    estadoFirma1,
    estadoFirma2,
    estadoFirma3,
    notificarA
  } = await resolverCadenaFirmasPorEcualizador({
    userId,
    rolUsuario,
    deptoId,
    tipoPermiso,
    esMismoDia: esMismoDiaSolicitud
  });

  if (!depto) throw new Error("No se encontró el departamento del colaborador.");

  const hayPendientes = [estadoFirma1, estadoFirma2, estadoFirma3].includes('pendiente');
  const estadoGeneral = hayPendientes ? 'en_firmas' : 'autorizado';

  let esSantaCatarina = false;
  if (sedeId) {
    const { data: sedeData } = await supabase.from('sedes').select('nombre').eq('id', sedeId).maybeSingle();
    if (sedeData && sedeData.nombre.toLowerCase().includes('catarina')) esSantaCatarina = true;
  }

  let folioTemporal = `REQ-${Math.floor(100000 + Math.random() * 900000)}`;
  if (!hayPendientes) {
    const nominaRef = (tipoPersonal || depto.clasificacion || 'produccion').toLowerCase();
    const letraAuto = nominaRef.includes('admin') ? 'A' : (nominaRef.includes('obra') ? 'O' : 'P');
    const anioAuto = new Date().getFullYear().toString().slice(-2);
    folioTemporal = await generarFolioOficial(letraAuto, anioAuto);
  }

  let detalleHorarioTexto = '';
  if (tipoPermiso === 'salida') {
    detalleHorarioTexto = regresaMismoDia ? `🕒 Salida: ${horaSalida} hrs (Regresa: ${horaRegreso} hrs)` : `🕒 Salida definitiva: ${horaSalida} hrs`;
  } else if (tipoPermiso === 'retardo') {
    detalleHorarioTexto = `🕒 Llegada estimada: ${horaLlegadaRetardo} hrs`;
  } else if (tipoPermiso === 'vacaciones') {
    detalleHorarioTexto = `📅 Del ${fechaPermiso} al ${fechaFinVacaciones || fechaPermiso}`;
  } else {
    detalleHorarioTexto = `📅 Para el: ${fechaPermiso}`;
  }

  const requiereCasetaAuto = esSantaCatarina && (tipoPermiso === 'salida' || tipoPermiso === 'retardo');

  const { error: errInsert } = await supabase
    .from('permisos')
    .insert([{
      folio: folioTemporal,
      usuario_id: userId,
      fecha_elaboracion: fechaHoy,
      fecha_permiso: fechaPermiso,
      fecha_fin: tipoPermiso === 'vacaciones' ? (fechaFinVacaciones || fechaPermiso) : null,
      tipo_permiso: tipoPermiso,
      pago: hayPendientes ? 'Pendiente de dictamen' : 'Con goce',
      asunto_motivo: tipoPermiso === 'vacaciones' ? `[VACACIONES] ${motivo.trim()}` : `[${naturaleza.toUpperCase()}] ${motivo.trim()}`,
      total_horas: totalHoras,
      observaciones: detalleHorarioTexto,
      firma_empleado: true,
      firma_1_id: jefeFinalId,
      firma_1_estado: estadoFirma1,
      firma_2_id: gerenteFinalId,
      firma_2_estado: estadoFirma2,
      firma_3_id: rhFinalId,
      firma_3_estado: estadoFirma3,
      requiere_caseta: requiereCasetaAuto,
      estado_general: estadoGeneral
    }]);

  if (errInsert) throw errInsert;

  if (notificarA.length > 0) {
    const mapaTitulos = { salida: 'SALIDA ANTICIPADA', retardo: 'RETARDO', falta: 'FALTA PROGRAMADA', vacaciones: 'VACACIONES' };
    let tituloNotif = mapaTitulos[tipoPermiso] || tipoPermiso.toUpperCase();
    if (esRetardoUrgente) tituloNotif = `🚨 URGENTE: ${tituloNotif}`;

    let etiquetaNat = '🏠 PERSONAL / FAMILIAR';
    if (naturaleza === 'Asunto de Trabajo') etiquetaNat = '💼 ASUNTO LABORAL';
    else if (naturaleza.includes('Cita')) etiquetaNat = '🏥 CITA MÉDICA';
    else if (tipoPermiso === 'vacaciones') etiquetaNat = '🌴 PERIODO VACACIONAL';

    await enviarNotificacionPushUsuarios([...new Set(notificarA.filter(Boolean))], {
      titulo: tituloNotif,
      mensaje: `👤 ${nombreSolicitante}\n${etiquetaNat}\n${detalleHorarioTexto}\n💬 ${motivo.trim()}`,
      fotoUrl: fotoSolicitante,
      urlDestino: '/aprobaciones'
    });
  }

  return folioTemporal;
};

// 10. CATÁLOGO SIMPLE DE DEPARTAMENTOS PARA FILTROS (ControlHistorial)
export const obtenerCatalogoDepartamentosSimple = async () => {
  const { data, error } = await supabase
    .from('departamentos')
    .select('id, nombre')
    .order('nombre', { ascending: true });
  if (error) throw error;
  return data || [];
};

// 11. HISTORIAL GENERAL CON FILTROS PARA RH (ControlHistorial)
export const obtenerHistorialGeneralPermisos = async ({ deptoFiltro = 'todos', tipoFiltro = 'todos', fechaInicio = '', fechaFin = '' } = {}) => {
  await sincronizarCierreTurnoAutomatico();
  let query = supabase
    .from('permisos')
    .select(`
      *,
      usuarios:usuario_id (
        id, numero_empleado, nombre_completo, area, puesto, tipo_personal, foto_url, firma_url, departamento_id,
        departamentos:departamento_id (id, nombre, clasificacion),
        sedes:sede_id (nombre),
        supervisor:reporta_a_id (id, nombre_completo, rol, puesto, firma_url)
      ),
      firmante1:firma_1_id (id, nombre_completo, rol, puesto, firma_url),
      firmante2:firma_2_id (id, nombre_completo, rol, puesto, firma_url),
      firmante3:firma_3_id (id, nombre_completo, rol, puesto, firma_url)
    `)
    .in('estado_general', ['autorizado', 'aprobado', 'completado_caseta', 'rechazado'])
    .order('created_at', { ascending: false });

  if (tipoFiltro && tipoFiltro !== 'todos') {
    query = query.eq('tipo_permiso', tipoFiltro);
  }
  if (fechaInicio) {
    query = query.gte('fecha_permiso', fechaInicio);
  }
  if (fechaFin) {
    query = query.lte('fecha_permiso', fechaFin);
  }

  const { data, error } = await query;
  if (error) throw error;

  let resultado = data || [];
  if (deptoFiltro && deptoFiltro !== 'todos') {
    resultado = resultado.filter(
      p => String(p.usuarios?.departamento_id) === String(deptoFiltro)
    );
  }

  return resultado;
};

// 12. OBTENER DETALLE DE PERMISO PARA APROBACIÓN RÁPIDA (AprobarDirecto)
export const obtenerPermisoPorId = async (permisoId) => {
  const { data, error } = await supabase
    .from('permisos')
    .select(`
      *,
      usuarios:usuario_id (
        id, nombre_completo, numero_empleado, area, puesto, tipo_personal, foto_url, departamento_id,
        departamentos:departamento_id (nombre, clasificacion)
      )
    `)
    .eq('id', permisoId)
    .single();

  if (error || !data) {
    throw new Error('El permiso no existe o el enlace ha caducado.');
  }
  return data;
};

// 13. AUTORIZAR DESDE LINK RÁPIDO DE JEFATURA (AprobarDirecto)
export const autorizarPermisoDirectoJefatura = async (permiso, dictamenPago) => {
  const { data: actualBD } = await supabase
    .from('permisos')
    .select('id, folio, usuario_id, fecha_permiso, tipo_permiso, estado_general, pago, observaciones, firma_1_id, firma_1_estado, firma_2_id, firma_2_estado, firma_3_id, firma_3_estado')
    .eq('id', permiso.id)
    .maybeSingle();

  if (actualBD && ['autorizado', 'aprobado', 'completado_caseta', 'rechazado', 'cancelado'].includes(actualBD.estado_general)) {
    throw new Error(`Esta solicitud ya fue dictaminada previamente (Folio ${actualBD.folio}).`);
  }
  if (actualBD) permiso = { ...permiso, ...actualBD };

  const esRetRegresa = (permiso.tipo_permiso || '').toLowerCase() === 'retardo' && String(dictamenPago || '').toLowerCase().includes('regresa');
  let updates = {
    pago: esRetRegresa ? 'Sin goce (Se regresa)' : dictamenPago,
    ...(esRetRegresa ? { tipo_permiso: 'falta', total_horas: 8 } : {})
  };
  let siguientesEnFirmar = [];
  let etiquetaNotificacion = "Gerencia";

  if (esRetRegresa) {
    updates.firma_1_estado = 'autorizado';
    if (permiso.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
    if (permiso.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
    updates.estado_general = 'autorizado';
    siguientesEnFirmar = [];
    etiquetaNotificacion = "Caseta de Vigilancia (Retiro de planta)";
    if (String(permiso.folio || '').startsWith('REQ-')) {
      const nominaEmp = (permiso.usuarios?.tipo_personal || permiso.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
      const letra = nominaEmp.includes('admin') ? 'A' : (nominaEmp.includes('obra') ? 'O' : 'P');
      const anio = new Date().getFullYear().toString().slice(-2);
      updates.folio = await generarFolioOficial(letra, anio);
    }
  } else {
    updates.firma_1_estado = 'autorizado';
    if (permiso.firma_2_estado === 'pendiente' && permiso.firma_2_id) {
      siguientesEnFirmar.push(permiso.firma_2_id);
    } else if (permiso.firma_3_estado === 'pendiente') {
      etiquetaNotificacion = "Recursos Humanos";
      const { data: rhUsers } = await supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']).eq('activo', true);
      if (rhUsers && rhUsers.length > 0) {
        siguientesEnFirmar = rhUsers.map(u => u.id);
      } else if (permiso.firma_3_id) {
        siguientesEnFirmar.push(permiso.firma_3_id);
      }
    }
  }

  const { error } = await supabase
    .from('permisos')
    .update(updates)
    .eq('id', permiso.id);

  if (error) throw error;

  if (esRetRegresa) {
    await cancelarSalidasMismoDiaPorRetiro(permiso.usuario_id, permiso.fecha_permiso, updates.folio || permiso.folio);
  }

  if (siguientesEnFirmar.length > 0) {
    const nombreSolicitante = permiso.usuarios?.nombre_completo || 'Un colaborador';
    const asuntoRaw = permiso.asunto_motivo || '';
    const matchMotivo = asuntoRaw.match(/\[(.*?)\]\s*(.*)/);
    const natClean = matchMotivo ? matchMotivo[1].toUpperCase() : '';
    const motClean = matchMotivo ? matchMotivo[2] : asuntoRaw;

    const mapaTitulos = { salida: 'SALIDA ANTICIPADA', retardo: 'RETARDO', falta: 'FALTA PROGRAMADA', vacaciones: 'VACACIONES' };
    const titNotif = mapaTitulos[permiso.tipo_permiso] || permiso.tipo_permiso.toUpperCase();

    let etiquetaNaturaleza = '🏠 PERSONAL / FAMILIAR';
    if (natClean === 'ASUNTO DE TRABAJO') etiquetaNaturaleza = '💼 ASUNTO LABORAL';
    else if (natClean.includes('CITA')) etiquetaNaturaleza = '🏥 CITA MÉDICA';
    else if (natClean === 'VACACIONES' || permiso.tipo_permiso === 'vacaciones') etiquetaNaturaleza = '🌴 PERIODO VACACIONAL';
    else if (natClean) etiquetaNaturaleza = `🏠 ${natClean}`;

    const horarioLimpio = (permiso.observaciones || '').split(' | ')[0];

    await enviarNotificacionPushUsuarios([...new Set(siguientesEnFirmar)], {
      titulo: titNotif,
      mensaje: `👤 ${nombreSolicitante}\n${etiquetaNaturaleza}\n${horarioLimpio}\n💬 ${motClean}`,
      urlDestino: '/aprobaciones'
    });
  }

  if ((permiso.tipo_permiso || '').toLowerCase() === 'retardo' && /\[LLEGADA EN PUERTA:/i.test(permiso.observaciones || '')) {
    const seRegresa = String(dictamenPago || '').toLowerCase().includes('regresa');
    if (seRegresa) {
      try {
        const { data: guardias } = await supabase.from('usuarios').select('id').eq('rol', 'caseta').eq('activo', true);
        if (guardias && guardias.length > 0) {
          const nomTrab = permiso.usuarios?.nombre_completo || 'Colaborador';
          await enviarNotificacionPushUsuarios(guardias.map(g => g.id), {
            titulo: '🚫 ACCESO DENEGADO',
            mensaje: `👤 ${nomTrab} • Se retira de planta.`,
            fotoUrl: permiso.usuarios?.foto_url || null,
            urlDestino: '/caseta/asistencia'
          });
        }
      } catch (_) {}
    }
  }

  return etiquetaNotificacion;
};

// 14. RECHAZAR DESDE LINK RÁPIDO DE JEFATURA (AprobarDirecto)
export const rechazarPermisoDirectoJefatura = async (permiso, motivoRechazo) => {
  const { data: actualBD } = await supabase
    .from("permisos")
    .select("id, folio, usuario_id, fecha_permiso, tipo_permiso, estado_general, pago, observaciones, firma_1_estado, firma_2_estado, firma_3_estado")
    .eq("id", permiso.id)
    .maybeSingle();
  if (actualBD && ["autorizado", "aprobado", "completado_caseta", "rechazado", "cancelado"].includes(actualBD.estado_general)) {
    throw new Error(`Esta solicitud ya fue dictaminada previamente (Folio ${actualBD.folio}).`);
  }
  if (actualBD) permiso = { ...permiso, ...actualBD };

  const hoyIso = obtenerFechaLocalHoyISO();
  const estaEnPuerta = /\[LLEGADA EN PUERTA:/i.test(permiso.observaciones || '');
  const esRetDelDia = (permiso.tipo_permiso || '').toLowerCase() === 'retardo' && (permiso.fecha_permiso <= hoyIso || estaEnPuerta);

  let folioOficial = permiso.folio;
  if (esRetDelDia && String(permiso.folio || '').startsWith('REQ-')) {
    const nominaEmp = (permiso.usuarios?.tipo_personal || permiso.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
    const letra = nominaEmp.includes('admin') ? 'A' : (nominaEmp.includes('obra') ? 'O' : 'P');
    const anio = new Date().getFullYear().toString().slice(-2);
    folioOficial = await generarFolioOficial(letra, anio);
  }
  const { error } = await supabase
    .from('permisos')
    .update({
      folio: folioOficial,
      firma_1_estado: esRetDelDia ? 'autorizado' : 'rechazado',
      firma_2_estado: permiso.firma_2_estado === 'pendiente' ? 'omitido' : permiso.firma_2_estado,
      firma_3_estado: permiso.firma_3_estado === 'pendiente' ? 'omitido' : permiso.firma_3_estado,
      estado_general: esRetDelDia ? 'autorizado' : 'rechazado',
      ...(esRetDelDia ? { tipo_permiso: 'falta', pago: 'Sin goce (Se regresa)', total_horas: 8 } : {}),
      observaciones: `${permiso.observaciones || ''} | ${esRetDelDia ? 'Nota Dictamen (Jefatura): Se regresa a casa — ' : 'Rechazado por Jefatura: '}${motivoRechazo.trim()}`
    })
    .eq('id', permiso.id);

  if (error) throw error;

  if (esRetDelDia) {
    await cancelarSalidasMismoDiaPorRetiro(permiso.usuario_id, permiso.fecha_permiso, folioOficial);
  }

  if (estaEnPuerta) {
    try {
      const { data: guardias } = await supabase.from('usuarios').select('id').eq('rol', 'caseta').eq('activo', true);
      if (guardias && guardias.length > 0) {
        const nomTrab = permiso.usuarios?.nombre_completo || 'Colaborador';
        await enviarNotificacionPushUsuarios(guardias.map(g => g.id), {
          titulo: '🚫 ACCESO DENEGADO',
          mensaje: `👤 ${nomTrab} • Se retira de planta.`,
          fotoUrl: permiso.usuarios?.foto_url || null,
          urlDestino: '/caseta/asistencia'
        });
      }
    } catch (_) {}
  }

  const mapaRechazo = {
    salida: 'SALIDA RECHAZADA',
    retardo: esRetDelDia ? 'ACCESO NO AUTORIZADO (SE REGRESA)' : 'RETARDO RECHAZADO',
    falta: 'FALTA RECHAZADA',
    vacaciones: 'VACACIONES RECHAZADAS'
  };
  const tipoPaseR = mapaRechazo[permiso.tipo_permiso] || 'PASE RECHAZADO';

  await enviarNotificacionPushUsuarios(permiso.usuario_id, {
    titulo: `❌ ${tipoPaseR}`,
    mensaje: `🚫 Motivo: ${motivoRechazo.trim()}`,
    urlDestino: '/mis-permisos'
  });
};

// 15. CANCELAR SOLICITUD DE PERMISO (Con blindaje contra pases ya ejecutados en caseta)
export const tieneSelloFisicoCaseta = (permiso) => {
  if (!permiso) return false;
  const fol = String(permiso.folio || '').toUpperCase();
  const obs = String(permiso.observaciones || '');
  if (fol.startsWith('CAS-')) return true;
  if (permiso.estado_general === 'completado_caseta') return true;
  if (/\[(?:LLEGADA EN PUERTA|SALIDA CASETA|ENTRADA CASETA|REINGRESO CASETA|REGRESADO EN PUERTA):/i.test(obs)) {
    return true;
  }
  return false;
};

export const cancelarSolicitudPermiso = async ({ permiso, usuario, motivoCancelacion }) => {
  if (!permiso?.id) throw new Error('Permiso inválido.');
  if (tieneSelloFisicoCaseta(permiso)) {
    throw new Error('No se puede cancelar un pase que ya fue registrado o detenido físicamente en Caseta de Vigilancia.');
  }

  const esRHOAdmin = ['gerente_rh', 'rh_nominas', 'superadmin'].includes(usuario?.rol);
  const hoyIso = obtenerFechaLocalHoyISO();
  const tipoP = (permiso.tipo_permiso || '').toLowerCase();
  const yaAutorizado = ['autorizado', 'aprobado'].includes(permiso.estado_general);

  if (!esRHOAdmin && yaAutorizado && ['falta', 'vacaciones'].includes(tipoP) && permiso.fecha_permiso <= hoyIso) {
    const ahora = new Date();
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    if (permiso.fecha_permiso < hoyIso || minAhora >= 7 * 60 + 15) {
      throw new Error('No puedes cancelar desde la aplicación una Falta o Vacaciones ya autorizadas una vez iniciado el turno. Si te presentaste a laborar, regístrate en Caseta de Vigilancia.');
    }
  }

  const motivoLimpio = String(motivoCancelacion || '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();
  if (!motivoLimpio) {
    throw new Error('Es obligatorio indicar el motivo de la cancelación.');
  }

  const partesNom = String(usuario?.nombre_completo || 'Usuario').trim().split(/\s+/).filter(Boolean);
  const nomCorto = partesNom.length > 2 ? `${partesNom[0]} ${partesNom[partesNom.length - 2]}` : partesNom.join(' ');
  const etiquetaQuien = usuario?.id === permiso.usuario_id ? `Colaborador (${nomCorto})` : `RH/Jefatura (${nomCorto})`;

  const nuevasObs = `${permiso.observaciones || ''} | CANCELADO por ${etiquetaQuien}: ${motivoLimpio}`;

  const { error: error1 } = await supabase
    .from('permisos')
    .update({
      estado_general: 'rechazado',
      pago: 'Cancelado',
      observaciones: nuevasObs
    })
    .eq('id', permiso.id);

  if (error1) {
    const { error: error2 } = await supabase
      .from('permisos')
      .update({
        estado_general: 'rechazado',
        pago: 'Sin goce',
        observaciones: nuevasObs
      })
      .eq('id', permiso.id);

    if (error2) {
      throw new Error(error2.message || error1.message || 'No se pudo cancelar el permiso.');
    }
  }
};
export const depurarPermisosCanceladosRH = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const { error } = await supabase
    .from('permisos')
    .delete()
    .in('id', ids);
  if (error) throw error;
  return ids.length;
};