import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';

export const obtenerTemaAprobaciones = (modoOscuro) => obtenerTemaGlobal(modoOscuro);

export const generarEstilosAprobaciones = (c) => `
  .aprobaciones-container {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    color: ${c.text};
  }
`;
