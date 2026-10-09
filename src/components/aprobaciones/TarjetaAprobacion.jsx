import React, { useState, useEffect } from 'react';
import { 
  Check, X, ShieldAlert, AlertTriangle, Calendar, Clock, 
  MessageSquare, Info, LockOpen, CheckCircle2, XCircle, FastForward 
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

export default function TarjetaAprobacion({ 
  solicitud, esPendiente, onAprobar, onRechazar, onForzarFirma, usuarioActual, c, modoOscuro 
}) {
  const u = solicitud.usuarios || {};
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo || 'U')}&background=16a34a&color=fff&bold=true`;

  const esRetardo = (solicitud.tipo_permiso || '').toLowerCase() === 'retardo';
  const [reincidencias, setReincidencias] = useState(0);

  const fechaCreacion = new Date(solicitud.created_at);
  const esUrgente = esRetardo && solicitud.fecha_permiso === solicitud.fecha_elaboracion && fechaCreacion.getHours() >= 6;

  // Lógica de Override para RH
  const esRH = usuarioActual?.rol === 'rh_nominas' || usuarioActual?.rol === 'gerente_rh';
  const estaAtoradoConJefe = solicitud.firma_1_estado === 'pendiente';
  const estaAtoradoConGerente = solicitud.firma_1_estado !== 'pendiente' && solicitud.firma_2_estado === 'pendiente';
  const mostrarOverride = esRH && esPendiente && (estaAtoradoConJefe || estaAtoradoConGerente);

  // Saber a quién le toca realmente
  const esMiTurno = () => {
    if (usuarioActual?.rol === 'jefe_area' && solicitud.firma_1_estado === 'pendiente') return true;
    if (solicitud.firma_2_id === usuarioActual?.id && solicitud.firma_2_estado === 'pendiente' && solicitud.firma_1_estado !== 'pendiente') return true;
    if (esRH && solicitud.firma_3_estado === 'pendiente' && solicitud.firma_2_estado !== 'pendiente' && solicitud.firma_1_estado !== 'pendiente') return true;
    return false;
  };

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

  const procesarMotivo = (textoCrudo = '') => {
    if (!textoCrudo) return { etiqueta: 'SIN CATEGORÍA', redaccion: 'No se ingresaron detalles.' };
    const txt = String(textoCrudo).trim();
    const match = txt.match(/^([\[\{])(.*?)([\]\}])\s*([\s\S]*)\$/);
    if (match) {
      return { etiqueta: match[2].trim(), redaccion: match[4].trim() || 'Sin comentarios adicionales.' };
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
  const observacionesLimpias = solicitud.observaciones ? solicitud.observaciones.replace(/Nota:\s*/i, '').trim() : '';

  // -------------------------------------------------------------
  // HELPER VISUAL DE ESTADOS PARA LA CADENA DE FIRMAS (STEPPER)
  // -------------------------------------------------------------
  const renderPasoFirma = (titulo, estado, esSiguienteTurno) => {
    const est = (estado || 'pendiente').toLowerCase();

    if (['autorizado', 'auto_aprobado'].includes(est)) {
      return {
        badgeBg: 'rgba(34, 197, 94, 0.12)',
        borderColor: '#22c55e',
        textColor: '#22c55e',
        icon: <CheckCircle2 size={13} />,
        label: est === 'auto_aprobado' ? 'Auto-aprobado' : 'Aprobado'
      };
    }
    if (['escalado', 'omitido'].includes(est)) {
      return {
        badgeBg: 'rgba(59, 130, 246, 0.12)',
        borderColor: '#3b82f6',
        textColor: '#3b82f6',
        icon: <FastForward size={13} />,
        label: est === 'escalado' ? 'Escalado por RH' : 'Omitido'
      };
    }
    if (est === 'rechazado') {
      return {
        badgeBg: 'rgba(239, 68, 68, 0.12)',
        borderColor: '#ef4444',
        textColor: '#ef4444',
        icon: <XCircle size={13} />,
        label: 'Rechazado'
      };
    }
    // Pendiente
    if (esSiguienteTurno) {
      return {
        badgeBg: 'rgba(245, 158, 11, 0.12)',
        borderColor: '#f59e0b',
        textColor: '#f59e0b',
        icon: <Clock size={13} />,
        label: 'En espera'
      };
    }
    return {
      badgeBg: modoOscuro ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
      borderColor: c.border,
      textColor: c.textMuted,
      icon: <Clock size={13} />,
      label: 'Pendiente'
    };
  };

  const firma1Listo = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(solicitud.firma_1_estado);
  const firma2Listo = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(solicitud.firma_2_estado);

  const pasoJefe = renderPasoFirma('Jefe', solicitud.firma_1_estado, true);
  const pasoGerente = renderPasoFirma('Gerente', solicitud.firma_2_estado, firma1Listo);
  const pasoRH = renderPasoFirma('RH', solicitud.firma_3_estado, firma1Listo && firma2Listo);

  return (
    <>
      <style>{`
        .tarjeta-wrapper { padding: 20px; border-radius: 20px; display: flex; flex-direction: column; gap: 20px; }
        .tarjeta-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .fechas-container { display: flex; gap: 30px; flex-wrap: wrap; padding-bottom: 16px; border-bottom: 1px solid ${c.borderDivider}; }
        .footer-container { display: flex; justify-content: space-between; align-items: center; padding-top: 4px; }
        .footer-buttons { display: flex; gap: 10px; }
        
        .stepper-container { 
          display: flex; gap: 8px; align-items: center; justify-content: space-between;
          padding: 10px 14px; border-radius: 12px; background: ${modoOscuro ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)'};
          border: 1px solid ${c.borderDivider}; margin-top: 2px;
        }
        .stepper-item { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
        .stepper-pill {
          display: inline-flex; alignItems: center; gap: 5px; padding: 4px 8px; borderRadius: 8px;
          font-size: 11px; font-weight: 700; border: 1px solid; white-space: nowrap;
        }

        @media (max-width: 580px) {
          .stepper-container { flex-direction: column; align-items: stretch; gap: 8px; }
          .stepper-item { justify-content: space-between; }
        }

        @media (max-width: 480px) {
          .tarjeta-wrapper { padding: 16px !important; border-radius: 16px !important; gap: 16px !important; }
          .tarjeta-header { flex-direction: column !important; gap: 12px !important; }
          .header-pill { align-self: flex-start !important; }
          .fechas-container { flex-direction: column !important; gap: 14px !important; }
          .footer-container { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
          .footer-buttons { width: 100% !important; justify-content: space-between !important; flex-wrap: wrap; }
          .footer-buttons button { flex: 1 !important; justify-content: center !important; padding: 12px 10px !important; min-width: 45%; }
          .estado-firma { width: 100% !important; justify-content: center !important; }
        }
      `}</style>

      <div className="tarjeta-wrapper" style={{
        background: c.surfaceCard, border: `1px solid ${c.border}`,
        boxShadow: modoOscuro ? '0 8px 30px rgba(0,0,0,0.4)' : '0 4px 15px rgba(0,0,0,0.04)'
      }}>
        
        <div className="tarjeta-header">
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <img src={urlFoto} alt="" style={{ width: '48px', height: '48px', borderRadius: '14px', objectFit: 'cover', border: `1px solid ${c.border}`, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: c.text, letterSpacing: '-0.01em', lineHeight: '1.2' }}>
                {u.nombre_completo || 'Colaborador'}
              </div>
              <div style={{ fontSize: '12px', color: c.textMuted, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
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
          <span className="header-pill" style={{ 
            fontSize: '11.5px', fontWeight: '800', color: estilo.color, backgroundColor: estilo.bg, 
            border: `1px solid ${estilo.border}`, padding: '6px 12px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.02em'
          }}>
            {estilo.text}
          </span>
        </div>

        {(esUrgente || reincidencias > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {esUrgente && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: c.dangerSoft, color: c.danger, border: `1px solid rgba(239, 68, 68, 0.3)`, padding: '12px 14px', borderRadius: '12px', fontSize: '12px' }}>
                <ShieldAlert size={18} style={{ flexShrink: 0 }} /> 
                <span><strong style={{ fontWeight: '800' }}>Urgente:</strong> Solicitado el mismo día después de las 6:00 AM.</span>
              </div>
            )}
            {reincidencias > 0 && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: c.warningSoft, color: c.warning, border: `1px solid rgba(245, 158, 11, 0.3)`, padding: '12px 14px', borderRadius: '12px', fontSize: '12px' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} /> 
                <span><strong style={{ fontWeight: '800' }}>Reincidencia:</strong> {reincidencias} retardo(s) en los últimos 15 días.</span>
              </div>
            )}
          </div>
        )}

        <div style={{ background: c.surface, border: `1px solid ${c.borderDivider}`, borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* STEPPER: CADENA VISUAL DE FIRMAS */}
          <div className="stepper-container">
            <div className="stepper-item">
              <span style={{ fontSize: '11px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase' }}>1. Jefe:</span>
              <span className="stepper-pill" style={{ backgroundColor: pasoJefe.badgeBg, borderColor: pasoJefe.borderColor, color: pasoJasoColor(pasoJefe) }}>
                {pasoJefe.icon} {pasoJefe.label}
              </span>
            </div>

            <div className="stepper-item">
              <span style={{ fontSize: '11px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase' }}>2. Gerente:</span>
              <span className="stepper-pill" style={{ backgroundColor: pasoGerente.badgeBg, borderColor: pasoGerente.borderColor, color: pasoJasoColor(pasoGerente) }}>
                {pasoGerente.icon} {pasoGerente.label}
              </span>
            </div>

            <div className="stepper-item">
              <span style={{ fontSize: '11px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase' }}>3. RH:</span>
              <span className="stepper-pill" style={{ backgroundColor: pasoRH.badgeBg, borderColor: pasoRH.borderColor, color: pasoJasoColor(pasoRH) }}>
                {pasoRH.icon} {pasoRH.label}
              </span>
            </div>
          </div>

          <div className="fechas-container">
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

          {observacionesLimpias && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', background: c.bg, padding: '12px 14px', borderRadius: '10px', border: `1px solid ${c.border}`, marginTop: '4px' }}>
              <Info size={16} color={c.textSubtle} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12.5px', color: c.textSubtle, lineHeight: '1.4', fontWeight: '500' }}>
                {observacionesLimpias}
              </div>
            </div>
          )}
        </div>

        <div className="footer-container">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10.5px', color: c.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dictamen de Nómina</span>
            <span style={{ fontSize: '14px', fontWeight: '900', color: solicitud.pago === 'Pendiente' ? '#f59e0b' : c.text, marginTop: '2px' }}>
              {solicitud.pago || 'Pendiente de resolución'}
            </span>
          </div>

          {esPendiente ? (
            <div className="footer-buttons">
              {/* BOTON ROJO DE OVERRIDE PARA RH */}
              {mostrarOverride && (
                <button 
                  onClick={() => onForzarFirma(solicitud)} 
                  style={{ padding: '10px 14px', borderRadius: '10px', border: `1px solid #ef4444`, backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <LockOpen size={16} /> Destrabar
                </button>
              )}

              {esMiTurno() && (
                <>
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
                </>
              )}
            </div>
          ) : (
            <span className="estado-firma" style={{ fontSize: '13px', fontWeight: '800', color: c.accent, display: 'flex', alignItems: 'center', gap: '6px', background: c.accentSoft, padding: '8px 14px', borderRadius: '10px' }}>
              <Check size={16} /> Firma registrada
            </span>
          )}
        </div>

      </div>
    </>
  );
}

// Auxiliar para extraer color
function pasoJasoColor(paso) {
  return paso.textColor;
}