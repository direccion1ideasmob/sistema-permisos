import { supabase } from '../api/supabaseClient';

const normalizarNombre = (txt) => {
  if (!txt) return '';
  return txt.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const resolverSedeId = async (nombreSede, sedesEnMemoria = []) => {
  const nomLimpio = normalizarNombre(nombreSede);
  if (!nomLimpio) return null;

  const enMemoria = sedesEnMemoria.find(s => normalizarNombre(s.nombre) === nomLimpio);
  if (enMemoria) return enMemoria.id;

  const { data: enDB } = await supabase.from('sedes').select('id').ilike('nombre', nomLimpio).maybeSingle();
  if (enDB) return enDB.id;

  const { data: nueva, error } = await supabase.from('sedes').insert([{ nombre: nomLimpio }]).select('id').single();
  if (error) throw new Error("Error creando sede: " + error.message);
  return nueva.id;
};

export const resolverDepartamentoId = async (
  nombreDepto,
  clasificacion = 'produccion',
  deptosEnMemoria = [],
  opcionesEcualizador = {}
) => {
  const nomLimpio = normalizarNombre(nombreDepto);
  if (!nomLimpio) return null;

  const enMemoria = deptosEnMemoria.find(d => normalizarNombre(d.nombre) === nomLimpio);
  if (enMemoria) return enMemoria.id;

  const { data: enDB } = await supabase.from('departamentos').select('id').ilike('nombre', nomLimpio).maybeSingle();
  if (enDB) return enDB.id;

  // Buscar a RH por defecto para asignarlo como rh_id
  const { data: rhUser } = await supabase
    .from('usuarios')
    .select('id')
    .eq('rol', 'gerente_rh')
    .eq('activo', true)
    .limit(1)
    .maybeSingle();

  const payload = {
    nombre: nomLimpio,
    clasificacion: (clasificacion || 'produccion').toLowerCase().trim(),
    jefe_id: opcionesEcualizador.jefe_id || null,
    gerente_id: opcionesEcualizador.gerente_id || null,
    rh_id: opcionesEcualizador.rh_id || rhUser?.id || null,
    emp_requiere_jefe: opcionesEcualizador.emp_requiere_jefe !== undefined ? Boolean(opcionesEcualizador.emp_requiere_jefe) : true,
    emp_requiere_gerente: opcionesEcualizador.emp_requiere_gerente !== undefined ? Boolean(opcionesEcualizador.emp_requiere_gerente) : false,
    jefe_requiere_gerente: opcionesEcualizador.jefe_requiere_gerente !== undefined ? Boolean(opcionesEcualizador.jefe_requiere_gerente) : true
  };

  const { data: nuevo, error } = await supabase
    .from('departamentos')
    .insert([payload])
    .select('id')
    .single();

  if (error) throw new Error("Error creando departamento: " + error.message);
  return nuevo.id;
};