export const obtenerTemaGrid = (modoOscuro) => ({
  bg: modoOscuro ? '#09090b' : '#ffffff',
  surface: modoOscuro ? '#0e1117' : '#f8fafc',
  surfaceCard: modoOscuro ? '#12161f' : '#ffffff',
  border: modoOscuro ? 'rgba(255, 255, 255, 0.07)' : '#e2e8f0',
  borderDivider: modoOscuro ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
  text: modoOscuro ? '#f8fafc' : '#0f172a',
  textMuted: modoOscuro ? '#94a3b8' : '#64748b',
  textSubtle: modoOscuro ? '#64748b' : '#94a3b8',
  rowHover: modoOscuro ? 'rgba(255, 255, 255, 0.025)' : '#f1f5f9',
  rowActive: modoOscuro ? 'rgba(22, 163, 74, 0.12)' : 'rgba(22, 163, 74, 0.06)',
  inputBg: modoOscuro ? '#161b24' : '#ffffff',
  inputBorder: modoOscuro ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1',
  accent: '#16a34a',
  accentSoft: modoOscuro ? 'rgba(22, 163, 74, 0.15)' : 'rgba(22, 163, 74, 0.08)',
  danger: '#ef4444',
  dangerSoft: modoOscuro ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)'
});

export const generarEstilosCSS = (c, modoOscuro) => `
  .grid-wrapper {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
    box-sizing: border-box;
  }

  /* BARRA DE FILTROS EN PÍLDORAS */
  .pills-scroll-container {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    width: 100%;
    max-width: 100%;
    padding-bottom: 8px;
    margin-bottom: 12px;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .pills-scroll-container::-webkit-scrollbar { display: none; }

  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border-radius: 9999px;
    border: 1px solid ${c.border};
    background: ${c.surface};
    color: ${c.text};
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
  }
  .filter-pill.active {
    border-color: ${c.accent};
    background: ${c.accentSoft};
    color: ${c.accent};
  }

  .pill-select {
    background: transparent;
    border: none;
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
    outline: none;
    cursor: pointer;
  }

  /* ================= LISTA MÓVIL BLINDADA CONTRA DESCUADRES ================= */
  .mobile-contact-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .mobile-contact-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 12px;
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    cursor: pointer;
    box-sizing: border-box;
    width: 100%;
    overflow: hidden;
  }

  /* ================= VISTA LAPTOP: TABLA MAESTRA ================= */
  .desktop-table-container {
    width: 100%;
    border: 1px solid ${c.border};
    border-radius: 12px;
    overflow: hidden;
    background: ${c.bg};
    box-shadow: ${modoOscuro ? '0 4px 30px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.04)'};
  }

  .desktop-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    text-align: left;
    white-space: nowrap;
  }

  .desktop-table th {
    padding: 12px 14px;
    background: ${c.surface};
    color: ${c.textMuted};
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1.5px solid ${c.border};
    user-select: none;
  }
  .desktop-table th.sortable { cursor: pointer; }
  .desktop-table th.sortable:hover { color: ${c.text}; }

  .desktop-table td {
    padding: 12px 14px;
    border-bottom: 1px solid ${c.borderDivider};
    color: ${c.text};
    vertical-align: middle;
    cursor: pointer;
  }

  .desktop-table tr.row-item:hover td {
    background-color: ${c.rowHover};
  }
  .desktop-table tr.row-item.active-row td {
    background-color: ${c.rowActive};
    border-bottom-color: ${c.accent};
  }

  .mono-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 700;
    color: ${c.accent};
  }

  /* ================= MODAL DEL EXPEDIENTE ================= */
  .dossier-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(5px);
    z-index: 5000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }

  @media (max-width: 768px) {
    .dossier-overlay {
      align-items: flex-end;
      padding: 0;
    }
  }

  .dossier-drawer {
    width: 100%;
    max-width: 580px;
    max-height: 88vh;
    background: ${c.bg};
    border: 1px solid ${c.border};
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);
    overflow: hidden;
    box-sizing: border-box;
  }

  @media (max-width: 768px) {
    .dossier-drawer {
      max-width: 100%;
      height: 92vh;
      border-radius: 20px 20px 0 0;
      border-left: none;
      border-right: none;
    }
  }

  .dossier-body-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-sizing: border-box;
  }

  .touch-field-input {
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid ${c.inputBorder};
    background: ${c.inputBg};
    color: ${c.text};
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
  }
  .touch-field-input:focus {
    border-color: ${c.accent};
    box-shadow: 0 0 0 2px ${c.accentSoft};
  }

  .touch-field-label {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    color: ${c.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 4px;
  }
`;