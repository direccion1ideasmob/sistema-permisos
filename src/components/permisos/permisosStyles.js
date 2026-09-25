export const obtenerTemaPermisos = (modoOscuro) => ({
  bg: modoOscuro ? '#09090b' : '#ffffff',
  surface: modoOscuro ? '#111115' : '#f8fafc',
  surfaceCard: modoOscuro ? '#141418' : '#ffffff',
  border: modoOscuro ? '#27272a' : '#cbd5e1',
  borderSubtle: modoOscuro ? '#1f1f23' : '#e2e8f0',
  text: modoOscuro ? '#ffffff' : '#09090b',
  textMuted: modoOscuro ? '#a1a1aa' : '#475569',
  textSubtle: modoOscuro ? '#71717a' : '#64748b',
  inputBg: modoOscuro ? '#18181b' : '#ffffff',
  inputBorder: modoOscuro ? '#3f3f46' : '#94a3b8',
  accent: '#16a34a',
  accentSoft: modoOscuro ? 'rgba(22, 163, 74, 0.2)' : 'rgba(22, 163, 74, 0.12)',
  warning: '#f59e0b',
  warningSoft: modoOscuro ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
  danger: '#ef4444',
  dangerSoft: modoOscuro ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'
});

export const generarEstilosPermisos = (c, modoOscuro) => `
  .permisos-container {
    width: 100%;
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif;
    box-sizing: border-box;
    padding: 0 4px;
  }

  .permiso-card-box {
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    border-radius: 14px;
    padding: 16px 20px;
    box-sizing: border-box;
    box-shadow: ${modoOscuro ? '0 4px 20px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.04)'};
  }

  /* INPUTS DE ALTO CONTRASTE CON COLOR-SCHEME */
  .input-permiso {
    width: 100%;
    height: 42px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1.5px solid ${c.inputBorder};
    background: ${c.inputBg};
    color: ${c.text} !important;
    font-size: 13.5px;
    font-weight: 600;
    outline: none;
    box-sizing: border-box;
    color-scheme: ${modoOscuro ? 'dark' : 'light'}; /* VITAL PARA QUE FECHA Y HORA SE VEAN */
    transition: border-color 0.15s ease;
  }
  .input-permiso:focus {
    border-color: ${c.accent};
    box-shadow: 0 0 0 2px ${c.accentSoft};
  }

  .label-permiso {
    display: block;
    font-size: 11px;
    font-weight: 800;
    color: ${c.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }

  /* BOTONES DE TIPO DE PASE */
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
    border-radius: 8px;
    border: 1.5px solid ${c.border};
    background: ${c.surface};
    color: ${c.textMuted};
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    text-align: center;
    transition: all 0.15s ease;
  }
  .pill-movimiento.active {
    border-color: ${c.accent};
    background: ${c.accentSoft};
    color: ${c.accent};
  }

  /* CUADRÍCULA DE FECHAS Y HORAS BLINDADA CONTRA DESCUADRES */
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

  /* NATURALEZA DEL ASUNTO */
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