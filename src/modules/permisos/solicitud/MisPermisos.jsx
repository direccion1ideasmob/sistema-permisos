import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { obtenerPermisosUsuario, escalarPermisoAGerencia } from '../services/permisosService';
import { obtenerTemaPermisos, generarEstilosPermisos } from '../permisosStyles';
import { parsearDatosObservaciones, limpiarMotivo } from '../historial/TablaHistorial';
import {
  Clock, FileText, AlertTriangle, ShieldCheck,
  XCircle, FastForward, MessageSquare, DoorOpen, CornerUpLeft,
  Calendar, ChevronDown, ChevronUp, User, Stethoscope, Briefcase
} from 'lucide-react';

export default function MisPermisos() {
  const { usuario } = useAuth();
  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaPermisos(modoOscuro);

  const [misPermisos, setMisPermisos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [pestaña, setPestaña] = useState('proceso');
  const [procesandoEscalamiento, setProcesandoEscalamiento] = useState(false);
  const [horaActual, setHoraActual] = useState(new Date());
  const [mesesContraidos, setMesesContraidos] = useState({});

  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const cargarHistorial = useCallback(async () => {
    if (!usuario?.id) return;
    setCargandoHistorial(true);
    try {
      const data = await obtenerPermisosUsuario(usuario.id);
      setMisPermisos(data);
    } catch (err) {
      console.error("Error al cargar historial:", err);
    } finally {
      setCargandoHistorial(false);
    }
  }, [usuario?.id]);

  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const escalarPermiso = async (permiso) => {
    if (!window.confirm("¿Estás seguro de escalar esta solicitud a la Gerencia? Usa esta opción solo si tu Jefe Directo no ha respondido en más de 1 hora.")) return;
    setProcesandoEscalamiento(true);
    try {
      await escalarPermisoAGerencia(permiso);
      alert("✅ Solicitud escalada a Gerencia correctamente.");
      await cargarHistorial();
    } catch (error) {
      console.error("Error al escalar:", error);
      alert("Hubo un problema al intentar escalar la solicitud.");
    } finally {
      setProcesandoEscalamiento(false);
    }
  };

  const getEstiloTipo = (tipoRaw = '') => {
    const t = tipoRaw.toLowerCase();
    if (t === 'retardo') return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.09)', border: 'rgba(239, 68, 68, 0.28)', label: 'RETARDO' };
    if (t === 'falta') return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.09)', border: 'rgba(139, 92, 246, 0.28)', label: 'FALTA' };
    if (t === 'vacaciones') return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.09)', border: 'rgba(16, 185, 129, 0.28)', label: 'VACACIONES' };
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.09)', border: 'rgba(14, 165, 233, 0.28)', label: 'SALIDA ANTICIPADA' };
    return { color: c.text, bg: c.surface, border: c.border, label: (tipoRaw || 'PERMISO').toUpperCase() };
  };

  const formatearFechaCorta = (fechaStr = '') => {
    if (!fechaStr) return '';
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    return `${String(parseInt(partes[2], 10)).padStart(2, '0')} ${meses[parseInt(partes[1], 10) - 1] || partes[1]} ${partes[0]}`;
  };

  const enProceso = misPermisos.filter(p => p.estado_general === 'en_firmas');
  const finalizados = misPermisos.filter(p => p.estado_general !== 'en_firmas');

  const gruposPorMes = useMemo(() => {
    const nombresMeses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const mapa = new Map();

    finalizados.forEach(p => {
      const f = p.fecha_permiso || (p.created_at ? p.created_at.slice(0, 10) : '');
      const [anio, mes] = f.split('-');
      const idxMes = parseInt(mes, 10) - 1;
      const clave = (anio && !isNaN(idxMes)) ? `${anio}-${mes}` : 'otros';
      const etiqueta = (anio && !isNaN(idxMes)) ? `${nombresMeses[idxMes]} ${anio}` : 'Otros periodos';

      if (!mapa.has(clave)) {
        mapa.set(clave, { clave, etiqueta, items: [] });
      }
      mapa.get(clave).items.push(p);
    });

    return Array.from(mapa.values());
  }, [finalizados]);

  const toggleMes = (clave) => {
    setMesesContraidos(prev => ({ ...prev, [clave]: !prev[clave] }));
  };

  const renderEtiquetaNaturaleza = (cat = '') => {
    if (!cat) return null;
    const low = cat.toLowerCase();
    let Icono = User;
    if (low.includes('cita') || low.includes('médic')) Icono = Stethoscope;
    else if (low.includes('trabajo')) Icono = Briefcase;
    else if (low.includes('vacaciones')) Icono = Calendar;

    return (
      <span className="badge-naturaleza-fijo" style={{ color: c.textMuted }}>
        <Icono size={14} color={c.textMuted} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span>{cat}</span>
      </span>
    );
  };

  const renderSelloArea = (nombreArea, estado) => {
    const est = (estado || 'pendiente').toLowerCase();
    let config = {
      bg: modoOscuro ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
      border: c.border,
      color: c.textMuted,
      texto: 'EN REVISIÓN',
      icono: <Clock size={15} />
    };

    if (['autorizado', 'auto_aprobado', 'aprobado'].includes(est)) {
      config = {
        bg: 'rgba(34, 197, 94, 0.08)',
        border: 'rgba(34, 197, 94, 0.32)',
        color: '#16a34a',
        texto: 'APROBADO',
        icono: <ShieldCheck size={15} />
      };
    } else if (['escalado', 'omitido'].includes(est)) {
      config = {
        bg: 'rgba(100, 116, 139, 0.08)',
        border: c.border,
        color: c.textMuted,
        texto: est === 'escalado' ? 'ESCALADO' : 'NO APLICA',
        icono: <FastForward size={15} />
      };
    } else if (est === 'rechazado') {
      config = {
        bg: 'rgba(239, 68, 68, 0.08)',
        border: 'rgba(239, 68, 68, 0.32)',
        color: '#dc2626',
        texto: 'RECHAZADO',
        icono: <XCircle size={15} />
      };
    }

    return (
      <div style={{
        height: '64px',
        padding: '10px',
        borderRadius: '11px',
        background: config.bg,
        border: `1.5px solid ${config.border}`,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        boxSizing: 'border-box'
      }}>
        <span style={{ fontSize: '11.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {nombreArea}
        </span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: config.color, fontSize: '13px', fontWeight: '800' }}>
          {config.icono}<span>{config.texto}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="mis-permisos-wrapper">
      <style>{generarEstilosPermisos(c, modoOscuro)}</style>
      <style>{`
        .mis-permisos-wrapper {
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
          padding: 22px 24px;
          box-sizing: border-box;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .tabs-mis-permisos {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: ${c.surfaceCard};
          padding: 4px;
          border-radius: 11px;
          border: 1.5px solid ${c.border};
          gap: 4px;
          min-width: 310px;
        }
        .tab-mp-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: 8px;
          border: none;
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .sellos-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .tarjeta-permiso-uniforme {
          width: 100%;
          min-height: 98px;
          background: ${c.surfaceCard};
          border: 1.5px solid ${c.border};
          border-radius: 15px;
          padding: 18px 22px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 12px;
          box-sizing: border-box;
          box-shadow: ${modoOscuro ? '0 4px 16px rgba(0,0,0,0.22)' : '0 2px 8px rgba(0,0,0,0.03)'};
        }
        .badge-folio-fijo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 92px;
          height: 28px;
          font-family: ui-monospace, monospace;
          font-size: 13px;
          font-weight: 800;
          color: ${c.text};
          background: ${c.bg};
          border: 1px solid ${c.border};
          border-radius: 6px;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .badge-tipo-fijo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 148px;
          height: 28px;
          font-size: 12px;
          font-weight: 800;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .badge-naturaleza-fijo {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          min-width: 96px;
          font-size: 13px;
          font-weight: 700;
        }
        .badge-dictamen-fijo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 114px;
          height: 28px;
          font-size: 12px;
          font-weight: 800;
          border-radius: 6px;
          text-transform: uppercase;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        @media (max-width: 680px) {
          .mis-permisos-wrapper {
            padding: 12px 12px 28px 12px;
          }
          .tabs-mis-permisos {
            width: 100%;
            min-width: 0;
          }
          .sellos-grid-3 {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .tarjeta-permiso-uniforme {
            padding: 16px;
          }
          .badge-naturaleza-fijo {
            justify-content: flex-start;
            min-width: auto;
          }
        }
      `}</style>

      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: c.text, margin: 0, letterSpacing: '-0.01em' }}>Mis Solicitudes de Pase</h2>
          <p style={{ fontSize: '13.5px', color: c.textMuted, margin: '4px 0 0 0', fontWeight: '500' }}>Seguimiento de firmas y archivo mensual de pases.</p>
        </div>

        <div className="tabs-mis-permisos">
          <button
            onClick={() => setPestaña('proceso')}
            className="tab-mp-btn"
            style={{
              background: pestaña === 'proceso' ? (modoOscuro ? '#334155' : '#0f172a') : 'transparent',
              color: pestaña === 'proceso' ? '#ffffff' : c.textMuted
            }}
          >
            <Clock size={15} /> En Proceso ({enProceso.length})
          </button>
          <button
            onClick={() => setPestaña('historial')}
            className="tab-mp-btn"
            style={{
              background: pestaña === 'historial' ? (modoOscuro ? '#334155' : '#0f172a') : 'transparent',
              color: pestaña === 'historial' ? '#ffffff' : c.textMuted
            }}
          >
            <FileText size={15} /> Concluidos ({finalizados.length})
          </button>
        </div>
      </div>

      {cargandoHistorial ? (
        <div style={{ padding: '40px', textAlign: 'center', color: c.textMuted, fontSize: '15px', fontWeight: '600' }}>
          Cargando solicitudes...
        </div>
      ) : pestaña === 'proceso' ? (
        enProceso.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 24px', background: c.surfaceCard, borderRadius: '16px', border: `1.5px dashed ${c.border}` }}>
            <Clock size={40} color={c.textMuted} style={{ marginBottom: '10px', opacity: 0.5 }} />
            <h4 style={{ margin: '0 0 6px 0', color: c.text, fontSize: '16.5px', fontWeight: '800' }}>Sin solicitudes en curso</h4>
            <p style={{ fontSize: '14px', color: c.textMuted, margin: 0 }}>Tus pases activos o en revisión aparecerán aquí.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            {enProceso.map(p => {
              const horasTranscurridas = (horaActual - new Date(p.created_at)) / (1000 * 60 * 60);
              const puedeEscalar = p.firma_1_estado === 'pendiente' && horasTranscurridas >= 1;
              const { horarioSolicitado, supervisorSubarea, notasFlujo } = parsearDatosObservaciones(p.observaciones);
              const { categoria, texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);
              const estilo = getEstiloTipo(p.tipo_permiso);
              const fechaTxt = p.fecha_fin && p.fecha_fin !== p.fecha_permiso
                ? `${formatearFechaCorta(p.fecha_permiso)} al ${formatearFechaCorta(p.fecha_fin)}`
                : formatearFechaCorta(p.fecha_permiso);

              return (
                <div
                  key={p.id}
                  className="tarjeta-permiso-uniforme"
                  style={{ borderLeft: `5px solid ${estilo.color}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span
                        className="badge-tipo-fijo"
                        style={{ color: estilo.color, background: estilo.bg, border: `1px solid ${estilo.border}` }}
                      >
                        {estilo.label}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14.5px', color: c.text, fontWeight: '700' }}>
                        <Calendar size={15} color={c.textMuted} />
                        {fechaTxt}
                      </span>
                      <span style={{ fontSize: '14px', color: c.textMuted, fontWeight: '600' }}>
                        • {horarioSolicitado}
                      </span>
                    </div>

                    {renderEtiquetaNaturaleza(categoria)}
                  </div>

                  <div style={{ fontSize: '14.5px', color: c.text, lineHeight: '1.5', background: c.bg, padding: '12px 16px', borderRadius: '11px', border: `1px solid ${c.border}` }}>
                    {motivoLimpio}
                    {supervisorSubarea && (
                      <div style={{ fontSize: '13.5px', color: c.textMuted, fontWeight: '700', marginTop: '8px' }}>
                        ✓ VoBo Subárea: <strong style={{ color: c.text }}>{supervisorSubarea}</strong>
                      </div>
                    )}
                    {notasFlujo && notasFlujo.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${c.border}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {notasFlujo.map((n, i) => (
                          <div key={i} style={{ fontSize: '13.5px', color: c.textMuted }}>
                            <strong style={{ color: c.text }}>💬 {n.autor}:</strong> {n.texto}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sellos-grid-3">
                    {renderSelloArea('Jefatura', p.firma_1_estado)}
                    {renderSelloArea('Gerencia', p.firma_2_estado)}
                    {renderSelloArea('R. Humanos', p.firma_3_estado)}
                  </div>

                  {puedeEscalar && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px', borderTop: `1px dashed ${c.border}`, paddingTop: '12px' }}>
                      <button
                        onClick={() => escalarPermiso(p)}
                        disabled={procesandoEscalamiento}
                        style={{
                          padding: '9px 16px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.35)',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706',
                          fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <AlertTriangle size={15} /> {procesandoEscalamiento ? 'Escalando...' : 'Escalar por inactividad'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* PESTAÑA CONCLUIDOS: AGRUPADA POR MES CON ANCHO Y ALTURA 100% UNIFORMES */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%' }}>
          {gruposPorMes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 24px', background: c.surfaceCard, borderRadius: '16px', border: `1.5px dashed ${c.border}` }}>
              <p style={{ fontSize: '14.5px', color: c.textMuted, margin: 0, fontWeight: '600' }}>No tienes historial de pases concluidos.</p>
            </div>
          ) : (
            gruposPorMes.map(grupo => {
              const contraido = Boolean(mesesContraidos[grupo.clave]);
              const autorizadosMes = grupo.items.filter(i => ['autorizado', 'aprobado', 'completado_caseta'].includes(i.estado_general)).length;
              const rechazadosMes = grupo.items.length - autorizadosMes;

              return (
                <div key={grupo.clave} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                  {/* CABECERA DEL MES (MISMO ANCHO 100% QUE LAS TARJETAS) */}
                  <button
                    type="button"
                    onClick={() => toggleMes(grupo.clave)}
                    style={{
                      width: '100%',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 20px',
                      borderRadius: '13px',
                      background: c.surfaceCard,
                      border: `1.5px solid ${c.border}`,
                      color: c.text,
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <Calendar size={17} color={c.textMuted} />
                      <span style={{ fontSize: '14.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {grupo.etiqueta}
                      </span>
                      <span style={{
                        fontSize: '12px', fontWeight: '700', color: c.textMuted,
                        background: c.bg, border: `1px solid ${c.border}`,
                        padding: '2px 10px', borderRadius: '999px'
                      }}>
                        {grupo.items.length} {grupo.items.length === 1 ? 'pase' : 'pases'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {autorizadosMes > 0 && (
                        <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#16a34a' }}>
                          {autorizadosMes} aut.
                        </span>
                      )}
                      {rechazadosMes > 0 && (
                        <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#dc2626' }}>
                          {rechazadosMes} rech.
                        </span>
                      )}
                      {contraido ? <ChevronDown size={18} color={c.textMuted} /> : <ChevronUp size={18} color={c.textMuted} />}
                    </div>
                  </button>

                  {/* LISTA DE TARJETAS DEL MES (SIN PADDING LATERAL PARA QUE MIDA IGUAL QUE LA BARRA SUPERIOR) */}
                  {!contraido && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                      {grupo.items.map(p => {
                        const esAutorizado = ['autorizado', 'aprobado', 'completado_caseta'].includes(p.estado_general);
                        const pagoLower = (p.pago || '').toLowerCase();
                        const seRegreso = pagoLower.includes('regresa');
                        const esSinGoce = pagoLower.includes('sin goce');
                        const { horarioSolicitado, horaSalidaCaseta, horaEntradaCaseta, horaRegresadoCaseta, motivoRechazo, notasFlujo } = parsearDatosObservaciones(p.observaciones);
                        const { categoria, texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);
                        const estilo = getEstiloTipo(p.tipo_permiso);
                        const fechaTxt = p.fecha_fin && p.fecha_fin !== p.fecha_permiso
                          ? `${formatearFechaCorta(p.fecha_permiso)} al ${formatearFechaCorta(p.fecha_fin)}`
                          : formatearFechaCorta(p.fecha_permiso);

                        let colorDictamen = '#16a34a';
                        let bgDictamen = 'rgba(22, 163, 74, 0.1)';
                        let borderDictamen = 'rgba(22, 163, 74, 0.3)';
                        if (!esAutorizado) {
                          colorDictamen = '#dc2626';
                          bgDictamen = 'rgba(239, 68, 68, 0.1)';
                          borderDictamen = 'rgba(239, 68, 68, 0.3)';
                        } else if (seRegreso || esSinGoce) {
                          colorDictamen = '#d97706';
                          bgDictamen = 'rgba(245, 158, 11, 0.12)';
                          borderDictamen = 'rgba(245, 158, 11, 0.32)';
                        }

                        const tieneRegistroCaseta = Boolean(horaSalidaCaseta || horaEntradaCaseta || horaRegresadoCaseta);

                        return (
                          <div
                            key={p.id}
                            className="tarjeta-permiso-uniforme"
                            style={{ borderLeft: `5px solid ${estilo.color}` }}
                          >
                            {/* FILA 1: COLUMNAS DE ANCHO FIJO PARA ALINEACIÓN VERTICAL PERFECTA */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span className="badge-folio-fijo">
                                  {(esAutorizado && p.folio && !p.folio.startsWith('REQ-') && !p.folio.startsWith('CAS-')) ? p.folio : 'SIN FOLIO'}
                                </span>

                                <span
                                  className="badge-tipo-fijo"
                                  style={{ color: estilo.color, background: estilo.bg, border: `1px solid ${estilo.border}` }}
                                >
                                  {estilo.label}
                                </span>

                                <span style={{ fontSize: '14px', color: c.text, fontWeight: '700' }}>
                                  {fechaTxt}
                                </span>
                                <span style={{ fontSize: '13.5px', color: c.textMuted, fontWeight: '600' }}>
                                  • {horarioSolicitado}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                {renderEtiquetaNaturaleza(categoria)}
                                <span
                                  className="badge-dictamen-fijo"
                                  style={{ color: colorDictamen, background: bgDictamen, border: `1px solid ${borderDictamen}` }}
                                >
                                  {esAutorizado ? (p.pago || 'AUTORIZADO') : 'RECHAZADO'}
                                </span>
                              </div>
                            </div>

                            {/* FILA 2: MOTIVO A LA IZQUIERDA Y SELLO DE CASETA INTEGRADO A LA DERECHA (MISMA ALTURA DE TARJETA) */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: '14.5px', color: c.text, lineHeight: '1.4', flex: 1, minWidth: '200px' }}>
                                {motivoLimpio}
                              </div>

                              {tieneRegistroCaseta && (
                                <div style={{
                                  height: '28px',
                                  padding: '0 12px',
                                  borderRadius: '6px',
                                  fontSize: '12.5px',
                                  fontWeight: '700',
                                  color: seRegreso ? '#d97706' : c.textMuted,
                                  background: seRegreso ? 'rgba(245,158,11,0.1)' : c.bg,
                                  border: `1px solid ${seRegreso ? 'rgba(245,158,11,0.3)' : c.border}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  flexShrink: 0,
                                  boxSizing: 'border-box'
                                }}>
                                  {horaSalidaCaseta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><DoorOpen size={13.5} /> Salida: <strong style={{ color: c.text }}>{horaSalidaCaseta}</strong></span>}
                                  {horaEntradaCaseta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><DoorOpen size={13.5} /> Entrada: <strong style={{ color: c.text }}>{horaEntradaCaseta}</strong></span>}
                                  {horaRegresadoCaseta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><CornerUpLeft size={13.5} /> Regresado: <strong>{horaRegresadoCaseta}</strong></span>}
                                </div>
                              )}
                            </div>

                            {notasFlujo && notasFlujo.length > 0 && (
                              <div style={{
                                fontSize: '13px', color: c.textMuted, background: c.bg,
                                padding: '8px 12px', borderRadius: '8px', border: `1px solid ${c.border}`,
                                display: 'flex', flexDirection: 'column', gap: '3px'
                              }}>
                                {notasFlujo.map((n, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <MessageSquare size={13.5} color={c.textMuted} />
                                    <span><strong style={{ color: c.text }}>Nota {n.autor}:</strong> {n.texto}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {!esAutorizado && motivoRechazo && (
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', padding: '7px 12px', borderRadius: '8px' }}>
                                Motivo de rechazo: {motivoRechazo}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
