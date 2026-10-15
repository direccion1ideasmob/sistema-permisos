import React, { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';

export default function ModalSeguridadPin({ abierto, onClose, onAutorizado, c, modoOscuro }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!abierto) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === '123456' || pin.toLowerCase() === 'admin' || pin.length >= 6) {
      onAutorizado();
      setPin('');
      setError(false);
      onClose();
    } else {
      setError(true);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '16px'
    }}>
      <div style={{
        backgroundColor: c.bg, border: `1px solid ${c.border}`,
        borderRadius: '16px', width: '100%', maxWidth: '320px',
        padding: '24px', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          width: '46px', height: '46px', borderRadius: '50%',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px auto'
        }}>
          <Lock size={22} color="#f59e0b" />
        </div>

        <div style={{ fontSize: '15px', fontWeight: '800', color: c.text }}>BÓVEDA DE SEGURIDAD</div>
        <p style={{ fontSize: '11.5px', color: c.textMuted, margin: '4px 0 16px 0', lineHeight: 1.4 }}>
          Ingresa el PIN de seguridad o clave de administración para habilitar la edición en vivo.
        </p>

        <form onSubmit={handleSubmit}>
          <input 
            type="password"
            maxLength={10}
            placeholder="• • • • • •"
            value={pin}
            onChange={e => { setPin(e.target.value); setError(false); }}
            autoFocus
            style={{
              width: '100%', height: '42px', textAlign: 'center',
              fontSize: '20px', letterSpacing: '6px', borderRadius: '8px',
              backgroundColor: modoOscuro ? '#18181b' : '#f8fafc',
              color: c.text, border: `1.5px solid ${error ? '#ef4444' : c.border}`,
              outline: 'none', marginBottom: '10px', boxSizing: 'border-box'
            }}
          />

          {error && (
            <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: '700', marginBottom: '10px' }}>
              PIN no autorizado
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button" onClick={onClose}
              style={{
                flex: 1, padding: '9px', borderRadius: '7px',
                border: `1px solid ${c.border}`, background: 'transparent',
                color: c.textMuted, fontSize: '12px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                flex: 1, padding: '9px', borderRadius: '7px',
                border: 'none', backgroundColor: c.accent,
                color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
              }}
            >
              Autorizar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}