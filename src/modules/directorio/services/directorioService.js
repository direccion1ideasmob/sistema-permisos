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


// AUXILIAR: Sincronizar vínculos de mando cuando cambia el rol de un colaborador
const sincronizarVinculosPorRol = async ({ colaboradorId, rolNuevo, departamentoId, areaFinal }) => {
  const rol = (rolNuevo || empleado).toLowerCase();

  // Caso A: Si ahora es empleado o caseta, NO puede tener subordinados ni ser jefe_id de un departamento
  if (rol === empleado || rol === caseta) {
    let nuevoJefeParaSubordinados = null;
    if (departamentoId) {
      const { data: depto } = await supabase.from(departamentos).select(jefe_id).eq(id, departamentoId).maybeSingle();
      if (depto?.jefe_id && depto.jefe_id !== colaboradorId) {
        nuevoJefeParaSubordinados = depto.jefe_id;
      }
    }
    await Promise.all([
      supabase.from(usuarios).update({ reporta_a_id: nuevoJefeParaSubordinados }).eq(reporta_a_id, colaboradorId),
      supabase.from(departamentos).update({ jefe_id: null }).eq(jefe_id, colaboradorId)
    ]);
  }

  // Caso B: Si es encargado (Supervisor de Subárea), los empleados base de su misma subárea le reportan a él, y él reporta al jefe_id del depto
  if (rol === encargado && departamentoId && areaFinal) {
    const { data: depto } = await supabase.from(departamentos).select(jefe_id).eq(id, departamentoId).maybeSingle();
    if (depto?.jefe_id && depto.jefe_id !== colaboradorId) {
      await supabase.from(usuarios).update({ reporta_a_id: depto.jefe_id }).eq(id, colaboradorId);
    }
    await supabase
      .from(usuarios)
      .update({ reporta_a_id: colaboradorId })
      .eq(departamento_id, departamentoId)
      .ilike(area, areaFinal)
      .eq(rol, empleado)
      .neq(id, colaboradorId);
  }
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
      .select('id, nombre, clasificacion, jefe_id, gerente_id')
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
      jefe_id: d.jefe_id,
      gerente_id: d.gerente_id
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
        jefe_id: deptoEncontrado?.jefe_id,
        gerente_id: deptoEncontrado?.gerente_id
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

// 2. REGISTRAR NUEVO COLABORADOR COMPLETO
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
    deptoFinalId = await resolverDepartamentoId(textosNuevos.depto, formData.tipo_personal, departamentos);
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
    telefono: formData.telefono || null,
    correo: correoLimpio,
    tipo_personal: formData.tipo_personal,
    sede_id: sedeFinalId,
    departamento_id: deptoFinalId,
    area: areaFinal.toUpperCase(),
    puesto: puestoFinal ? puestoFinal.toUpperCase() : null,
    rol: formData.rol,
    reporta_a_id: formData.reporta_a_id || null,
    usuario_login: loginLimpio,
    pin: formData.pin.trim(),
    foto_url: fotoUrl,
    firma_url: firmaUrl,
    activo: true
  }]);

  if (dbError) throw dbError;

  const actualizacionDepto = {};
  if (['gerente_produccion', 'gerente_admin', 'gerente_rh'].includes(formData.rol)) {
    actualizacionDepto.gerente_id = nuevoUsuarioId;
  }

  if (Object.keys(actualizacionDepto).length > 0 && deptoFinalId) {
    await supabase.from('departamentos').update(actualizacionDepto).eq('id', deptoFinalId);
  }

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
    deptoFinalId = await resolverDepartamentoId(textosNuevos.depto, datosEdit.tipo_personal, departamentos);
  } else if (!deptoFinalId && datosEdit.departamento_texto?.trim()) {
    deptoFinalId = await resolverDepartamentoId(datosEdit.departamento_texto, datosEdit.tipo_personal, departamentos);
  }

  const nombreDeptoSeleccionado = departamentos.find(d => d.id === deptoFinalId)?.nombre || textosNuevos.depto || 'GENERAL';
  const areaFinal = (datosEdit.area || nombreDeptoSeleccionado).trim().toUpperCase();

  // Verificar si el PIN cambió para limpiar suscripciones Push de dispositivos viejos
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
      telefono: datosEdit.telefono ? datosEdit.telefono.trim() : null,
      correo: datosEdit.correo.trim().toLowerCase(),
      usuario_login: datosEdit.usuario_login?.trim() ? datosEdit.usuario_login.trim().toLowerCase() : null,
      pin: datosEdit.pin?.trim() ? datosEdit.pin.trim() : null,
      fecha_ingreso: datosEdit.fecha_ingreso || null,
      foto_url: datosEdit.foto_url || null,
      firma_url: datosEdit.firma_url || null
    })
    .eq('id', colaboradorId);

  if (error) throw error;

  if (pinCambio) {
    await supabase.from('suscripciones_push').delete().eq('usuario_id', colaboradorId);
  }
  await sincronizarVinculosPorRol({ colaboradorId, rolNuevo: datosEdit.rol, departamentoId: deptoFinalId, areaFinal });
};

// 4. REUBICACIÓN RÁPIDA DE EMPLEADO DESDE EL ÁRBOL (Depto, Área, Puesto, Rol y Superior)
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
  await sincronizarVinculosPorRol({ colaboradorId, rolNuevo: rol, departamentoId, areaFinal: (area || 'GENERAL').trim().toUpperCase() });
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

// 6. RENOMBRAR DEPARTAMENTO Y SINCRONIZAR ÁREAS DE EMPLEADOS SIMPLES
export const actualizarDepartamentoSeguro = async (deptoId, nuevoNombre, nuevaClasif, nombreAnterior = '') => {
  const nomLimpio = limpiarTexto(nuevoNombre);
  const clasifLimpia = (nuevaClasif || 'produccion').toLowerCase().trim();

  const { data: duplicado } = await supabase
    .from('departamentos')
    .select('id')
    .ilike('nombre', nomLimpio)
    .neq('id', deptoId)
    .maybeSingle();

  if (duplicado) {
    throw new Error(`Ya existe otro departamento llamado "${nomLimpio}".`);
  }

  const { error } = await supabase
    .from('departamentos')
    .update({ nombre: nomLimpio, clasificacion: clasifLimpia })
    .eq('id', deptoId);

  if (error) throw error;

  // Si el departamento tenía empleados cuya área se llamaba igual al departamento anterior, actualizarlos también
  if (nombreAnterior && limpiarTexto(nombreAnterior) !== nomLimpio) {
    await supabase
      .from('usuarios')
      .update({ area: nomLimpio })
      .eq('departamento_id', deptoId)
      .ilike('area', limpiarTexto(nombreAnterior));
  }
};

// 7. ELIMINACIÓN FÍSICA DEFINITIVA (LIMPIA BUCKET DE FOTOS + REFERENCIAS + TABLA USUARIOS)
export const eliminarColaboradorDefinitivo = async (usuarioId) => {
  if (!usuarioId) throw new Error("ID de usuario inválido.");

  // A) Borrar foto de perfil y firma digitalizada del Bucket para liberar espacio
  const archivos = [`perfil_${usuarioId}.jpg`, `firma_${usuarioId}.png`];
  await supabase.storage.from('fotos_usuarios').remove(archivos);

  // B) Desvincular si era jefe, gerente o RH en la tabla departamentos (evita error Foreign Key)
  await Promise.all([
    supabase.from('departamentos').update({ jefe_id: null }).eq('jefe_id', usuarioId),
    supabase.from('departamentos').update({ gerente_id: null }).eq('gerente_id', usuarioId),
    supabase.from('departamentos').update({ rh_id: null }).eq('rh_id', usuarioId),
    supabase.from('usuarios').update({ reporta_a_id: null }).eq('reporta_a_id', usuarioId)
  ]);

  // C) Limpiar suscripciones push y permisos asociados a este usuario
  await Promise.all([
    supabase.from('suscripciones_push').delete().eq('usuario_id', usuarioId),
    supabase.from('permisos').delete().eq('usuario_id', usuarioId),
    supabase.from('permisos').update({ firma_1_id: null }).eq('firma_1_id', usuarioId),
    supabase.from('permisos').update({ firma_2_id: null }).eq('firma_2_id', usuarioId),
    supabase.from('permisos').update({ firma_3_id: null }).eq('firma_3_id', usuarioId)
  ]);

  // D) Eliminar definitivamente el registro de la tabla usuarios
  const { error } = await supabase.from('usuarios').delete().eq('id', usuarioId);
  if (error) throw error;
};
