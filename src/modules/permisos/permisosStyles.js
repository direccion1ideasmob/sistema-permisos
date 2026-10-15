import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';

export const obtenerTemaPermisos = (modoOscuro) => obtenerTemaGlobal(modoOscuro);

export const generarEstilosPermisos = (c) => `
  .permisos-container {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    color: ${c.text};
  }
`;
