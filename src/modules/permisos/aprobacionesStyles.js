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
    border-radius: 10px;
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
    padding: 9px 12px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: ${c.textMuted};
    font-family: inherit;
    font-size: 12px;
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
    background: ${c.surfaceCard};
    color: ${c.accent};
    border-color: ${c.border};
    box-shadow: ${modoOscuro ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.06)'};
  }

  .tab-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 800;
    line-height: 1;
  }

  .card-aprobacion {
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-sizing: border-box;
    width: 100%;
  }

  .footer-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 12px;
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
      padding: 8px 10px;
      font-size: 11.5px;
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
