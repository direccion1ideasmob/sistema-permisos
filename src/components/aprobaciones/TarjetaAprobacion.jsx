import React, { useState, useEffect } from 'react';
import { Check, X, ShieldAlert, AlertTriangle, Calendar, Clock, MessageSquare, Info } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

export default function TarjetaAprobacion({ 
  solicitud, esPendiente, onAprobar, onRechazar, c, modoOscuro 
}) {
  const u = solicitud.usuarios || {};
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo || 'U')}&background=16a34a&color=fff&bold=true`;

  const esRetardo = (solicitud.tipo_permiso || '').toLowerCase() === 'retardo';
  const [reincidencias, setReincidencias] = useState(0);

  const fechaCreacion = new Date(solicitud.created_at);
  const esUrgente = esRetardo && solicitud.fecha_permiso === solicitud.fecha_elaboracion && fechaCreacion.getHours() >= 6;

  useEffect(() => {
    const checarReincidencia = async () => {
      if (esRetardo && solicitud.usuario_id) {
        const fechaLimite = new Date(fechaCreacion);
        fechaLimite.setDate(fechaLimite.getDate() - 15);
        const { count } = await supabase
          .from('permisos')
          .select('id', { count: 'exact', head: true })
          .eq('usuario_id', solicitud.usuario_id)
          .eq('tipo_permiso', 'retardo')
          .neq('estado_general', 'rechazado')
          .neq('id', solicitud.id)
          .gte('fecha_permiso', fechaLimite.toISOString().split('T')[0]);
        setReincidencias(count || 0);
      }
    };
    checarReincidencia();
  }, [esRetardo, solicitud, fechaCreacion]);

  // FUNCIÓN BLINDADA PARA LIMPIAR CORCHETES (Soporta saltos de línea [\s\S])
  const procesarMotivo = (textoCrudo = '') => {
    if (!textoCrudo) return { etiqueta: 'SIN CATEGORÍA', redaccion: 'No se ingresaron detalles.' };
    
    const txt = String(textoCrudo).trim();
    // Extrae lo que esté entre [] o {} y deja el resto en otro grupo
    const match = txt.match(/^([\[\{])(.*?)([\]\}])\s*([\s\S]*)$/);
    
    if (match) {
      return { 
        etiqueta: match[2].trim(), 
        redaccion: match[4].trim() || 'Sin comentarios adicionales.' 
      };
    }
    return { etiqueta: 'MOTIVO DE LA SOLICITUD', redaccion: txt };
  };

  const { etiqueta, redaccion } = procesarMotivo(solicitud.asunto_motivo);

  const getEstiloTipo = (tipo) => {
    const t = (tipo || '').toLowerCase();
    if (t === 'retardo') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: 'Retardo' };
    if (t === 'falta') return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.2)', text: 'Falta Programada' };
    if (t === 'vacaciones') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)', text: 'Vacaciones' };
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.2)', text: 'Salida Anticipada' };
    return { color: c.accent, bg: c.accentSoft, border: c.border, text: t.toUpperCase() };
  };
  const estilo = getEstiloTipo(solicitud.tipo_permiso);

  // Limpiar la palabra "Nota:" si viene en las observaciones
  const observacionesLimpias = solicitud.observaciones ? solicitud.observaciones.replace(/Nota:\s*/i, '').trim() : '';

  return (
    <div style={{
      background: c.surfaceCard, border: `1px solid ${c.border}`,
      borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px',
      boxShadow: modoOscuro ? '0 8px 30px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.04)'
    }}>
      
      {/* 1. CABECERA: PERFIL Y ETIQUETA TIPO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <img src={urlFoto} alt="" style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover', border: `1px solid ${c.border}` }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: c.text, letterSpacing: '-0.01em' }}>
              {u.nombre_completo || 'Colaborador'}
            </div>
            <div style={{ fontSize: '12px', color: c.textMuted, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '800', color: c.accent, background: c.accentSoft, padding: '2px 6px', borderRadius: '4px' }}>
                {solicitud.folio}
              </span>
              <span>•</span>
              <span style={{ fontWeight: '600' }}>#{u.numero_empleado}</span>
              <span>•</span>
              <span>{u.departamentos?.nombre || 'Área general'}</span>
            </div>
          </div>
        </div>
        
        {/* Píldora del Tipo de Permiso */}
        <span style={{ 
          fontSize: '11.5px', fontWeight: '800', color: estilo.color, backgroundColor: estilo.bg, 
          border: `1px solid ${estilo.border}`, padding: '6px 12px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.02em'
        }}>
          {estilo.text}
        </span>
      </div>

      {/* 2. ALERTAS (Solo si hay urgencia o reincidencia) */}
      {(esUrgente || reincidencias > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {esUrgente && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: c.dangerSoft, color: c.danger, border: `1px solid rgba(239, 68, 68, 0.3)`, padding: '12px 14px', borderRadius: '12px', fontSize: '12px' }}>
              <ShieldAlert size={18} /> 
              <span><strong style={{ fontWeight: '800' }}>Urgente:</strong> Solicitado el mismo día después de las 6:00 AM.</span>
            </div>
          )}
          {reincidencias > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: c.warningSoft, color: c.warning, border: `1px solid rgba(245, 158, 11, 0.3)`, padding: '12px 14px', borderRadius: '12px', fontSize: '12px' }}>
              <AlertTriangle size={18} /> 
              <span><strong style={{ fontWeight: '800' }}>Reincidencia:</strong> {reincidencias} retardo(s) en los últimos 15 días.</span>
            </div>
          )}
        </div>
      )}

      {/* 3. BLOQUE CENTRAL DE INFORMACIÓN (Grid Elegante) */}
      <div style={{ background: c.surface, border: `1px solid ${c.borderDivider}`, borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Fila 1: Fechas y Horas */}
        <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', paddingBottom: '16px', borderBottom: `1px solid ${c.borderDivider}` }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: c.bg, border: `1px solid ${c.border}` }}><Calendar size={18} color={c.textMuted} /></div>
            <div>
              <div style={{ fontSize: '10.5px', color: c.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha Programada</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: c.text, marginTop: '2px' }}>{solicitud.fecha_permiso} {solicitud.fecha_fin && `al ${solicitud.fecha_fin}`}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: c.bg, border: `1px solid ${c.border}` }}><Clock size={18} color={c.textMuted} /></div>
            <div>
              <div style={{ fontSize: '10.5px', color: c.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tiempo Solicitado</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: c.text, marginTop: '2px' }}>{solicitud.total_horas ? `${solicitud.total_horas} hr(s)` : 'Jornada Completa'}</div>
            </div>
          </div>
        </div>

        {/* Fila 2: El Motivo Limpio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageSquare size={14} color={c.accent} />
            <span style={{ fontSize: '11px', fontWeight: '800', color: c.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {etiqueta}
            </span>
          </div>
          <div style={{ fontSize: '14.5px', color: c.text, lineHeight: '1.5', fontWeight: '500', paddingLeft: '20px' }}>
            {redaccion}
          </div>
        </div>

        {/* Fila 3: Observaciones Extra (Si aplica) */}
        {observacionesLimpias && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: c.bg, padding: '12px 14px', borderRadius: '10px', border: `1px solid ${c.border}`, marginTop: '4px' }}>
            <Info size={16} color={c.textSubtle} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12.5px', color: c.textSubtle, lineHeight: '1.4', fontWeight: '500' }}>
              {observacionesLimpias}
            </div>
          </div>
        )}
      </div>

      {/* 4. PIE DE TARJETA: ESTADO Y BOTONES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '10.5px', color: c.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dictamen de Nómina</span>
          <span style={{ fontSize: '14px', fontWeight: '900', color: solicitud.pago === 'Pendiente' ? '#f59e0b' : c.text, marginTop: '2px' }}>
            {solicitud.pago || 'Pendiente de resolución'}
          </span>
        </div>

        {esPendiente ? (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => onRechazar(solicitud)} 
              style={{ padding: '10px 16px', borderRadius: '10px', border: `1px solid ${c.border}`, background: 'transparent', color: c.danger, fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s' }}
            >
              <X size={16} /> Rechazar
            </button>
            <button 
              onClick={() => onAprobar(solicitud)} 
              style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', backgroundColor: c.accent, color: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: `0 4px 12px rgba(22, 163, 74, 0.3)` }}
            >
              <Check size={16} /> Evaluar
            </button>
          </div>
        ) : (
          <span style={{ fontSize: '13px', fontWeight: '800', color: c.accent, display: 'flex', alignItems: 'center', gap: '6px', background: c.accentSoft, padding: '8px 14px', borderRadius: '10px' }}>
            <Check size={16} /> Firma registrada
          </span>
        )}
      </div>

    </div>
  );
}