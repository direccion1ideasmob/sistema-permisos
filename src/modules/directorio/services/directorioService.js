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

// 1. CARGAR TODO EL DIRECTORIO Y CATÁLOGOS
export const obtenerDatosDirectorio = async () => {
  const [resSedes, resUsuarios, resDeptos] = await Promise.all([
    supabase.from('sedes').select('id, nombre').order('nombre', { ascending: true }),
    supabase
      .from('usuarios')
      .select('id, numero_empleado, nombre_completo, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, usuario_login, puesto, area, rol, tipo_personal, foto_url, firma_url, activo, departamento_id, sede_id, pin, fecha_ingreso, fecha_baja, motivo_baja, celular, telefono, correo')
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

// 2. REGISTRAR NUEVO COLABORADOR COMPLETO (SIN AUTH.SIGNUP QUE BLOQUEA CON 429)
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

  // VERIFICAR DUPLICADOS EN TABLA USUARIOS ANTES DE CREAR NADA
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

  let puestoFinal = formData.puesto;
  if (creandoNuevo.puesto && textosNuevos.puesto.trim()) {
    const nomLimpio = limpiarTexto(textosNuevos.puesto);
    puestoFinal = puestos.find(p => limpiarTexto(p) === nomLimpio) || nomLimpio;
  }

  if (!sedeFinalId || !deptoFinalId || !areaFinal) {
    throw new Error("Faltan campos obligatorios: Revisa Sede, Departamento y Área Física.");
  }

  const nombreCompletoFinal = [formData.nombre.trim(), formData.apellido_paterno.trim(), formData.apellido_materno.trim()]
    .filter(Boolean).join(' ').toUpperCase();

  // Generar ID único directamente sin pasar por el límite 429 de auth.signUp
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
    usuario_login: loginLimpio,
    pin: formData.pin.trim(),
    foto_url: fotoUrl,
    firma_url: firmaUrl,
    activo: true
  }]);

  if (dbError) throw dbError;

  const actualizacionDepto = {};
  if (formData.rol === 'jefe_area') actualizacionDepto.jefe_id = nuevoUsuarioId;
  else if (['gerente_produccion', 'gerente_admin'].includes(formData.rol)) actualizacionDepto.gerente_id = nuevoUsuarioId;
  else if (['gerente_rh', 'rh_nominas'].includes(formData.rol)) actualizacionDepto.rh_id = nuevoUsuarioId;

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

  if (!datosEdit.numero_empleado?.trim() || !nombreCompletoFinal || !datosEdit.correo?.trim() || !datosEdit.area?.trim()) {
    throw new Error("Faltan campos obligatorios: Número de empleado, Nombre, Correo y Área no pueden estar vacíos.");
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
      area: datosEdit.area.trim().toUpperCase(),
      puesto: datosEdit.puesto ? datosEdit.puesto.trim().toUpperCase() : null,
      tipo_personal: datosEdit.tipo_personal || 'produccion',
      rol: datosEdit.rol || 'empleado',
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
};

// 4. BAJA Y REACTIVACIÓN LABORAL
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

// 5. RENOMBRAR DEPARTAMENTO CON PROTECCIÓN ANTI-DUPLICADOS (Usado en VistaArbol)
export const actualizarDepartamentoSeguro = async (deptoId, nuevoNombre, nuevaClasif) => {
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
};
