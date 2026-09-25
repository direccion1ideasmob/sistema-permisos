import React from 'react';
import { Check, X, Clock, Calendar, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';

export default function TarjetaAprobacion({ 
  solicitud, esPendiente, onAprobar, onRechazar, c, modoOscuro 
}) {
  const u = solicitud.usuarios || {};
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo || 'U')}&background=16a34a&color=fff&bold=true`;

  const esRetardo = (solicitud.tipo_permiso || '').toLowerCase() === 'retardo';

  return (
    <div className="tarjeta-solicitud">
      {/* CABECERA: FOLIO + COLABORADOR + TIPO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src={urlFoto} alt="" 
            style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', border: `1px solid ${c.border}` }} 
          />
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>
              {u.nombre_completo || 'Colaborador'}
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="mono-folio">{solicitud.folio}</span>
              <span>•</span>
              <span>#{u.numero_empleado}</span>
              <span>•</span>
              <span>{u.departamentos?.nombre || 'General'}</span>
            </div>
          </div>
        </div>

        {/* BADGE DEL TIPO DE PERMISO */}
        <span style={{
          fontSize: '10px', fontWeight: '800', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: '6px',
          background: esRetardo ? c.warningSoft : c.surface,
          color: esRetardo ? c.warning : c.text,
          border: `1px solid ${c.border}`
        }}>
          {solicitud.tipo_permiso || 'Pase'}
        </span>
      </div>

      {/* DETALLES DE HORARIOS Y MOTIVO */}
      <div style={{
        padding: '10px 12px', borderRadius: '8px',
        backgroundColor: c.surface, border: `1px solid ${c.borderDivider}`,
        display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
          <span><strong style={{ color: c.textMuted }}>Fecha:</strong> {solicitud.fecha_permiso} {solicitud.fecha_fin && `al ${solicitud.fecha_fin}`}</span>
          <span><strong style={{ color: c.textMuted }}>Duración:</strong> {solicitud.total_horas ? `${solicitud.total_horas} hr(s)` : 'Jornada Completa'}</span>
        </div>

        {solicitud.observaciones && (
          <div style={{ fontSize: '11.5px', color: c.textMuted }}>
            {solicitud.observaciones}
          </div>
        )}

        <div style={{ fontSize: '12px', color: c.text, marginTop: '2px' }}>
          <strong style={{ color: c.textMuted }}>Motivo:</strong> "{solicitud.asunto_motivo}"
        </div>
      </div>

      {/* PIE: ACCIONES RÁPIDAS O ESTATUS YA FIRMADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${c.borderDivider}`, paddingTop: '10px' }}>
        <div style={{ fontSize: '11px', color: c.textMuted }}>
          Dictamen actual: <strong style={{ color: c.text }}>{solicitud.pago || 'Pendiente'}</strong>
        </div>

        {esPendiente ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onRechazar(solicitud)}
              style={{
                padding: '6px 14px', borderRadius: '6px',
                border: `1px solid ${c.danger}`, background: 'transparent',
                color: c.danger, fontSize: '11.5px', fontWeight: '700',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <X size={13} /> Rechazar
            </button>
            <button
              onClick={() => onAprobar(solicitud)}
              style={{
                padding: '6px 16px', borderRadius: '6px', border: 'none',
                backgroundColor: c.accent, color: '#fff', fontSize: '11.5px', fontWeight: '800',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                boxShadow: `0 2px 8px rgba(22, 163, 74, 0.25)`
              }}
            >
              <Check size={13} /> Autorizar
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: '700', color: c.accent }}>
            ✓ Firma Registrada
          </span>
        )}
      </div>
    </div>
  );
}