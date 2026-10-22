import React, { useState, useEffect, useRef } from 'react';
import { Clock, Lock, Unlock, Check, RotateCcw, X } from 'lucide-react';
import { obtenerHoraLimiteTolerancia, guardarHoraLimiteTolerancia } from '../../vigilancia/services/vigilanciaService.js';

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

  // Cerrar y volver a poner el candado si hacen clic fuera
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

  const abrirPopover = () => {
    if (abierto) {
      setAbierto(false);
      setDesbloqueado(false);
    } else {
      setInputHora(horaCorte);
      setDesbloqueado(false);
      setAbierto(true);
    }
  };

  const guardar = async (horaExplicita) => {
    if (!desbloqueado) return;
    const valor = typeof horaExplicita === 'string' ? horaExplicita : inputHora;
    if (!valor) return;
    setGuardando(true);
    try {
      const nueva = await guardarHoraLimiteTolerancia(valor, usuario?.id || null);
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
      {/* BOTÓN PURO DE RELOJ (SIN HORA VISIBLE AFUERA) */}
      <button
        type="button"
        onClick={abrirPopover}
        title="Reloj de corte de asistencia"
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '8px',
          border: `1px solid ${abierto ? (c?.accent || '#16a34a') : (c?.border || 'rgba(148,163,184,0.28)')}`,
          background: abierto ? (c?.accentSoft || 'rgba(22,163,74,0.1)') : 'transparent',
          color: abierto ? (c?.accent || '#16a34a') : (c?.textMuted || '#64748b'),
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          opacity: abierto ? 1 : 0.7,
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => { if (!abierto) e.currentTarget.style.opacity = '0.7'; }}
      >
        <Clock size={15} />
      </button>

      {/* POPOVER OCULTO HASTA HACER CLIC, PROTEGIDO CON CANDADO */}
      {abierto && (
        <div
          style={{
            position: 'absolute',
            top: '36px',
            right: 0,
            zIndex: 1200,
            background: c?.surfaceCard || '#ffffff',
            border: `1.5px solid ${c?.border || '#cbd5e1'}`,
            borderRadius: '11px',
            padding: '10px 12px',
            minWidth: '215px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.16)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: c?.textMuted || '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Corte Tolerancia
            </span>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setDesbloqueado(!desbloqueado)}
                title={desbloqueado ? 'Bloquear candado' : 'Desbloquear candado para editar'}
                style={{
                  height: '24px',
                  padding: '0 7px',
                  borderRadius: '6px',
                  border: `1px solid ${desbloqueado ? '#f59e0b' : (c?.border || '#cbd5e1')}`,
                  background: desbloqueado ? 'rgba(245,158,11,0.14)' : (c?.bg || '#f8fafc'),
                  color: desbloqueado ? '#d97706' : (c?.textMuted || '#64748b'),
                  fontSize: '10.5px',
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
                  width: '22px',
                  height: '22px',
                  border: 'none',
                  background: 'transparent',
                  color: c?.textMuted || '#64748b',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                <X size={13} />
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
                height: '32px',
                border: `1px solid ${desbloqueado ? (c?.accent || '#16a34a') : (c?.border || '#cbd5e1')}`,
                borderRadius: '7px',
                background: desbloqueado ? (c?.bg || '#f8fafc') : 'rgba(148,163,184,0.12)',
                color: c?.text || '#111',
                fontSize: '13px',
                fontWeight: '800',
                fontFamily: 'ui-monospace, monospace',
                padding: '0 8px',
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
                title="Confirmar y bloquear"
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '7px',
                  border: 'none',
                  background: c?.accent || '#16a34a',
                  color: '#fff',
                  fontSize: '11.5px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Check size={14} strokeWidth={3} />
              </button>
            )}
          </div>

          {desbloqueado && horaCorte !== '07:15' && (
            <button
              type="button"
              onClick={() => guardar('07:15')}
              disabled={guardando}
              style={{
                height: '26px',
                borderRadius: '6px',
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
