import React, { useState, useEffect, useRef } from 'react';
import { Clock, Lock, Unlock, Check, RotateCcw, X } from 'lucide-react';
import {
  obtenerHoraLimiteTolerancia,
  guardarHoraLimiteTolerancia,
  obtenerHoraSalidaOficial,
  guardarHoraSalidaOficial,
  obtenerHoraInicioTurno,
  guardarHoraInicioTurno
} from '../../vigilancia/services/vigilanciaService';

// Reloj de RH: Inicio de turno (I) + Tolerancia (T) = Entrada límite (E). Salida oficial (S).
// Las horas de retardo se cuentan desde I; después de E es retardo; antes de S se necesita pase.
const aMinutosReloj = (hhmm, porDefecto) => {
  const [h, m] = String(hhmm || porDefecto).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) {
    const [hd, md] = porDefecto.split(':').map(Number);
    return hd * 60 + md;
  }
  return h * 60 + m;
};

const aHHMMReloj = (minutos) => {
  const total = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export default function ControlHoraCorteRH({ usuario, c }) {
  const rol = String(usuario?.rol || '').toLowerCase();
  const esRHOSuper = rol === 'gerente_rh' || rol === 'rh_nominas' || rol === 'superadmin';

  const [horaInicio, setHoraInicio] = useState(() => localStorage.getItem('hora_inicio_turno_rh') || '07:00');
  const [horaCorte, setHoraCorte] = useState(() => localStorage.getItem('hora_limite_retardo_rh') || '07:15');
  const [horaSalida, setHoraSalida] = useState(() => localStorage.getItem('hora_salida_oficial_rh') || '17:00');
  const [abierto, setAbierto] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [inputInicio, setInputInicio] = useState('07:00');
  const [inputTolerancia, setInputTolerancia] = useState('15');
  const [inputHoraSalida, setInputHoraSalida] = useState('17:00');
  const [guardando, setGuardando] = useState(false);
  const contenedorRef = useRef(null);

  const toleranciaActual = Math.max(0, aMinutosReloj(horaCorte, '07:15') - aMinutosReloj(horaInicio, '07:00'));

  useEffect(() => {
    if (!esRHOSuper) return;
    Promise.all([obtenerHoraInicioTurno(), obtenerHoraLimiteTolerancia(), obtenerHoraSalidaOficial()])
      .then(([hIni, hLim, hSal]) => {
        if (hIni) setHoraInicio(hIni);
        if (hLim) setHoraCorte(hLim);
        if (hSal) setHoraSalida(hSal);
      })
      .catch(() => {});
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

  const toleranciaInputNum = parseInt(inputTolerancia, 10);
  const entradaCalculada = aHHMMReloj(aMinutosReloj(inputInicio, '07:00') + (isNaN(toleranciaInputNum) ? 0 : toleranciaInputNum));

  const guardarReloj = async (iniExpl = null, tolExpl = null, salExpl = null) => {
    if (!desbloqueado) return;
    const valIni = typeof iniExpl === 'string' ? iniExpl : inputInicio;
    const valTol = tolExpl !== null ? tolExpl : parseInt(inputTolerancia, 10);
    const valSal = typeof salExpl === 'string' ? salExpl : inputHoraSalida;
    if (!valIni || !valSal) return;
    if (isNaN(valTol) || valTol < 0 || valTol > 180) {
      alert('La tolerancia debe ser un número de minutos entre 0 y 180.');
      return;
    }
    const valEnt = aHHMMReloj(aMinutosReloj(valIni, '07:00') + valTol);
    if (aMinutosReloj(valSal, '17:00') <= aMinutosReloj(valEnt, '07:15')) {
      alert('La salida oficial debe ser posterior a la entrada límite.');
      return;
    }

    setGuardando(true);
    try {
      const [nuevaIni, nuevaEnt, nuevaSal] = await Promise.all([
        guardarHoraInicioTurno(valIni),
        guardarHoraLimiteTolerancia(valEnt),
        guardarHoraSalidaOficial(valSal)
      ]);
      setHoraInicio(nuevaIni);
      setHoraCorte(nuevaEnt);
      setHoraSalida(nuevaSal);
      setDesbloqueado(false);
      setAbierto(false);
    } catch (e) {
      alert('Error al guardar horarios de RH: ' + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const estiloInput = {
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
  };

  const estiloLabel = {
    display: 'block', fontSize: '10px', fontWeight: '700', color: c?.textMuted || '#64748b',
    marginBottom: '3px', textTransform: 'uppercase'
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
            setInputInicio(horaInicio);
            setInputTolerancia(String(toleranciaActual));
            setInputHoraSalida(horaSalida);
            setDesbloqueado(false);
            setAbierto(true);
          }
        }}
        title={`Horarios RH • Inicio: ${horaInicio} | Tolerancia: ${toleranciaActual} min (entrada límite ${horaCorte}) | Salida: ${horaSalida}`}
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
        <span>{horaInicio} (+{toleranciaActual}′) – {horaSalida}</span>
      </button>

      <style>{`
        .rh-reloj-popover {
          position: absolute;
          top: 40px;
          right: 0;
          z-index: 9999;
          width: 300px;
          box-sizing: border-box;
        }
        @media (max-width: 640px) {
          .rh-reloj-popover {
            position: fixed !important;
            top: 76px !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            max-width: 360px !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
      {abierto && (
        <div
          className="rh-reloj-popover"
          style={{
            background: c?.surfaceCard || '#ffffff',
            border: `1.5px solid ${c?.border || '#cbd5e1'}`,
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={estiloLabel}>Inicio turno</label>
              <input
                type="time"
                value={inputInicio}
                disabled={!desbloqueado}
                onChange={(e) => setInputInicio(e.target.value)}
                style={estiloInput}
              />
            </div>
            <div>
              <label style={estiloLabel}>Tolerancia (min)</label>
              <input
                type="number"
                min="0"
                max="180"
                value={inputTolerancia}
                disabled={!desbloqueado}
                onChange={(e) => setInputTolerancia(e.target.value)}
                style={estiloInput}
              />
            </div>
            <div>
              <label style={estiloLabel}>Salida oficial</label>
              <input
                type="time"
                value={inputHoraSalida}
                disabled={!desbloqueado}
                onChange={(e) => setInputHoraSalida(e.target.value)}
                style={estiloInput}
              />
            </div>
          </div>

          <div style={{ fontSize: '11.5px', fontWeight: '700', color: c?.textMuted || '#64748b' }}>
            Entrada límite (después es retardo): <span style={{ color: c?.text || '#111', fontFamily: 'ui-monospace, monospace' }}>{entradaCalculada}</span>
          </div>

          {toleranciaActual > 180 && (
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', background: 'rgba(245,158,11,0.12)', borderRadius: '8px', padding: '6px 8px' }}>
              ⚠️ La entrada límite guardada ({horaCorte}) está muy lejos del inicio de turno. Abre el candado y pulsa «Restaurar» o pon la tolerancia correcta.
            </div>
          )}

          {desbloqueado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                type="button"
                onClick={() => guardarReloj()}
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

              {(horaInicio !== '07:00' || horaCorte !== '07:15' || horaSalida !== '17:00') && (
                <button
                  type="button"
                  onClick={() => guardarReloj('07:00', 15, '17:00')}
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
                  <RotateCcw size={11} /> Restaurar (07:00 + 15 min / 17:00)
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
