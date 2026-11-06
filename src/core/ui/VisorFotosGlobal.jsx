import React, { useEffect, useState } from 'react';
import ModalFotoZoom from './ModalFotoZoom';

// Vista previa de cualquier foto de perfil: al tocar una foto (subida o avatar generado) se abre en grande.
// Escucha en captura para que el clic no dispare además la acción de la tarjeta. Las fotos que no deben ampliarse llevan data-no-zoom.
const esFotoPerfil = (img) => {
  if (!img || img.tagName !== 'IMG' || img.hasAttribute('data-no-zoom')) return false;
  const src = img.currentSrc || img.src || '';
  return src.includes('fotos_usuarios') || src.includes('ui-avatars.com');
};

const ampliarAvatar = (src) => (src.includes('ui-avatars.com') ? src.replace(/([?&])size=\d+/, '$1').concat('&size=512') : src);

const nombreCercano = (img) => {
  if (img.alt && !/^(avatar|foto|perfil)/i.test(img.alt)) return img.alt;
  const tarjeta = img.parentElement;
  const texto = tarjeta ? (tarjeta.innerText || '').split('\n').map((t) => t.trim()).find(Boolean) : '';
  return texto && texto.length <= 60 ? texto : '';
};

export default function VisorFotosGlobal() {
  const [fotoZoom, setFotoZoom] = useState(null);

  useEffect(() => {
    const alTocar = (e) => {
      const img = e.target;
      if (!esFotoPerfil(img)) return;
      e.preventDefault();
      e.stopPropagation();
      setFotoZoom({ url: ampliarAvatar(img.currentSrc || img.src), nombre: nombreCercano(img) });
    };
    const marcarCursor = (e) => {
      if (esFotoPerfil(e.target)) e.target.style.cursor = 'zoom-in';
    };
    document.addEventListener('click', alTocar, true);
    document.addEventListener('mouseover', marcarCursor);
    return () => {
      document.removeEventListener('click', alTocar, true);
      document.removeEventListener('mouseover', marcarCursor);
    };
  }, []);

  useEffect(() => {
    if (!fotoZoom) return;
    const alTecla = (e) => { if (e.key === 'Escape') setFotoZoom(null); };
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [fotoZoom]);

  return <ModalFotoZoom fotoZoom={fotoZoom} onClose={() => setFotoZoom(null)} />;
}
