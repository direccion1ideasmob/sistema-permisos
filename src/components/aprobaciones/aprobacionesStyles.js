export const obtenerTemaAprobaciones = (modoOscuro) => ({
  bg: modoOscuro ? '#171717' : '#fafafa', // Gris carbón puro (sin azul)
  surface: modoOscuro ? '#262626' : '#f5f5f5', 
  surfaceCard: modoOscuro ? '#262626' : '#ffffff', 
  border: modoOscuro ? '#404040' : '#e5e5e5', 
  borderDivider: modoOscuro ? '#525252' : '#f5f5f5',
  text: modoOscuro ? '#ffffff' : '#171717', 
  textMuted: modoOscuro ? '#a3a3a3' : '#737373', 
  textSubtle: modoOscuro ? '#737373' : '#a3a3a3',
  inputBg: modoOscuro ? '#171717' : '#ffffff',
  inputBorder: modoOscuro ? '#525252' : '#d4d4d4',
  accent: '#16a34a',
  accentSoft: modoOscuro ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)',
  warning: '#f59e0b',
  warningSoft: modoOscuro ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.08)',
  danger: '#ef4444',
  dangerSoft: modoOscuro ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)'
});
export const generarEstilosAprobaciones = (c, modoOscuro) => `
  .aprobaciones-container {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: ${c.text};
  }

  .tabs-aprobacion-bar {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid ${c.border};
    padding-bottom: 10px;
    margin-bottom: 8px;
    scrollbar-width: none; /* Oculta scrollbar en firefox */
  }
  .tabs-aprobacion-bar::-webkit-scrollbar {
    display: none; /* Oculta scrollbar en Chrome/Safari */
  }

  .tab-btn {
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: ${c.textMuted};
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
  }
  .tab-btn:hover {
    color: ${c.text};
  }
  .tab-btn.active {
    background: ${c.surfaceCard};
    border-color: ${c.border};
    color: ${c.text};
    box-shadow: ${modoOscuro ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 6px rgba(0,0,0,0.03)'};
  }

  .tarjeta-solicitud {
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    border-radius: 16px;
    padding: 20px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: ${modoOscuro ? '0 4px 20px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.02)'};
    transition: border-color 0.2s ease, transform 0.2s ease;
  }
  .tarjeta-solicitud:hover {
    border-color: ${modoOscuro ? '#3f3f46' : '#d4d4d8'};
  }

  .mono-folio {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 700;
    font-size: 13px;
    color: ${c.text};
    background: ${c.surface};
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid ${c.border};
  }

  /* 🔥 EL TRUCO PARA EL CELULAR EN APROBACIONES 🔥 */
  @media (max-width: 500px) {
    div[style*="repeat(3, 1fr)"] {
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) !important;
      gap: 6px !important;
    }
  }
`;