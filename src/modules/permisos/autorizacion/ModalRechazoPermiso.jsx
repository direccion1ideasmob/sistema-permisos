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
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '16px'
    }}>
      <div style={{
        backgroundColor: c.bg, border: `1px solid ${c.border}`,
        borderRadius: '16px', width: '100%', maxWidth: '380px',
        padding: '22px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            backgroundColor: c.dangerSoft, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <XCircle size={20} color={c.danger} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: c.danger }}>
              RECHAZAR SOLICITUD
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted }}>
              Folio: {solicitud.folio} • {solicitud.usuarios?.nombre_completo}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '5px' }}>
              Motivo o Razón del Rechazo *
            </label>
            <textarea 
              required rows={3} autoFocus
              placeholder="Explica por qué no es posible autorizar este pase..."
              value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                border: `1px solid ${c.inputBorder}`, backgroundColor: c.inputBg,
                color: c.text, fontSize: '12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ fontSize: '10.5px', color: c.textMuted, fontStyle: 'italic' }}>
            * Esta explicación se le enviará directamente al colaborador en su notificación.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button" onClick={onClose}
              style={{
                padding: '7px 12px', borderRadius: '6px', border: `1px solid ${c.border}`,
                background: 'transparent', color: c.textMuted, fontSize: '11.5px', cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={procesando}
              style={{
                padding: '7px 16px', borderRadius: '6px', border: 'none',
                backgroundColor: c.danger, color: '#fff', fontSize: '11.5px', fontWeight: '800',
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