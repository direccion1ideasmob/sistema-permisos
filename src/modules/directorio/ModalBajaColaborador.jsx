import React, { useState } from 'react';
import { UserX } from 'lucide-react';

export default function ModalBajaColaborador({ usuario, onClose, onConfirmarBaja, procesando, c }) {
  const [fechaBaja, setFechaBaja] = useState(new Date().toISOString().split('T')[0]);
  const [motivoBaja, setMotivoBaja] = useState('Renuncia voluntaria');

  if (!usuario) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmarBaja(usuario.id, fechaBaja, motivoBaja);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '16px'
    }}>
      <div style={{
        backgroundColor: c.surface, border: `1px solid ${c.border}`,
        borderRadius: '24px', width: '100%', maxWidth: '380px',
        padding: '28px', boxShadow: '0 20px 40px -8px rgba(0,0,0,0.2)'
      }}>
        
        {/* ENCABEZADO PREMIUM */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            backgroundColor: c.dangerSoft || '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.15)'
          }}>
            <UserX size={22} color={c.danger || '#ef4444'} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '900', color: c.danger || '#ef4444', letterSpacing: '-0.01em' }}>
              TRÁMITE DE BAJA LABORAL
            </div>
            <div style={{ fontSize: '12.5px', color: c.textMuted, fontWeight: '500', marginTop: '2px' }}>
              {usuario.nombre_completo} <strong style={{ color: c.text }}>(#{usuario.numero_empleado})</strong>
            </div>
          </div>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Fecha Efectiva de Baja *
            </label>
            <input 
              type="date" required 
              value={fechaBaja} onChange={e => setFechaBaja(e.target.value)} 
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                border: `1px solid ${c.border}`, backgroundColor: c.inputBg || c.surfaceCard,
                color: c.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Motivo de Separación *
            </label>
            <select 
              value={motivoBaja} onChange={e => setMotivoBaja(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: '10px',
                border: `1px solid ${c.border}`, backgroundColor: c.inputBg || c.surfaceCard,
                color: c.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
            >
              <option value="Renuncia voluntaria">Renuncia voluntaria</option>
              <option value="Rescisión / Despido">Rescisión / Despido</option>
              <option value="Fin de contrato / obra">Fin de contrato / obra</option>
              <option value="Abandono de trabajo">Abandono de trabajo</option>
              <option value="Jubilación / Retiro">Jubilación / Retiro</option>
              <option value="Otro motivo">Otro motivo</option>
            </select>
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button" onClick={onClose}
              style={{
                padding: '10px 16px', borderRadius: '10px', border: `1px solid ${c.border}`,
                background: 'transparent', color: c.textMuted, fontSize: '12.5px', fontWeight: '700', cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={procesando}
              style={{
                padding: '10px 20px', borderRadius: '10px', border: 'none',
                backgroundColor: c.danger || '#ef4444', color: '#fff', fontSize: '12.5px', fontWeight: '800',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)', transition: 'transform 0.1s, opacity 0.2s',
                opacity: procesando ? 0.7 : 1
              }}
            >
              {procesando ? 'Procesando...' : 'Confirmar Baja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}