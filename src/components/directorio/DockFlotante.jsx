import React from 'react';
import { Save } from 'lucide-react';

export default function DockFlotante({ nombreColaborador, onCancelar, onGuardar, guardando, c }) {
  return (
    <div className="dock-flotante">
      <div style={{ fontSize: '12px', fontWeight: '700', color: c.text }}>
        Editando a: <strong style={{ color: c.accent }}>{nombreColaborador}</strong>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onCancelar}
          style={{
            background: 'transparent', border: `1px solid ${c.border}`,
            color: c.subText, padding: '5px 12px', borderRadius: '20px',
            fontSize: '11px', fontWeight: '700', cursor: 'pointer'
          }}
        >
          Cancelar
        </button>
        <button
          onClick={onGuardar}
          disabled={guardando}
          style={{
            background: c.accent, border: 'none', color: '#fff',
            padding: '6px 16px', borderRadius: '20px',
            fontSize: '11px', fontWeight: '800', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px'
          }}
        >
          <Save size={12} /> {guardando ? 'Guardando en Supabase...' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}