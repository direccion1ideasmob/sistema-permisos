import React, { useState, useEffect, useRef } from 'react';
import { Clock, Lock, Unlock, Check, RotateCcw, X } from 'lucide-react';
import { obtenerHoraLimiteTolerancia, guardarHoraLimiteTolerancia } from '../../vigilancia/services/vigilanciaService';

export default function ControlHoraCorteRH({ usuario, c }) {
  const rol = String(usuario?.rol || '').toLowerCase();
  const esRHOSuper = rol === 'gerente_rh' || rol === 'rh_nominas' || rol === 'superadmin';

  const [horaCorte, setHoraCorte] = useState(() => localStorage.getItem('hora_limite_retardo_rh') || '07:15');
  const [abierto, setAbierto] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [inputHora, setInputHora] = useState('07:15');
  const [guardando, setGuardando] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!esRHOSuper) return;
    obtenerHoraLimiteTolerancia().then((h) => {
      if (h) {
        setHoraCorte(h);
        setInputHora(h);
      }
    });
  }, [esRHOSuper]);

  useEffect(() => {
    if (!abierto) return;
    const handleClickFuera = (e) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
        setDesbloqueado(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, [abierto]);

  if (!esRHOSuper) return null;

  const guardar = async (horaExplicita) => {
    if (!desbloqueado) return;
    const valor = typeof horaExplicita === 'string' ? horaExplicita : inputHora;
    if (!valor) return;
    setGuardando(true);
    try {
      const nueva = await guardarHoraLimiteTolerancia(valor);
      setHoraCorte(nueva);
      setInputHora(nueva);
      setDesbloqueado(false);
      setAbierto(false);
    } catch (e) {
      alert('Error al guardar hora de corte: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div ref={contenedorRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => {
          if (abierto) {
            setAbierto(false);
            setDesbloqueado(false);
          } else {
            setInputHora(horaCorte);
            setDesbloqueado(false);
            setAbierto(true);
          }
        }}
        title="Ajuste de hora límite de tolerancia"
        style={{
          height: '35px',
          width: '35px',
          borderRadius: '8px',
          border: `1px solid ${abierto ? (c?.accent || '#16a34a') : (c?.border || '#cbd5e1')}`,
          background: abierto ? (c?.accentSoft || 'rgba(22,163,74,0.1)') : (c?.bg || 'transparent'),
          color: abierto ? (c?.accent || '#16a34a') : (c?.textMuted || '#64748b'),
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          flexShrink: 0
        }}
      >
        <Clock size={15} />
      </button>

      {abierto && (
        <div
          style={{
            position: 'absolute',
            top: '42px',
            right: 0,
            zIndex: 9999,
            background: c?.surfaceCard || '#ffffff',
            border: `1.5px solid ${c?.border || '#cbd5e1'}`,
            borderRadius: '12px',
            padding: '12px 14px',
            width: '235px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: c?.textMuted || '#64748b', textTransform: 'uppercase' }}>
              Tolerancia Entrada
            </span>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setDesbloqueado(!desbloqueado)}
                style={{
                  height: '25px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: `1px solid ${desbloqueado ? '#f59e0b' : (c?.border || '#cbd5e1')}`,
                  background: desbloqueado ? 'rgba(245,158,11,0.14)' : (c?.bg || '#f8fafc'),
                  color: desbloqueado ? '#d97706' : (c?.textMuted || '#64748b'),
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {desbloqueado ? <Unlock size={12} /> : <Lock size={12} />}
                <span>{desbloqueado ? 'Abierto' : 'Candado'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setAbierto(false); setDesbloqueado(false); }}
                style={{
                  width: '24px', height: '24px', border: 'none', background: 'transparent',
                  color: c?.textMuted || '#64748b', cursor: 'pointer', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', padding: 0
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="time"
              value={inputHora}
              disabled={!desbloqueado}
              onChange={(e) => setInputHora(e.target.value)}
              style={{
                flex: 1,
                height: '34px',
                border: `1px solid ${desbloqueado ? (c?.accent || '#16a34a') : (c?.border || '#cbd5e1')}`,
                borderRadius: '8px',
                background: desbloqueado ? (c?.bg || '#f8fafc') : 'rgba(148,163,184,0.12)',
                color: c?.text || '#111',
                fontSize: '14px',
                fontWeight: '800',
                fontFamily: 'ui-monospace, monospace',
                padding: '0 10px',
                outline: 'none',
                cursor: desbloqueado ? 'pointer' : 'not-allowed',
                opacity: desbloqueado ? 1 : 0.65
              }}
            />

            {desbloqueado && (
              <button
                type="button"
                onClick={() => guardar(inputHora)}
                disabled={guardando}
                title="Guardar hora límite"
                style={{
                  height: '34px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: c?.accent || '#16a34a',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Check size={15} strokeWidth={3} />
              </button>
            )}
          </div>

          {desbloqueado && horaCorte !== '07:15' && (
            <button
              type="button"
              onClick={() => guardar('07:15')}
              disabled={guardando}
              style={{
                height: '28px',
                borderRadius: '7px',
                border: `1px solid ${c?.border || '#cbd5e1'}`,
                background: c?.bg || '#f8fafc',
                color: c?.textMuted || '#64748b',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}
            >
              <RotateCcw size={11} /> Restaurar a 07:15 hrs
            </button>
          )}
        </div>
      )}
    </div>
  );
}
