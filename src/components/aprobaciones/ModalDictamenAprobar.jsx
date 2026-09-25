import React, { useState } from 'react';
import { CheckCircle2, X, Save, AlertCircle } from 'lucide-react';

export default function ModalDictamenAprobar({ 
  solicitud, usuarioFirmante, onClose, onConfirmarAprobacion, procesando, c, modoOscuro 
}) {
  const [dictamenPago, setDictamenPago] = useState('Con goce');
  const [comentarios, setComentarios] = useState('');

  if (!solicitud) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmarAprobacion(solicitud, dictamenPago, comentarios);
  };

  const opciones = [
    { key: 'Con goce', label: 'Con goce de sueldo (Autorizado normal)', desc: 'No se aplica deducción en nómina' },
    { key: 'Sin goce', label: 'Sin goce de sueldo (Deducción)', desc: 'Se descuenta el tiempo solicitado' },
    { key: 'Con tiempo', label: 'Reposición de tiempo', desc: 'El trabajador repondrá las horas con tiempo extra' }
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '16px'
    }}>
      <div style={{
        backgroundColor: c.bg, border: `1px solid ${c.border}`,
        borderRadius: '16px', width: '100%', maxWidth: '440px',
        padding: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', boxSizing: 'border-box'
      }}>
        {/* CABECERA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: `1px solid ${c.border}`, paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: c.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle2 size={18} color={c.accent} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>DICTAMEN DE AUTORIZACIÓN</div>
              <div style={{ fontSize: '11px', color: c.textMuted }}>Folio: {solicitud.folio}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <div style={{ fontSize: '12px', color: c.text }}>
            Autorizando solicitud de: <strong>{solicitud.usuarios?.nombre_completo}</strong>
            <div style={{ fontSize: '11px', color: c.textMuted, marginTop: '2px' }}>
              Motivo: "{solicitud.asunto_motivo}"
            </div>
          </div>

          {/* SELECTOR DE DICTAMEN DE PAGO */}
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>
              Resolución de Pago / Nómina *
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {opciones.map(op => {
                const seleccionada = dictamenPago === op.key;
                return (
                  <div
                    key={op.key}
                    onClick={() => setDictamenPago(op.key)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px',
                      border: seleccionada ? `1.5px solid ${c.accent}` : `1px solid ${c.border}`,
                      backgroundColor: seleccionada ? c.accentSoft : c.surface,
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: seleccionada ? '800' : '600', color: seleccionada ? c.accent : c.text }}>
                      {op.label}
                    </div>
                    <div style={{ fontSize: '10px', color: c.textMuted, marginTop: '1px' }}>
                      {op.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OBSERVACIONES OPCIONALES */}
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
              Observaciones o Instrucciones (Opcional)
            </label>
            <input 
              type="text"
              placeholder="Ej. Cumplir entrega antes de salir..."
              value={comentarios} onChange={e => setComentarios(e.target.value)}
              style={{
                width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px',
                border: `1px solid ${c.inputBorder}`, backgroundColor: c.inputBg,
                color: c.text, fontSize: '12px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* PREVIA DE LA FIRMA DIGITAL */}
          <div style={{
            padding: '8px 12px', borderRadius: '8px', background: c.surface,
            border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: '11px', color: c.textMuted }}>
              Sello Digital: <strong style={{ color: c.text }}>{usuarioFirmante?.nombre_completo || 'Tú'}</strong>
            </div>
            {usuarioFirmante?.firma_url ? (
              <span style={{ fontSize: '10px', color: c.accent, fontWeight: '700' }}>✓ Firma lista</span>
            ) : (
              <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>⚠ Firma en texto</span>
            )}
          </div>

          {/* BOTONES */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button" onClick={onClose}
              style={{
                padding: '8px 14px', borderRadius: '6px', border: `1px solid ${c.border}`,
                background: 'transparent', color: c.textMuted, fontSize: '12px', cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={procesando}
              style={{
                padding: '8px 18px', borderRadius: '6px', border: 'none',
                backgroundColor: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Save size={13} /> {procesando ? 'Sellando...' : 'Confirmar y Autorizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}