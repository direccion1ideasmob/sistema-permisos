import React, { useState, useEffect } from 'react';
import { 
  Check, X, ShieldAlert, AlertTriangle, Calendar, Clock, 
  MessageSquare, LockOpen, CheckCircle2, XCircle, FastForward,
  ChevronDown, ChevronUp, UserCheck
} from 'lucide-react';
import { contarReincidenciasRetardo } from '../services/permisosService';

export default function TarjetaAprobacion({ 
  solicitud, esPendiente, onAprobar, onRechazar, onForzarFirma, usuarioActual, c, modoOscuro 
}) {
  const [expandido, setExpandido] = useState(false);
  const [reincidencias, setReincidencias] = useState(0);

  const u = solicitud.usuarios || {};
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo || 'U')}&background=16a34a&color=fff&bold=true`;

  const esRetardo = (solicitud.tipo_permiso || '').toLowerCase() === 'retardo';
  const fechaCreacion = new Date(solicitud.created_at);
  const esUrgente = esRetardo && solicitud.fecha_permiso === solicitud.fecha_elaboracion && fechaCreacion.getHours() >= 6;

  const esRH = usuarioActual?.rol === 'rh_nominas' || usuarioActual?.rol === 'gerente_rh' || usuarioActual?.rol === 'superadmin';
  const soyFirmante1Directo = solicitud.firma_1_id === usuarioActual?.id && solicitud.firma_1_estado === 'pendiente';
  const estaAtoradoConJefe = solicitud.firma_1_estado === 'pendiente';
  const estaAtoradoConGerente = solicitud.firma_1_estado !== 'pendiente' && solicitud.firma_2_estado === 'pendiente';
  const mostrarOverride = esRH && esPendiente && !soyFirmante1Directo && (estaAtoradoConJefe || estaAtoradoConGerente);

  const esMiTurno = () => {
    if (soyFirmante1Directo) return true;
    if (['jefe_area', 'encargado'].includes(usuarioActual?.rol) && solicitud.firma_1_estado === 'pendiente') return true;
    if (solicitud.firma_2_id === usuarioActual?.id && solicitud.firma_2_estado === 'pendiente' && solicitud.firma_1_estado !== 'pendiente') return true;
    if (esRH && solicitud.firma_3_estado === 'pendiente' && solicitud.firma_2_estado !== 'pendiente' && solicitud.firma_1_estado !== 'pendiente') return true;
    return false;
  };

  useEffect(() => {
    let montado = true;
    const checarReincidencia = async () => {
      if (esRetardo && solicitud.usuario_id) {
        try {
          const total = await contarReincidenciasRetardo(solicitud.usuario_id, solicitud.id, new Date(solicitud.created_at));
          if (montado) setReincidencias(total || 0);
        } catch (err) {
          console.error("Error verificando reincidencia:", err);
        }
      }
    };
    checarReincidencia();
    return () => { montado = false; };
  }, [esRetardo, solicitud.usuario_id, solicitud.id, solicitud.created_at]);

  // Extraer nombre corto (Ej. "RENE MORALES FLORES" -> "René Morales")
  const nombreCorto = (nombreCompleto, fallback) => {
    if (!nombreCompleto) return fallback;
    const partes = String(nombreCompleto).trim().split(/\s+/);
    const capitalizar = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    if (partes.length === 1) return capitalizar(partes[0]);
    return `${capitalizar(partes[0])} ${capitalizar(partes[1])}`;
  };

  // Extraer sellos de la cadena de observaciones (Subárea, Jefe, Gerencia)
  const extraerBitacoraObservaciones = (obs = '') => {
    const partes = String(obs).split('|').map(p => p.trim()).filter(Boolean);
    const horario = partes[0] || '';
    const sellos = partes.slice(1);
    let nombreSubarea = null;
    let nombreJefeBitacora = null;

    for (const s of sellos) {
      const mSub = s.match(/VoBo Subárea:\s*(.*)/i);
      if (mSub) nombreSubarea = mSub[1].trim();
      const mJefe = s.match(/VoBo Jefe:\s*(.*)/i);
      if (mJefe) nombreJefeBitacora = mJefe[1].trim();
    }

    return { horario, sellos, nombreSubarea, nombreJefeBitacora };
  };

  const { horario, sellos, nombreSubarea, nombreJefeBitacora } = extraerBitacoraObservaciones(solicitud.observaciones);

  const procesarMotivo = (textoCrudo = '') => {
    if (!textoCrudo) return { etiqueta: '', redaccion: 'Sin detalles especificados.' };
    const txt = String(textoCrudo).trim();
    const match = txt.match(/^\[(.*?)\]\s*(.*)/);
    if (match) {
      return { etiqueta: match[1].trim(), redaccion: match[2].trim() || 'Sin comentarios adicionales.' };
    }
    return { etiqueta: '', redaccion: txt };
  };

  const { etiqueta, redaccion } = procesarMotivo(solicitud.asunto_motivo);

  const getEstiloTipo = (tipo) => {
    const t = (tipo || '').toLowerCase();
    if (t === 'retardo') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', text: 'Retardo' };
    if (t === 'falta') return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.25)', text: 'Falta' };
    if (t === 'vacaciones') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: 'Vacaciones' };
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.25)', text: 'Salida' };
    return { color: c.accent, bg: c.accentSoft, border: c.border, text: t.toUpperCase() };
  };
  const estilo = getEstiloTipo(solicitud.tipo_permiso);

  const configChipFirma = (estado, esTurnoActual) => {
    const est = (estado || 'pendiente').toLowerCase();
    if (['autorizado', 'auto_aprobado'].includes(est)) {
      return { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.35)', color: '#16a34a', icon: <CheckCircle2 size={12} /> };
    }
    if (['escalado', 'omitido'].includes(est)) {
      return { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)', color: '#2563eb', icon: <FastForward size={12} /> };
    }
    if (est === 'rechazado') {
      return { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)', color: '#dc2626', icon: <XCircle size={12} /> };
    }
    if (esTurnoActual) {
      return { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.45)', color: '#d97706', icon: <Clock size={12} /> };
    }
    return { bg: modoOscuro ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: c.border, color: c.textMuted, icon: <Clock size={12} /> };
  };

  const firma1Listo = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(solicitud.firma_1_estado);
  const firma2Listo = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(solicitud.firma_2_estado);

  const nombreFirmante1 = nombreJefeBitacora || solicitud.firmante1?.nombre_completo || 'Jefe Área';
  const nombreFirmante2 = solicitud.firmante2?.nombre_completo || (solicitud.firma_2_estado === 'omitido' ? 'N/A' : 'Gerencia');
  const nombreFirmante3 = solicitud.firmante3?.nombre_completo || 'RH';

  const chipSubarea = nombreSubarea ? configChipFirma('autorizado', false) : null;
  const chipJefe = configChipFirma(solicitud.firma_1_estado, !firma1Listo);
  const chipGerente = configChipFirma(solicitud.firma_2_estado, firma1Listo && !firma2Listo);
  const chipRH = configChipFirma(solicitud.firma_3_estado, firma1Listo && firma2Listo);

  const colorDictamen = (solicitud.pago || '').toLowerCase().includes('pendiente') ? '#d97706' : c.accent;

  return (
    <div
      style={{
        background: c.surfaceCard,
        border: `1px solid ${expandido ? c.accent : c.border}`,
        borderRadius: '12px',
        transition: 'all 0.15s ease',
        boxShadow: modoOscuro ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}
    >
      {/* FILA EJECUTIVA COMPACTA (VISTA PRINCIPAL ARMONIOSA) */}
      <div
        onClick={() => setExpandido(!expandido)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          padding: '12px 16px',
          cursor: 'pointer',
          flexWrap: 'wrap'
        }}
      >
        {/* 1. COLABORADOR */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: '210px', flex: '1.2 1 210px' }}>
          <img
            src={urlFoto}
            alt=""
            style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'cover', border: `1px solid ${c.border}`, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.nombre_completo || 'Colaborador'}
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted, display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: '700', color: c.textSubtle }}>#{u.numero_empleado}</span>
              <span>•</span>
              <span>{u.departamentos?.nombre || u.area || 'General'}</span>
              <span>•</span>
              <span style={{ fontFamily: 'monospace', fontSize: '10.5px' }}>{solicitud.folio}</span>
            </div>
          </div>
        </div>

        {/* 2. RESUMEN DEL PERMISO (TIPO + FECHA + DURACIÓN EN UNA LÍNEA) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1.1 1 220px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '10.5px', fontWeight: '800', color: estilo.color, backgroundColor: estilo.bg,
            border: `1px solid ${estilo.border}`, padding: '3px 9px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.02em'
          }}>
            {estilo.text}
          </span>

          <span style={{ fontSize: '12px', fontWeight: '700', color: c.text, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={13} color={c.textMuted} />
            {solicitud.fecha_permiso}{solicitud.fecha_fin ? ` → ${solicitud.fecha_fin}` : ''}
          </span>

          <span style={{ fontSize: '11.5px', fontWeight: '600', color: c.textMuted, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} color={c.textMuted} />
            {solicitud.total_horas ? `${solicitud.total_horas}h` : 'Día'}
          </span>

          {(esUrgente || reincidencias > 0) && (
            <span style={{
              fontSize: '10px', fontWeight: '800', color: '#dc2626', background: 'rgba(239,68,68,0.12)',
              padding: '2px 7px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px'
            }}>
              <AlertTriangle size={11} /> {esUrgente ? 'Urgente' : `${reincidencias} Reinc.`}
            </span>
          )}
        </div>

        {/* 3. CADENA DE FIRMAS CON NOMBRES REALES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: '1.5 1 260px', flexWrap: 'wrap' }}>
          {nombreSubarea && (
            <span
              title={`VoBo Subárea: ${nombreSubarea}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '7px',
                fontSize: '11px', fontWeight: '700', backgroundColor: chipSubarea.bg, border: `1px solid ${chipSubarea.border}`, color: chipSubarea.color
              }}
            >
              {chipSubarea.icon} {nombreCorto(nombreSubarea, 'Subárea')}
            </span>
          )}

          <span
            title={`Jefe de Área: ${nombreFirmante1} (${solicitud.firma_1_estado})`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '7px',
              fontSize: '11px', fontWeight: '700', backgroundColor: chipJefe.bg, border: `1px solid ${chipJefe.border}`, color: chipJefe.color
            }}
          >
            {chipJefe.icon} {nombreCorto(nombreFirmante1, 'Jefe')}
          </span>

          {solicitud.firma_2_estado !== 'omitido' && (
            <span
              title={`Gerencia: ${nombreFirmante2} (${solicitud.firma_2_estado})`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '7px',
                fontSize: '11px', fontWeight: '700', backgroundColor: chipGerente.bg, border: `1px solid ${chipGerente.border}`, color: chipGerente.color
              }}
            >
              {chipGerente.icon} {nombreCorto(nombreFirmante2, 'Gerente')}
            </span>
          )}

          <span
            title={`RH: ${nombreFirmante3} (${solicitud.firma_3_estado})`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '7px',
              fontSize: '11px', fontWeight: '700', backgroundColor: chipRH.bg, border: `1px solid ${chipRH.border}`, color: chipRH.color
            }}
          >
            {chipRH.icon} RH
          </span>
        </div>

        {/* 4. BOTONES DE ACCIÓN RÁPIDA + EXPANDIR */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
        >
          {esPendiente && mostrarOverride && (
            <button
              onClick={() => onForzarFirma(solicitud)}
              title="Saltar firma pendiente por emergencia"
              style={{
                padding: '6px 11px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)',
                backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '11.5px', fontWeight: '800',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
              }}
            >
              <LockOpen size={13} /> Destrabar
            </button>
          )}

          {esPendiente && esMiTurno() && (
            <>
              <button
                onClick={() => onRechazar(solicitud)}
                style={{
                  padding: '6px 10px', borderRadius: '8px', border: `1px solid ${c.border}`,
                  background: 'transparent', color: c.danger, fontSize: '11.5px', fontWeight: '700',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}
              >
                <X size={14} /> Rechazar
              </button>
              <button
                onClick={() => onAprobar(solicitud)}
                style={{
                  padding: '6px 13px', borderRadius: '8px', border: 'none',
                  backgroundColor: c.accent, color: '#fff', fontSize: '11.5px', fontWeight: '800',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                }}
              >
                <Check size={14} /> Evaluar
              </button>
            </>
          )}

          <button
            onClick={() => setExpandido(!expandido)}
            title={expandido ? "Ocultar detalles" : "Ver motivo y bitácora"}
            style={{
              width: '28px', height: '28px', borderRadius: '7px', border: `1px solid ${c.border}`,
              background: 'transparent', color: c.textMuted, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {expandido ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* PANEL DESPLEGABLE (SOLO SE ABRE AL DAR CLIC EN LA FILA) */}
      {expandido && (
        <div
          style={{
            borderTop: `1px solid ${c.borderDivider}`,
            background: modoOscuro ? 'rgba(0,0,0,0.2)' : '#f8fafc',
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '12px'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '2 1 280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <MessageSquare size={13} color={c.accent} />
              {etiqueta && (
                <span style={{ fontSize: '10px', fontWeight: '800', color: c.accent, background: c.accentSoft, padding: '1px 7px', borderRadius: '6px' }}>
                  {etiqueta}
                </span>
              )}
              <span style={{ fontWeight: '700', color: c.text }}>{redaccion}</span>
            </div>

            {horario && (
              <div style={{ color: c.textMuted, fontSize: '11.5px', paddingLeft: '19px' }}>
                {horario}
              </div>
            )}
          </div>

          {/* BITÁCORA DE SELLOS Y DICTAMEN */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {sellos.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {sellos.map((sello, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '11px', fontWeight: '700', color: c.textSubtle,
                      background: c.surfaceCard, border: `1px solid ${c.border}`,
                      padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <UserCheck size={12} color={c.accent} /> {sello.replace('✅ ', '')}
                  </span>
                ))}
              </div>
            )}

            <div style={{
              fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '7px',
              background: c.surfaceCard, border: `1px solid ${c.border}`, color: colorDictamen
            }}>
              Dictamen: {solicitud.pago || 'Pendiente'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
