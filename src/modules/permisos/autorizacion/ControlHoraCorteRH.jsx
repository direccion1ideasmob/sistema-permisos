import React, { useState, useEffect, useRef } from 'react';
import { Clock, Lock, Unlock, Check, RotateCcw, X } from 'lucide-react';
import {
  obtenerHoraLimiteTolerancia,
  guardarHoraLimiteTolerancia,
  obtenerHoraSalidaOficial,
  guardarHoraSalidaOficial
} from '../../vigilancia/services/vigilanciaService';

export default function ControlHoraCorteRH({ usuario, c }) {
  const rol = String(usuario?.rol || '').toLowerCase();
  const esRHOSuper = rol === 'gerente_rh' || rol === 'rh_nominas' || rol === 'superadmin';

  const [horaCorte, setHoraCorte] = useState(() => localStorage.getItem('hora_limite_retardo_rh') || '07:15');
  const [horaSalida, setHoraSalida] = useState(() => localStorage.getItem('hora_salida_oficial_rh') || '17:00');
  const [abierto, setAbierto] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [inputHoraEntrada, setInputHoraEntrada] = useState('07:15');
  const [inputHoraSalida, setInputHoraSalida] = useState('17:00');
  const [guardando, setGuardando] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!esRHOSuper) return;
    obtenerHoraLimiteTolerancia().then((h) => {
      if (h) {
        setHoraCorte(h);
        setInputHoraEntrada(h);
      }
    });
    obtenerHoraSalidaOficial().then((hSal) => {
      if (hSal) {
        setHoraSalida(hSal);
        setInputHoraSalida(hSal);
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

  const guardarAmbos = async (entExplicita = null, salExplicita = null) => {
    if (!desbloqueado) return;
    const valEnt = typeof entExplicita === 'string' ? entExplicita : inputHoraEntrada;
    const valSal = typeof salExplicita === 'string' ? salExplicita : inputHoraSalida;
    if (!valEnt || !valSal) return;

    setGuardando(true);
    try {
      const [nuevaEnt, nuevaSal] = await Promise.all([
        guardarHoraLimiteTolerancia(valEnt),
        guardarHoraSalidaOficial(valSal)
      ]);
      setHoraCorte(nuevaEnt);
      setInputHoraEntrada(nuevaEnt);
      setHoraSalida(nuevaSal);
      setInputHoraSalida(nuevaSal);
      setDesbloqueado(false);
      setAbierto(false);
    } catch (e) {
      alert('Error al guardar horarios de RH: ' + e.message);
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
            setInputHoraEntrada(horaCorte);
            setInputHoraSalida(horaSalida);
            setDesbloqueado(false);
            setAbierto(true);
          }
        }}
        title={`Horarios RH • Entrada: ${horaCorte} | Salida: ${horaSalida}`}
        style={{
          height: '34px',
          padding: '0 10px',
          borderRadius: '8px',
          border: `1px solid ${abierto ? (c?.accent || '#16a34a') : (c?.border || '#cbd5e1')}`,
          background: abierto ? (c?.accentSoft || 'rgba(22,163,74,0.1)') : (c?.bg || 'transparent'),
          color: abierto ? (c?.accent || '#16a34a') : (c?.textMuted || '#64748b'),
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          fontWeight: '700',
          flexShrink: 0
        }}
      >
        <Clock size={14} />
        <span>{horaCorte} – {horaSalida}</span>
      </button>

      {abierto && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: 0,
            zIndex: 9999,
            background: c?.surfaceCard || '#ffffff',
            border: `1.5px solid ${c?.border || '#cbd5e1'}`,
            borderRadius: '12px',
            padding: '12px 14px',
            width: '260px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: c?.textMuted || '#64748b', textTransform: 'uppercase' }}>
              Relojes de Turno RH
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: c?.textMuted || '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>
                Tolerancia Entrada
              </label>
              <input
                type="time"
                value={inputHoraEntrada}
                disabled={!desbloqueado}
                onChange={(e) => setInputHoraEntrada(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  border: `1px solid ${desbloqueado ? (c?.accent || '#16a34a') : (c?.border || '#cbd5e1')}`,
                  borderRadius: '8px',
                  background: desbloqueado ? (c?.bg || '#f8fafc') : 'rgba(148,163,184,0.12)',
                  color: c?.text || '#111',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  fontFamily: 'ui-monospace, monospace',
                  padding: '0 8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: desbloqueado ? 'pointer' : 'not-allowed',
                  opacity: desbloqueado ? 1 : 0.65
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: c?.textMuted || '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>
                Salida Oficial
              </label>
              <input
                type="time"
                value={inputHoraSalida}
                disabled={!desbloqueado}
                onChange={(e) => setInputHoraSalida(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  border: `1px solid ${desbloqueado ? (c?.accent || '#16a34a') : (c?.border || '#cbd5e1')}`,
                  borderRadius: '8px',
                  background: desbloqueado ? (c?.bg || '#f8fafc') : 'rgba(148,163,184,0.12)',
                  color: c?.text || '#111',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  fontFamily: 'ui-monospace, monospace',
                  padding: '0 8px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: desbloqueado ? 'pointer' : 'not-allowed',
                  opacity: desbloqueado ? 1 : 0.65
                }}
              />
            </div>
          </div>

          {desbloqueado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                onClick={() => guardarAmbos()}
                disabled={guardando}
                style={{
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: c?.accent || '#16a34a',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
              >
                <Check size={14} strokeWidth={3} /> Guardar horarios
              </button>

              {(horaCorte !== '07:15' || horaSalida !== '17:00') && (
                <button
                  type="button"
                  onClick={() => guardarAmbos('07:15', '17:00')}
                  disabled={guardando}
                  style={{
                    height: '27px',
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
                  <RotateCcw size={11} /> Restaurar (07:15 / 17:00)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
