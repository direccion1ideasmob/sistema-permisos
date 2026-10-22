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
    horarioRaw = horarioRaw
      .replace(/^Llegada estimada:\s*/i, 'Llegada: ')
      .replace(/^Llegada en puerta:\s*/i, 'Puerta: ')
      .replace(/^Para el:\s*.*$/i, '');

    let nombreSubarea = null;
    let nombreJefe = null;
    let nombreGerente = null;
    const notasPrevias = [];

    for (const s of partes.slice(1)) {
      const mNota = s.match(/^Nota\s+([^:]+):\s*(.+)$/i);
      if (mNota) notasPrevias.push({ autor: mNota[1].trim(), texto: mNota[2].trim() });
      const mRes = s.match(/^Res:\s*(.+)$/i);
      if (mRes) notasPrevias.push({ autor: 'Nota', texto: mRes[1].trim() });
      const mSub = s.match(/VoBo Sub[áa]rea:\s*(.*)/i);
      if (mSub) nombreSubarea = mSub[1].trim();
      const mJefe = s.match(/VoBo Jefe:\s*(.*)/i);
      if (mJefe) nombreJefe = mJefe[1].trim();
      const mGer = s.match(/VoBo Gerencia:\s*(.*)/i);
      if (mGer) nombreGerente = mGer[1].trim();
    }

    return { horarioRaw, nombreSubarea, nombreJefe, nombreGerente, notasPrevias };
  };

  const { horarioRaw, nombreSubarea, nombreJefe, nombreGerente, notasPrevias } = analizarDatos(solicitud.observaciones);

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
    if (t === 'retardo') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.09)', border: 'rgba(239, 68, 68, 0.28)', text: 'Retardo' };
    if (t === 'falta') return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.09)', border: 'rgba(139, 92, 246, 0.28)', text: 'Falta' };
    if (t === 'vacaciones') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.09)', border: 'rgba(16, 185, 129, 0.28)', text: 'Vacaciones' };
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.09)', border: 'rgba(14, 165, 233, 0.28)', text: 'Salida' };
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
        border: `1.5px solid ${c.border}`,
        borderLeft: `5px solid ${estilo.color}`,
        borderRadius: '16px',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: modoOscuro ? '0 4px 16px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.04)'
      }}
    >
      {/* RENGLÓN 1: CABECERA (AVATAR 50px + NOMBRE/PUESTO | BADGE DE TIPO) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
          <img
            src={urlFoto}
            alt=""
            style={{ width: '50px', height: '50px', borderRadius: '12px', objectFit: 'cover', border: `1.5px solid ${c.border}`, flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: '800', color: c.text, lineHeight: 1.25 }}>
              {aTitulo(u.nombre_completo || 'Colaborador')}
            </div>
            <div style={{ fontSize: '14px', color: c.textMuted, fontWeight: '600', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtituloFicha}
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '13.5px', fontWeight: '800', color: estilo.color, backgroundColor: estilo.bg,
          border: `1.5px solid ${estilo.border}`, padding: '5px 13px', borderRadius: '8px', flexShrink: 0,
          textTransform: 'uppercase', letterSpacing: '0.03em'
        }}>
          {estilo.text}
        </span>
      </div>

      {/* RENGLÓN 2: FECHA Y HORARIO + MOTIVO + COMENTARIOS PREVIOS */}
      <div style={{
        background: modoOscuro ? 'rgba(255,255,255,0.03)' : '#f8fafc',
        border: `1px solid ${c.border}`,
        borderRadius: '12px',
        padding: '13px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', fontSize: '14.5px', fontWeight: '700', color: c.text }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color={c.accent} />
              {fechaFormateada}
            </span>
            {horarioRaw && (
              <>
                <span style={{ color: c.border }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: c.textSubtle }}>
                  <Clock size={15} color={c.textMuted} />
                  {horarioRaw}
                </span>
              </>
            )}
          </div>

          {reincidencias > 0 && (
            <span style={{
              fontSize: '13px', fontWeight: '800', color: '#dc2626', background: 'rgba(239,68,68,0.12)',
              padding: '4px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px'
            }}>
              <AlertTriangle size={14} /> {reincidencias} retardo(s) previo(s)
            </span>
          )}
        </div>

        <div style={{ fontSize: '15px', color: c.textSubtle, lineHeight: 1.45 }}>
          {etiqueta && (
            <span style={{ fontWeight: '800', color: c.textMuted }}>
              {etiqueta}:{' '}
            </span>
          )}
          <span style={{ fontWeight: '600', color: c.text }}>"{redaccion}"</span>
        </div>

        {notasPrevias && notasPrevias.length > 0 && (
          <div style={{
            marginTop: '4px', paddingTop: '8px', borderTop: `1px dashed ${c.border}`,
            display: 'flex', flexDirection: 'column', gap: '4px'
          }}>
            {notasPrevias.map((n, idx) => (
              <div key={idx} style={{ fontSize: '14px', color: c.text }}>
                <strong style={{ color: c.accent }}>💬 {n.autor}:</strong> {n.texto}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RENGLÓN 3: AVALES PREVIOS + BOTONES DE ACCIÓN */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginTop: '2px' }}>
        {(avalesPrevios.length > 0 || esperandoA) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {avalesPrevios.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '14px', fontWeight: '700', color: '#16a34a'
              }}>
                <CheckCircle2 size={15} /> Avaló: {avalesPrevios.join(', ')}
              </span>
            )}
            {esperandoA && (
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#d97706' }}>
                ⏳ Turno de: {formatearNombreCorto(esperandoA)}
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 220px', justifyContent: 'flex-end' }}>
          {esPendiente && mostrarOverride && (
            <button
              onClick={() => onForzarFirma(solicitud)}
              style={{
                flex: 1, maxWidth: '200px', padding: '10px 16px', borderRadius: '10px', border: '1.5px solid rgba(239,68,68,0.4)',
                backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '14.5px', fontWeight: '800',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <LockOpen size={15} /> Saltar Firma
            </button>
          )}

          {esPendiente && esMiTurno() && (
            <>
              <button
                onClick={() => onRechazar(solicitud)}
                style={{
                  flex: 1, maxWidth: '175px', padding: '10px 18px', borderRadius: '10px', border: `1.5px solid ${c.border}`,
                  background: 'transparent', color: c.textMuted, fontSize: '14.5px', fontWeight: '700',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <X size={16} color={c.danger} /> Rechazar
              </button>
              <button
                onClick={() => onAprobar(solicitud)}
                style={{
                  flex: 1.2, maxWidth: '195px', padding: '10px 20px', borderRadius: '10px', border: 'none',
                  backgroundColor: c.accent, color: '#fff', fontSize: '14.5px', fontWeight: '800',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <Check size={16} /> Evaluar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
