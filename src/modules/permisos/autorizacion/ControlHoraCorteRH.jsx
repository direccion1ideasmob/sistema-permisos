import React, { useState, useEffect } from 'react';
import { Sliders, X, Check } from 'lucide-react';
import { obtenerHoraLimiteTolerancia, guardarHoraLimiteTolerancia } from '../../vigilancia/services/vigilanciaService.js';

export default function ControlHoraCorteRH({ usuario, c }) {
  const rol = String(usuario?.rol || '').toLowerCase();
  const esRHOSuper = rol === 'gerente_rh' || rol === 'rh_nominas' || rol === 'superadmin';

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

  const guardar = async () => {
    if (!inputHora) return;
    setGuardando(true);
    try {
      const nueva = await guardarHoraLimiteTolerancia(inputHora, usuario?.id || null);
      setHoraCorte(nueva);
      setEditando(false);
    } catch (e) {
      alert('Error al guardar hora de corte: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {!editando ? (
        <button
          type="button"
          onClick={() => {
            setInputHora(horaCorte);
            setEditando(true);
          }}
          title="Configurar hora límite de tolerancia para caseta"
          style={{
            height: '36px',
            padding: '0 12px',
            borderRadius: '9px',
            border: `1.5px solid ${c?.accent || '#16a34a'}`,
            background: c?.accentSoft || 'rgba(22,163,74,0.12)',
            color: c?.accent || '#16a34a',
            fontSize: '12px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Sliders size={14} />
          <span>Tolerancia Caseta: {horaCorte} hrs</span>
        </button>
      ) : (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: c?.surfaceCard || '#fff',
            border: `1.5px solid ${c?.accent || '#16a34a'}`,
            borderRadius: '9px',
            padding: '3px 8px',
            height: '36px',
            boxSizing: 'border-box'
          }}
        >
          <span style={{ fontSize: '11.5px', fontWeight: '800', color: c?.text || '#111' }}>Límite:</span>
          <input
            type="time"
            value={inputHora}
            onChange={(e) => setInputHora(e.target.value)}
            style={{
              border: `1px solid ${c?.border || '#ccc'}`,
              borderRadius: '6px',
              background: c?.bg || '#f8fafc',
              color: c?.text || '#111',
              fontSize: '12.5px',
              fontWeight: '800',
              padding: '2px 6px',
              outline: 'none'
            }}
          />
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            style={{
              height: '26px',
              padding: '0 9px',
              borderRadius: '6px',
              border: 'none',
              background: c?.accent || '#16a34a',
              color: '#fff',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Check size={12} /> {guardando ? '...' : 'OK'}
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            style={{
              height: '26px',
              padding: '0 5px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: c?.textMuted || '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center'
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
