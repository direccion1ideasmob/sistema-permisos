export const obtenerTemaAprobaciones = (modoOscuro) => ({
  bg: modoOscuro ? '#09090b' : '#ffffff',
  surface: modoOscuro ? '#0e1117' : '#f8fafc',
  surfaceCard: modoOscuro ? '#12161f' : '#ffffff',
  border: modoOscuro ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
  borderDivider: modoOscuro ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
  text: modoOscuro ? '#f8fafc' : '#0f172a',
  textMuted: modoOscuro ? '#94a3b8' : '#64748b',
  textSubtle: modoOscuro ? '#64748b' : '#94a3b8',
  inputBg: modoOscuro ? '#161b24' : '#ffffff',
  inputBorder: modoOscuro ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1',
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
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .tabs-aprobacion-bar {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid ${c.border};
    padding-bottom: 8px;
    margin-bottom: 8px;
  }

  .tab-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: ${c.textMuted};
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.15s ease;
  }
  .tab-btn.active {
    background: ${c.surface};
    border-color: ${c.border};
    color: ${c.text};
    box-shadow: ${modoOscuro ? '0 2px 10px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.05)'};
  }

  .tarjeta-solicitud {
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    border-radius: 12px;
    padding: 16px 18px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: border-color 0.15s ease;
  }
  .tarjeta-solicitud:hover {
    border-color: ${modoOscuro ? '#33333d' : '#cbd5e1'};
  }

  .mono-folio {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 800;
    font-size: 13px;
    color: ${c.accent};
  }
`;