import { supabase } from '../../../core/api/supabaseClient';
import { subirImagenUsuario } from '../../../core/services/storageService';
import { resolverSedeId, resolverDepartamentoId } from '../../../core/services/catalogosService';
import { estandarizar } from '../utils/directorioHelpers';

const limpiarTexto = (txt) => {
  if (!txt) return '';
  return typeof estandarizar === 'function'
    ? estandarizar(txt.toUpperCase())
    : txt.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const resolverClasifYGerentePorNomina = async (tipoPersonal = 'produccion') => {
  const tp = String(tipoPersonal || 'produccion').toLowerCase().trim();
  const clasif = tp.includes('admin') ? 'administrativo' : (tp.includes('obra') ? 'obra' : 'produccion');
  const rolGerenteBuscado = clasif === 'administrativo' ? 'gerente_admin' : 'gerente_produccion';

  const { data: ger } = await supabase
    .from('usuarios')
    .select('id')
    .eq('rol', rolGerenteBuscado)
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  return { clasif, gerenteId: ger?.id || null };
};

// 1. CARGAR TODO EL DIRECTORIO Y CATÁLOGOS
export const obtenerDatosDirectorio = async () => {
  const [resSedes, resUsuarios, resDeptos] = await Promise.all([
    supabase.from('sedes').select('id, nombre').order('nombre', { ascending: true }),
    supabase
      .from('usuarios')
      .select('id, numero_empleado, nombre_completo, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, usuario_login, puesto, area, rol, tipo_personal, foto_url, firma_url, activo, departamento_id, sede_id, reporta_a_id, pin, fecha_ingreso, fecha_baja, motivo_baja, celular, telefono, correo')
      .order('nombre_completo', { ascending: true }),
    supabase
      .from('departamentos')
      .select('id, nombre, clasificacion, jefe_id, gerente_id, rh_id, emp_requiere_jefe, emp_requiere_gerente, jefe_requiere_gerente')
      .order('nombre', { ascending: true })
  ]);

  if (resUsuarios.error) throw resUsuarios.error;
  if (resDeptos.error) throw resDeptos.error;

  const sedes = resSedes.data || [];
  const deptosFormateados = (resDeptos.data || [])
    .map(d => ({
      ...d,
      nombre: (d.nombre || '').toUpperCase(),
      clasificacion: (d.clasificacion || 'produccion').toLowerCase().trim(),
      jefe_id: d.jefe_id || null,
      gerente_id: d.gerente_id || null,
      rh_id: d.rh_id || null,
      emp_requiere_jefe: d.emp_requiere_jefe !== false,
      emp_requiere_gerente: Boolean(d.emp_requiere_gerente),
      jefe_requiere_gerente: d.jefe_requiere_gerente !== false
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const usuariosCruzados = (resUsuarios.data || []).map(user => {
    const deptoEncontrado = deptosFormateados.find(d => d.id === user.departamento_id);
    return {
      ...user,
      departamentos: {
        id: deptoEncontrado?.id,
        nombre: deptoEncontrado ? deptoEncontrado.nombre : 'SIN DEPARTAMENTO',
        clasificacion: deptoEncontrado ? deptoEncontrado.clasificacion : 'produccion',
        jefe_id: deptoEncontrado?.jefe_id || null,
        gerente_id: deptoEncontrado?.gerente_id || null,
        emp_requiere_jefe: deptoEncontrado ? deptoEncontrado.emp_requiere_jefe : true,
        emp_requiere_gerente: deptoEncontrado ? deptoEncontrado.emp_requiere_gerente : false,
        jefe_requiere_gerente: deptoEncontrado ? deptoEncontrado.jefe_requiere_gerente : true
      }
    };
  });

  const areasUnicas = [...new Set(usuariosCruzados.map(u => u.area ? limpiarTexto(u.area) : null).filter(Boolean))].sort();
  const puestosUnicos = [...new Set(usuariosCruzados.map(u => u.puesto ? limpiarTexto(u.puesto) : null).filter(Boolean))].sort();

  return {
    sedes,
    departamentos: deptosFormateados,
    usuarios: usuariosCruzados,
    areasUnicas,
    puestosUnicos
  };
};

// 2. REGISTRAR NUEVO COLABORADOR
export const registrarNuevoColaborador = async ({
  formData, creandoNuevo, textosNuevos, sedes, departamentos, areas, puestos, fotoArchivo, firmaArchivo
}) => {
  if (!formData.nombre.trim() || !formData.apellido_paterno.trim()) {
    throw new Error("El Nombre y el Apellido Paterno son obligatorios.");
  }
  if (!formData.numero_empleado.trim() || !formData.correo.trim() || !formData.usuario_login.trim()) {
    throw new Error("Faltan datos de empleado, correo o usuario login.");
  }
  if (formData.pin.length < 6) {
    throw new Error("El PIN requiere mínimo 6 dígitos.");
  }

  const numEmpLimpio = formData.numero_empleado.trim().toUpperCase();
  const loginLimpio = formData.usuario_login.trim().toLowerCase();
  const correoLimpio = formData.correo.trim().toLowerCase();

  const { data: existentes } = await supabase
    .from('usuarios')
    .select('numero_empleado, usuario_login, correo')
    .or(`numero_empleado.eq.${numEmpLimpio},usuario_login.eq.${loginLimpio},correo.eq.${correoLimpio}`);

  if (existentes && existentes.length > 0) {
    const dup = existentes[0];
    if (dup.numero_empleado === numEmpLimpio) throw new Error(`El Número de Empleado #${numEmpLimpio} ya está registrado.`);
    if (dup.usuario_login === loginLimpio) throw new Error(`El Usuario Login "${loginLimpio}" ya existe. Cámbialo ligeramente.`);
    if (dup.correo === correoLimpio) throw new Error(`El Correo "${correoLimpio}" ya está asignado a otro colaborador.`);
  }

  let sedeFinalId = formData.sede_id;
  if (creandoNuevo.sede && textosNuevos.sede.trim()) {
    sedeFinalId = await resolverSedeId(textosNuevos.sede, sedes);
  }

  let deptoFinalId = formData.departamento_id;
  if (creandoNuevo.depto && textosNuevos.depto.trim()) {
    const { clasif, gerenteId } = await resolverClasifYGerentePorNomina(formData.tipo_personal);
    deptoFinalId = await resolverDepartamentoId(textosNuevos.depto, clasif, departamentos, {
      gerente_id: gerenteId
    });
  }

  let areaFinal = formData.area;
  if (creandoNuevo.area && textosNuevos.area.trim()) {
    const nomLimpio = limpiarTexto(textosNuevos.area);
    areaFinal = areas.find(a => limpiarTexto(a) === nomLimpio) || nomLimpio;
  }

  if (!areaFinal && deptoFinalId) {
    const dObj = departamentos.find(d => d.id === deptoFinalId);
    areaFinal = dObj ? dObj.nombre : (textosNuevos.depto ? limpiarTexto(textosNuevos.depto) : 'GENERAL');
  }

  let puestoFinal = formData.puesto;
  if (creandoNuevo.puesto && textosNuevos.puesto.trim()) {
    const nomLimpio = limpiarTexto(textosNuevos.puesto);
    puestoFinal = puestos.find(p => limpiarTexto(p) === nomLimpio) || nomLimpio;
  }

  if (!sedeFinalId || !deptoFinalId) {
    throw new Error("Faltan campos obligatorios: Revisa Sede y Departamento.");
  }

  const nombreCompletoFinal = [formData.nombre.trim(), formData.apellido_paterno.trim(), formData.apellido_materno.trim()]
    .filter(Boolean).join(' ').toUpperCase();

  const nuevoUsuarioId = crypto.randomUUID();

  let reportaAFinal = formData.reporta_a_id || null;
  const deptoSeleccionadoObj = departamentos.find(d => d.id === deptoFinalId);
  if (!reportaAFinal && deptoSeleccionadoObj && formData.rol === 'empleado') {
    if (deptoSeleccionadoObj.jefe_id) {
      reportaAFinal = deptoSeleccionadoObj.jefe_id;
    }
  }

  const [fotoUrl, firmaUrl] = await Promise.all([
    fotoArchivo ? subirImagenUsuario(fotoArchivo, nuevoUsuarioId, 'perfil') : Promise.resolve(null),
    firmaArchivo ? subirImagenUsuario(firmaArchivo, nuevoUsuarioId, 'firma') : Promise.resolve(null)
  ]);

  const { error: dbError } = await supabase.from('usuarios').insert([{
    id: nuevoUsuarioId,
    numero_empleado: numEmpLimpio,
    nombre: formData.nombre.trim().toUpperCase(),
    apellido_paterno: formData.apellido_paterno.trim().toUpperCase(),
    apellido_materno: formData.apellido_materno.trim() ? formData.apellido_materno.trim().toUpperCase() : null,
    nombre_completo: nombreCompletoFinal,
    fecha_nacimiento: formData.fecha_nacimiento || null,
    fecha_ingreso: formData.fecha_ingreso || null,
    celular: formData.celular || null,
    correo: correoLimpio,
    tipo_personal: formData.tipo_personal,
    sede_id: sedeFinalId,
    departamento_id: deptoFinalId,
    area: areaFinal.toUpperCase(),
    puesto: puestoFinal ? puestoFinal.toUpperCase() : null,
    rol: formData.rol || 'empleado',
    reporta_a_id: reportaAFinal,
    usuario_login: loginLimpio,
    pin: formData.pin.trim(),
    foto_url: fotoUrl,
    firma_url: firmaUrl,
    activo: true
  }]);

  if (dbError) throw dbError;
  return nuevoUsuarioId;
};

// 3. ACTUALIZAR EXPEDIENTE DESDE DOSSIER
export const actualizarExpedienteColaborador = async ({
  colaboradorId, datosEdit, creandoNuevo = {}, textosNuevos = {}, sedes = [], departamentos = []
}) => {
  const nom = (datosEdit.nombre || '').trim().toUpperCase();
  const pat = (datosEdit.apellido_paterno || '').trim().toUpperCase();
  const mat = (datosEdit.apellido_materno || '').trim().toUpperCase();
  const nombreCompletoFinal = [nom, pat, mat].filter(Boolean).join(' ') || (datosEdit.nombre_completo || '').trim().toUpperCase();

  if (!datosEdit.numero_empleado?.trim() || !nombreCompletoFinal || !datosEdit.correo?.trim()) {
    throw new Error("Faltan campos obligatorios: Número de empleado, Nombre y Correo no pueden estar vacíos.");
  }

  let sedeFinalId = datosEdit.sede_id || null;
  if (creandoNuevo.sede && textosNuevos.sede?.trim()) {
    sedeFinalId = await resolverSedeId(textosNuevos.sede, sedes);
  }

  let deptoFinalId = datosEdit.departamento_id || null;
  if (creandoNuevo.depto && textosNuevos.depto?.trim()) {
    const { clasif, gerenteId } = await resolverClasifYGerentePorNomina(datosEdit.tipo_personal);
    deptoFinalId = await resolverDepartamentoId(textosNuevos.depto, clasif, departamentos, {
      gerente_id: gerenteId
    });
  }

  const nombreDeptoSeleccionado = departamentos.find(d => d.id === deptoFinalId)?.nombre || textosNuevos.depto || 'GENERAL';
  const areaFinal = (datosEdit.area || nombreDeptoSeleccionado).trim().toUpperCase();

  const { data: usuarioPrevio } = await supabase.from('usuarios').select('pin').eq('id', colaboradorId).maybeSingle();
  const pinCambio = usuarioPrevio && datosEdit.pin?.trim() && String(usuarioPrevio.pin).trim() !== String(datosEdit.pin).trim();

  const { error } = await supabase
    .from('usuarios')
    .update({
      numero_empleado: datosEdit.numero_empleado.trim().toUpperCase(),
      nombre: nom || null,
      apellido_paterno: pat || null,
      apellido_materno: mat || null,
      nombre_completo: nombreCompletoFinal,
      fecha_nacimiento: datosEdit.fecha_nacimiento || null,
      sede_id: sedeFinalId,
      departamento_id: deptoFinalId,
      area: areaFinal,
      puesto: datosEdit.puesto ? datosEdit.puesto.trim().toUpperCase() : null,
      tipo_personal: datosEdit.tipo_personal || 'produccion',
      rol: datosEdit.rol || 'empleado',
      reporta_a_id: datosEdit.reporta_a_id || null,
      celular: datosEdit.celular ? datosEdit.celular.trim() : null,
      correo: datosEdit.correo.trim().toLowerCase(),
      usuario_login: datosEdit.usuario_login?.trim() ? datosEdit.usuario_login.trim().toLowerCase() : null,
      pin: datosEdit.pin?.trim() ? datosEdit.pin.trim() : null,
      fecha_ingreso: datosEdit.fecha_ingreso || null,
      foto_url: datosEdit.foto_url || null,
      firma_url: datosEdit.firma_url || null
    })
    .eq('id', colaboradorId);

  if (error) throw error;

  await sanearJefaturaPorCambioRol({
    usuarioId: colaboradorId,
    rolNuevo: datosEdit.rol || 'empleado',
    deptoNuevoId: deptoFinalId
  });

  if (pinCambio) {
    await supabase.from('suscripciones_push').delete().eq('usuario_id', colaboradorId);
  }
};

// 3.B REGLA #6: SANEAR departamentos.jefe_id Y reporta_a_id CUANDO UN MANDO BAJA A EMPLEADO O CAMBIA DE DEPTO
// - Si era Jefe General (departamentos.jefe_id) y ahora es 'empleado' o pertenece a otro depto:
//   jefe_id = null y emp_requiere_jefe = false en ese departamento.
// - Si ahora es 'empleado': nadie puede seguir reportándole; sus subordinados pasan al jefe_id
//   vigente de su departamento (si existe y no es él mismo) o a null.
export const sanearJefaturaPorCambioRol = async ({ usuarioId, rolNuevo, deptoNuevoId }) => {
  const resultado = { deptosLimpiados: [], reasignaciones: [] };
  if (!usuarioId) return resultado;
  const esEmpleado = String(rolNuevo || 'empleado').toLowerCase().trim() === 'empleado';

  const { data: deptosQueEncabeza } = await supabase
    .from('departamentos')
    .select('id')
    .eq('jefe_id', usuarioId);

  const idsLimpiar = (deptosQueEncabeza || [])
    .filter(d => esEmpleado || d.id !== deptoNuevoId)
    .map(d => d.id);

  if (idsLimpiar.length > 0) {
    const { error } = await supabase
      .from('departamentos')
      .update({ jefe_id: null, emp_requiere_jefe: false })
      .in('id', idsLimpiar);
    if (error) throw error;
    resultado.deptosLimpiados = idsLimpiar;
  }

  if (!esEmpleado) return resultado;

  const { data: subordinados } = await supabase
    .from('usuarios')
    .select('id, departamento_id')
    .eq('reporta_a_id', usuarioId);

  if (!subordinados || subordinados.length === 0) return resultado;

  const idsDeptosSub = [...new Set(subordinados.map(s => s.departamento_id).filter(Boolean))];
  const { data: deptosSub } = idsDeptosSub.length
    ? await supabase.from('departamentos').select('id, jefe_id').in('id', idsDeptosSub)
    : { data: [] };
  const jefePorDepto = new Map((deptosSub || []).map(d => [d.id, d.jefe_id]));

  // Agrupar por nuevo jefe para minimizar escrituras
  const grupos = new Map();
  subordinados.forEach(s => {
    const jefeVigente = jefePorDepto.get(s.departamento_id) || null;
    const nuevoJefe = jefeVigente && jefeVigente !== usuarioId && jefeVigente !== s.id ? jefeVigente : null;
    const clave = nuevoJefe || '__null__';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(s.id);
    resultado.reasignaciones.push({ id: s.id, reporta_a_id: nuevoJefe });
  });

  for (const [clave, ids] of grupos) {
    const { error } = await supabase
      .from('usuarios')
      .update({ reporta_a_id: clave === '__null__' ? null : clave })
      .in('id', ids);
    if (error) throw error;
  }

  return resultado;
};

// 4. REUBICAR UN EMPLEADO EN EL ORGANIGRAMA
export const reubicarColaboradorEnArbol = async ({ colaboradorId, departamentoId, area, puesto, rol, reportaAId }) => {
  const { error } = await supabase
    .from('usuarios')
    .update({
      departamento_id: departamentoId || null,
      area: (area || 'GENERAL').trim().toUpperCase(),
      puesto: puesto ? puesto.trim().toUpperCase() : null,
      rol: rol || 'empleado',
      reporta_a_id: reportaAId || null
    })
    .eq('id', colaboradorId);

  if (error) throw error;

  return sanearJefaturaPorCambioRol({
    usuarioId: colaboradorId,
    rolNuevo: rol || 'empleado',
    deptoNuevoId: departamentoId || null
  });
};

// 5. BAJA Y REACTIVACIÓN LABORAL
export const tramitarBajaColaborador = async (id, fechaBaja, motivoBaja) => {
  const { error } = await supabase
    .from('usuarios')
    .update({ activo: false, fecha_baja: fechaBaja, motivo_baja: motivoBaja })
    .eq('id', id);
  if (error) throw error;
};

export const reactivarColaborador = async (id) => {
  const { error } = await supabase
    .from('usuarios')
    .update({ activo: true, fecha_baja: null, motivo_baja: null })
    .eq('id', id);
  if (error) throw error;
};

// 6. GUARDAR CONFIGURACIÓN DE UN DEPARTAMENTO Y SINCRONIZAR A SU PLANTILLA
export const actualizarDepartamentoSeguro = async (
  deptoId,
  nuevoNombre,
  nuevaClasif,
  nombreAnterior = '',
  configFirmas = null
) => {
  const nomLimpio = limpiarTexto(nuevoNombre);
  if (!nomLimpio) throw new Error("El nombre del departamento no puede estar vacío.");

  const { data: duplicado } = await supabase
    .from('departamentos')
    .select('id')
    .ilike('nombre', nomLimpio)
    .neq('id', deptoId)
    .maybeSingle();

  if (duplicado) {
    throw new Error(`Ya existe otro departamento llamado "${nomLimpio}".`);
  }

  let clasifLimpia = (nuevaClasif || 'produccion').toLowerCase().trim();
  if (configFirmas && configFirmas.gerente_id) {
    const { data: gerUser } = await supabase.from('usuarios').select('rol').eq('id', configFirmas.gerente_id).maybeSingle();
    if (gerUser?.rol === 'gerente_admin') clasifLimpia = 'administrativo';
    else if (gerUser?.rol === 'gerente_produccion') clasifLimpia = 'produccion';
    else if (gerUser?.rol === 'gerente_rh') clasifLimpia = 'rh';
  }

  const payloadUpdate = {
    nombre: nomLimpio,
    clasificacion: clasifLimpia
  };

  // Jefe General anterior: solo se reasignan empleados que le reportaban a él (o a nadie),
  // nunca los que reportan a un supervisor de subárea
  let jefeAnteriorId = null;
  if (configFirmas) {
    const { data: deptoPrevio } = await supabase.from('departamentos').select('jefe_id').eq('id', deptoId).maybeSingle();
    jefeAnteriorId = deptoPrevio?.jefe_id || null;
  }

  if (configFirmas) {
    payloadUpdate.jefe_id = configFirmas.jefe_id || null;
    payloadUpdate.gerente_id = configFirmas.gerente_id || null;
    payloadUpdate.emp_requiere_jefe = Boolean(configFirmas.emp_requiere_jefe);
    payloadUpdate.emp_requiere_gerente = Boolean(configFirmas.emp_requiere_gerente);
    payloadUpdate.jefe_requiere_gerente = Boolean(configFirmas.jefe_requiere_gerente);
  }

  const { error } = await supabase
    .from('departamentos')
    .update(payloadUpdate)
    .eq('id', deptoId);

  if (error) throw error;

  if (configFirmas && configFirmas.jefe_id) {
    const { data: jefeActual } = await supabase.from('usuarios').select('id, rol').eq('id', configFirmas.jefe_id).maybeSingle();
    if (jefeActual && jefeActual.rol === 'empleado') {
      await supabase.from('usuarios').update({ rol: 'jefe_area' }).eq('id', configFirmas.jefe_id);
    }
    if (nomLimpio !== 'RECURSOS HUMANOS' && jefeAnteriorId !== configFirmas.jefe_id) {
      await supabase
        .from('usuarios')
        .update({ reporta_a_id: configFirmas.jefe_id })
        .eq('departamento_id', deptoId)
        .eq('rol', 'empleado')
        .neq('id', configFirmas.jefe_id)
        .or(jefeAnteriorId ? `reporta_a_id.is.null,reporta_a_id.eq.${jefeAnteriorId}` : 'reporta_a_id.is.null');
    }
  } else if (configFirmas && !configFirmas.jefe_id && jefeAnteriorId && nomLimpio !== 'RECURSOS HUMANOS') {
    await supabase
      .from('usuarios')
      .update({ reporta_a_id: null })
      .eq('departamento_id', deptoId)
      .eq('rol', 'empleado')
      .eq('reporta_a_id', jefeAnteriorId);
  }

  if (nombreAnterior && limpiarTexto(nombreAnterior) !== nomLimpio) {
    await supabase
      .from('usuarios')
      .update({ area: nomLimpio })
      .eq('departamento_id', deptoId)
      .ilike('area', limpiarTexto(nombreAnterior));
  }
};

// 6.B CREAR NUEVO DEPARTAMENTO
export const crearDepartamentoConEcualizador = async ({
  nombre,
  jefe_id = null,
  gerente_id = null,
  emp_requiere_jefe = true,
  emp_requiere_gerente = false,
  jefe_requiere_gerente = true
}) => {
  const nomLimpio = limpiarTexto(nombre);
  if (!nomLimpio) throw new Error("Ingresa el nombre del nuevo departamento.");

  let clasif = 'produccion';
  if (gerente_id) {
    const { data: gerUser } = await supabase.from('usuarios').select('rol').eq('id', gerente_id).maybeSingle();
    if (gerUser?.rol === 'gerente_admin') clasif = 'administrativo';
    else if (gerUser?.rol === 'gerente_rh') clasif = 'rh';
  }

  const nuevoId = await resolverDepartamentoId(nomLimpio, clasif, [], {
    jefe_id,
    gerente_id,
    emp_requiere_jefe,
    emp_requiere_gerente,
    jefe_requiere_gerente
  });

  if (jefe_id) {
    const { data: uJefe } = await supabase.from('usuarios').select('id, rol').eq('id', jefe_id).maybeSingle();
    if (uJefe && uJefe.rol === 'empleado') {
      await supabase.from('usuarios').update({ rol: 'jefe_area' }).eq('id', jefe_id);
    }
  }

  return nuevoId;
};

// 6.C SWITCH RÁPIDO EN VIVO PARA UN DEPARTAMENTO (UN SOLO CLIC EN LA BARRA)
export const alternarSwitchFirmaDepartamento = async (deptoId, campo, nuevoValor) => {
  const { error } = await supabase
    .from('departamentos')
    .update({ [campo]: Boolean(nuevoValor) })
    .eq('id', deptoId);
  if (error) throw error;
};

// 6.D SWITCH MAESTRO POR DIVISIÓN
export const alternarFirmaGerenciaMasivoDivision = async (idsDepartamentos = [], nuevoValor) => {
  if (!idsDepartamentos.length) return;
  const { error } = await supabase
    .from('departamentos')
    .update({ emp_requiere_gerente: Boolean(nuevoValor) })
    .in('id', idsDepartamentos);
  if (error) throw error;
};

// 7. ELIMINACIÓN FÍSICA DEFINITIVA
export const eliminarColaboradorDefinitivo = async (usuarioId) => {
  if (!usuarioId) throw new Error("ID de usuario inválido.");

  const archivos = [`perfil_${usuarioId}.jpg`, `firma_${usuarioId}.png`];
  await supabase.storage.from('fotos_usuarios').remove(archivos);

  await Promise.all([
    supabase.from('departamentos').update({ jefe_id: null }).eq('jefe_id', usuarioId),
    supabase.from('departamentos').update({ gerente_id: null }).eq('gerente_id', usuarioId),
    supabase.from('departamentos').update({ rh_id: null }).eq('rh_id', usuarioId),
    supabase.from('usuarios').update({ reporta_a_id: null }).eq('reporta_a_id', usuarioId)
  ]);

  await Promise.all([
    supabase.from('suscripciones_push').delete().eq('usuario_id', usuarioId),
    supabase.from('permisos').delete().eq('usuario_id', usuarioId),
    supabase.from('permisos').update({ firma_1_id: null }).eq('firma_1_id', usuarioId),
    supabase.from('permisos').update({ firma_2_id: null }).eq('firma_2_id', usuarioId),
    supabase.from('permisos').update({ firma_3_id: null }).eq('firma_3_id', usuarioId)
  ]);

  const { error } = await supabase.from('usuarios').delete().eq('id', usuarioId);
  if (error) throw error;
};