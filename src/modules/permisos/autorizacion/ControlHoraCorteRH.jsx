import React, { useState, useEffect } from 'react';
import { Clock, X, Check } from 'lucide-react';
import { obtenerHoraLimiteTolerancia, guardarHoraLimiteTolerancia } from '../../vigilancia/services/vigilanciaService.js';

export default function ControlHoraCorteRH({ usuario, c }) {
  const rol = String(usuario?.rol || '').toLowerCase();
  const esRHOSuper = rol.includes('rh') || rol.includes('super') || rol.includes('admin');

  const [horaCorte, setHoraCorte] = useState(() => localStorage.getItem('hora_limite_retardo_rh') || '07:15');
  const [editando, setEditando] = useState(false);
  const [inputHora, setInputHora] = useState('07:15');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!esRHOSuper) return;
    obtenerHoraLimiteTolerancia().then((h) => {
      if (h) setHoraCorte(h);
    });
  }, [esRHOSuper]);

  if (!esRHOSuper) return null;

  const guardar = async (horaExplicita) => {
    const valor = typeof horaExplicita === 'string' ? horaExplicita : inputHora;
    if (!valor) return;
    setGuardando(true);
    try {
      const nueva = await guardarHoraLimiteTolerancia(valor, usuario?.id || null);
      setHoraCorte(nueva);
      setEditando(false);
    } catch (e) {
      alert('Error al guardar hora de corte: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {!editando ? (
        <button
          type="button"
          onClick={() => {
            setInputHora(horaCorte);
            setEditando(true);
          }}
          title={`Límite tolerancia caseta: ${horaCorte} hrs (Clic para ajustar)`}
          style={{
            height: '28px',
            padding: '0 8px',
            borderRadius: '7px',
            border: `1px solid ${c?.border || 'rgba(148,163,184,0.28)'}`,
            background: 'transparent',
            color: c?.textMuted || '#64748b',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            opacity: 0.75,
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}
        >
          <Clock size={12.5} />
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{horaCorte}</span>
        </button>
      ) : (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: c?.surfaceCard || '#fff',
            border: `1px solid ${c?.border || '#cbd5e1'}`,
            borderRadius: '8px',
            padding: '3px 7px',
            height: '30px',
            boxSizing: 'border-box',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          <Clock size={12} color={c?.accent || '#16a34a'} />
          <input
            type="time"
            value={inputHora}
            onChange={(e) => setInputHora(e.target.value)}
            style={{
              border: `1px solid ${c?.border || '#cbd5e1'}`,
              borderRadius: '5px',
              background: c?.bg || '#f8fafc',
              color: c?.text || '#111',
              fontSize: '11.5px',
              fontWeight: '700',
              padding: '1px 5px',
              outline: 'none'
            }}
          />
          <button
            type="button"
            onClick={() => guardar(inputHora)}
            disabled={guardando}
            title="Guardar hora límite"
            style={{
              height: '22px',
              padding: '0 7px',
              borderRadius: '5px',
              border: 'none',
              background: c?.accent || '#16a34a',
              color: '#fff',
              fontSize: '10.5px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            <Check size={12} />
          </button>
          {horaCorte !== '07:15' && (
            <button
              type="button"
              onClick={() => guardar('07:15')}
              disabled={guardando}
              title="Restaurar a 07:15"
              style={{
                height: '22px',
                padding: '0 6px',
                borderRadius: '5px',
                border: `1px solid ${c?.border || '#cbd5e1'}`,
                background: c?.bg || '#f1f5f9',
                color: c?.textMuted || '#64748b',
                fontSize: '10px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              07:15
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditando(false)}
            style={{
              height: '22px',
              padding: '0 4px',
              borderRadius: '5px',
              border: 'none',
              background: 'transparent',
              color: c?.textMuted || '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
