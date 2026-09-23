export const obtenerTemaPermisos = (modoOscuro) => ({
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

export const generarEstilosPermisos = (c, modoOscuro) => `
  .permisos-container {
    width: 100%;
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
    box-sizing: border-box;
  }

  .permiso-card-box {
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    border-radius: 14px;
    padding: 20px;
    box-sizing: border-box;
  }

  .input-permiso {
    width: 100%;
    height: 38px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid ${c.inputBorder};
    background: ${c.inputBg};
    color: ${c.text};
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }
  .input-permiso:focus {
    border-color: ${c.accent};
    box-shadow: 0 0 0 2px ${c.accentSoft};
  }

  .label-permiso {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    color: ${c.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 5px;
  }

  .pill-movimiento {
    flex: 1 1 140px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid ${c.border};
    background: ${c.surface};
    color: ${c.textMuted};
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.15s ease;
  }
  .pill-movimiento.active {
    border-color: ${c.accent};
    background: ${c.accentSoft};
    color: ${c.accent};
  }

  /* REGLAS DE IMPRESIÓN OFICIAL */
  @media print {
    body * { visibility: hidden; }
    .seccion-impresion-papeleta, .seccion-impresion-papeleta * { visibility: visible; }
    .seccion-impresion-papeleta {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      margin: 0;
      padding: 24px;
      background: #ffffff !important;
      color: #000000 !important;
    }
    .no-print { display: none !important; }
  }
`;