import { supabase } from '../../../core/api/supabaseClient';
import { subirImagenUsuario } from '../../../core/services/storageService';
import { resolverSedeId, resolverDepartamentoId } from '../../../core/services/catalogosService';
import { estandarizar, esRolValidadorSuperior } from '../utils/directorioHelpers';

const limpiarTexto = (txt) => {
  if (!txt) return '';
  return typeof estandarizar === 'function'
    ? estandarizar(txt.toUpperCase())
    : txt.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// AUXILIAR: Sincronizar vínculos de mando cuando cambia el rol de un colaborador
const sincronizarVinculosPorRol = async ({ colaboradorId, rolNuevo, departamentoId, esTitularDepto = false }) => {
  const rol = (rolNuevo || "empleado").toLowerCase();

  // Caso A: Si ahora es empleado o caseta, NO puede tener subordinados ni ser jefe_id de un departamento
  if (rol === "empleado" || rol === "caseta") {
    let nuevoJefeParaSubordinados = null;
    if (departamentoId) {
      const { data: depto } = await supabase.from("departamentos").select("jefe_id").eq("id", departamentoId).maybeSingle();
      if (depto?.jefe_id && depto.jefe_id !== colaboradorId) {
        nuevoJefeParaSubordinados = depto.jefe_id;
      }
    }
    await Promise.all([
      supabase.from("usuarios").update({ reporta_a_id: nuevoJefeParaSubordinados }).eq("reporta_a_id", colaboradorId),
      supabase.from("departamentos").update({ jefe_id: null }).eq("jefe_id", colaboradorId)
    ]);
  }

  // Caso B: Si se marca explícitamente como Jefe Titular del departamento (o es el único jefe_area en ese depto sin jefe_id previo)
  if (rol === "jefe_area" && departamentoId) {
    const { data: depto } = await supabase
      .from("departamentos")
      .select("id, jefe_id, gerente_id")
      .eq("id", departamentoId)
      .maybeSingle();

    if (depto && (esTitularDepto || !depto.jefe_id)) {
      await supabase.from("departamentos").update({ jefe_id: colaboradorId }).eq("id", departamentoId);
      if (depto.gerente_id && depto.gerente_id !== colaboradorId) {
        await supabase.from("usuarios").update({ reporta_a_id: depto.gerente_id }).eq("id", colaboradorId);
      }
    }
  }
};

// 1. CARGAR TODO EL DIRECTORIO Y CATÁLOGOS (INCLUYENDO ECUALIZADOR DE DEPARTAMENTOS)
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
    deptoFinalId = await resolverDepartamentoId(
      textosNuevos.depto,
      'produccion',
      departamentos,
      {
        gerente_id: formData.nuevo_depto_gerente_id || null,
        emp_requiere_jefe: formData.nuevo_depto_emp_jefe !== undefined ? formData.nuevo_depto_emp_jefe : true,
        emp_requiere_gerente: formData.nuevo_depto_emp_gerente !== undefined ? formData.nuevo_depto_emp_gerente : false,
        jefe_requiere_gerente: formData.nuevo_depto_jefe_gerente !== undefined ? formData.nuevo_depto_jefe_gerente : true
      }
    );
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

  // Si no se especificó reporta_a_id manualmente, heredarlo inteligentemente del departamento
  let reportaAFinal = formData.reporta_a_id || null;
  const deptoSeleccionadoObj = departamentos.find(d => d.id === deptoFinalId);
  if (!reportaAFinal && deptoSeleccionadoObj) {
    if (formData.rol === 'empleado' && deptoSeleccionadoObj.jefe_id) {
      reportaAFinal = deptoSeleccionadoObj.jefe_id;
    } else if (formData.rol === 'jefe_area' && deptoSeleccionadoObj.gerente_id) {
      reportaAFinal = deptoSeleccionadoObj.gerente_id;
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
    telefono: formData.telefono || null,
    correo: correoLimpio,
    tipo_personal: formData.tipo_personal,
    sede_id: sedeFinalId,
    departamento_id: deptoFinalId,
    area: areaFinal.toUpperCase(),
    puesto: puestoFinal ? puestoFinal.toUpperCase() : null,
    rol: formData.rol,
    reporta_a_id: reportaAFinal,
    usuario_login: loginLimpio,
    pin: formData.pin.trim(),
    foto_url: fotoUrl,
    firma_url: firmaUrl,
    activo: true
  }]);

  if (dbError) throw dbError;

  const actualizacionDepto = {};
  if (esRolValidadorSuperior(formData.rol)) {
    // Si se crea un departamento nuevo para este Validador Superior o si se marca como cabeza de su departamento
    if (creandoNuevo.depto || formData.es_titular_depto) {
      actualizacionDepto.gerente_id = nuevoUsuarioId;
    }
  } else if (formData.rol === 'jefe_area') {
    if (creandoNuevo.depto || formData.es_titular_depto || !deptoSeleccionadoObj?.jefe_id) {
      actualizacionDepto.jefe_id = nuevoUsuarioId;
    }
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
    deptoFinalId = await resolverDepartamentoId(textosNuevos.depto, 'produccion', departamentos);
  } else if (!deptoFinalId && datosEdit.departamento_texto?.trim()) {
    deptoFinalId = await resolverDepartamentoId(datosEdit.departamento_texto, 'produccion', departamentos);
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
  await sincronizarVinculosPorRol({
    colaboradorId,
    rolNuevo: datosEdit.rol,
    departamentoId: deptoFinalId,
    esTitularDepto: Boolean(datosEdit.es_titular_depto)
  });
};

// 4. REUBICACIÓN RÁPIDA DE EMPLEADO DESDE EL ÁRBOL (Depto, Área, Puesto, Rol y Superior)
export const reubicarColaboradorEnArbol = async ({ colaboradorId, departamentoId, area, puesto, rol, reportaAId, esTitularDepto = false }) => {
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
  await sincronizarVinculosPorRol({
    colaboradorId,
    rolNuevo: rol,
    departamentoId,
    esTitularDepto
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

// 6. GUARDAR CONFIGURACIÓN COMPLETA DEL ECUALIZADOR DE UN DEPARTAMENTO
export const actualizarDepartamentoSeguro = async (
  deptoId,
  nuevoNombre,
  nuevaClasif,
  nombreAnterior = '',
  ecualizador = null
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

  // Determinar clasificación coherente con el gerente seleccionado (para mantener compatibilidad visual)
  let clasifLimpia = (nuevaClasif || 'produccion').toLowerCase().trim();
  if (ecualizador && ecualizador.gerente_id) {
    const { data: gerUser } = await supabase.from('usuarios').select('rol').eq('id', ecualizador.gerente_id).maybeSingle();
    if (gerUser?.rol === 'gerente_admin') clasifLimpia = 'administrativo';
    else if (gerUser?.rol === 'gerente_produccion') clasifLimpia = 'produccion';
    else if (gerUser?.rol === 'gerente_rh') clasifLimpia = 'rh';
  }

  const payloadUpdate = {
    nombre: nomLimpio,
    clasificacion: clasifLimpia
  };

  if (ecualizador) {
    payloadUpdate.jefe_id = ecualizador.jefe_id || null;
    payloadUpdate.gerente_id = ecualizador.gerente_id || null;
    payloadUpdate.emp_requiere_jefe = Boolean(ecualizador.emp_requiere_jefe);
    payloadUpdate.emp_requiere_gerente = Boolean(ecualizador.emp_requiere_gerente);
    payloadUpdate.jefe_requiere_gerente = Boolean(ecualizador.jefe_requiere_gerente);
  }

  const { error } = await supabase
    .from('departamentos')
    .update(payloadUpdate)
    .eq('id', deptoId);

  if (error) throw error;

  // Si se asignó un Jefe Titular en el Ecualizador, asegurar que tenga rol de mando y que reporte al Gerente del depto
  if (ecualizador && ecualizador.jefe_id) {
    const { data: jefeActual } = await supabase.from('usuarios').select('id, rol').eq('id', ecualizador.jefe_id).maybeSingle();
    const updatesJefe = {};
    if (jefeActual && ['empleado', 'encargado'].includes(jefeActual.rol)) {
      updatesJefe.rol = 'jefe_area';
    }
    if (ecualizador.gerente_id && ecualizador.gerente_id !== ecualizador.jefe_id) {
      updatesJefe.reporta_a_id = ecualizador.gerente_id;
    }
    if (Object.keys(updatesJefe).length > 0) {
      await supabase.from('usuarios').update(updatesJefe).eq('id', ecualizador.jefe_id);
    }
  }

  // Si el departamento tenía empleados cuya área se llamaba igual al departamento anterior, actualizarlos también
  if (nombreAnterior && limpiarTexto(nombreAnterior) !== nomLimpio) {
    await supabase
      .from('usuarios')
      .update({ area: nomLimpio })
      .eq('departamento_id', deptoId)
      .ilike('area', limpiarTexto(nombreAnterior));
  }
};

// 6.B CREAR NUEVO DEPARTAMENTO DIRECTAMENTE CON SU ECUALIZADOR
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

  // Si se designó un Jefe Titular para el nuevo departamento, moverlo a este departamento y asegurar su rol
  if (jefe_id && nuevoId) {
    const { data: uJefe } = await supabase.from('usuarios').select('id, rol').eq('id', jefe_id).maybeSingle();
    const upJefe = {
      departamento_id: nuevoId,
      area: nomLimpio,
      reporta_a_id: (gerente_id && gerente_id !== jefe_id) ? gerente_id : null
    };
    if (uJefe && ['empleado', 'encargado'].includes(uJefe.rol)) {
      upJefe.rol = 'jefe_area';
    }
    await supabase.from('usuarios').update(upJefe).eq('id', jefe_id);
  }

  return nuevoId;
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