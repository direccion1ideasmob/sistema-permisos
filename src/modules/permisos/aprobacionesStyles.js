import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';

export const obtenerTemaAprobaciones = (modoOscuro) => obtenerTemaGlobal(modoOscuro);

export const generarEstilosAprobaciones = (c, modoOscuro) => `
  .aprobaciones-container {
    font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    color: ${c.text};
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .tabs-aprobacion-bar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: ${c.bg};
    padding: 4px;
    border-radius: 12px;
    border: 1px solid ${c.border};
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs-aprobacion-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 14px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: ${c.textMuted};
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    box-sizing: border-box;
  }

  .tab-btn:hover {
    color: ${c.text};
  }

  .tab-btn.active {
    background: ${modoOscuro ? '#27272a' : '#0f172a'} !important;
    color: #ffffff !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }
  .tab-btn.active svg {
    color: #ffffff !important;
  }
  .tab-btn.active .tab-badge {
    background: rgba(255, 255, 255, 0.22) !important;
    color: #ffffff !important;
  }
  .tab-btn:not(.active) .tab-badge {
    background: ${modoOscuro ? '#27272a' : '#e2e8f0'} !important;
    color: ${c.text} !important;
  };
    color: ${c.accent};
    border-color: ${c.border};
    box-shadow: ${modoOscuro ? '0 4px 14px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.06)'};
  }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 800;
    line-height: 1;
  }

  .card-aprobacion {
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-sizing: border-box;
    width: 100%;
  }

  .footer-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    padding-top: 14px;
    border-top: 1px solid ${c.borderDivider};
  }

  .footer-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  @media (max-width: 600px) {
    .tab-btn {
      padding: 8px 12px;
      font-size: 13.5px;
      gap: 5px;
    }
    .footer-container {
      flex-direction: column;
      align-items: stretch;
    }
    .footer-buttons {
      width: 100%;
      justify-content: flex-end;
    }
  }
`;
