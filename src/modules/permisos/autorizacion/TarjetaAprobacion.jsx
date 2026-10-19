import React, { useState, useEffect } from 'react';
import { 
  Check, X, ShieldAlert, AlertTriangle, Calendar, Clock, 
  MessageSquare, LockOpen, CheckCircle2, XCircle, FastForward,
  ChevronDown, ChevronUp
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

  // Formatear Primer Nombre + Primer Apellido (Ej. "RICARDO ISRAEL MORUA" -> "Ricardo Morua")
  const formatearNombreApellido = (nombreCompleto, fallback) => {
    if (!nombreCompleto) return fallback;
    const partes = String(nombreCompleto).trim().split(/\s+/);
    const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    if (partes.length === 1) return cap(partes[0]);
    if (partes.length === 2) return `${cap(partes[0])} ${cap(partes[1])}`;
    // Si tiene 3 o 4 palabras, tomamos primer nombre y primer apellido (índice 0 y penúltimo/segundo según longitud)
    const apellido = partes.length >= 3 ? partes[partes.length - 2] === 'DE' ? partes[partes.length - 1] : (partes.length === 3 ? partes[2] : partes[2]) : partes[1];
    return `${cap(partes[0])} ${cap(apellido)}`;
  };

  // Extraer datos limpios de observaciones sin repetir sellos abajo
  const analizarObservaciones = (obs = '') => {
    const partes = String(obs).split('|').map(p => p.trim()).filter(Boolean);
    const horario = partes[0] || '';
    let nombreSubarea = null;
    let nombreJefeBitacora = null;
    let comentarioRes = null;

    for (const s of partes.slice(1)) {
      const mSub = s.match(/VoBo Subárea:\s*(.*)/i);
      if (mSub) nombreSubarea = mSub[1].trim();
      const mJefe = s.match(/VoBo Jefe:\s*(.*)/i);
      if (mJefe) nombreJefeBitacora = mJefe[1].trim();
      const mRes = s.match(/Res:\s*(.*)/i);
      if (mRes) comentarioRes = mRes[1].trim();
    }

    return { horario, nombreSubarea, nombreJefeBitacora, comentarioRes };
  };

  const { horario, nombreSubarea, nombreJefeBitacora, comentarioRes } = analizarObservaciones(solicitud.observaciones);

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
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.25)', text: 'Salida Anticipada' };
    return { color: c.accent, bg: c.accentSoft, border: c.border, text: t.toUpperCase() };
  };
  const estilo = getEstiloTipo(solicitud.tipo_permiso);

  const configChipFirma = (estado, esTurnoActual) => {
    const est = (estado || 'pendiente').toLowerCase();
    if (['autorizado', 'auto_aprobado'].includes(est)) {
      return { bg: 'rgba(34, 197, 94, 0.10)', border: 'rgba(34, 197, 94, 0.35)', color: '#16a34a', icon: <CheckCircle2 size={13} />, statusText: 'Aprobó' };
    }
    if (['escalado', 'omitido'].includes(est)) {
      return { bg: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.35)', color: '#2563eb', icon: <FastForward size={13} />, statusText: 'Saltado' };
    }
    if (est === 'rechazado') {
      return { bg: 'rgba(239, 68, 68, 0.10)', border: 'rgba(239, 68, 68, 0.35)', color: '#dc2626', icon: <XCircle size={13} />, statusText: 'Rechazó' };
    }
    if (esTurnoActual) {
      return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.45)', color: '#d97706', icon: <Clock size={13} />, statusText: 'En turno' };
    }
    return { bg: modoOscuro ? 'rgba(255,255,255,0.03)' : '#f8fafc', border: c.border, color: c.textMuted, icon: <Clock size={13} />, statusText: 'Pendiente' };
  };

  const firma1Listo = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(solicitud.firma_1_estado);
  const firma2Listo = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(solicitud.firma_2_estado);

  const nombreFirmante1 = nombreJefeBitacora || solicitud.firmante1?.nombre_completo || 'Sin asignar';
  const rolFirmante1 = (!nombreSubarea && solicitud.firmante1?.rol === 'encargado') ? 'SUPERVISOR' : 'JEFE DEPTO';
  const nombreFirmante2 = solicitud.firmante2?.nombre_completo || 'Gerencia';
  const nombreFirmante3 = solicitud.firmante3?.nombre_completo || 'Nóminas / RH';

  // Construimos los pasos jerárquicos sin duplicar nada
  const pasosCadena = [];
  if (nombreSubarea) {
    pasosCadena.push({
      cargo: 'SUPERVISOR SUBÁREA',
      nombre: formatearNombreApellido(nombreSubarea, 'Subárea'),
      ...configChipFirma('autorizado', false)
    });
  }
  pasosCadena.push({
    cargo: rolFirmante1,
    nombre: formatearNombreApellido(nombreFirmante1, 'Jefe Área'),
    ...configChipFirma(solicitud.firma_1_estado, !firma1Listo)
  });
  if (solicitud.firma_2_estado !== 'omitido') {
    pasosCadena.push({
      cargo: 'GERENCIA',
      nombre: formatearNombreApellido(nombreFirmante2, 'Gerente'),
      ...configChipFirma(solicitud.firma_2_estado, firma1Listo && !firma2Listo)
    });
  }
  pasosCadena.push({
    cargo: 'DICTAMEN RH',
    nombre: solicitud.firma_3_estado === 'autorizado' ? formatearNombreApellido(nombreFirmante3, 'RH') : 'Recursos Humanos',
    ...configChipFirma(solicitud.firma_3_estado, firma1Listo && firma2Listo)
  });

  const colorDictamen = (solicitud.pago || '').toLowerCase().includes('pendiente') ? '#d97706' : c.accent;
  const deptoNombre = u.departamentos?.nombre || 'SIN DEPTO';
  const subareaOPuesto = u.puesto || u.area || 'Colaborador';

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
      {/* FILA PRINCIPAL EJECUTIVA */}
      <div
        onClick={() => setExpandido(!expandido)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '13px 16px',
          cursor: 'pointer',
          flexWrap: 'wrap'
        }}
      >
        {/* 1. COLABORADOR CON PUESTO, SUBÁREA Y DEPARTAMENTO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '230px', flex: '1.2 1 230px' }}>
          <img
            src={urlFoto}
            alt=""
            style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', border: `1px solid ${c.border}`, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {u.nombre_completo || 'Colaborador'}
            </div>
            <div style={{ fontSize: '11px', color: c.textMuted, display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '800', color: c.accent, background: c.accentSoft, padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
                {deptoNombre}
              </span>
              {u.area && u.area.toUpperCase() !== deptoNombre.toUpperCase() && (
                <>
                  <span>•</span>
                  <span style={{ fontWeight: '700', color: c.textSubtle }}>{u.area}</span>
                </>
              )}
              <span>•</span>
              <span style={{ fontWeight: '600' }}>{subareaOPuesto}</span>
              <span>•</span>
              <span style={{ fontWeight: '700' }}>#{u.numero_empleado}</span>
            </div>
          </div>
        </div>

        {/* 2. TIPO DE PASE + FECHA + HORAS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '0.9 1 180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px', fontWeight: '800', color: estilo.color, backgroundColor: estilo.bg,
              border: `1px solid ${estilo.border}`, padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.03em'
            }}>
              {estilo.text}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: '10.5px', color: c.textMuted, fontWeight: '700' }}>
              {solicitud.folio}
            </span>
            {(esUrgente || reincidencias > 0) && (
              <span style={{
                fontSize: '10px', fontWeight: '800', color: '#dc2626', background: 'rgba(239,68,68,0.12)',
                padding: '2px 6px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '3px'
              }}>
                <AlertTriangle size={11} /> {esUrgente ? 'Urgente' : `${reincidencias} Reinc.`}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: c.text, fontWeight: '700' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} color={c.textMuted} />
              {solicitud.fecha_permiso}{solicitud.fecha_fin ? ` al ${solicitud.fecha_fin}` : ''}
            </span>
            <span style={{ color: c.textMuted }}>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: c.textSubtle }}>
              <Clock size={12} color={c.textMuted} />
              {solicitud.total_horas ? `${solicitud.total_horas} hr(s)` : 'Jornada'}
            </span>
          </div>
        </div>

        {/* 3. CADENA DE FIRMAS CON CARGO ARRIBA Y NOMBRE ABAJO (SIN REPETICIONES) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1.8 1 320px', flexWrap: 'wrap' }}>
          {pasosCadena.map((paso, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 10px',
                borderRadius: '8px',
                backgroundColor: paso.bg,
                border: `1px solid ${paso.border}`,
                minWidth: '115px'
              }}
            >
              <div style={{ color: paso.color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {paso.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: c.textMuted, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                  {paso.cargo}
                </span>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: paso.color, whiteSpace: 'nowrap' }}>
                  {paso.nombre}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 4. BOTONES DE ACCIÓN */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
        >
          {esPendiente && mostrarOverride && (
            <button
              onClick={() => onForzarFirma(solicitud)}
              title="Saltar firma pendiente por emergencia"
              style={{
                padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)',
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
                  padding: '7px 11px', borderRadius: '8px', border: `1px solid ${c.border}`,
                  background: 'transparent', color: c.danger, fontSize: '11.5px', fontWeight: '700',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}
              >
                <X size={14} /> Rechazar
              </button>
              <button
                onClick={() => onAprobar(solicitud)}
                style={{
                  padding: '7px 14px', borderRadius: '8px', border: 'none',
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
            title={expandido ? "Ocultar motivo" : "Ver motivo y horario"}
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

      {/* PANEL DESPLEGABLE: SOLO MOTIVO, HORARIO Y DICTAMEN (SIN REPETIR NOMBRES DE FIRMAS) */}
      {expandido && (
        <div
          style={{
            borderTop: `1px solid ${c.borderDivider}`,
            background: modoOscuro ? 'rgba(0,0,0,0.2)' : '#f8fafc',
            padding: '10px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={13} color={c.accent} />
              {etiqueta && (
                <span style={{ fontSize: '10px', fontWeight: '800', color: c.accent, background: c.accentSoft, padding: '2px 7px', borderRadius: '5px' }}>
                  {etiqueta}
                </span>
              )}
              <span style={{ fontWeight: '700', color: c.text }}>{redaccion}</span>
            </div>

            {horario && (
              <>
                <span style={{ color: c.border }}>|</span>
                <span style={{ color: c.textSubtle, fontSize: '11.5px', fontWeight: '600' }}>
                  {horario}
                </span>
              </>
            )}

            {comentarioRes && (
              <>
                <span style={{ color: c.border }}>|</span>
                <span style={{ color: c.textMuted, fontSize: '11.5px', fontStyle: 'italic' }}>
                  Nota: {comentarioRes}
                </span>
              </>
            )}
          </div>

          <div style={{
            fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '6px',
            background: c.surfaceCard, border: `1px solid ${c.border}`, color: colorDictamen
          }}>
            Dictamen Nómina: {solicitud.pago || 'Pendiente'}
          </div>
        </div>
      )}
    </div>
  );
}
