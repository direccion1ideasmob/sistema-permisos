import React, { useState } from 'react';
import { XCircle, X } from 'lucide-react';

export default function ModalRechazoPermiso({ 
  solicitud, onClose, onConfirmarRechazo, procesando, c 
}) {
  const [motivoRechazo, setMotivoRechazo] = useState('');

  if (!solicitud) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!motivoRechazo.trim()) {
      return alert("Es obligatorio indicar el motivo por el cual se rechaza la solicitud.");
    }
    onConfirmarRechazo(solicitud, motivoRechazo.trim());
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '20px',
      fontFamily: '"Inter", system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: c.surfaceCard || c.bg,
        border: `1.5px solid ${c.border}`,
        borderRadius: '20px',
        width: '100%',
        maxWidth: '500px',
        padding: '28px 30px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        {/* CABECERA */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              backgroundColor: c.dangerSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <XCircle size={24} color={c.danger} />
            </div>
            <div>
              <div style={{ fontSize: '19px', fontWeight: '900', color: c.danger, letterSpacing: '-0.01em' }}>
                RECHAZAR SOLICITUD
              </div>
              <div style={{ fontSize: '14.5px', color: c.textMuted, fontWeight: '600', marginTop: '3px' }}>
                {solicitud.tipo_permiso?.toUpperCase()} • <strong style={{ color: c.text }}>{solicitud.usuarios?.nombre_completo}</strong>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: c.surface, border: `1.5px solid ${c.border}`, color: c.textMuted,
              cursor: 'pointer', width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Motivo o Razón del Rechazo *
            </label>
            <textarea 
              required rows={4} autoFocus
              placeholder="Explica por qué no es posible autorizar este pase..."
              value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
              style={{
                width: '100%', padding: '13px 15px', borderRadius: '12px',
                border: `1.5px solid ${c.inputBorder}`, backgroundColor: c.inputBg,
                color: c.text, fontSize: '15px', fontWeight: '500', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.45
              }}
            />
          </div>

          <div style={{ fontSize: '13.5px', color: c.textMuted, fontStyle: 'italic' }}>
            * Esta explicación se le enviará directamente al colaborador en su notificación.
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            <button
              type="button" onClick={onClose}
              style={{
                flex: 1, padding: '13px 16px', borderRadius: '11px', border: `1.5px solid ${c.border}`,
                background: 'transparent', color: c.textMuted, fontSize: '15px', fontWeight: '700', cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={procesando}
              style={{
                flex: 1.4, padding: '13px 18px', borderRadius: '11px', border: 'none',
                backgroundColor: c.danger, color: '#fff', fontSize: '15px', fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              {procesando ? 'Rechazando...' : 'Confirmar Rechazo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
