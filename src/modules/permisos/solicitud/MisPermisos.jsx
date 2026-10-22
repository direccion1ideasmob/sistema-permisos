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
  const [tarjetasExpandidas, setTarjetasExpandidas] = useState({});

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
      const inicial = {};
      (data || []).forEach(p => {
        if (p.estado_general === 'en_firmas') inicial[p.id] = true;
      });
      setTarjetasExpandidas(inicial);
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
    if (t === 'salida') return { color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.09)', border: 'rgba(14, 165, 233, 0.28)', label: 'SALIDA' };
    return { color: c.text, bg: c.surface, border: c.border, label: (tipoRaw || 'PERMISO').toUpperCase() };
  };

  const formatearFechaCorta = (fechaStr = '') => {
    if (!fechaStr) return '';
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const partes = fechaStr.split('-');
    if (partes.length !== 3) return fechaStr;
    return `${String(parseInt(partes[2], 10)).padStart(2, '0')} ${meses[parseInt(partes[1], 10) - 1] || partes[1]} ${partes[0]}`;
  };

  const acortarHorario = (txt = '') => {
    return String(txt || '')
      .replace(/^Llegada estimada:\s*/i, 'Llegada: ')
      .replace(/^Salida definitiva:\s*/i, 'Salida: ')
      .replace(/^Para el:\s*.*$/i, 'Día completo');
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

  const toggleTarjeta = (id) => {
    setTarjetasExpandidas(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderEtiquetaNaturaleza = (cat = '', extraClass = '') => {
    if (!cat) return null;
    const low = cat.toLowerCase();
    let Icono = User;
    if (low.includes('cita') || low.includes('médic')) Icono = Stethoscope;
    else if (low.includes('trabajo')) Icono = Briefcase;
    else if (low.includes('vacaciones')) Icono = Calendar;

    return (
      <span className={`mp-naturaleza-tag ${extraClass}`} style={{ color: c.textMuted }}>
        <Icono size={13.5} color={c.textMuted} strokeWidth={2} style={{ flexShrink: 0 }} />
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
      icono: <Clock size={14} />
    };

    if (['autorizado', 'auto_aprobado', 'aprobado'].includes(est)) {
      config = {
        bg: 'rgba(34, 197, 94, 0.08)',
        border: 'rgba(34, 197, 94, 0.32)',
        color: '#16a34a',
        texto: 'APROBADO',
        icono: <ShieldCheck size={14} />
      };
    } else if (['escalado', 'omitido'].includes(est)) {
      config = {
        bg: 'rgba(100, 116, 139, 0.08)',
        border: c.border,
        color: c.textMuted,
        texto: est === 'escalado' ? 'ESCALADO' : 'NO APLICA',
        icono: <FastForward size={14} />
      };
    } else if (est === 'rechazado') {
      config = {
        bg: 'rgba(239, 68, 68, 0.08)',
        border: 'rgba(239, 68, 68, 0.32)',
        color: '#dc2626',
        texto: 'RECHAZADO',
        icono: <XCircle size={14} />
      };
    }

    return (
      <div className="mp-sello-box" style={{ background: config.bg, border: `1.5px solid ${config.border}` }}>
        <span className="mp-sello-area" style={{ color: c.textMuted }}>
          {nombreArea}
        </span>
        <div className="mp-sello-status" style={{ color: config.color }}>
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
        .mp-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 14px;
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
          box-sizing: border-box;
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
        .mp-mes-btn {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          border-radius: 12px;
          background: ${c.surfaceCard};
          border: 1.5px solid ${c.border};
          color: ${c.text};
          cursor: pointer;
          text-align: left;
          box-sizing: border-box;
          gap: 12px;
        }
        .tarjeta-permiso-uniforme {
          width: 100%;
          background: ${c.surfaceCard};
          border: 1.5px solid ${c.border};
          border-radius: 14px;
          overflow: hidden;
          box-sizing: border-box;
          transition: all 0.18s ease;
          box-shadow: ${modoOscuro ? '0 4px 16px rgba(0,0,0,0.22)' : '0 2px 8px rgba(0,0,0,0.03)'};
        }

        /* =========================================================
           ESCRITORIO / LAPTOP 14": 1 FILA CON COLUMNAS FIJAS
           ========================================================= */
        .mp-card-summary {
          width: 100%;
          min-height: 64px;
          padding: 14px 20px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
          box-sizing: border-box;
        }
        .mp-row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
        }
        .mp-left-group {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .mp-datetime-desktop {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          margin-left: 4px;
        }
        .mp-right-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .mp-row-bottom-mobile {
          display: none;
        }
        .mp-only-mobile {
          display: none !important;
        }

        .mp-card-body {
          padding: 0 20px 18px 20px;
          border-top: 1px dashed ${c.border};
          padding-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mp-pill-folio {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 88px;
          height: 28px;
          font-family: ui-monospace, monospace;
          font-size: 12.5px;
          font-weight: 800;
          color: ${c.text};
          background: ${c.bg};
          border: 1px solid ${c.border};
          border-radius: 6px;
          box-sizing: border-box;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .mp-pill-tipo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 96px;
          height: 28px;
          font-size: 11.5px;
          font-weight: 800;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          box-sizing: border-box;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .mp-naturaleza-tag {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 5px;
          min-width: 90px;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }
        .mp-pill-dictamen {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 110px;
          height: 28px;
          font-size: 11.5px;
          font-weight: 800;
          border-radius: 6px;
          text-transform: uppercase;
          box-sizing: border-box;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .sellos-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .mp-sello-box {
          height: 60px;
          padding: 8px 10px;
          border-radius: 10px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          box-sizing: border-box;
        }
        .mp-sello-area {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .mp-sello-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12.5px;
          font-weight: 800;
        }

        /* =========================================================
           VISTA MÓVIL (MAX-WIDTH: 680PX) — SIN CHOQUES NI TRUNCADOS
           ========================================================= */
        @media (max-width: 680px) {
          .mis-permisos-wrapper {
            padding: 12px 12px 28px 12px;
          }
          .mp-header-bar {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
            margin-bottom: 16px;
          }
          .tabs-mis-permisos {
            width: 100%;
            min-width: 0;
          }
          .tab-mp-btn {
            font-size: 13px;
            padding: 0 10px;
          }
          .mp-mes-btn {
            padding: 10px 14px;
            min-height: 44px;
          }
          .mp-card-summary {
            padding: 12px 14px;
            gap: 8px;
          }
          .mp-datetime-desktop,
          .mp-hide-mobile {
            display: none !important;
          }
          .mp-only-mobile {
            display: inline-flex !important;
          }
          .mp-row-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            width: 100%;
          }
          .mp-left-group {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
          }
          .mp-right-group {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
          }
          /* Píldoras proporcionales en celular (jamás chocan entre sí) */
          .mp-pill-folio {
            width: auto !important;
            min-width: 0 !important;
            height: 24px;
            padding: 0 7px;
            font-size: 11px;
          }
          .mp-pill-tipo {
            width: auto !important;
            min-width: 68px !important;
            height: 24px;
            padding: 0 8px;
            font-size: 10.5px;
          }
          .mp-pill-dictamen {
            width: auto !important;
            min-width: 82px !important;
            height: 24px;
            padding: 0 8px;
            font-size: 10.5px;
          }
          /* Renglón 2 completo para que Fecha y Hora nunca se corten con "..." */
          .mp-row-bottom-mobile {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            font-size: 13px;
            line-height: 1.3;
          }
          .mp-naturaleza-tag {
            min-width: 0;
            font-size: 12px;
            justify-content: flex-start;
          }
          .mp-card-body {
            padding: 12px 14px 14px 14px;
          }
          .sellos-grid-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
          .mp-sello-box {
            height: 52px;
            padding: 6px 4px;
          }
          .mp-sello-area {
            font-size: 9.5px;
          }
          .mp-sello-status {
            font-size: 10.5px;
            gap: 3px;
          }
        }
      `}</style>

      {/* CABECERA */}
      <div className="mp-header-bar">
        <div>
          <h2 style={{ fontSize: '21px', fontWeight: '800', color: c.text, margin: 0, letterSpacing: '-0.01em' }}>
            Mis Solicitudes de Pase
          </h2>
          <p style={{ fontSize: '13px', color: c.textMuted, margin: '3px 0 0 0', fontWeight: '500' }}>
            Toca cualquier solicitud para ver u ocultar su detalle.
          </p>
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
            <Clock size={14} /> En Proceso ({enProceso.length})
          </button>
          <button
            onClick={() => setPestaña('historial')}
            className="tab-mp-btn"
            style={{
              background: pestaña === 'historial' ? (modoOscuro ? '#334155' : '#0f172a') : 'transparent',
              color: pestaña === 'historial' ? '#ffffff' : c.textMuted
            }}
          >
            <FileText size={14} /> Concluidos ({finalizados.length})
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {enProceso.map(p => {
              const expandida = Boolean(tarjetasExpandidas[p.id]);
              const horasTranscurridas = (horaActual - new Date(p.created_at)) / (1000 * 60 * 60);
              const puedeEscalar = p.firma_1_estado === 'pendiente' && horasTranscurridas >= 1;
              const { horarioSolicitado, horaSalidaCaseta, horaEntradaCaseta, horaRegresadoCaseta, supervisorSubarea, notasFlujo } = parsearDatosObservaciones(p.observaciones);
              const seRegresaProceso = (p.pago || '').toLowerCase().includes('regresa') || Boolean(horaRegresadoCaseta);
              const { categoria, texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);
              const estilo = getEstiloTipo(p.tipo_permiso);
              const fechaTxt = p.fecha_fin && p.fecha_fin !== p.fecha_permiso
                ? `${formatearFechaCorta(p.fecha_permiso)} al ${formatearFechaCorta(p.fecha_fin)}`
                : formatearFechaCorta(p.fecha_permiso);
              const horarioCorto = acortarHorario(horarioSolicitado);

              return (
                <div
                  key={p.id}
                  className="tarjeta-permiso-uniforme"
                  style={{ borderLeft: `5px solid ${estilo.color}` }}
                >
                  <div className="mp-card-summary" onClick={() => toggleTarjeta(p.id)}>
                    <div className="mp-row-top">
                      <div className="mp-left-group">
                        <span
                          className="mp-pill-tipo"
                          style={{ color: estilo.color, background: estilo.bg, border: `1px solid ${estilo.border}` }}
                        >
                          {estilo.label}
                        </span>

                        <div className="mp-datetime-desktop">
                          <span style={{ fontSize: '14px', color: c.text, fontWeight: '700' }}>
                            {fechaTxt}
                          </span>
                          <span style={{ fontSize: '13.5px', color: c.textMuted, fontWeight: '600' }}>
                            • {horarioCorto}
                          </span>
                        </div>
                      </div>

                      <div className="mp-right-group">
                        {seRegresaProceso && (
                          <span style={{
                            fontSize: '10.5px', fontWeight: '800', padding: '2px 7px', borderRadius: '5px',
                            background: 'rgba(245, 158, 11, 0.14)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.32)'
                          }}>
                            ↩️ SE REGRESA
                          </span>
                        )}
                        {renderEtiquetaNaturaleza(categoria)}
                        {expandida ? <ChevronUp size={18} color={c.textMuted} /> : <ChevronDown size={18} color={c.textMuted} />}
                      </div>
                    </div>

                    <div className="mp-row-bottom-mobile">
                      <span style={{ fontWeight: '700', color: c.text }}>
                        {fechaTxt} <span style={{ color: c.textMuted, fontWeight: '600' }}>• {horarioCorto}</span>
                      </span>
                    </div>
                  </div>

                  {expandida && (
                    <div className="mp-card-body">
                      <div style={{ fontSize: '14px', color: c.text, lineHeight: '1.45', background: c.bg, padding: '11px 14px', borderRadius: '10px', border: `1px solid ${c.border}` }}>
                        {motivoLimpio}
                        {supervisorSubarea && (
                          <div style={{ fontSize: '13px', color: c.textMuted, fontWeight: '700', marginTop: '6px' }}>
                            ✓ VoBo Subárea: <strong style={{ color: c.text }}>{supervisorSubarea}</strong>
                          </div>
                        )}
                        {notasFlujo && notasFlujo.length > 0 && (
                          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px dashed ${c.border}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {notasFlujo.map((n, i) => (
                              <div key={i} style={{ fontSize: '13px', color: c.textMuted }}>
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
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px', borderTop: `1px dashed ${c.border}`, paddingTop: '10px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); escalarPermiso(p); }}
                            disabled={procesandoEscalamiento}
                            style={{
                              padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.35)',
                              backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706',
                              fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                          >
                            <AlertTriangle size={14} /> {procesandoEscalamiento ? 'Escalando...' : 'Escalar por inactividad'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* PESTAÑA CONCLUIDOS */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
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
                <div key={grupo.clave} style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                  {/* CABECERA DEL MES */}
                  <button
                    type="button"
                    onClick={() => toggleMes(grupo.clave)}
                    className="mp-mes-btn"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <Calendar size={16} color={c.textMuted} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                        {grupo.etiqueta}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '11.5px', fontWeight: '700', color: c.textMuted,
                        background: c.bg, border: `1px solid ${c.border}`,
                        padding: '2px 10px', borderRadius: '999px'
                      }}>
                        {grupo.items.length} {grupo.items.length === 1 ? 'pase' : 'pases'}
                      </span>
                      <span className="mp-hide-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {autorizadosMes > 0 && (
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>
                            {autorizadosMes} aut.
                          </span>
                        )}
                        {rechazadosMes > 0 && (
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626' }}>
                            {rechazadosMes} rech.
                          </span>
                        )}
                      </span>
                      {contraido ? <ChevronDown size={18} color={c.textMuted} /> : <ChevronUp size={18} color={c.textMuted} />}
                    </div>
                  </button>

                  {!contraido && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                      {grupo.items.map(p => {
                        const expandida = Boolean(tarjetasExpandidas[p.id]);
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
                        const horarioCorto = acortarHorario(horarioSolicitado);

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
                        const folioLimpio = (esAutorizado && p.folio && !p.folio.startsWith('REQ-') && !p.folio.startsWith('CAS-')) ? p.folio : 'SIN FOLIO';

                        return (
                          <div
                            key={p.id}
                            className="tarjeta-permiso-uniforme"
                            style={{ borderLeft: `5px solid ${estilo.color}` }}
                          >
                            <div className="mp-card-summary" onClick={() => toggleTarjeta(p.id)}>
                              {/* FILA 1: IZQUIERDA (FOLIO + TIPO) <---> DERECHA (DICTAMEN + FLECHA) */}
                              <div className="mp-row-top">
                                <div className="mp-left-group">
                                  <span className="mp-pill-folio">
                                    {folioLimpio}
                                  </span>

                                  <span
                                    className="mp-pill-tipo"
                                    style={{ color: estilo.color, background: estilo.bg, border: `1px solid ${estilo.border}` }}
                                  >
                                    {estilo.label}
                                  </span>

                                  <div className="mp-datetime-desktop">
                                    <span style={{ fontSize: '13.5px', color: c.text, fontWeight: '700' }}>
                                      {fechaTxt}
                                    </span>
                                    <span style={{ fontSize: '13px', color: c.textMuted, fontWeight: '600' }}>
                                      • {horarioCorto}
                                    </span>
                                  </div>
                                </div>

                                <div className="mp-right-group">
                                  {renderEtiquetaNaturaleza(categoria, 'mp-hide-mobile')}
                                  <span
                                    className="mp-pill-dictamen"
                                    style={{ color: colorDictamen, background: bgDictamen, border: `1px solid ${borderDictamen}` }}
                                  >
                                    {esAutorizado ? (p.pago || 'AUTORIZADO') : 'RECHAZADO'}
                                  </span>
                                  {expandida ? <ChevronUp size={18} color={c.textMuted} /> : <ChevronDown size={18} color={c.textMuted} />}
                                </div>
                              </div>

                              {/* FILA 2 EN MÓVIL: FECHA Y HORARIO COMPLETOS SIN CORTARSE */}
                              <div className="mp-row-bottom-mobile">
                                <span style={{ fontWeight: '700', color: c.text }}>
                                  {fechaTxt} <span style={{ color: c.textMuted, fontWeight: '600' }}>• {horarioCorto}</span>
                                </span>
                              </div>
                            </div>

                            {expandida && (
                              <div className="mp-card-body">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                                  <div style={{ fontSize: '14px', color: c.text, lineHeight: '1.45', flex: 1, minWidth: '180px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                      <strong style={{ color: c.textMuted, fontSize: '11.5px', textTransform: 'uppercase' }}>
                                        Motivo / Justificación:
                                      </strong>
                                      {renderEtiquetaNaturaleza(categoria, 'mp-only-mobile')}
                                    </div>
                                    {motivoLimpio}
                                  </div>

                                  {tieneRegistroCaseta && (
                                    <div style={{
                                      padding: '6px 12px',
                                      borderRadius: '8px',
                                      fontSize: '12.5px',
                                      fontWeight: '700',
                                      color: seRegreso ? '#d97706' : c.textMuted,
                                      background: seRegreso ? 'rgba(245,158,11,0.1)' : c.bg,
                                      border: `1px solid ${seRegreso ? 'rgba(245,158,11,0.3)' : c.border}`,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '12px',
                                      flexWrap: 'wrap'
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
