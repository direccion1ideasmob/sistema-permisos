import { registrarCheckCaseta, sincronizarCierreTurnoAutomatico } from '../../vigilancia/services/vigilanciaService';
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

  const siguienteId = permiso.firma_2_estado === 'pendiente' ? permiso.firma_2_id : permiso.firma_3_id;
  if (siguienteId) {
    await enviarNotificacionPushUsuarios(siguienteId, {
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
    if (pagoL === 'cancelado' || /CANCELADO por/i.test(obsL)) return false;
    const tipoL = (p.tipo_permiso || '').toLowerCase();
    const fueRegresado = pagoL.includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(obsL);
    if (tipoL === 'retardo' && p.estado_general !== 'rechazado') return true;
    if (tipoL === 'falta' && fueRegresado) return true;
    return false;
  }).length;

  return total;
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
        departamentos:departamento_id (id, nombre, clasificacion, jefe_id)
      ),
      firmante1:firma_1_id (id, nombre_completo, rol, puesto, firma_url),
      firmante2:firma_2_id (id, nombre_completo, rol, puesto, firma_url),
      firmante3:firma_3_id (id, nombre_completo, rol, puesto, firma_url)
    `);

  if (soloEnFirmas) {
    query = query.eq("estado_general", "en_firmas");
  } else if (usuarioId && (rol === "jefe_area" || rol === "encargado")) {
    query = query.eq("firma_1_id", usuarioId).limit(100);
  } else if (usuarioId && rol && rol.includes("gerente")) {
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

// 6. PROCESAR APROBACIÓN Y ENRUTAMIENTO INTELIGENTE DE 4 NIVELES (Aprobaciones)
export const aprobarSolicitudPermiso = async ({ solicitud, usuario, dictamenPago, comentarios }) => {
  if (solicitud.usuario_id === usuario.id && usuario.rol !== "superadmin") {
    throw new Error("Por control interno, no puedes autorizar ni dictaminar tu propia solicitud.");
  }

  // Verificación en vivo anti-colisión (evita doble dictamen simultáneo entre Jefe y RH)
  const { data: actualBD, error: errCheck } = await supabase
    .from('permisos')
    .select('id, folio, tipo_permiso, estado_general, pago, observaciones, firma_1_id, firma_1_estado, firma_2_id, firma_2_estado, firma_3_id, firma_3_estado')
    .eq('id', solicitud.id)
    .single();

  if (errCheck || !actualBD) {
    throw new Error('No se pudo verificar el estado actual de la solicitud.');
  }
  if (['autorizado', 'aprobado', 'completado_caseta', 'rechazado', 'cancelado'].includes(actualBD.estado_general)) {
    throw new Error(`Esta solicitud ya fue dictaminada hace unos instantes (Folio ${actualBD.folio} • ${actualBD.pago || actualBD.estado_general}). Actualiza tu bandeja.`);
  }
  solicitud = { ...solicitud, ...actualBD };
  const esFirmante1Actual =
    solicitud.firma_1_estado === 'pendiente' &&
    (solicitud.firma_1_id === usuario.id || ['encargado', 'jefe_area'].includes(usuario.rol));

  const esGerente = solicitud.firma_2_id === usuario.id && solicitud.firma_2_estado === 'pendiente';
  const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh';

  const esRetardoRegresaAprob = (solicitud.tipo_permiso || '').toLowerCase() === 'retardo' && String(dictamenPago || '').toLowerCase().includes('regresa');
  const updates = {
    pago: esRetardoRegresaAprob ? 'Sin goce (Se regresa)' : dictamenPago,
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

  if (esFirmante1Actual) {
    // CASO A: Si quien aprueba Firma 1 es un Supervisor de Subárea (encargado, ej. Ricardo Morúa),
    // verificamos si arriba de él hay un Jefe de Departamento (jefe_area, ej. René Morales).
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

    // CASO B: Si es Jefe de Departamento (o un encargado sin otro jefe_area arriba, o Victoria como jefa de Nora), cierra Firma 1
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
        // Si quien acaba de firmar Firma 1 fue Victoria (rh_nominas), notificamos prioritariamente al Gerente de RH (José Coca)
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

  // CIERRE DE FIRMA 3 (RH / SUPLENCIA):
  // Si Victoria acaba de firmar la Firma 1 de Nora en este mismo clic, NO cierra Firma 3 todavía (pasa a José Coca).
  // Pero si Firma 1 y Firma 2 ya estaban listas de antes (o si quien firma es José Coca), cierra Firma 3 y genera Folio Oficial.
  const firma1EstabaListaAntes = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(solicitud.firma_1_estado);
  const firma1Lista = !huboRelevoSubareaADepto && ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(updates.firma_1_estado || solicitud.firma_1_estado);
  const firma2Lista = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(updates.firma_2_estado || solicitud.firma_2_estado);

  const puedeCerrarFirma3EnEsteClic = usuario.rol === 'gerente_rh' || firma1EstabaListaAntes;

  if (esRetardoRegresaAprob && !esRH) {
    updates.estado_general = 'autorizado';
    if (updates.firma_2_estado !== 'autorizado' && solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
    if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
    siguientesEnFirmar = [];
    const nominaEmpleado = (solicitud.usuarios?.tipo_personal || solicitud.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
    let letra = nominaEmpleado.includes('admin') ? 'A' : (nominaEmpleado.includes('obra') ? 'O' : 'P');
    const anio = new Date().getFullYear().toString().slice(-2);
    nuevoFolioGenerado = await generarFolioOficial(letra, anio);
    updates.folio = nuevoFolioGenerado;
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
    nuevoFolioGenerado = await generarFolioOficial(letra, anio);
    updates.folio = nuevoFolioGenerado;
  }

  if (comentarios && String(comentarios).trim()) {
    const partesNom = String(usuario.nombre_completo || '').trim().split(/\s+/).filter(Boolean);
    const nomCorto = partesNom.length > 2 ? `${partesNom[0]} ${partesNom[partesNom.length - 2]}` : partesNom.join(' ');
    let etiquetaRolNota = 'Jefe';
    if (usuario.rol === 'encargado') etiquetaRolNota = 'Subárea';
    else if ((esRH || usuario.rol === 'superadmin') && (!esFirmante1Actual || firma1EstabaListaAntes)) etiquetaRolNota = 'RH';
    else if (esGerente) etiquetaRolNota = 'Gerencia';
    const comentarioLimpio = String(comentarios).replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();
    const baseObsNota = updates.observaciones || solicitud.observaciones || '';
    updates.observaciones = `${baseObsNota} | Nota ${etiquetaRolNota} (${nomCorto}): ${comentarioLimpio}`;
  }

  const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
  if (error) throw error;

  // 1) AVISO CORTO A CASETA SI ES RETARDO EN PUERTA Y YA HUBO DECISIÓN DE JEFE O RH
  const tipoLower = (solicitud.tipo_permiso || '').toLowerCase();
  const estaEnPuerta = /\[LLEGADA EN PUERTA:/i.test(solicitud.observaciones || '');
  const seRegresaDictamen = String(dictamenPago || '').toLowerCase().includes('regresa');

  if (tipoLower === 'retardo' && estaEnPuerta) {
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

  // 2) AVISO CORTO A CASETA CUANDO UN PASE DE SALIDA QUEDA AUTORIZADO
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

  // 3) NOTIFICACIÓN AL EMPLEADO O AL SIGUIENTE FIRMANTE EN LA CADENA
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
    .select('id, folio, tipo_permiso, estado_general, pago, observaciones, firma_1_id, firma_1_estado, firma_2_id, firma_2_estado, firma_3_id, firma_3_estado')
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

  const esRetardoRech = (solicitud.tipo_permiso || '').toLowerCase() === 'retardo';
  const partesNomRech = String(usuario.nombre_completo || '').trim().split(/\s+/).filter(Boolean);
  const nomCortoRech = partesNomRech.length > 2 ? `${partesNomRech[0]} ${partesNomRech[partesNomRech.length - 2]}` : partesNomRech.join(' ');
  const motivoLimpioRech = String(motivoRechazo || '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();

  const etiquetaBitacora = esRetardoRech
    ? `Nota Dictamen (${nomCortoRech}): Se regresa a casa — ${motivoLimpioRech}`
    : `RECHAZO (${nomCortoRech}): ${motivoLimpioRech}`;

  const updates = {
    estado_general: esRetardoRech ? 'autorizado' : 'rechazado',
    ...(esRetardoRech ? {
      tipo_permiso: 'falta',
      pago: 'Sin goce (Se regresa)',
      total_horas: 8
    } : {}),
    observaciones: `${solicitud.observaciones || ''} | ${etiquetaBitacora}`
  };

  // Si es un retardo donde se dictamina "Se regresa" y aún tiene folio REQ-, asignarle Folio Oficial
  if (esRetardoRech && String(solicitud.folio || '').startsWith('REQ-')) {
    const nominaEmpleado = (solicitud.usuarios?.tipo_personal || solicitud.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
    let letra = 'P';
    if (nominaEmpleado.includes('admin')) letra = 'A';
    else if (nominaEmpleado.includes('obra')) letra = 'O';
    const anio = new Date().getFullYear().toString().slice(-2);
    updates.folio = await generarFolioOficial(letra, anio);
  }

  // Asignar SIEMPRE el usuario.id real de quien dictaminó y omitir las etapas posteriores que ya no intervinieron
  if (esRH && solicitud.firma_3_estado === 'pendiente' && solicitud.firma_1_id !== usuario.id) {
    updates.firma_3_id = usuario.id;
    updates.firma_3_estado = esRetardoRech ? 'autorizado' : 'rechazado';
  } else if (esGerente && solicitud.firma_2_estado === 'pendiente') {
    updates.firma_2_id = usuario.id;
    updates.firma_2_estado = esRetardoRech ? 'autorizado' : 'rechazado';
    if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
  } else if (esFirmante1 && solicitud.firma_1_estado === 'pendiente') {
    updates.firma_1_id = usuario.id;
    updates.firma_1_estado = esRetardoRech ? 'autorizado' : 'rechazado';
    if (solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
    if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
  } else {
    updates.firma_1_id = usuario.id;
    updates.firma_1_estado = esRetardoRech ? 'autorizado' : 'rechazado';
    if (solicitud.firma_2_estado === 'pendiente') updates.firma_2_estado = 'omitido';
    if (solicitud.firma_3_estado === 'pendiente') updates.firma_3_estado = 'omitido';
  }

  const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
  if (error) throw error;

  // Si era un retardo esperando en puerta, avisar a Caseta sin detalles administrativos
  if ((solicitud.tipo_permiso || '').toLowerCase() === 'retardo' && /\[LLEGADA EN PUERTA:/i.test(solicitud.observaciones || '')) {
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
    titulo: esRetardoRech ? '↩️ Acceso no autorizado (Se regresa)' : `❌ ${tipoPaseR} Rechazado`,
    mensaje: esRetardoRech
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

// 9. CREAR NUEVA SOLICITUD DE PASE CON ENRUTADOR DE 4 NIVELES (Operador -> Supervisor Subárea -> Jefe Depto -> Gerente División -> RH)
export const crearNuevaSolicitudPermiso = async ({
  userId, rolUsuario, deptoId, sedeId, tipoPersonal, nombreSolicitante, fotoSolicitante,
  tipoPermiso, naturaleza, fechaHoy, fechaPermiso, fechaFinVacaciones,
  horaSalida, regresaMismoDia, horaRegreso, horaLlegadaRetardo, motivo, totalHoras, esRetardoUrgente
}) => {
  // === VALIDACIÓN ESTRICTA DE COHERENCIA DIARIA DEL COLABORADOR ===
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
    const esCancelado = pagoL === 'cancelado' || /CANCELADO por/i.test(obsL);
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

  // 1) Si ya fue regresado a casa en esa fecha (Falta por retardo) -> Bloquear CUALQUIER solicitud
  if (paseRegresadoACasa) {
    throw new Error(`No es posible generar otro permiso para esta fecha porque ya existe un dictamen de retiro de planta (Falta por retardo • Folio ${paseRegresadoACasa.folio}).`);
  }

  // 2) Si ya tiene una Falta o Vacaciones en esa fecha -> Bloquear CUALQUIER solicitud
  if (paseAusenciaCompleta) {
    const etiquetaExistente = (paseAusenciaCompleta.tipo_permiso || '').toUpperCase();
    throw new Error(`No es posible registrar este permiso porque ya existe un registro de ${etiquetaExistente} (${paseAusenciaCompleta.folio}) para esta fecha.`);
  }

  // 3) HUECO 1: Si pide un RETARDO pero YA registró entrada normal en Caseta o YA tiene un pase de Salida ese día
  if (tipoPermiso === 'retardo') {
    if (retardoPrevio) {
      throw new Error(`Ya existe un registro de retardo (${retardoPrevio.folio}) para esta fecha. No es posible generar dos retardos el mismo día.`);
    }
    if (asistenciaDia?.hora_entrada) {
      throw new Error(`No es posible solicitar un Retardo para esta fecha porque ya cuentas con registro de entrada en planta (${asistenciaDia.hora_entrada} hrs).`);
    }
    if (salidasPrevias.length > 0) {
      throw new Error(`No es posible solicitar un Retardo porque ya tienes un pase de Salida (${salidasPrevias[0].folio}) registrado para esta fecha.`);
    }
  }

  // 4) HUECO 2 y HUECO 3: Reglas al solicitar una SALIDA ANTICIPADA
  if (tipoPermiso === 'salida') {
    if (asistenciaDia?.hora_salida) {
      throw new Error(`No es posible solicitar una Salida porque ya registraste tu salida definitiva de planta hoy (${asistenciaDia.hora_salida} hrs).`);
    }
    // HUECO 3: Si tiene un retardo que todavía está en_firmas (esperando autorización), no puede pedir salida hasta que se autorice su entrada
    if (retardoPrevio && retardoPrevio.estado_general === 'en_firmas') {
      throw new Error(`Tienes un pase de Retardo (${retardoPrevio.folio}) pendiente de autorización. Podrás solicitar una Salida una vez que tu entrada haya sido autorizada.`);
    }
    // HUECO 2: No permitir 2 salidas activas el mismo día (a menos que una salida temporal previa ya haya reingresado por Caseta)
    const salidaAbierta = salidasPrevias.find(s => !/\[REINGRESO CASETA:/i.test(String(s.observaciones || '')));
    if (salidaAbierta) {
      throw new Error(`Ya cuentas con un pase de Salida activo (${salidaAbierta.folio}) para esta fecha. No es posible duplicar pases de salida.`);
    }
  }

  // 5) Si pide FALTA o VACACIONES pero hoy ya entró a planta o ya tiene sello en Caseta -> Bloquear
  if (tipoPermiso === 'falta' || tipoPermiso === 'vacaciones') {
    if (asistenciaDia?.hora_entrada) {
      throw new Error(`No es posible registrar una ${tipoPermiso} para esta fecha porque ya tienes registro de entrada en planta (${asistenciaDia.hora_entrada} hrs).`);
    }
    if (salidasPrevias.some(s => tieneSelloFisicoCaseta(s))) {
      throw new Error(`No es posible registrar una ${tipoPermiso} porque ya tienes movimientos registrados en Caseta para esta fecha.`);
    }
    if (retardoPrevio && tieneSelloFisicoCaseta(retardoPrevio)) {
      throw new Error(`No es posible registrar una ${tipoPermiso} para hoy porque ya tienes un registro de llegada en Caseta (${retardoPrevio.folio}).`);
    }
    // Si tenía un retardo o salida previa ese día SIN sello físico de caseta y ahora reporta Falta, cancelar el pase previo no utilizado
    const pasesSinSello = [...(retardoPrevio ? [retardoPrevio] : []), ...salidasPrevias].filter(p => !tieneSelloFisicoCaseta(p));
    for (const pPrev of pasesSinSello) {
      await supabase
        .from('permisos')
        .update({
          estado_general: 'rechazado',
          pago: 'Cancelado',
          observaciones: `${pPrev.observaciones || ''} | CANCELADO por Sistema: Sustituido por reporte de ${tipoPermiso.toUpperCase()} del mismo día`
        })
        .eq('id', pPrev.id);
    }
  }

  const [{ data: depto, error: errD }, { data: usuarioSolicitante }, { data: todosEmpDepto }] = await Promise.all([
    supabase.from('departamentos').select('id, nombre, clasificacion, jefe_id, gerente_id, rh_id').eq('id', deptoId).single(),
    supabase.from('usuarios').select('area, reporta_a_id, tipo_personal').eq('id', userId).maybeSingle(),
    supabase.from('usuarios').select('id, area, rol').eq('departamento_id', deptoId).eq('activo', true)
  ]);

  if (errD || !depto) throw new Error("No se encontró el departamento del colaborador.");

  const areaSolicitante = (usuarioSolicitante?.area || '').trim().toUpperCase();
  const reportaAId = usuarioSolicitante?.reporta_a_id || null;
  const listaDepto = todosEmpDepto || [];
  const areasEnDepto = new Set(listaDepto.map(u => (u.area || '').trim().toUpperCase()).filter(Boolean));
  const mandosEnDepto = listaDepto.filter(u => ['encargado', 'jefe_area'].includes(u.rol) && u.id !== userId);

  // === PASO 1: DETERMINAR FIRMA 1 (SUPERVISOR DE SUBÁREA / JEFE DE DEPTO / TITULAR NÓMINAS) ===
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
    // Si no tiene reporta_a_id explícito, busca primero encargado o jefe_area de su misma subárea
    const mandoMismaArea =
      mandosEnDepto.find(j => j.rol === 'encargado' && (j.area || '').trim().toUpperCase() === areaSolicitante) ||
      mandosEnDepto.find(j => j.rol === 'jefe_area' && (j.area || '').trim().toUpperCase() === areaSolicitante);

    if (mandoMismaArea) {
      jefeFinalId = mandoMismaArea.id;
    } else if (depto.jefe_id && depto.jefe_id !== userId) {
      jefeFinalId = depto.jefe_id;
    } else if ( areasEnDepto.size <= 1 && mandosEnDepto.length > 0) {
      jefeFinalId = mandosEnDepto[0].id;
    }
  }

  // === PASO 2: DETERMINAR FIRMA 2 (GERENCIA DE DIVISIÓN) Y FIRMA 3 (RH) ===
  const esDeptoRH = (depto.clasificacion || '').toLowerCase().includes('rh') || depto.nombre.toUpperCase().includes('RECURSOS HUMANOS') || depto.nombre.toUpperCase().includes('VIGILANCIA') || depto.nombre.toUpperCase() === 'RH';
  const clasificacionDepto = (depto.clasificacion || tipoPersonal || 'produccion').toLowerCase();
  const rolGerenteFallback = clasificacionDepto.includes('admin') ? 'gerente_admin' : (clasificacionDepto.includes('rh') ? 'gerente_rh' : 'gerente_produccion');

  const [{ data: gerenteDeptoData }, { data: gerenteFallbackData }, { data: rhUsersData }] = await Promise.all([
    depto.gerente_id ? supabase.from('usuarios').select('id, rol').eq('id', depto.gerente_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('usuarios').select('id, rol').eq('rol', rolGerenteFallback).eq('activo', true).limit(1).maybeSingle(),
    supabase.from('usuarios').select('id, rol').in('rol', ['gerente_rh', 'rh_nominas']).eq('activo', true)
  ]);

  const listaRH = rhUsersData || [];
  const gerenteRH = listaRH.find(u => u.rol === 'gerente_rh') || listaRH[0];
  const rhFinalId = gerenteRH?.id || depto.rh_id || null;

  let gerenteFinalId = gerenteDeptoData?.id || (esDeptoRH ? rhFinalId : gerenteFallbackData?.id) || null;
  let rolDelGerenteDepto = gerenteDeptoData?.rol || (esDeptoRH ? 'gerente_rh' : gerenteFallbackData?.rol);

  // === PASO 3: ÁRBITRO DE ESTADOS ===
  let estadoFirma1 = jefeFinalId ? (jefeFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let estadoFirma2 = gerenteFinalId ? (gerenteFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';
  let estadoFirma3 = rhFinalId ? (rhFinalId === userId ? 'auto_aprobado' : 'pendiente') : 'omitido';

  // REGLA GERENCIA ADMIN (Pedro Simón):
  // En retardos de Administración, solo interviene cuando es ANTICIPADO (!esRetardoUrgente) o por ASUNTO DE TRABAJO.
  // Si es un retardo del mismo día fuera del tiempo de anticipación, lo ven directo Jefe de Área -> RH sin notificar a Pedro.
  const esDivisionAdmin = rolDelGerenteDepto === 'gerente_admin' || clasificacionDepto.includes('admin');
  const esTrabajo = (naturaleza || '').toLowerCase().includes('trabajo');
  const omitirGerenteAdminPorRetardoDia =
    tipoPermiso === 'retardo' && esDivisionAdmin && Boolean(esRetardoUrgente) && !esTrabajo;

  // FUSIÓN INTELIGENTE: Si la división ya es comandada por José Coca (RH / Vigilancia) o aplica omisión de retardo del día en Admin
  if (esDeptoRH || rolDelGerenteDepto === 'gerente_rh' || gerenteFinalId === rhFinalId || omitirGerenteAdminPorRetardoDia) {
    estadoFirma2 = 'omitido';
  }

  if (rolUsuario === 'superadmin') {
    estadoFirma1 = 'auto_aprobado';
    estadoFirma2 = 'auto_aprobado';
    estadoFirma3 = 'auto_aprobado';
  }

  // ¿A quién se le notifica primero?
  let notificarA = [];
  if (estadoFirma1 === 'pendiente') {
    notificarA = [jefeFinalId];
  } else if (estadoFirma2 === 'pendiente') {
    notificarA = [gerenteFinalId];
  } else if (estadoFirma3 === 'pendiente') {
    const destinatariosRH = listaRH.filter(u => u.id !== userId).map(u => u.id);
    notificarA = destinatariosRH.length > 0 ? destinatariosRH : [rhFinalId].filter(id => id && id !== userId);
  }

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
  const { data: actualBD } = await supabase
    .from('permisos')
    .select('id, folio, tipo_permiso, estado_general, pago, observaciones, firma_1_id, firma_1_estado, firma_2_id, firma_2_estado, firma_3_id, firma_3_estado')
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

  // Verificar si quien era firma_1_id es un encargado con un jefe_area arriba
  if (permiso.firma_1_id) {
    const { data: firmante1 } = await supabase.from('usuarios').select('id, rol, nombre_completo').eq('id', permiso.firma_1_id).maybeSingle();
    if (firmante1?.rol === 'encargado') {
      const jefeDeptoId = await buscarJefeDeptoSuperior(firmante1.id, permiso.usuarios?.departamento_id);
      if (jefeDeptoId && jefeDeptoId !== firmante1.id) {
        updates.firma_1_id = jefeDeptoId;
        updates.firma_1_estado = 'pendiente';
        updates.observaciones = `${permiso.observaciones || ''} | ✅ VoBo Subárea: ${firmante1.nombre_completo}`;
        siguientesEnFirmar.push(jefeDeptoId);
        etiquetaNotificacion = "Jefatura de Departamento";
      }
    }
  }

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
  } else if (siguientesEnFirmar.length === 0) {
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

  // AVISO CORTO CASETA LINK RAPIDO (Solo si desde Firma 1 se dictaminó regreso a casa)
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
  const esRet = (permiso.tipo_permiso || '').toLowerCase() === 'retardo';
  let folioOficial = permiso.folio;
  if (esRet && String(permiso.folio || '').startsWith('REQ-')) {
    const nominaEmp = (permiso.usuarios?.tipo_personal || permiso.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
    const letra = nominaEmp.includes('admin') ? 'A' : (nominaEmp.includes('obra') ? 'O' : 'P');
    const anio = new Date().getFullYear().toString().slice(-2);
    folioOficial = await generarFolioOficial(letra, anio);
  }
  const { error } = await supabase
    .from('permisos')
    .update({
      folio: folioOficial,
      firma_1_estado: esRet ? 'autorizado' : 'rechazado',
      firma_2_estado: permiso.firma_2_estado === 'pendiente' ? 'omitido' : permiso.firma_2_estado,
      firma_3_estado: permiso.firma_3_estado === 'pendiente' ? 'omitido' : permiso.firma_3_estado,
      estado_general: esRet ? 'autorizado' : 'rechazado',
      ...(esRet ? { tipo_permiso: 'falta', pago: 'Sin goce (Se regresa)', total_horas: 8 } : {}),
      observaciones: `${permiso.observaciones || ''} | ${esRet ? 'Nota Dictamen (Jefatura): Se regresa a casa — ' : 'Rechazado por Jefatura: '}${motivoRechazo.trim()}`
    })
    .eq('id', permiso.id);

  if (error) throw error;

  if ((permiso.tipo_permiso || '').toLowerCase() === 'retardo' && /\[LLEGADA EN PUERTA:/i.test(permiso.observaciones || '')) {
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
  const motivoLimpio = String(motivoCancelacion || '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '/').trim();
  if (!motivoLimpio) {
    throw new Error('Es obligatorio indicar el motivo de la cancelación.');
  }

  const partesNom = String(usuario?.nombre_completo || 'Usuario').trim().split(/\s+/).filter(Boolean);
  const nomCorto = partesNom.length > 2 ? `${partesNom[0]} ${partesNom[partesNom.length - 2]}` : partesNom.join(' ');
  const etiquetaQuien = usuario?.id === permiso.usuario_id ? `Colaborador (${nomCorto})` : `RH/Jefatura (${nomCorto})`;

  const nuevasObs = `${permiso.observaciones || ''} | CANCELADO por ${etiquetaQuien}: ${motivoLimpio}`;

  const { error } = await supabase
    .from('permisos')
    .update({
      estado_general: 'rechazado',
      pago: 'Cancelado',
      observaciones: nuevasObs
    })
    .eq('id', permiso.id);

  if (error) throw error;
};
