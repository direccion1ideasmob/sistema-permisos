export const obtenerTemaPermisos = (modoOscuro) => ({
  bg: modoOscuro ? '#171717' : '#fafafa', // Gris carbón puro (sin azul) / Gris clarito
  surface: modoOscuro ? '#262626' : '#f5f5f5', // Fondo de tarjeta oscuro puro
  surfaceCard: modoOscuro ? '#262626' : '#ffffff', // Tarjeta pura
  border: modoOscuro ? '#404040' : '#e5e5e5', // Bordes neutros
  borderSubtle: modoOscuro ? '#525252' : '#f5f5f5',
  text: modoOscuro ? '#ffffff' : '#171717', // Texto blanco puro / negro carbón
  textMuted: modoOscuro ? '#a3a3a3' : '#737373', // Texto secundario gris puro
  textSubtle: modoOscuro ? '#737373' : '#a3a3a3',
  inputBg: modoOscuro ? '#171717' : '#ffffff',
  inputBorder: modoOscuro ? '#525252' : '#d4d4d4',
  accent: '#16a34a', // Verde
  accentSoft: modoOscuro ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)',
  warning: '#f59e0b',
  danger: '#ef4444',
});

export const generarEstilosPermisos = (c, modoOscuro) => `
  .permisos-container {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-sizing: border-box;
    padding: 0 4px;
    color: ${c.text};
  }

  .permiso-card-box {
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    border-radius: 16px;
    padding: 16px 20px;
    box-sizing: border-box;
    box-shadow: ${modoOscuro ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.02)'};
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  /* INPUTS MODERNOS */
  .input-permiso {
    width: 100%;
    height: 42px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid ${c.inputBorder};
    background: ${c.inputBg};
    color: ${c.text} !important;
    font-size: 13.5px;
    font-weight: 500;
    outline: none;
    box-sizing: border-box;
    color-scheme: ${modoOscuro ? 'dark' : 'light'};
    transition: all 0.2s ease;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);
  }
  .input-permiso:focus {
    border-color: ${c.accent};
    box-shadow: 0 0 0 3px ${c.accentSoft};
  }

  .label-permiso {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: ${c.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  /* CHIPS / BOTONES DE TIPO DE PASE */
  .grid-tipo-pase {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  @media (min-width: 640px) {
    .grid-tipo-pase {
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    }
  }

  .pill-movimiento {
    padding: 10px 8px;
    border-radius: 10px;
    border: 1px solid ${c.border};
    background: ${c.surface};
    color: ${c.textMuted};
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
    transition: all 0.2s ease;
  }
  .pill-movimiento:hover {
    border-color: ${c.textMuted};
  }
  .pill-movimiento.active {
    border-color: ${c.accent};
    background: ${c.accentSoft};
    color: ${c.accent};
    box-shadow: 0 2px 8px ${c.accentSoft};
  }

  /* CUADRÍCULAS RESPONSIVAS */
  .grid-fechas-horas {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  @media (min-width: 600px) {
    .grid-fechas-horas {
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    }
  }

  .grid-naturaleza {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }
  @media (min-width: 500px) {
    .grid-naturaleza {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* 🔥 EL TRUCO PARA EL CELULAR: Arregla los sellos de 3 columnas sin tocar el JSX 🔥 */
  @media (max-width: 500px) {
    div[style*="repeat(3, 1fr)"] {
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) !important;
      gap: 6px !important;
    }
  }

  /* IMPRESIÓN OFICIAL */
  @media print {
    body * { visibility: hidden; }
    .seccion-impresion-papeleta, .seccion-impresion-papeleta * { visibility: visible; }
    .seccion-impresion-papeleta {
      position: absolute;
      left: 0; top: 0; width: 100%;
      margin: 0; padding: 20px;
      background: #ffffff !important;
      color: #000000 !important;
    }
    .no-print { display: none !important; }
  }
`;