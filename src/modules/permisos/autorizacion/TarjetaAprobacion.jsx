import React, { useState, useEffect } from 'react';
import {
  Check, X, AlertTriangle, Calendar, Clock, LockOpen, CheckCircle2
} from 'lucide-react';
import { contarReincidenciasRetardo } from '../services/permisosService';

export default function TarjetaAprobacion({
  solicitud, esPendiente, onAprobar, onRechazar, onForzarFirma, usuarioActual, c, modoOscuro
}) {
  const [reincidencias, setReincidencias] = useState(0);

  const u = solicitud.usuarios || {};
  // Avatar neutro en gris pizarra cuando no tiene foto para no saturar de verde la tarjeta
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo || 'U')}&background=334155&color=f8fafc&bold=true`;

  const tipo = (solicitud.tipo_permiso || '').toLowerCase();
  const esRetardo = tipo === 'retardo';

  const esRH = usuarioActual?.rol === 'rh_nominas' || usuarioActual?.rol === 'gerente_rh' || usuarioActual?.rol === 'superadmin';
  const soyFirmante1Directo = solicitud.firma_1_id === usuarioActual?.id && solicitud.firma_1_estado === 'pendiente';
  const estaAtoradoConJefe = solicitud.firma_1_estado === 'pendiente';
  const estaAtoradoConGerente = solicitud.firma_1_estado !== 'pendiente' && solicitud.firma_2_estado === 'pendiente';
  const esPropioPermiso = solicitud.usuario_id === usuarioActual?.id;
  const mostrarOverride = !esPropioPermiso && esRH && esPendiente && !soyFirmante1Directo && (estaAtoradoConJefe || estaAtoradoConGerente);

  const esMiTurno = () => {
    if (esPropioPermiso) return false;
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

  // Convertir "SALUD OCUPACIONAL" -> "Salud Ocupacional" (conservando siglas como CNC o RH)
  const aTitulo = (str = '') => {
    const siglas = ['CNC', 'RH', 'TI', 'IMSS', 'NOM'];
    return String(str)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => {
        const up = w.toUpperCase();
        if (siglas.includes(up)) return up;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  };

  const formatearNombreCorto = (nombreCompleto = '') => {
    const partes = String(nombreCompleto).trim().split(/\s+/).filter(Boolean);
    if (partes.length <= 2) return aTitulo(partes.join(' '));
    return aTitulo(`${partes[0]} ${partes[partes.length - 2]}`);
  };

  const formatearFechaCorta = (fechaStr = '') => {
    if (!fechaStr) return '';
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    const anio = partes[0];
    const mes = meses[parseInt(partes[1], 10) - 1] || partes[1];
    const dia = parseInt(partes[2], 10);
    return `${dia} ${mes} ${anio}`;
  };

  const analizarDatos = (obs = '') => {
    const partes = String(obs).split('|').map(p => p.trim()).filter(Boolean);
    let horarioRaw = (partes[0] || '').replace(/🕒|📅/g, '').trim();
    // Simplificar textos largos de horario para que quepan en una sola línea con la fecha
    horarioRaw = horarioRaw
      .replace(/^Llegada estimada:\s*/i, 'Llegada: ')
      .replace(/^Llegada en puerta:\s*/i, 'Puerta: ')
      .replace(/^Para el:\s*.*\$/i, '');

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
    const etiquetaRaw = match ? match[1].trim() : '';
    const redaccionRaw = match ? match[2].trim() : txt;

    if (etiquetaRaw.toUpperCase() === 'APOYO CASETA') {
      return { etiqueta: 'Caseta', redaccion: 'Llegada registrada en puerta sin acceso móvil.' };
    }
    const etiquetaCorta = etiquetaRaw
      .replace(/PERSONAL\s*\/\s*FAMILIAR/i, 'Personal')
      .replace(/ASUNTO DE TRABAJO/i, 'Trabajo')
      .replace(/CITA M[ÉE]DICA/i, 'Cita Médica')
      .replace(/VACACIONES/i, 'Vacaciones');

    const redaccionLimpia = redaccionRaw
      ? redaccionRaw.charAt(0).toUpperCase() + redaccionRaw.slice(1)
      : 'Sin motivo especificado.';

    return { etiqueta: aTitulo(etiquetaCorta), redaccion: redaccionLimpia };
  };

  const { etiqueta, redaccion } = procesarMotivo(solicitud.asunto_motivo);

  const getEstiloTipo = (t) => {
    if (t === 'retardo') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.25)', text: 'Retardo' };
    if (t === 'falta') return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', border: 'rgba(139, 92, 246, 0.25)', text: 'Falta' };
    if (t === 'vacaciones') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.25)', text: 'Vacaciones' };
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.25)', text: 'Salida' };
    return { color: c.accent, bg: c.accentSoft, border: c.border, text: aTitulo(t) };
  };
  const estilo = getEstiloTipo(tipo);

  const avalesPrevios = [];
  if (nombreSubarea) avalesPrevios.push(formatearNombreCorto(nombreSubarea));
  if (solicitud.firma_1_estado === 'autorizado') {
    const nomJ = nombreJefe || solicitud.firmante1?.nombre_completo;
    if (nomJ) avalesPrevios.push(formatearNombreCorto(nomJ));
  }
  if (solicitud.firma_2_estado === 'autorizado') {
    const nomG = nombreGerente || solicitud.firmante2?.nombre_completo;
    if (nomG) avalesPrevios.push(formatearNombreCorto(nomG));
  }

  let esperandoA = null;
  if (mostrarOverride) {
    if (estaAtoradoConJefe) esperandoA = solicitud.firmante1?.nombre_completo || 'Jefe de Área';
    else if (estaAtoradoConGerente) esperandoA = solicitud.firmante2?.nombre_completo || 'Gerencia';
  }

  const deptoNombre = u.departamentos?.nombre || '';
  const areaLimpia = u.area && u.area.toUpperCase() !== deptoNombre.toUpperCase() ? aTitulo(u.area) : aTitulo(deptoNombre);
  const puestoLimpio = u.puesto && u.puesto.toUpperCase() !== (u.area || '').toUpperCase() ? aTitulo(u.puesto) : null;
  const subtituloFicha = [
    u.numero_empleado ? `#${u.numero_empleado}` : null,
    areaLimpia || null,
    puestoLimpio
  ].filter(Boolean).join(' • ');

  const fechaFormateada = solicitud.fecha_fin && solicitud.fecha_fin !== solicitud.fecha_permiso
    ? `${formatearFechaCorta(solicitud.fecha_permiso)} al ${formatearFechaCorta(solicitud.fecha_fin)}`
    : formatearFechaCorta(solicitud.fecha_permiso);

  return (
    <div
      style={{
        background: c.surfaceCard,
        border: `1px solid ${c.border}`,
        borderLeft: `4px solid ${estilo.color}`,
        borderRadius: '12px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: modoOscuro ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.03)'
      }}
    >
      {/* RENGLÓN 1: CABECERA (AVATAR + NOMBRE/PUESTO A LA IZQUIERDA | BADGE DE TIPO A LA DERECHA) */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flex: 1 }}>
          <img
            src={urlFoto}
            alt=""
            style={{ width: '38px', height: '38px', borderRadius: '9px', objectFit: 'cover', border: `1px solid ${c.border}`, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text, lineHeight: 1.2 }}>
              {aTitulo(u.nombre_completo || 'Colaborador')}
            </div>
            <div style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '600', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtituloFicha}
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '10.5px', fontWeight: '800', color: estilo.color, backgroundColor: estilo.bg,
          border: `1px solid ${estilo.border}`, padding: '3px 9px', borderRadius: '6px', flexShrink: 0
        }}>
          {estilo.text}
        </span>
      </div>

      {/* RENGLÓN 2: FECHA Y HORARIO UNIDOS EN UNA SOLA LÍNEA + CAJA DE MOTIVO */}
      <div style={{
        background: modoOscuro ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        border: `1px solid ${c.border}`,
        borderRadius: '9px',
        padding: '9px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '12px', fontWeight: '700', color: c.text }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12.5} color={c.textMuted} />
              {fechaFormateada}
            </span>
            {horarioRaw && (
              <>
                <span style={{ color: c.border }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: c.textSubtle }}>
                  <Clock size={12.5} color={c.textMuted} />
                  {horarioRaw}
                </span>
              </>
            )}
          </div>

          {reincidencias > 0 && (
            <span style={{
              fontSize: '10px', fontWeight: '800', color: '#dc2626', background: 'rgba(239,68,68,0.1)',
              padding: '2px 6px', borderRadius: '5px', display: 'inline-flex', alignItems: 'center', gap: '3px'
            }}>
              <AlertTriangle size={11} /> {reincidencias} retardo(s) previo(s)
            </span>
          )}
        </div>

        <div style={{ fontSize: '12px', color: c.textSubtle, lineHeight: 1.35 }}>
          {etiqueta && (
            <span style={{ fontWeight: '700', color: c.textMuted }}>
              {etiqueta}:{' '}
            </span>
          )}
          <span style={{ fontWeight: '600', color: c.text }}>"{redaccion}"</span>
        </div>
      </div>

      {/* RENGLÓN 3: AVALES PREVIOS (SI LOS HAY) + BOTONES SIMÉTRICOS */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
        {(avalesPrevios.length > 0 || esperandoA) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {avalesPrevios.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', fontWeight: '700', color: '#16a34a'
              }}>
                <CheckCircle2 size={12} /> Avaló: {avalesPrevios.join(', ')}
              </span>
            )}
            {esperandoA && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#d97706' }}>
                ⏳ Turno de: {formatearNombreCorto(esperandoA)}
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px', justifyContent: 'flex-end' }}>
          {esPendiente && mostrarOverride && (
            <button
              onClick={() => onForzarFirma(solicitud)}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.35)',
                backgroundColor: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: '12px', fontWeight: '700',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
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
                  flex: 1, maxWidth: '160px', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${c.border}`,
                  background: 'transparent', color: c.textMuted, fontSize: '12px', fontWeight: '700',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                }}
              >
                <X size={14} color={c.danger} /> Rechazar
              </button>
              <button
                onClick={() => onAprobar(solicitud)}
                style={{
                  flex: 1.2, maxWidth: '180px', padding: '8px 14px', borderRadius: '8px', border: 'none',
                  backgroundColor: c.accent, color: '#fff', fontSize: '12px', fontWeight: '800',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                }}
              >
                <Check size={14} /> Evaluar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
