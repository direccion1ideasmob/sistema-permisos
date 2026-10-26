import { formatearApellidosNombre } from '../../core/utils/ordenNombre';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../permisos/aprobacionesStyles';
import {
  obtenerDatosCaseta,
  registrarCheckCaseta,
  registrarAsistenciaLista,
  deshacerEntradaReciente,
  deshacerSalidaReciente,
  cancelarPasePorInasistenciaOCambio,
  obtenerFechaLocalHoy
} from './services/vigilanciaService';
import {
  DoorOpen, RotateCcw, CheckCircle2, LogOut,
  Search, RefreshCw, UserCheck, Users,
  Hourglass, CornerUpLeft, X, Check, Undo2, Ban
} from 'lucide-react';

export default function Caseta() {
  const { usuario } = useAuth();
  const location = useLocation();
  const inputBusquedaRef = useRef(null);

  const rutaActual = location.pathname;
  const vista = rutaActual.includes('/asistencia') || rutaActual.includes('/retardo')
    ? 'asistencia'
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
  const [subTabAsistencia, setSubTabAsistencia] = useState('por_llegar');

  const [retenidosEnEspera, setRetenidosEnEspera] = useState([]);
  const [pasesPorCruzar, setPasesPorCruzar] = useState([]);
  const [personalFuera, setPersonalFuera] = useState([]);
  const [crucesCompletadosHoy, setCrucesCompletadosHoy] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});
  const [mapaIncidenciasHoy, setMapaIncidenciasHoy] = useState({});

  const [marcasEntradaRecientes, setMarcasEntradaRecientes] = useState({});
  const [marcasSalidaRecientes, setMarcasSalidaRecientes] = useState({});
  const [ahoraMs, setAhoraMs] = useState(Date.now());

  // ESTADO DEL MODAL DE DOBLE PALOMITA: { emp, tipoMarca: 'entrada' | 'salida' }
  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [ultimoRegistradoTexto, setUltimoRegistradoTexto] = useState('');

  useEffect(() => {
    const t = setInterval(() => setAhoraMs(Date.now()), 3000);
    return () => clearInterval(t);
  }, []);

  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  const sedeGuardia = usuario?.sede_id || null;
  const hoyStr = obtenerFechaLocalHoy();

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerDatosCaseta(sedeGuardia, hoyStr);
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
  }, [sedeGuardia, hoyStr]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 8000);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const handleSellarPase = async (id, tipoMovimiento) => {
    setProcesandoId(id);
    try {
      await registrarCheckCaseta(id, tipoMovimiento);
      await cargarDatos();
    } catch (err) {
      alert('Error al sellar movimiento: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleCancelarPaseSinUso = async (paseId, nombre) => {
    if (!window.confirm(`¿Confirmas que ${nombre || 'el colaborador'} ya no utilizó este pase o no se presentó?`)) return;
    setProcesandoId(paseId);
    try {
      await cancelarPasePorInasistenciaOCambio(paseId, 'Cancelado en puerta (No se presentó / Sin uso)');
      await cargarDatos();
    } catch (err) {
      alert('Error al cancelar pase: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleConfirmarDesdeModal = async () => {
    if (!modalConfirmacion || procesandoId) return;
    const { emp, tipoMarca } = modalConfirmacion;
    const empleadoId = emp.id;
    const nombreColaborador = emp.nombre_completo;

    setProcesandoId(`${empleadoId}-${tipoMarca}`);
    try {
      const res = await registrarAsistenciaLista(empleadoId, tipoMarca, usuario?.id || null, false);

      setModalConfirmacion(null);
      setBusquedaTexto('');

      if (tipoMarca === 'entrada') {
        if (res?.resultado === 'ok' || res?.resultado === 'entrada_registrada') {
          setMarcasEntradaRecientes(prev => ({ ...prev, [empleadoId]: Date.now() }));
          setUltimoRegistradoTexto(`✓ Entrada registrada: ${nombreColaborador}`);
        } else if (res?.resultado === 'en_espera_rh') {
          setUltimoRegistradoTexto(`⏳ En espera de veredicto de RH: ${nombreColaborador}`);
        }
      } else {
        setMarcasSalidaRecientes(prev => ({ ...prev, [empleadoId]: Date.now() }));
        setUltimoRegistradoTexto(`✓ Salida registrada: ${nombreColaborador}`);
      }

      setTimeout(() => {
        setUltimoRegistradoTexto('');
        if (inputBusquedaRef.current) inputBusquedaRef.current.focus();
      }, 1800);

      await cargarDatos();
    } catch (err) {
      alert('Error al procesar registro: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDeshacerEntrada = async (empleadoId) => {
    setProcesandoId(`${empleadoId}-deshacer`);
    try {
      await deshacerEntradaReciente(empleadoId);
      setMarcasEntradaRecientes(prev => {
        const copia = { ...prev };
        delete copia[empleadoId];
        return copia;
      });
      await cargarDatos();
    } catch (err) {
      alert('No se pudo deshacer la entrada: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDeshacerSalida = async (empleadoId) => {
    setProcesandoId(`${empleadoId}-deshacer-salida`);
    try {
      await deshacerSalidaReciente(empleadoId);
      setMarcasSalidaRecientes(prev => {
        const copia = { ...prev };
        delete copia[empleadoId];
        return copia;
      });
      await cargarDatos();
    } catch (err) {
      alert('No se pudo deshacer la salida: ' + err.message);
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
    .caseta-tabs-bar-2 {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px;
      height: 42px;
      padding: 4px !important;
      box-sizing: border-box;
    }
    .caseta-tabs-bar .tab-btn,
    .caseta-tabs-bar-2 .tab-btn {
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
      .caseta-tabs-bar,
      .caseta-tabs-bar-2 {
        height: 38px;
        border-radius: 10px !important;
      }
      .caseta-tabs-bar .tab-btn,
      .caseta-tabs-bar-2 .tab-btn {
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

        {subTabPases === 'por_cruzar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
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
                    <Hourglass size={13} /> EN ESPERA DE VEREDICTO DE RH
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
                            {formatearApellidosNombre(p.usuarios?.nombre_completo)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px', fontSize: '11.5px', fontWeight: '700' }}>
                            <span style={{ color: '#d97706', background: 'rgba(245,158,11,0.14)', padding: '1.5px 6px', borderRadius: '4px' }}>
                              ⏳ En espera de RH
                            </span>
                            <span style={{ color: c.textMuted, fontFamily: 'ui-monospace, monospace' }}>
                              #{p.usuarios?.numero_empleado}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="caseta-card-actions">
                        <button
                          type="button"
                          onClick={() => handleCancelarPaseSinUso(p.id, p.usuarios?.nombre_completo)}
                          disabled={procesandoId === p.id}
                          style={{
                            height: '34px', padding: '0 10px', borderRadius: '8px',
                            border: `1px solid ${c.border}`, background: c.bg, color: c.textMuted,
                            fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Ban size={13} /> Se retiró
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                  ? '🚫 ORDEN RH: SE REGRESA A CASA'
                  : (esSalida ? (p.requiereRegreso ? '🔵 SALIDA (CON REGRESO)' : '🔵 SALIDA DEFINITIVA') : '🟢 ACCESO AUTORIZADO');

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
                          {formatearApellidosNombre(p.usuarios?.nombre_completo)}
                        </div>

                        {esSalida && p.horarioProgramado && (
                          <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0284c7', marginTop: '2px' }}>
                            {p.horarioProgramado}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="caseta-card-actions">
                      {!esRegresoCasa && (
                        <button
                          type="button"
                          onClick={() => handleCancelarPaseSinUso(p.id, p.usuarios?.nombre_completo)}
                          disabled={procesandoId === p.id}
                          style={{
                            height: '38px', padding: '0 10px', borderRadius: '9px',
                            border: `1px solid ${c.border}`, background: c.bg, color: c.textMuted,
                            fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Ban size={13} /> Sin uso
                        </button>
                      )}
                      <button
                        onClick={() => handleSellarPase(p.id, esRegresoCasa ? 'retiro' : (esSalida ? 'salida' : 'entrada'))}
                        disabled={procesandoId === p.id}
                        className="caseta-btn-action"
                        style={{ background: colorBorde, color: '#fff' }}
                      >
                        {esRegresoCasa ? <CornerUpLeft size={15} /> : <Check size={16} strokeWidth={3} />}
                        {procesandoId === p.id
                          ? 'Procesando...'
                          : (esRegresoCasa ? 'Confirmar Retiro' : (esSalida ? 'Confirmar Salida' : 'Dar Acceso'))}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

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
                        {formatearApellidosNombre(p.usuarios?.nombre_completo)}
                      </div>
                      <div style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '700', marginTop: '2px' }}>
                        #{p.usuarios?.numero_empleado} • Fuera con pase temporal
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
                      <Check size={16} strokeWidth={3} />
                      {procesandoId === p.id ? 'Confirmando...' : 'Confirmar Reingreso'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

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
                        {formatearApellidosNombre(p.usuarios?.nombre_completo)}
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
  // PASE DE LISTA: MÍNIMO 3 LETRAS + MÁXIMO 3 RESULTADOS + MODAL DE DOBLE PALOMITA
  // ====================================================================
  const termino = (busquedaTexto || '').toLowerCase().trim();
  const letrasSinEspacios = termino.replace(/\s+/g, '');
  const tieneMinimo3Letras = letrasSinEspacios.length >= 3;

  const todosSinEntrada = empleadosSede.filter(emp => !mapaAsistencias[emp.id]?.hora_entrada);
  const todosEnPlanta = empleadosSede.filter(emp => Boolean(mapaAsistencias[emp.id]?.hora_entrada));

  const retenidosActivosPuerta = todosSinEntrada.filter((emp) => {
    const inc = mapaIncidenciasHoy[emp.id];
    const t = inc?.tipo || 'normal';
    if (t === 'retardo_regresa' && inc?.yaSeRetiroACasa) return false;
    return t === 'retardo_en_espera' || t === 'retardo_regresa' || t === 'retardo_autorizado';
  });

  const coincidenciasEntrada = tieneMinimo3Letras
    ? todosSinEntrada.filter((emp) => (emp.nombre_completo || '').toLowerCase().includes(termino))
    : [];

  const demasiadasCoincidenciasEntrada = tieneMinimo3Letras && coincidenciasEntrada.length > 3;

  const recientesEnPlanta = todosEnPlanta.filter((emp) => mapaIncidenciasHoy[emp.id]?.tipo === 'salida_fuera');

  const coincidenciasEnPlanta = termino
    ? todosEnPlanta.filter((emp) =>
        (emp.nombre_completo || '').toLowerCase().includes(termino) ||
        String(emp.numero_empleado || '').toLowerCase().includes(termino)
      )
    : todosEnPlanta;

  return (
    <div className="caseta-wrap">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{estilosComunesCaseta}</style>

      {/* =================================================================
          MODAL DE CONFIRMACIÓN CON EL NOMBRE DEL TRABAJADOR Y OTRA PALOMITA
          ================================================================= */}
      {modalConfirmacion && (
        <div
          onClick={() => { if (!procesandoId) setModalConfirmacion(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.68)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: c.surfaceCard,
              border: `2px solid ${modalConfirmacion.tipoMarca === 'salida' ? '#0284c7' : c.accent}`,
              borderRadius: '18px',
              padding: '24px 22px',
              width: '100%',
              maxWidth: '410px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '14px'
            }}
          >
            <span style={{
              fontSize: '11.5px',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '4px 12px',
              borderRadius: '999px',
              background: modalConfirmacion.tipoMarca === 'salida' ? 'rgba(2,132,199,0.14)' : c.accentSoft,
              color: modalConfirmacion.tipoMarca === 'salida' ? '#0284c7' : c.accent
            }}>
              {modalConfirmacion.tipoMarca === 'salida' ? 'Confirmar Salida de Planta' : 'Confirmar Entrada a Planta'}
            </span>

            <AvatarColaborador u={modalConfirmacion.emp} size={68} />

            <div>
              <div style={{ fontSize: '19px', fontWeight: '900', color: c.text, lineHeight: 1.25 }}>
                {formatearApellidosNombre(modalConfirmacion.emp?.nombre_completo)}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: c.textMuted, marginTop: '5px' }}>
                #{modalConfirmacion.emp?.numero_empleado}
                {modalConfirmacion.emp?.departamentos?.nombre ? ` • ${modalConfirmacion.emp.departamentos.nombre}` : ''}
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.4fr',
              gap: '10px',
              width: '100%',
              marginTop: '6px'
            }}>
              <button
                type="button"
                onClick={() => setModalConfirmacion(null)}
                disabled={Boolean(procesandoId)}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  border: `1.5px solid ${c.border}`,
                  background: c.bg,
                  color: c.textMuted,
                  fontSize: '14px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <X size={18} /> Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarDesdeModal}
                disabled={Boolean(procesandoId)}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  border: 'none',
                  background: modalConfirmacion.tipoMarca === 'salida' ? '#0284c7' : c.accent,
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: '900',
                  cursor: procesandoId ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 6px 18px rgba(22,163,74,0.32)'
                }}
              >
                <Check size={22} strokeWidth={3.2} />
                <span>{procesandoId ? 'Registrando...' : 'Confirmar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tabs-aprobacion-bar caseta-tabs-bar-2">
        <button
          className={`tab-btn ${subTabAsistencia === 'por_llegar' ? 'active' : ''}`}
          onClick={() => setSubTabAsistencia('por_llegar')}
        >
          <Users size={15} />
          <span>Entrada</span>
          <span className="tab-badge" style={{ background: c.accent, color: '#fff', fontSize: '11px', padding: '1px 6px' }}>
            {todosSinEntrada.length}
          </span>
        </button>

        <button
          className={`tab-btn ${subTabAsistencia === 'en_planta' ? 'active' : ''}`}
          onClick={() => setSubTabAsistencia('en_planta')}
        >
          <UserCheck size={15} />
          <span>En Planta / Salidas</span>
          <span className="tab-badge" style={{ background: '#0284c7', color: '#fff', fontSize: '11px', padding: '1px 6px' }}>
            {todosEnPlanta.length}
          </span>
        </button>
      </div>

      {/* BUSCADOR GRANDE DE TEXTO (MÍNIMO 3 LETRAS) */}
      <div style={{
        background: c.surfaceCard,
        border: `2px solid ${tieneMinimo3Letras ? c.accent : c.border}`,
        borderRadius: '16px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: tieneMinimo3Letras ? '0 6px 20px rgba(22,163,74,0.12)' : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={22}
              style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: tieneMinimo3Letras ? c.accent : c.textMuted
              }}
            />
            <input
              ref={inputBusquedaRef}
              type="text"
              placeholder="Escribe al menos 3 letras del nombre o apellido..."
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              style={{
                width: '100%',
                height: '56px',
                padding: '0 48px 0 48px',
                borderRadius: '13px',
                border: `2px solid ${tieneMinimo3Letras ? c.accent : c.border}`,
                background: c.bg,
                color: c.text,
                fontSize: '19px',
                fontWeight: '800',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            {busquedaTexto && (
              <button
                type="button"
                onClick={() => {
                  setBusquedaTexto('');
                  if (inputBusquedaRef.current) inputBusquedaRef.current.focus();
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'rgba(239,68,68,0.12)',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <button
            onClick={cargarDatos}
            title="Actualizar"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '13px',
              border: `1.5px solid ${c.border}`,
              background: c.bg,
              color: c.text,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {ultimoRegistradoTexto && (
          <div style={{
            background: c.accentSoft,
            border: `1.5px solid ${c.accent}`,
            color: c.accent,
            borderRadius: '10px',
            padding: '9px 12px',
            fontSize: '14px',
            fontWeight: '900',
            textAlign: 'center'
          }}>
            {ultimoRegistradoTexto}
          </div>
        )}
      </div>

      {/* PESTAÑA 1: ENTRADA */}
      {subTabAsistencia === 'por_llegar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {retenidosActivosPuerta.length > 0 && (
            <div style={{
              background: c.surfaceCard,
              border: `2px solid ${c.border}`,
              borderRadius: '14px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{
                fontSize: '11.5px',
                fontWeight: '900',
                color: c.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>🔔 En puerta (En espera y Resoluciones)</span>
                <span>{retenidosActivosPuerta.length}</span>
              </div>

              {retenidosActivosPuerta.map((emp) => {
                const inc = mapaIncidenciasHoy[emp.id];
                const tipoInc = inc?.tipo || 'normal';
                const esAutorizado = tipoInc === 'retardo_autorizado';
                const esRegresa = tipoInc === 'retardo_regresa';

                return (
                  <div
                    key={emp.id}
                    style={{
                      background: esAutorizado
                        ? (modoOscuro ? 'rgba(22,163,74,0.14)' : '#f0fdf4')
                        : esRegresa
                        ? (modoOscuro ? 'rgba(239,68,68,0.14)' : '#fef2f2')
                        : c.bg,
                      border: `2px solid ${esAutorizado ? '#16a34a' : (esRegresa ? '#ef4444' : '#f59e0b')}`,
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
                      <AvatarColaborador u={emp} size={40} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '14.5px', fontWeight: '900', color: c.text }}>
                          {formatearApellidosNombre(emp.nombre_completo)}
                        </div>
                        {inc && (
                          <span style={{
                            fontSize: '11px', fontWeight: '900', padding: '2px 8px', borderRadius: '6px',
                            color: inc.color, background: inc.bg, display: 'inline-block', marginTop: '3px'
                          }}>
                            {inc.etiqueta}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {tipoInc === 'retardo_en_espera' ? (
                        <span style={{
                          fontSize: '11.5px', fontWeight: '800', color: '#d97706',
                          background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.32)',
                          padding: '6px 11px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px'
                        }}>
                          <Hourglass size={13} /> En espera...
                        </span>
                      ) : esRegresa ? (
                        <button
                          type="button"
                          onClick={() => handleSellarPase(inc.paseId, 'retiro')}
                          disabled={Boolean(procesandoId)}
                          style={{
                            height: '40px', padding: '0 14px', borderRadius: '9px', border: 'none',
                            background: '#ef4444', color: '#fff', fontSize: '12.5px', fontWeight: '900',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          <CornerUpLeft size={15} /> Confirmar Retiro
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSellarPase(inc.paseId, 'entrada')}
                          disabled={Boolean(procesandoId)}
                          style={{
                            height: '42px', padding: '0 16px', borderRadius: '10px', border: 'none',
                            background: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: '900',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
                            boxShadow: '0 4px 12px rgba(22,163,74,0.28)'
                          }}
                        >
                          <Check size={18} strokeWidth={3} /> Dar Paso a Planta
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!tieneMinimo3Letras ? (
            <div style={{
              background: c.surfaceCard, border: `1px dashed ${c.border}`, borderRadius: '12px',
              padding: '32px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              Escribe al menos <strong style={{ color: c.text }}>3 letras</strong> del nombre o apellido del colaborador para buscarlo.
            </div>
          ) : demasiadasCoincidenciasEntrada ? (
            <div style={{
              background: 'rgba(245, 158, 11, 0.10)',
              border: '1.5px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px',
              padding: '24px 18px',
              textAlign: 'center',
              color: '#d97706',
              fontSize: '14px',
              fontWeight: '800'
            }}>
              Hay {coincidenciasEntrada.length} personas que coinciden con "{busquedaTexto}".<br />
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: c.textMuted }}>
                Escribe una o dos letras más para que queden <strong>máximo 3 resultados</strong> y puedas seleccionarlo.
              </span>
            </div>
          ) : coincidenciasEntrada.length === 0 ? (
            <div style={{
              background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
              padding: '28px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              No se encontró ningún colaborador pendiente de entrada con "{busquedaTexto}".
            </div>
          ) : (
            coincidenciasEntrada.map((emp) => {
              const inc = mapaIncidenciasHoy[emp.id];
              const tipoInc = inc?.tipo || 'normal';

              return (
                <div
                  key={emp.id}
                  style={{
                    background: c.surfaceCard,
                    border: `1.5px solid ${
                      tipoInc === 'retardo_en_espera' ? '#f59e0b' :
                      tipoInc === 'retardo_autorizado' ? '#16a34a' :
                      tipoInc === 'retardo_regresa' ? '#ef4444' : c.border
                    }`,
                    borderRadius: '11px',
                    padding: '10px 13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    opacity: tipoInc === 'ausencia_autorizada' ? 0.8 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px', minWidth: 0 }}>
                    <AvatarColaborador u={emp} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatearApellidosNombre(emp.nombre_completo)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11.5px', color: c.textMuted, fontWeight: '600', marginTop: '2px' }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '800', color: c.text }}>#{emp.numero_empleado}</span>
                        {emp.departamentos?.nombre && <span>• {emp.departamentos.nombre}</span>}
                        {inc && (
                          <span style={{
                            fontSize: '10.5px', fontWeight: '800', padding: '1.5px 7px', borderRadius: '5px',
                            color: inc.color, background: inc.bg
                          }}>
                            {inc.etiqueta}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {tipoInc === 'retardo_en_espera' ? (
                      <span style={{
                        fontSize: '11.5px', fontWeight: '800', color: '#d97706',
                        background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.32)',
                        padding: '6px 11px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px'
                      }}>
                        <Hourglass size={13} /> En espera de RH
                      </span>
                    ) : tipoInc === 'retardo_regresa' ? (
                      inc.yaSeRetiroACasa ? (
                        <span style={{
                          fontSize: '11.5px', fontWeight: '800', color: '#ef4444',
                          background: 'rgba(239,68,68,0.12)', padding: '6px 10px', borderRadius: '8px'
                        }}>
                          ↩️ Retirado
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSellarPase(inc.paseId, 'retiro')}
                          disabled={Boolean(procesandoId)}
                          style={{
                            height: '38px', padding: '0 14px', borderRadius: '9px', border: 'none',
                            background: '#ef4444', color: '#fff', fontSize: '12px', fontWeight: '800',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          <CornerUpLeft size={15} /> Confirmar Retiro
                        </button>
                      )
                    ) : tipoInc === 'retardo_autorizado' ? (
                      <button
                        type="button"
                        onClick={() => handleSellarPase(inc.paseId, 'entrada')}
                        disabled={Boolean(procesandoId)}
                        style={{
                          height: '42px', padding: '0 16px', borderRadius: '10px', border: 'none',
                          background: '#16a34a', color: '#fff', fontSize: '12.5px', fontWeight: '900',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <Check size={17} strokeWidth={3} /> Dar Paso
                      </button>
                    ) : tipoInc === 'ausencia_autorizada' ? (
                      <span style={{
                        fontSize: '11.5px', fontWeight: '800', color: inc.color,
                        background: inc.bg, padding: '6px 10px', borderRadius: '8px'
                      }}>
                        {inc.etiqueta}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setModalConfirmacion({ emp, tipoMarca: 'entrada' })}
                        disabled={Boolean(procesandoId)}
                        title="Seleccionar trabajador"
                        style={{
                          minWidth: '64px', height: '46px', padding: '0 20px', borderRadius: '11px', border: 'none',
                          background: c.accent, color: '#fff', fontSize: '13px',
                          fontWeight: '900', cursor: procesandoId ? 'not-allowed' : 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                        }}
                      >
                        <Check size={20} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PESTAÑA 2: EN PLANTA / SALIDAS */}
      {subTabAsistencia === 'en_planta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {todosEnPlanta.length === 0 ? (
            <div style={{
              background: c.surfaceCard, border: `1px dashed ${c.border}`, borderRadius: '12px',
              padding: '32px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              Aún no hay colaboradores registrados en planta el día de hoy.
            </div>
          ) : coincidenciasEnPlanta.length === 0 ? (
            <div style={{
              background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
              padding: '28px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              No se encontró personal en planta que coincida con "{busquedaTexto}".
            </div>
          ) : (
            coincidenciasEnPlanta.map((emp) => {
              const reg = mapaAsistencias[emp.id];
              const inc = mapaIncidenciasHoy[emp.id];
              const tieneSalida = Boolean(reg?.hora_salida);

              return (
                <div
                  key={emp.id}
                  style={{
                    background: c.surfaceCard,
                    border: `1.5px solid ${c.border}`,
                    borderLeft: `4px solid ${tieneSalida ? '#64748b' : '#16a34a'}`,
                    borderRadius: '11px',
                    padding: '10px 13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px', minWidth: 0 }}>
                    <AvatarColaborador u={emp} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {formatearApellidosNombre(emp.nombre_completo)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11.5px', color: c.textMuted, fontWeight: '600', marginTop: '2px' }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '800', color: c.text }}>#{emp.numero_empleado}</span>
                        {emp.departamentos?.nombre && <span>• {emp.departamentos.nombre}</span>}
                        {reg?.hora_entrada && (
                          <span style={{
                            fontSize: '10.5px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px',
                            color: '#16a34a', background: 'rgba(22,163,74,0.12)'
                          }}>
                            Entrada: {reg.hora_entrada}
                          </span>
                        )}
                        {inc && (
                          <span style={{
                            fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px',
                            color: inc.color, background: inc.bg
                          }}>
                            {inc.etiqueta}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                    {inc?.tipo === 'salida_fuera' ? (
                      <button
                        onClick={() => handleSellarPase(inc.paseId, 'reingreso')}
                        disabled={Boolean(procesandoId)}
                        style={{
                          height: '38px', padding: '0 14px', borderRadius: '9px', border: 'none',
                          background: '#2563eb', color: '#fff', fontSize: '12px',
                          fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                        }}
                      >
                        <Check size={15} strokeWidth={3} /> Reingreso
                      </button>
                    ) : tieneSalida ? (
                      <span style={{
                        fontSize: '11.5px', fontWeight: '800', color: '#0284c7',
                        background: 'rgba(2,132,199,0.10)', border: '1px solid rgba(2,132,199,0.28)',
                        padding: '6px 10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <CheckCircle2 size={13} /> Salida: {reg.hora_salida}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setModalConfirmacion({ emp, tipoMarca: 'salida' })}
                        disabled={Boolean(procesandoId)}
                        style={{
                          height: '42px', padding: '0 16px', borderRadius: '10px', border: `1.5px solid ${c.border}`,
                          background: c.bg, color: c.text, fontSize: '12.5px',
                          fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <LogOut size={15} /> Salida
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
