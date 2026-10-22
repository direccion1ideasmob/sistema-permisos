export const obtenerTemaGrid = (modoOscuro) => ({
  // Fondos base (Gris más suave y elegante, no negro puro)
  bg: modoOscuro ? '#27272a' : '#f8fafc', // Zinc 800
  surface: modoOscuro ? '#27272a' : '#f1f5f9',
  surfaceCard: modoOscuro ? '#3f3f46' : '#ffffff', // Zinc 700 para resaltar las tarjetas/tabla
  
  // Bordes
  border: modoOscuro ? '#52525b' : 'rgba(0, 0, 0, 0.08)', // Zinc 600
  borderDivider: modoOscuro ? '#52525b' : 'rgba(0, 0, 0, 0.04)',
  
  // Textos
  text: modoOscuro ? '#f4f4f5' : '#09090b',
  textMuted: modoOscuro ? '#a1a1aa' : '#71717a',
  textSubtle: modoOscuro ? '#94a3b8' : '#94a3b8',
  
  // Interacciones
  rowHover: modoOscuro ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9',
  rowActive: modoOscuro ? 'rgba(22, 163, 74, 0.2)' : 'rgba(22, 163, 74, 0.06)',
  
  // Inputs
  inputBg: modoOscuro ? '#27272a' : '#ffffff',
  inputBorder: modoOscuro ? '#52525b' : 'rgba(0, 0, 0, 0.08)',
  
  // Acentos
  accent: '#16a34a',
  accentSoft: modoOscuro ? 'rgba(22, 163, 74, 0.2)' : 'rgba(22, 163, 74, 0.08)',
  danger: '#ef4444',
  dangerSoft: modoOscuro ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.08)'
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
    border: 1.5px solid ${c.border};
    background: ${c.surfaceCard};
    color: ${c.text};
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s ease;
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
  .pill-select option {
    background: ${c.surfaceCard};
    color: ${c.text};
  }

  /* ================= VISTA LAPTOP: TABLA MAESTRA ================= */
  .desktop-table-container {
    width: 100%;
    border: 1.5px solid ${c.border};
    border-radius: 12px;
    overflow: hidden;
    background: ${c.surfaceCard};
    box-shadow: ${modoOscuro ? '0 10px 30px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.04)'};
  }

  .desktop-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
    text-align: left;
    white-space: nowrap;
  }

  .desktop-table th {
    padding: 12px 14px;
    background: ${c.surface};
    color: ${c.textMuted};
    font-size: 11.5px;
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
    border-bottom: 1.5px solid ${c.borderDivider};
    color: ${c.text};
    vertical-align: middle;
    cursor: pointer;
  }

  .desktop-table tr.row-item:hover td { background-color: ${c.rowHover}; }
  .desktop-table tr.row-item.active-row td {
    background-color: ${c.rowActive};
    border-bottom-color: ${c.accent};
  }

  .mono-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 700;
    color: ${c.textMuted};
  }

  /* ================= SCROLLBAR ELEGANTE PARA EL MODAL ================= */
  .dossier-body-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .dossier-body-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .dossier-body-scroll::-webkit-scrollbar-thumb {
    background: ${c.border};
    border-radius: 10px;
  }
  .dossier-body-scroll::-webkit-scrollbar-thumb:hover {
    background: ${c.textMuted};
  }

  /* ================= MODAL DEL EXPEDIENTE ================= */
  .dossier-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 5000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    box-sizing: border-box;
  }

  .dossier-drawer {
    width: 100%;
    max-width: 580px;
    max-height: 88vh;
    background: ${c.bg}; /* Usa el gris base */
    border: 1.5px solid ${c.border};
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
    overflow: hidden;
    box-sizing: border-box;
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
    border-radius: 8px;
    border: 1.5px solid ${c.inputBorder};
    background: ${c.inputBg};
    color: ${c.text};
    font-size: 13px;
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }
  .touch-field-input:focus {
    border-color: ${c.accent};
    box-shadow: 0 0 0 3px ${c.accentSoft};
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

  /* ================= VISTA MÓVIL: LISTA DE CONTACTOS LIMPIA ================= */
  .mobile-contact-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
  }

  .mobile-contact-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 13px;
    background: ${c.surfaceCard};
    border: 1px solid ${c.border};
    border-radius: 12px;
    cursor: pointer;
    box-sizing: border-box;
    width: 100%;
    transition: background 0.15s ease;
  }

  .mobile-contact-card:active {
    background: ${c.rowHover};
  }

  @media (max-width: 640px) {
    .pills-scroll-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      overflow-x: visible;
      padding-bottom: 4px;
    }
    .filter-pill {
      width: 100%;
      box-sizing: border-box;
      justify-content: space-between;
      padding: 0 10px;
      height: 34px;
    }
    .pill-select {
      width: 100%;
      text-overflow: ellipsis;
      overflow: hidden;
    }
  }
`;
