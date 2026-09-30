import React, { useState, useEffect } from 'react';
import { X, Check, Banknote, Receipt, Clock, UserCog, MessageSquare, ShieldCheck } from 'lucide-react';

export default function ModalDictamenAprobar({ 
  solicitud, onClose, onConfirmarAprobacion, procesando, c 
}) {
  const [dictamenPago, setDictamenPago] = useState('Pendiente');
  const [comentarios, setComentarios] = useState('');

  useEffect(() => {
    if (solicitud?.pago && !solicitud.pago.toLowerCase().includes('pendiente')) {
      setDictamenPago(solicitud.pago);
    } else {
      setDictamenPago('Pendiente');
    }
  }, [solicitud]);

  if (!solicitud) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmarAprobacion(solicitud, dictamenPago, comentarios);
  };

  // Opciones con íconos para toma de decisión instantánea
  const opciones = [
    { key: 'Con goce', label: 'Con Goce', icon: Banknote },
    { key: 'Sin goce', label: 'Sin Goce', icon: Receipt },
    { key: 'Con tiempo', label: 'Repone Tiempo', icon: Clock },
    { key: 'Pendiente', label: 'Delegar a RH', icon: UserCog }
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '20px'
    }}>
      <div style={{
        backgroundColor: c.surfaceCard, border: `1px solid ${c.border}`,
        borderRadius: '24px', width: '100%', maxWidth: '380px',
        padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: '20px'
      }}>
        
        {/* CABECERA ELEGANTE */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: c.text, letterSpacing: '-0.01em' }}>
              Resolución de Nómina
            </div>
            <div style={{ fontSize: '12.5px', color: c.textMuted, marginTop: '4px', fontWeight: '500' }}>
              Autorizando a <strong style={{ color: c.text }}>{solicitud.usuarios?.nombre_completo?.split(' ')[0]}</strong> • <span style={{ color: c.accent, fontWeight: '800', fontFamily: 'monospace' }}>{solicitud.folio}</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.textMuted, cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* GRID DE OPCIONES (RADIO CARDS) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {opciones.map(op => {
              const seleccionada = dictamenPago === op.key;
              const Icono = op.icon;
              
              return (
                <div
                  key={op.key} 
                  onClick={() => setDictamenPago(op.key)}
                  style={{
                    padding: '14px 12px', borderRadius: '14px', textAlign: 'center',
                    border: seleccionada ? `2px solid ${c.accent}` : `1px solid ${c.border}`,
                    backgroundColor: seleccionada ? c.accentSoft : c.surface,
                    cursor: 'pointer', transition: 'all 0.15s ease', 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    position: 'relative', overflow: 'hidden'
                  }}
                >
                  <Icono size={22} color={seleccionada ? c.accent : c.textMuted} strokeWidth={seleccionada ? 2.5 : 1.5} />
                  <span style={{ fontSize: '12px', fontWeight: seleccionada ? '800' : '600', color: seleccionada ? c.accent : c.text, letterSpacing: '-0.01em' }}>
                    {op.label}
                  </span>
                  
                  {/* Pequeña palomita en la esquina si está seleccionado */}
                  {seleccionada && (
                    <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
                      <Check size={12} color={c.accent} strokeWidth={4} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* INPUT DE NOTAS ELEGANTE */}
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: c.textSubtle }}>
              <MessageSquare size={16} />
            </div>
            <input 
              type="text" placeholder="Agregar nota o instrucción (opcional)..."
              value={comentarios} onChange={e => setComentarios(e.target.value)}
              style={{
                width: '100%', height: '44px', padding: '0 12px 0 38px', borderRadius: '12px',
                border: `1px solid ${c.inputBorder}`, backgroundColor: c.inputBg,
                color: c.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s', fontWeight: '500'
              }}
              onFocus={(e) => e.target.style.borderColor = c.accent}
              onBlur={(e) => e.target.style.borderColor = c.inputBorder}
            />
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button 
              type="button" onClick={onClose} 
              style={{ flex: 1, padding: '12px', borderRadius: '12px', border: `1px solid ${c.border}`, background: 'transparent', color: c.textMuted, fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
            >
              Cancelar
            </button>
            <button 
              type="submit" disabled={procesando} 
              style={{ flex: 1.5, padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: c.accent, color: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: `0 4px 15px rgba(22, 163, 74, 0.3)` }}
            >
              <ShieldCheck size={18} /> {procesando ? 'Guardando...' : 'Firmar y Autorizar'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}