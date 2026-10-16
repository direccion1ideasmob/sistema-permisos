import { supabase } from '../../../core/api/supabaseClient';
import { enviarNotificacionPushUsuarios } from '../../../core/notificaciones/notificacionesService';

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
  const { error } = await supabase
    .from('permisos')
    .update({ 
      firma_1_estado: 'escalado',
      observaciones: `${permiso.observaciones || ''} | ⚠️ Escalado a Gerencia por inactividad del Jefe.`
    })
    .eq('id', permiso.id);

  if (error) throw error;

  if (permiso.firma_2_id) {
    await enviarNotificacionPushUsuarios(permiso.firma_2_id, {
      titulo: `⚠️ ESCALAMIENTO: ${permiso.tipo_permiso.toUpperCase()}`,
      mensaje: `El Jefe de Área no respondió a tiempo. Se requiere tu autorización para el folio ${permiso.folio}.`,
      urlDestino: '/aprobaciones'
    });
  }
};

// 3. VERIFICAR REINCIDENCIA DE RETARDOS (Últimos 15 días)
export const contarReincidenciasRetardo = async (usuarioId, permisoId = null, fechaBase = new Date()) => {
  if (!usuarioId) return 0;
  const fechaLimite = new Date(fechaBase);
  fechaLimite.setDate(fechaLimite.getDate() - 15);

  let query = supabase
    .from('permisos')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .eq('tipo_permiso', 'retardo')
    .neq('estado_general', 'rechazado')
    .gte('fecha_permiso', fechaLimite.toISOString().split('T')[0]);

  if (permisoId) {
    query = query.neq('id', permisoId);
  }

  const { count } = await query;
  return count || 0;
};

// 4. OBTENER TODAS LAS SOLICITUDES PARA BANDEJA DE APROBACIONES
export const obtenerSolicitudesAprobacion = async () => {
  const { data, error } = await supabase
    .from('permisos')
    .select(`
      *,
      usuarios:usuario_id (
        id, numero_empleado, nombre_completo, area, puesto, foto_url, departamento_id,
        departamentos:departamento_id (id, nombre, clasificacion)
      )
    `)
    .order('created_at', { ascending: false });

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

// 6. PROCESAR APROBACIÓN Y ENRUTAMIENTO INTELIGENTE (Aprobaciones)
export const aprobarSolicitudPermiso = async ({ solicitud, usuario, dictamenPago, comentarios }) => {
  const esJefeDepto = usuario.rol === 'jefe_area' && solicitud.firma_1_id === usuario.id;
  const esGerente = solicitud.firma_2_id === usuario.id;
  const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh';

  const updates = { pago: dictamenPago };
  let siguientesEnFirmar = [];
  let nuevoFolioGenerado = null;

  const obtenerUsuariosRH = async () => {
    const { data: rhUsers } = await supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']);
    return rhUsers ? rhUsers.map(u => u.id) : [];
  };

  if (esJefeDepto) {
    updates.firma_1_estado = 'autorizado';
    if (!solicitud.firma_1_id) updates.firma_1_id = usuario.id;

    if (solicitud.firma_2_estado === 'pendiente') {
      if (solicitud.firma_2_id) siguientesEnFirmar.push(solicitud.firma_2_id);
    } else if (solicitud.firma_3_estado === 'pendiente') {
      if (solicitud.firma_3_id) siguientesEnFirmar.push(solicitud.firma_3_id);
      else siguientesEnFirmar.push(...(await obtenerUsuariosRH()));
    }
  }

  if (esGerente) {
    updates.firma_2_estado = 'autorizado';
    if (solicitud.firma_3_estado === 'pendiente') {
      if (solicitud.firma_3_id) siguientesEnFirmar.push(solicitud.firma_3_id);
      else siguientesEnFirmar.push(...(await obtenerUsuariosRH()));
    }
  }

  if (esRH) {
    updates.firma_3_estado = 'autorizado';
    updates.estado_general = 'autorizado';
    if (!solicitud.firma_3_id) updates.firma_3_id = usuario.id;

    const clasificacionDepto = (solicitud.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
    let letra = 'P';
    if (clasificacionDepto.includes('admin')) letra = 'A';
    else if (clasificacionDepto.includes('obra')) letra = 'O';

    const anio = new Date().getFullYear().toString().slice(-2);
    nuevoFolioGenerado = await generarFolioOficial(letra, anio);
    updates.folio = nuevoFolioGenerado;
  }

  if (comentarios && comentarios.trim()) {
    updates.observaciones = `${solicitud.observaciones || ''} | Res: ${comentarios.trim()}`;
  }

  const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
  if (error) throw error;

  if (esRH) {
    const tipoPase = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
    await enviarNotificacionPushUsuarios(solicitud.usuario_id, {
      titulo: `✅ ${tipoPase} Autorizado`,
      mensaje: `Folio Oficial: ${nuevoFolioGenerado}\nDictamen: ${dictamenPago}`,
      urlDestino: '/mis-permisos'
    });
  }

  if (siguientesEnFirmar.length > 0) {
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

    await enviarNotificacionPushUsuarios(siguientesEnFirmar, {
      titulo: titNotif,
      mensaje: `👤 ${nombreSolicitante}\n${etiquetaNaturaleza}\n${horarioLimpio}\n💬 ${motivoLimpio}`,
      fotoUrl: fotoSolicitante,
      urlDestino: '/aprobaciones'
    });
  }
};

// 7. RECHAZAR SOLICITUD (Aprobaciones)
export const rechazarSolicitudPermiso = async ({ solicitud, usuario, motivoRechazo }) => {
  const esJefeDepto = usuario.rol === 'jefe_area' && solicitud.firma_1_id === usuario.id;
  const esGerente = solicitud.firma_2_id === usuario.id;
  const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh';

  const updates = {
    estado_general: 'rechazado',
    observaciones: `${solicitud.observaciones || ''} | RECHAZO: ${motivoRechazo}`
  };

  if (esRH && solicitud.firma_3_estado === 'pendiente') {
    updates.firma_3_estado = 'rechazado';
    if (!solicitud.firma_3_id) updates.firma_3_id = usuario.id;
  } else if (esGerente && solicitud.firma_2_estado === 'pendiente') {
    updates.firma_2_estado = 'rechazado';
  } else if (esJefeDepto && solicitud.firma_1_estado === 'pendiente') {
    updates.firma_1_estado = 'rechazado';
    if (!solicitud.firma_1_id) updates.firma_1_id = usuario.id;
  } else {
    updates.firma_1_estado = 'rechazado';
  }

  const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
  if (error) throw error;

  const tipoPaseR = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
  await enviarNotificacionPushUsuarios(solicitud.usuario_id, {
    titulo: `❌ ${tipoPaseR} Rechazado`,
    mensaje: `Motivo: ${motivoRechazo}`,
    urlDestino: '/mis-permisos'
  });
};

// 8. FORZAR SALTO DE FIRMA POR RH (Override)
export const forzarSaltoFirmaRH = async (solicitud) => {
  let updates = {};
  let siguienteFirmanteId = null;

  if (solicitud.firma_1_estado === 'pendiente') {
    updates = { firma_1_estado: 'escalado', observaciones: `${solicitud.observaciones || ''} | 🛡️ RH forzó salto de Jefe.` };
    siguienteFirmanteId = solicitud.firma_2_id;
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

// 9. CREAR NUEVA SOLICITUD DE PASE CON ENRUTADOR AUTOMÁTICO (FormularioSolicitud)
export const crearNuevaSolicitudPermiso = async ({
  userId, rolUsuario, deptoId, sedeId, tipoPersonal, nombreSolicitante, fotoSolicitante,
  tipoPermiso, naturaleza, fechaHoy, fechaPermiso, fechaFinVacaciones,
  horaSalida, regresaMismoDia, horaRegreso, horaLlegadaRetardo, motivo, totalHoras, esRetardoUrgente
}) => {
  const { data: depto, error: errD } = await supabase
    .from('departamentos')
    .select('nombre, clasificacion, jefe_id, gerente_id, rh_id')
    .eq('id', deptoId)
    .single();
  if (errD) throw new Error("No se encontró el departamento del colaborador.");

  // BÚSQUEDA INTELIGENTE DE JEFE POR SUBDEPARTAMENTO / ÁREA
  const { data: usuarioSolicitante } = await supabase.from('usuarios').select('area').eq('id', userId).maybeSingle();
  const areaSolicitante = (usuarioSolicitante?.area || '').trim().toUpperCase();

  const { data: todosEmpDepto } = await supabase
    .from('usuarios')
    .select('id, area, rol')
    .eq('departamento_id', deptoId)
    .eq('activo', true);

  const listaDepto = todosEmpDepto || [];
  const areasEnDepto = new Set(listaDepto.map(u => (u.area || '').trim().toUpperCase()).filter(Boolean));
  const jefesEnDepto = listaDepto.filter(u => u.rol === 'jefe_area');

  // 1. Buscar si hay un Jefe de Área exactamente en el mismo Subdepartamento (ej. Mariel en SEGURIDAD INDUSTRIAL)
  const jefeMismaArea = jefesEnDepto.find(j => (j.area || '').trim().toUpperCase() === areaSolicitante);

  let jefeFinalId = null;
  if (jefeMismaArea) {
    jefeFinalId = jefeMismaArea.id;
  } else if (areasEnDepto.size <= 1) {
    // 2. Si es un departamento simple (1 sola área), usa el jefe del departamento
    jefeFinalId = depto.jefe_id || jefesEnDepto[0]?.id || null;
  }

  const clasificacionDepto = (depto.clasificacion || tipoPersonal || 'produccion').toLowerCase();
  const rolGerente = clasificacionDepto.includes('admin') ? 'gerente_admin' : 'gerente_produccion';

  const [{ data: gerenteData }, { data: rhData }] = await Promise.all([
    supabase.from('usuarios').select('id').eq('rol', rolGerente).limit(1).maybeSingle(),
    supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']).limit(1).maybeSingle()
  ]);

  const gerenteFinalId = gerenteData?.id || depto.gerente_id;
  const rhFinalId = rhData?.id || depto.rh_id;

  let estadoFirma1 = jefeFinalId ? (jefeFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let estadoFirma2 = gerenteFinalId ? (gerenteFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let estadoFirma3 = rhFinalId ? (rhFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';

  if (rolUsuario === 'superadmin') {
    estadoFirma1 = 'auto_aprobado';
    estadoFirma2 = 'auto_aprobado';
    estadoFirma3 = 'auto_aprobado';
  }

  let notificarA = [];
  if (estadoFirma1 === 'pendiente') notificarA = [jefeFinalId];
  else if (estadoFirma2 === 'pendiente') notificarA = [gerenteFinalId];
  else if (estadoFirma3 === 'pendiente') notificarA = [rhFinalId];

  const hayPendientes = [estadoFirma1, estadoFirma2, estadoFirma3].includes('pendiente');
  const estadoGeneral = hayPendientes ? 'en_firmas' : 'aprobado';

  let esSantaCatarina = false;
  if (sedeId) {
    const { data: sedeData } = await supabase.from('sedes').select('nombre').eq('id', sedeId).maybeSingle();
    if (sedeData && sedeData.nombre.toLowerCase().includes('catarina')) esSantaCatarina = true;
  }

  const folioTemporal = `REQ-${Math.floor(100000 + Math.random() * 900000)}`;

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
      pago: 'Pendiente de dictamen',
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

    await enviarNotificacionPushUsuarios(notificarA, {
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
  let query = supabase
    .from('permisos')
    .select(`
      *,
      usuarios:usuario_id (
        id, numero_empleado, nombre_completo, area, puesto, foto_url, departamento_id,
        departamentos:departamento_id (id, nombre, clasificacion)
      )
    `)
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
        id, nombre_completo, numero_empleado, area, puesto, foto_url,
        departamentos:departamento_id (nombre)
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
  const { error } = await supabase
    .from('permisos')
    .update({ firma_1_estado: 'autorizado', pago: dictamenPago })
    .eq('id', permiso.id);

  if (error) throw error;

  let siguientesEnFirmar = [];
  let etiquetaNotificacion = "Gerencia";

  if (permiso.firma_2_estado === 'pendiente') {
    if (permiso.firma_2_id) siguientesEnFirmar.push(permiso.firma_2_id);
  } else if (permiso.firma_3_estado === 'pendiente') {
    etiquetaNotificacion = "Recursos Humanos";
    if (permiso.firma_3_id) {
      siguientesEnFirmar.push(permiso.firma_3_id);
    } else {
      const { data: rhUsers } = await supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']);
      if (rhUsers) siguientesEnFirmar = rhUsers.map(u => u.id);
    }
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

    await enviarNotificacionPushUsuarios(siguientesEnFirmar, {
      titulo: titNotif,
      mensaje: `👤 ${nombreSolicitante}\n${etiquetaNaturaleza}\n${horarioLimpio}\n💬 ${motClean}`,
      urlDestino: '/aprobaciones'
    });
  }

  return etiquetaNotificacion;
};

// 14. RECHAZAR DESDE LINK RÁPIDO DE JEFATURA (AprobarDirecto)
export const rechazarPermisoDirectoJefatura = async (permiso, motivoRechazo) => {
  const { error } = await supabase
    .from('permisos')
    .update({
      firma_1_estado: 'rechazado',
      estado_general: 'rechazado',
      observaciones: `${permiso.observaciones || ''} | Rechazado por Jefatura: ${motivoRechazo.trim()}`
    })
    .eq('id', permiso.id);

  if (error) throw error;

  const mapaRechazo = {
    salida: 'SALIDA RECHAZADA',
    retardo: 'RETARDO RECHAZADO',
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
