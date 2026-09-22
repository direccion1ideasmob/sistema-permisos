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
      backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 6000, padding: '16px'
    }}>
      <div style={{
        backgroundColor: c.bg, border: `1px solid ${c.border}`,
        borderRadius: '16px', width: '100%', maxWidth: '360px',
        padding: '22px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '8px',
            backgroundColor: c.dangerSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <UserX size={20} color={c.danger} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: c.danger }}>
              TRÁMITE DE BAJA LABORAL
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted }}>
              {usuario.nombre_completo} (#{usuario.numero_empleado})
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
              Fecha Efectiva de Baja *
            </label>
            <input 
              type="date" required 
              value={fechaBaja} onChange={e => setFechaBaja(e.target.value)} 
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                border: `1px solid ${c.border}`, backgroundColor: c.inputBg,
                color: c.text, fontSize: '12px', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
              Motivo de Separación *
            </label>
            <select 
              value={motivoBaja} onChange={e => setMotivoBaja(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '6px',
                border: `1px solid ${c.border}`, backgroundColor: c.inputBg,
                color: c.text, fontSize: '12px', outline: 'none', boxSizing: 'border-box'
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
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
              {procesando ? 'Procesando...' : 'Confirmar Baja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}