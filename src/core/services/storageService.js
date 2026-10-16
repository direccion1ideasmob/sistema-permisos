import imageCompression from 'browser-image-compression';
import { supabase } from '../api/supabaseClient';

export const subirImagenUsuario = async (archivo, usuarioId, tipo = 'perfil') => {
  if (!archivo || !usuarioId) return null;

  const opciones = {
    maxSizeMB: 0.2,
    maxWidthOrHeight: tipo === 'firma' ? 700 : 800,
    useWebWorker: true
  };

  let archivoFinal = archivo;
  try {
    archivoFinal = await imageCompression(archivo, opciones);
  } catch (_) {
    archivoFinal = archivo;
  }

  const extension = tipo === 'firma' ? 'png' : 'jpg';
  const fileName = `${tipo}_${usuarioId}.${extension}`;

  const { error } = await supabase.storage
    .from('fotos_usuarios')
    .upload(fileName, archivoFinal, { contentType: archivoFinal.type, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('fotos_usuarios').getPublicUrl(fileName);
  return `${data.publicUrl}?t=${Date.now()}`;
};

export const eliminarImagenesUsuario = async (usuarioId) => {
  if (!usuarioId) return;
  const archivosABorrar = [
    `perfil_${usuarioId}.jpg`,
    ` perfil_${usuarioId}.png`,
    `firma_${usuarioId}.png`,
    `firma_${usuarioId}.jpg`
  ];
  try {
    await supabase.storage.from('fotos_usuarios').remove(archivosABorrar);
  } catch (err) {
    console.warn("Aviso al limpiar bucket de fotos:", err);
  }
};
