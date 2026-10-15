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

export const resolverDepartamentoId = async (nombreDepto, clasificacion = 'produccion', deptosEnMemoria = []) => {
  const nomLimpio = normalizarNombre(nombreDepto);
  if (!nomLimpio) return null;

  const enMemoria = deptosEnMemoria.find(d => normalizarNombre(d.nombre) === nomLimpio);
  if (enMemoria) return enMemoria.id;

  const { data: enDB } = await supabase.from('departamentos').select('id').ilike('nombre', nomLimpio).maybeSingle();
  if (enDB) return enDB.id;

  const { data: nuevo, error } = await supabase
    .from('departamentos')
    .insert([{ nombre: nomLimpio, clasificacion: (clasificacion || 'produccion').toLowerCase() }])
    .select('id')
    .single();

  if (error) throw new Error("Error creando departamento: " + error.message);
  return nuevo.id;
};
