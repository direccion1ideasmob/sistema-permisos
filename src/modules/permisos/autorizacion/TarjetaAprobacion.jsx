import React, { useState, useEffect } from 'react';
import {
  Check, X, AlertTriangle, Calendar, Clock,
  MessageSquare, LockOpen, CheckCircle2
} from 'lucide-react';
import { contarReincidenciasRetardo } from '../services/permisosService';

export default function TarjetaAprobacion({
  solicitud, esPendiente, onAprobar, onRechazar, onForzarFirma, usuarioActual, c, modoOscuro
}) {
  const [reincidencias, setReincidencias] = useState(0);

  const u = solicitud.usuarios || {};
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo || 'U')}&background=16a34a&color=fff&bold=true`;

  const tipo = (solicitud.tipo_permiso || '').toLowerCase();
  const esRetardo = tipo === 'retardo';

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

  const formatearNombreCorto = (nombreCompleto = '') => {
    const partes = String(nombreCompleto).trim().split(/\s+/).filter(Boolean);
    if (partes.length <= 2) return partes.join(' ');
    return `${partes[0]} ${partes[partes.length - 2]}`;
  };

  // Extraer horario real y avales previos ya firmados (sin mostrar pendientes obvios)
  const analizarDatos = (obs = '') => {
    const partes = String(obs).split('|').map(p => p.trim()).filter(Boolean);
    const horarioRaw = (partes[0] || '').replace(/🕒|📅/g, '').trim();

    let nombreSubarea = null;
    let nombreJefe = null;
    let nombreGerente = null;

    for (const s of partes.slice(1)) {
      const mSub = s.match(/VoBo Sub[áa]rea:\s*(.*)/i);
      if (mSub) nombreSubarea = mSub[1].trim();
      const mJefe = s.match(/VoBo Jefe:\s*(.*)/i);
      if (mJefe) nombreJefe = mJefe[1].trim();
      const mGer = s.match(/VoBo Gerencia:\s*(.*)/i);
      if (mGer) nombreGerente = mGer[1].trim();
    }

    return { horarioRaw, nombreSubarea, nombreJefe, nombreGerente };
  };

  const { horarioRaw, nombreSubarea, nombreJefe, nombreGerente } = analizarDatos(solicitud.observaciones);

  const procesarMotivo = (textoCrudo = '') => {
    const txt = String(textoCrudo || '').trim();
    const match = txt.match(/^\[(.*?)\]\s*(.*)/);
    const etiqueta = match ? match[1].trim() : '';
    const redaccion = match ? match[2].trim() : txt;

    // Si fue generado desde Apoyo Caseta, mostrar texto limpio sin repetir la hora
    if (etiqueta.toUpperCase() === 'APOYO CASETA') {
      return { etiqueta: 'Generado en Caseta', redaccion: 'Colaborador reportó llegada en caseta sin acceso móvil.' };
    }
    return { etiqueta, redaccion: redaccion || 'Sin motivo especificado.' };
  };

  const { etiqueta, redaccion } = procesarMotivo(solicitud.asunto_motivo);

  const getEstiloTipo = (t) => {
    if (t === 'retardo') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.25)', text: 'RETARDO' };
    if (t === 'falta') return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.25)', text: 'FALTA' };
    if (t === 'vacaciones') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: 'VACACIONES' };
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.25)', text: 'SALIDA' };
    return { color: c.accent, bg: c.accentSoft, border: c.border, text: t.toUpperCase() };
  };
  const estilo = getEstiloTipo(tipo);

  // Construir únicamente los avales que YA firmaron antes de este turno (o quién está esperando en Tránsito para RH)
  const avalesPrevios = [];
  if (nombreSubarea) avalesPrevios.push(`Subárea: ${formatearNombreCorto(nombreSubarea)}`);
  if (solicitud.firma_1_estado === 'autorizado') {
    const nomJ = nombreJefe || solicitud.firmante1?.nombre_completo;
    if (nomJ) avalesPrevios.push(`Jefe: ${formatearNombreCorto(nomJ)}`);
  }
  if (solicitud.firma_2_estado === 'autorizado') {
    const nomG = nombreGerente || solicitud.firmante2?.nombre_completo;
    if (nomG) avalesPrevios.push(`Gerencia: ${formatearNombreCorto(nomG)}`);
  }

  // Para la pestaña "En Tránsito" de RH: saber con quién está pendiente ahorita
  let esperandoA = null;
  if (mostrarOverride) {
    if (estaAtoradoConJefe) {
      esperandoA = solicitud.firmante1?.nombre_completo || 'Jefe de Área';
    } else if (estaAtoradoConGerente) {
      esperandoA = solicitud.firmante2?.nombre_completo || 'Gerencia';
    }
  }

  const deptoNombre = u.departamentos?.nombre || 'GENERAL';
  const partesFicha = [
    u.numero_empleado ? `#${u.numero_empleado}` : null,
    u.area && u.area.toUpperCase() !== deptoNombre.toUpperCase() ? u.area : null,
    u.puesto || null
  ].filter(Boolean);

  return (
    <div
      style={{
        background: c.surfaceCard,
        border: `1px solid ${c.border}`,
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        flexWrap: 'wrap',
        boxShadow: modoOscuro ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.04)'
      }}
    >
      {/* 1. COLABORADOR (SIN PUNTOS HUÉRFANOS) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: '1.1 1 230px' }}>
        <img
          src={urlFoto}
          alt=""
          style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', border: `1px solid ${c.border}`, flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>
            {u.nombre_completo || 'Colaborador'}
          </div>
          <div style={{ fontSize: '11px', color: c.textMuted, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '800', color: c.accent, background: c.accentSoft, padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
              {deptoNombre}
            </span>
            {partesFicha.length > 0 && (
              <span style={{ fontWeight: '600', color: c.textSubtle }}>
                {partesFicha.join(' • ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. QUÉ PIDE, FECHA Y HORARIO REAL (CERO FOLIOS FALSOS CAS-/REQ- Y CERO "1 hr(s)") */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '10px', fontWeight: '800', color: estilo.color, backgroundColor: estilo.bg,
            border: `1px solid ${estilo.border}`, padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.03em'
          }}>
            {estilo.text}
          </span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '800', color: c.text }}>
            <Calendar size={13} color={c.textMuted} />
            {solicitud.fecha_permiso}{solicitud.fecha_fin && solicitud.fecha_fin !== solicitud.fecha_permiso ? ` al ${solicitud.fecha_fin}` : ''}
          </span>

          {reincidencias > 0 && (
            <span style={{
              fontSize: '10px', fontWeight: '800', color: '#dc2626', background: 'rgba(239,68,68,0.12)',
              padding: '2px 6px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '3px'
            }}>
              <AlertTriangle size={11} /> {reincidencias} retardo(s) previo(s)
            </span>
          )}
        </div>

        {horarioRaw && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', fontWeight: '700', color: c.textSubtle }}>
            <Clock size={12} color={c.accent} />
            <span>{horarioRaw}</span>
          </div>
        )}
      </div>

      {/* 3. MOTIVO VISIBLE A PRIMERA VISTA + AVALES PREVIOS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1.5 1 240px', minWidth: '200px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: c.text }}>
          <MessageSquare size={13} color={c.accent} style={{ flexShrink: 0 }} />
          {etiqueta && (
            <span style={{ fontSize: '10px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase' }}>
              {etiqueta}:
            </span>
          )}
          <span style={{ fontWeight: '600' }}>{redaccion}</span>
        </div>

        {avalesPrevios.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {avalesPrevios.map((av, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '10.5px', fontWeight: '700', color: '#16a34a',
                  background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
                  padding: '2px 7px', borderRadius: '5px'
                }}
              >
                <CheckCircle2 size={11} /> {av}
              </span>
            ))}
          </div>
        )}

        {esperandoA && (
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#d97706' }}>
            ⏳ Pendiente firma de: {formatearNombreCorto(esperandoA)}
          </div>
        )}
      </div>

      {/* 4. BOTONES DE ACCIÓN LIMPIOS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
        {esPendiente && mostrarOverride && (
          <button
            onClick={() => onForzarFirma(solicitud)}
            title="Saltar firma pendiente por emergencia"
            style={{
              padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.4)',
              backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '11.5px', fontWeight: '800',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
            }}
          >
            <LockOpen size={13} /> Saltar Firma
          </button>
        )}

        {esPendiente && esMiTurno() && (
          <>
            <button
              onClick={() => onRechazar(solicitud)}
              style={{
                padding: '8px 13px', borderRadius: '8px', border: `1px solid ${c.border}`,
                background: 'transparent', color: c.danger, fontSize: '12px', fontWeight: '700',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
              }}
            >
              <X size={14} /> Rechazar
            </button>
            <button
              onClick={() => onAprobar(solicitud)}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Check size={14} /> Evaluar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
