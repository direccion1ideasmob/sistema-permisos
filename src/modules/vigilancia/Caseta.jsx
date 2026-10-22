import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../permisos/aprobacionesStyles';
import {
  obtenerDatosCaseta,
  registrarCheckCaseta,
  registrarRetardoEnPuerta,
  registrarAsistenciaLista,
  obtenerFechaLocalHoy
} from './services/vigilanciaService';
import {
  DoorOpen, RotateCcw, CheckCircle2, LogOut, LogIn,
  Search, Calendar, RefreshCw, UserCheck,
  Hourglass, MapPin, CornerUpLeft, X, ShieldCheck, Send
} from 'lucide-react';
import BuscadorPersonal from './BuscadorPersonal';

export default function Caseta() {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const rutaActual = location.pathname;
  const vista = rutaActual.includes('/asistencia')
    ? 'asistencia'
    : rutaActual.includes('/retardo')
    ? 'retardo'
    : 'pases';

  const [modoOscuro, setModoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  useEffect(() => {
    const syncTema = () => setModoOscuro(localStorage.getItem('tema_sistema') === 'oscuro');
    window.addEventListener('storage', syncTema);
    const timer = setInterval(syncTema, 800);
    return () => {
      window.removeEventListener('storage', syncTema);
      clearInterval(timer);
    };
  }, []);

  const c = obtenerTemaAprobaciones(modoOscuro);

  const [subTabPases, setSubTabPases] = useState('por_cruzar');

  const [retenidosEnEspera, setRetenidosEnEspera] = useState([]);
  const [pasesPorCruzar, setPasesPorCruzar] = useState([]);
  const [personalFuera, setPersonalFuera] = useState([]);
  const [crucesCompletadosHoy, setCrucesCompletadosHoy] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});
  const [mapaIncidenciasHoy, setMapaIncidenciasHoy] = useState({});

  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [mostrarBuscadorMovil, setMostrarBuscadorMovil] = useState(false);
  const [fechaAsistencia, setFechaAsistencia] = useState(obtenerFechaLocalHoy());
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');

  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  const sedeGuardia = usuario?.sede_id || null;
  const esSoloGuardia = usuario?.rol === 'caseta';
  const hoyStr = obtenerFechaLocalHoy();
  const esFechaHoy = fechaAsistencia === hoyStr;

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const fechaTarget = esSoloGuardia ? hoyStr : fechaAsistencia;
      const data = await obtenerDatosCaseta(sedeGuardia, fechaTarget);
      setRetenidosEnEspera(data.retenidosEnEspera || []);
      setPasesPorCruzar(data.pasesPorCruzar || []);
      setPersonalFuera(data.personalFuera || []);
      setCrucesCompletadosHoy(data.crucesCompletadosHoy || []);
      setEmpleadosSede(data.empleadosSede || []);
      setMapaAsistencias(data.mapaAsistencias || {});
      setMapaIncidenciasHoy(data.mapaIncidenciasHoy || {});
    } catch (err) {
      console.error('Error cargando datos de vigilancia:', err);
    } finally {
      setCargando(false);
    }
  }, [sedeGuardia, fechaAsistencia, esSoloGuardia, hoyStr]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 10000);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const handleSellarPase = async (id, tipoMovimiento) => {
    setProcesandoId(id);
    try {
      await registrarCheckCaseta(id, tipoMovimiento);
      await cargarDatos();
    } catch (err) {
      alert('Error al sellar cruce: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleMarcarAsistencia = async (empleadoId, tipoMarca) => {
    setProcesandoId(`${empleadoId}-${tipoMarca}`);
    try {
      await registrarAsistenciaLista(empleadoId, tipoMarca, usuario?.id || null);
      await cargarDatos();
    } catch (err) {
      alert('Error al registrar asistencia: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleGenerarRetardo = async () => {
    if (!empleadoSeleccionado) return;
    setProcesandoId('nuevo-retardo');
    try {
      await registrarRetardoEnPuerta(empleadoSeleccionado);
      setEmpleadoSeleccionado('');
      await cargarDatos();
      alert('✅ Solicitud enviada al Jefe de Área. El colaborador queda en la lista de Espera en Puerta hasta recibir instrucción.');
      navigate('/caseta');
      setSubTabPases('por_cruzar');
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const AvatarColaborador = ({ u, size = 40 }) => {
    const url = u?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.nombre_completo || 'C')}&background=16a34a&color=fff&bold=true`;
    return (
      <img
        src={url}
        alt=""
        style={{
          width: `${size}px`, height: `${size}px`, borderRadius: '9px',
          objectFit: 'cover', border: `1px solid ${c.border}`, flexShrink: 0
        }}
      />
    );
  };

  const estilosComunesCaseta = `
    .caseta-wrap {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .caseta-tabs-bar {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      height: 42px;
      padding: 4px !important;
      box-sizing: border-box;
    }
    .caseta-tabs-bar .tab-btn {
      padding: 0 8px !important;
      font-size: 13px !important;
      gap: 6px !important;
      min-width: 0 !important;
    }
    .caseta-card {
      background: ${c.surfaceCard};
      border: 1.5px solid ${c.border};
      border-radius: 13px;
      padding: 12px 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-sizing: border-box;
      width: 100%;
    }
    .caseta-card-left {
      display: flex;
      align-items: center;
      gap: 11px;
      min-width: 0;
      flex: 1;
    }
    .caseta-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .caseta-btn-action {
      height: 38px;
      padding: 0 15px;
      border-radius: 9px;
      border: none;
      font-size: 12.5px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
    }
    @media (max-width: 768px) {
      .caseta-wrap {
        padding-top: 42px;
        gap: 10px;
      }
      .caseta-tabs-bar {
        height: 38px;
        border-radius: 10px !important;
      }
      .caseta-tabs-bar .tab-btn {
        font-size: 11.5px !important;
        padding: 0 4px !important;
        gap: 4px !important;
      }
      .caseta-tabs-bar .tab-btn svg {
        display: none !important;
      }
      .caseta-card {
        flex-direction: column;
        align-items: stretch;
        padding: 11px 12px;
        gap: 9px;
      }
      .caseta-card-actions {
        width: 100%;
        justify-content: stretch;
      }
      .caseta-btn-action {
        width: 100%;
        height: 36px;
      }
    }
  `;

  // ====================================================================
  // MÓDULO 1 DEL SIDEBAR: PASES DE PUERTA (/caseta) - SIN RELOJES NI HORAS
  // ====================================================================
  if (vista === 'pases') {
    const totalPorCruzarYEspera = pasesPorCruzar.length + retenidosEnEspera.length;

    return (
      <div className="caseta-wrap">
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
        <style>{estilosComunesCaseta}</style>

        <div className="tabs-aprobacion-bar caseta-tabs-bar">
          <button
            className={`tab-btn ${subTabPases === 'por_cruzar' ? 'active' : ''}`}
            onClick={() => setSubTabPases('por_cruzar')}
          >
            <DoorOpen size={15} />
            <span>En Puerta</span>
            {totalPorCruzarYEspera > 0 && (
              <span className="tab-badge" style={{ background: c.accent, color: '#fff', fontSize: '11px', padding: '1px 6px' }}>
                {totalPorCruzarYEspera}
              </span>
            )}
          </button>

          <button
            className={`tab-btn ${subTabPases === 'reingresos' ? 'active' : ''}`}
            onClick={() => setSubTabPases('reingresos')}
          >
            <RotateCcw size={15} />
            <span>Por Regresar</span>
            {personalFuera.length > 0 && (
              <span className="tab-badge" style={{ background: '#2563eb', color: '#fff', fontSize: '11px', padding: '1px 6px' }}>
                {personalFuera.length}
              </span>
            )}
          </button>

          <button
            className={`tab-btn ${subTabPases === 'sellados' ? 'active' : ''}`}
            onClick={() => setSubTabPases('sellados')}
          >
            <CheckCircle2 size={15} />
            <span>Sellados ({crucesCompletadosHoy.length})</span>
          </button>
        </div>

        {/* SUB-PESTAÑA 1: EN PUERTA (RETENIDOS EN ESPERA + LISTOS PARA ACCIÓN) */}
        {subTabPases === 'por_cruzar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>

            {/* BLOQUE A: RETENIDOS EN PUERTA ESPERANDO RESPUESTA DEL JEFE */}
            {retenidosEnEspera.length > 0 && (
              <div style={{
                background: c.surfaceCard,
                border: '1.5px solid #f59e0b',
                borderRadius: '13px',
                overflow: 'hidden'
              }}>
                <div style={{
                  padding: '9px 13px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  borderBottom: '1px solid rgba(245, 158, 11, 0.28)',
                  fontSize: '12px',
                  fontWeight: '800',
                  color: '#d97706',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Hourglass size={13} /> EN ESPERA DE INSTRUCCIÓN DE JEFATURA (NO DAR ACCESO AÚN)
                  </span>
                  <span>{retenidosEnEspera.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {retenidosEnEspera.map((p, idx) => (
                    <div
                      key={p.id}
                      className="caseta-card"
                      style={{
                        border: 'none',
                        borderRadius: 0,
                        borderBottom: idx < retenidosEnEspera.length - 1 ? `1px solid ${c.border}` : 'none'
                      }}
                    >
                      <div className="caseta-card-left">
                        <AvatarColaborador u={p.usuarios} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: c.text, lineHeight: 1.2 }}>
                            {p.usuarios?.nombre_completo}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px', fontSize: '11.5px', fontWeight: '700' }}>
                            <span style={{ color: '#d97706', background: 'rgba(245,158,11,0.14)', padding: '1.5px 6px', borderRadius: '4px' }}>
                              ⏳ Esperando a: {p.esperandoFirmaDe}
                            </span>
                            <span style={{ color: c.textMuted, fontFamily: 'ui-monospace, monospace' }}>
                              #{p.usuarios?.numero_empleado}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="caseta-card-actions">
                        {p.horaLlegadaPuerta ? (
                          <span style={{
                            fontSize: '11.5px', fontWeight: '800', color: '#16a34a',
                            background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)',
                            padding: '6px 10px', borderRadius: '8px', width: '100%', textAlign: 'center',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                          }}>
                            <CheckCircle2 size={13} /> Presencia registrada
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSellarPase(p.id, 'congelar_llegada')}
                            disabled={procesandoId === p.id}
                            className="caseta-btn-action"
                            style={{ background: '#f59e0b', color: '#fff' }}
                          >
                            <MapPin size={14} />
                            {procesandoId === p.id ? 'Registrando...' : 'Confirmar Presencia en Puerta'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BLOQUE B: PASES CON INSTRUCCIÓN LISTA PARA CASETA (SIN MOSTRAR HORAS) */}
            {pasesPorCruzar.length === 0 && retenidosEnEspera.length === 0 ? (
              <div style={{
                background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
                padding: '36px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
              }}>
                No hay pases pendientes en puerta en este momento.
              </div>
            ) : (
              pasesPorCruzar.map((p) => {
                const esSalida = p.tipo_permiso === 'salida';
                const esRegresoCasa = Boolean(p.seRegresaACasa);

                const colorBorde = esRegresoCasa ? '#ef4444' : (esSalida ? '#0284c7' : '#16a34a');
                const bgBadge = esRegresoCasa ? 'rgba(239,68,68,0.14)' : (esSalida ? 'rgba(2,132,199,0.12)' : 'rgba(22,163,74,0.12)');
                const textoBadge = esRegresoCasa
                  ? (p.esRechazado ? '🚫 ACCESO DENEGADO • SE REGRESA' : '🚫 SE REGRESA A CASA • SIN ACCESO')
                  : (esSalida ? (p.requiereRegreso ? '🔵 SALIDA (CON REGRESO)' : '🔵 SALIDA DEFINITIVA') : '🟢 ENTRADA AUTORIZADA');

                return (
                  <div
                    key={p.id}
                    className="caseta-card"
                    style={{
                      borderLeft: `5px solid ${colorBorde}`,
                      background: esRegresoCasa ? (modoOscuro ? 'rgba(239,68,68,0.08)' : '#fef2f2') : c.surfaceCard
                    }}
                  >
                    <div className="caseta-card-left">
                      <AvatarColaborador u={p.usuarios} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: '800', padding: '2px 7px', borderRadius: '5px',
                            background: bgBadge, color: colorBorde, textTransform: 'uppercase', letterSpacing: '0.02em'
                          }}>
                            {textoBadge}
                          </span>
                          <span style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace', fontWeight: '700', color: c.textMuted }}>
                            #{p.usuarios?.numero_empleado}
                          </span>
                        </div>

                        <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text, lineHeight: 1.2 }}>
                          {p.usuarios?.nombre_completo}
                        </div>

                        {p.autorizadoPor && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px', fontSize: '11.5px', color: c.textMuted, fontWeight: '600' }}>
                            <ShieldCheck size={12} color={colorBorde} />
                            <span>Instrucción de: <strong style={{ color: c.text }}>{p.autorizadoPor}</strong></span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="caseta-card-actions">
                      <button
                        onClick={() => handleSellarPase(p.id, esRegresoCasa ? 'retiro' : (esSalida ? 'salida' : 'entrada'))}
                        disabled={procesandoId === p.id}
                        className="caseta-btn-action"
                        style={{
                          background: colorBorde,
                          color: '#fff'
                        }}
                      >
                        {esRegresoCasa ? <CornerUpLeft size={15} /> : (esSalida ? <LogOut size={15} /> : <LogIn size={15} />)}
                        {procesandoId === p.id
                          ? 'Confirmando...'
                          : (esRegresoCasa ? 'Confirmar Retiro a Casa' : (esSalida ? 'Confirmar Salida' : 'Confirmar Entrada'))}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* SUB-PESTAÑA 2: PERSONAL FUERA PENDIENTE DE REINGRESAR (SIN HORAS) */}
        {subTabPases === 'reingresos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {personalFuera.length === 0 ? (
              <div style={{
                background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
                padding: '36px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
              }}>
                No hay personal fuera de planta pendiente de reingreso.
              </div>
            ) : (
              personalFuera.map((p) => (
                <div key={p.id} className="caseta-card" style={{ borderLeft: '5px solid #2563eb' }}>
                  <div className="caseta-card-left">
                    <AvatarColaborador u={p.usuarios} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text }}>
                        {p.usuarios?.nombre_completo}
                      </div>
                      <div style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '700', marginTop: '2px' }}>
                        #{p.usuarios?.numero_empleado} • Fuera de planta (Pendiente de reingreso)
                      </div>
                    </div>
                  </div>

                  <div className="caseta-card-actions">
                    <button
                      onClick={() => handleSellarPase(p.id, 'reingreso')}
                      disabled={procesandoId === p.id}
                      className="caseta-btn-action"
                      style={{ background: '#2563eb', color: '#fff' }}
                    >
                      <LogIn size={15} />
                      {procesandoId === p.id ? 'Confirmando...' : 'Confirmar Reingreso'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SUB-PESTAÑA 3: BITÁCORA DE SELLADOS HOY (SIN HORAS) */}
        {subTabPases === 'sellados' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {crucesCompletadosHoy.length === 0 ? (
              <div style={{
                background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
                padding: '36px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
              }}>
                Aún no se han sellado movimientos en puerta el día de hoy.
              </div>
            ) : (
              crucesCompletadosHoy.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: c.surfaceCard,
                    border: `1px solid ${c.border}`,
                    borderLeft: `4px solid ${p.seRegresaACasa ? '#ef4444' : '#16a34a'}`,
                    borderRadius: '11px',
                    padding: '10px 13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <AvatarColaborador u={p.usuarios} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.usuarios?.nombre_completo}
                      </div>
                      <div style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>
                        #{p.usuarios?.numero_empleado} • {p.folio}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11.5px', fontWeight: '800' }}>
                    {p.seRegresaACasa ? (
                      <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '4px 9px', borderRadius: '6px' }}>
                        ↩️ Retirado a casa
                      </span>
                    ) : (
                      <>
                        {p.horaSalidaCaseta && (
                          <span style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7', padding: '4px 9px', borderRadius: '6px' }}>
                            ✓ Salida sellada
                          </span>
                        )}
                        {p.horaEntradaCaseta && (
                          <span style={{ background: c.accentSoft, color: c.accent, padding: '4px 9px', borderRadius: '6px' }}>
                            {p.tipo_permiso === 'salida' ? '✓ Reingreso sellado' : '✓ Entrada sellada'}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  // ====================================================================
  // MÓDULO 2 DEL SIDEBAR: APOYO RETARDO (/caseta/retardo) - SIN RELOJ VISIBLE
  // ====================================================================
  if (vista === 'retardo') {
    return (
      <div className="caseta-wrap">
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
        <style>{estilosComunesCaseta}</style>

        <div style={{
          background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '14px',
          padding: '18px', width: '100%', boxSizing: 'border-box'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: c.text }}>
              Solicitar Autorización de Acceso en Puerta
            </div>
            <div style={{ fontSize: '12.5px', color: c.textMuted, marginTop: '3px', lineHeight: 1.4 }}>
              Selecciona al colaborador que se encuentra en puerta para enviar la alerta a su Jefe de Área y recibir instrucción de acceso o retiro.
            </div>
          </div>

          <BuscadorPersonal
            empleados={empleadosSede}
            seleccionado={empleadoSeleccionado}
            setSeleccionado={setEmpleadoSeleccionado}
          />

          <button
            onClick={handleGenerarRetardo}
            disabled={!empleadoSeleccionado || procesandoId === 'nuevo-retardo'}
            style={{
              width: '100%', height: '42px', borderRadius: '10px', border: 'none',
              background: c.accent, color: '#fff', fontSize: '13.5px', fontWeight: '800',
              cursor: (!empleadoSeleccionado || procesandoId === 'nuevo-retardo') ? 'not-allowed' : 'pointer',
              opacity: (!empleadoSeleccionado || procesandoId === 'nuevo-retardo') ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Send size={15} />
            {procesandoId === 'nuevo-retardo' ? 'Enviando solicitud...' : 'Notificar a Jefatura'}
          </button>
        </div>
      </div>
    );
  }

  // ====================================================================
  // MÓDULO 3 DEL SIDEBAR: PASE DE LISTA (/caseta/asistencia) - SIN HORAS VISIBLES
  // ====================================================================
  const termino = (busquedaTexto || '').toLowerCase().trim();
  const personalFiltrado = empleadosSede.filter(emp => {
    if (!termino) return true;
    return (
      (emp.nombre_completo || '').toLowerCase().includes(termino) ||
      String(emp.numero_empleado || '').toLowerCase().includes(termino)
    );
  });

  const totalPresentes = empleadosSede.filter(e => Boolean(mapaAsistencias[e.id]?.hora_entrada)).length;

  return (
    <div className="caseta-wrap">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{estilosComunesCaseta}</style>

      <div style={{
        background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {!esSoloGuardia && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: c.bg, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '5px 10px'
              }}>
                <Calendar size={14} color={c.accent} />
                <input
                  type="date"
                  value={fechaAsistencia}
                  max={hoyStr}
                  onChange={(e) => setFechaAsistencia(e.target.value)}
                  style={{
                    border: 'none', background: 'transparent', color: c.text,
                    fontSize: '12.5px', fontWeight: '800', outline: 'none', cursor: 'pointer'
                  }}
                />
              </div>
            )}

            <span style={{
              fontSize: '12px', fontWeight: '800', color: c.accent, background: c.accentSoft,
              padding: '6px 10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px'
            }}>
              <UserCheck size={14} /> Presentes hoy: {totalPresentes} / {empleadosSede.length}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setMostrarBuscadorMovil(prev => !prev)}
              style={{
                height: '32px', padding: '0 10px', borderRadius: '8px',
                border: `1px solid ${(mostrarBuscadorMovil || busquedaTexto) ? c.accent : c.border}`,
                background: (mostrarBuscadorMovil || busquedaTexto) ? c.accentSoft : c.bg,
                color: (mostrarBuscadorMovil || busquedaTexto) ? c.accent : c.text,
                fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '5px'
              }}
            >
              <Search size={14} />
              <span>Buscar</span>
            </button>

            <button
              onClick={cargarDatos}
              title="Actualizar lista"
              style={{
                width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${c.border}`,
                background: c.bg, color: c.text, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {(mostrarBuscadorMovil || busquedaTexto) && (
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: c.textMuted }} />
            <input
              type="text"
              placeholder="Buscar colaborador por nombre o # de nómina..."
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              style={{
                width: '100%', height: '36px', padding: '0 30px 0 32px', borderRadius: '8px',
                border: `1px solid ${c.border}`, background: c.bg, color: c.text,
                fontSize: '13px', boxSizing: 'border-box', outline: 'none'
              }}
            />
            {busquedaTexto && (
              <button
                type="button"
                onClick={() => setBusquedaTexto('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* LISTA DE PERSONAL SIN MOSTRAR HORAS AL GUARDIA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', width: '100%' }}>
        {personalFiltrado.map((emp) => {
          const reg = mapaAsistencias[emp.id];
          const incidencia = mapaIncidenciasHoy[emp.id];
          const tieneEntrada = Boolean(reg?.hora_entrada);
          const tieneSalida = Boolean(reg?.hora_salida);
          const bloqueadoPorRetiro = incidencia?.etiqueta?.includes('regresó');
          const ausenteJustificado = incidencia?.etiqueta?.includes('Vacaciones') || incidencia?.etiqueta?.includes('Falta');

          return (
            <div
              key={emp.id}
              style={{
                background: c.surfaceCard,
                border: `1px solid ${c.border}`,
                borderRadius: '11px',
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px', minWidth: 0 }}>
                <AvatarColaborador u={emp} size={34} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {emp.nombre_completo}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '700' }}>#{emp.numero_empleado}</span>
                    {emp.departamentos?.nombre && <span>• {emp.departamentos.nombre}</span>}
                    {incidencia && (
                      <span style={{
                        fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px',
                        color: incidencia.color, background: incidencia.bg
                      }}>
                        {incidencia.etiqueta}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                {tieneEntrada ? (
                  <span style={{
                    fontSize: '11.5px', fontWeight: '800', color: '#16a34a',
                    background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.28)',
                    padding: '5px 9px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}>
                    <CheckCircle2 size={12.5} /> {esSoloGuardia ? 'Entrada registrada' : `Entrada: ${reg.hora_entrada}`}
                  </span>
                ) : bloqueadoPorRetiro ? (
                  <span style={{
                    fontSize: '11px', fontWeight: '800', color: '#ef4444',
                    background: 'rgba(239,68,68,0.1)', padding: '5px 9px', borderRadius: '7px'
                  }}>
                    Sin acceso hoy
                  </span>
                ) : ausenteJustificado ? (
                  <span style={{
                    fontSize: '11px', fontWeight: '700', color: c.textMuted,
                    background: c.bg, border: `1px solid ${c.border}`,
                    padding: '4px 8px', borderRadius: '6px'
                  }}>
                    Ausencia autorizada
                  </span>
                ) : (esFechaHoy || esSoloGuardia) ? (
                  <button
                    onClick={() => handleMarcarAsistencia(emp.id, 'entrada')}
                    disabled={procesandoId === `${emp.id}-entrada`}
                    style={{
                      height: '32px', padding: '0 12px', borderRadius: '7px', border: 'none',
                      background: c.accent, color: '#fff', fontSize: '11.5px',
                      fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                    }}
                  >
                    <LogIn size={13} />
                    {procesandoId === `${emp.id}-entrada` ? '...' : 'Entrada'}
                  </button>
                ) : (
                  <span style={{
                    fontSize: '11px', fontWeight: '700', color: c.textMuted,
                    background: c.bg, border: `1px solid ${c.border}`,
                    padding: '4px 8px', borderRadius: '6px'
                  }}>
                    Sin asistencia
                  </span>
                )}

                {tieneEntrada && (
                  tieneSalida ? (
                    <span style={{
                      fontSize: '11.5px', fontWeight: '800', color: '#0284c7',
                      background: 'rgba(2,132,199,0.10)', border: '1px solid rgba(2,132,199,0.28)',
                      padding: '5px 9px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}>
                      <LogOut size={12.5} /> {esSoloGuardia ? 'Salida registrada' : `Salida: ${reg.hora_salida}`}
                    </span>
                  ) : (esFechaHoy || esSoloGuardia) ? (
                    <button
                      onClick={() => handleMarcarAsistencia(emp.id, 'salida')}
                      disabled={procesandoId === `${emp.id}-salida`}
                      style={{
                        height: '32px', padding: '0 11px', borderRadius: '7px', border: `1px solid ${c.border}`,
                        background: c.bg, color: c.text, fontSize: '11.5px',
                        fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                      }}
                    >
                      <LogOut size={13} />
                      {procesandoId === `${emp.id}-salida` ? '...' : 'Salida'}
                    </button>
                  ) : null
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
