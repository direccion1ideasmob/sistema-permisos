import React from 'react';
import { FileText, Clock, Calendar } from 'lucide-react';

export default function HistorialPermisos({ permisos = [], onVerPapeleta, cargando, c }) {
  
  const badgeEstado = (estado) => {
    switch (estado) {
      case 'autorizado':
      case 'autorizado_nominas':
        return { label: 'AUTORIZADO', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.12)' };
      case 'rechazado':
        return { label: 'RECHAZADO', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' };
      case 'en_firmas':
        return { label: 'EN FIRMAS', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
      default:
        return { label: (estado || 'PENDIENTE').toUpperCase(), color: c.textMuted, bg: 'rgba(255, 255, 255, 0.05)' };
    }
  };

  return (
    <div className="permiso-card-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: '800', color: c.text }}>HISTORIAL DE MIS PASES</div>
        <span style={{ fontSize: '11px', color: c.textMuted }}>Total: {permisos.length}</span>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '30px', color: c.textMuted, fontSize: '12px' }}>
          Consultando registros...
        </div>
      ) : permisos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: c.textMuted, fontSize: '12px' }}>
          No tienes solicitudes registradas en el sistema.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {permisos.map((p) => {
            const badge = badgeEstado(p.estado_general);

            return (
              <div 
                key={p.id}
                style={{
                  padding: '12px 14px', borderRadius: '8px',
                  background: c.surface, border: `1px solid ${c.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexWrap: 'wrap', gap: '10px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '800', fontSize: '13px', color: c.accent }}>
                      {p.folio}
                    </span>
                    <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: '10.5px', color: c.textMuted, textTransform: 'capitalize' }}>
                      • {p.tipo_permiso || 'Pase'}
                    </span>
                  </div>

                  <div style={{ fontSize: '11.5px', color: c.textMuted }}>
                    Fecha: <strong style={{ color: c.text }}>{p.fecha_permiso}</strong>
                    {p.hora_inicio && <span> ({p.hora_inicio} a {p.hora_fin} hrs)</span>}
                    <span> • {p.total_horas || 0} hr(s)</span>
                  </div>

                  <div style={{ fontSize: '11.5px', color: c.text, marginTop: '2px' }}>
                    {p.asunto_motivo}
                  </div>
                </div>

                <button
                  onClick={() => onVerPapeleta(p)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', border: `1px solid ${c.border}`,
                    background: 'transparent', color: c.text, fontSize: '11px', fontWeight: '700',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
                  }}
                  title="Ver papeleta digital para imprimir"
                >
                  <FileText size={12} color={c.accent} />
                  <span>Papeleta PDF</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}