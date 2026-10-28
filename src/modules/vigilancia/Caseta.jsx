import { formatearApellidosNombre } from '../../core/utils/ordenNombre';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../permisos/aprobacionesStyles';
import {
  obtenerDatosCaseta,
  registrarCheckCaseta,
  registrarAsistenciaLista,
  registrarRetardoEnPuerta,
  solicitarAutorizacionInusualCaseta,
  deshacerEntradaReciente,
  deshacerSalidaReciente,
  obtenerFechaLocalHoy
} from './services/vigilanciaService';
import {
  DoorOpen, RotateCcw, CheckCircle2, LogOut,
  Search, RefreshCw, UserCheck, Users, CalendarOff,
  Hourglass, CornerUpLeft, X, Check, Undo2
} from 'lucide-react';

export default function Caseta() {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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

  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [ultimoRegistradoTexto, setUltimoRegistradoTexto] = useState('');
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [procesandoId, setProcesandoId] = useState(null);

  const sedeGuardia = usuario?.sede_id || null;
  const hoyStr = obtenerFechaLocalHoy();

  const mostrarAvisoTemporal = (texto) => {
    setUltimoRegistradoTexto(texto);
    setTimeout(() => {
      setUltimoRegistradoTexto('');
    }, 2600);
  };

  const cargarDatos = useCallback(async () => {
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
      const res = await registrarCheckCaseta(id, tipoMovimiento);
      if (res?.resultado === 'retenido_por_horario') {
        alert('⚠️ HORARIO NO COINCIDE:\n' + res.detalleDesfase + '\n\nEl colaborador quedó retenido en la pestaña "En Puerta" mientras Jefatura / RH autoriza.');
        setSubTabPases('por_cruzar');
      }
      await cargarDatos();
    } catch (err) {
      alert('Error al sellar movimiento: ' + err.message);
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
          mostrarAvisoTemporal(`✓ Entrada registrada: ${nombreColaborador}`);
        } else if (res?.resultado === 'en_espera_rh' || res?.resultado === 'retenido_por_inusual') {
          mostrarAvisoTemporal(`⏳ Retenido en Pases de Puerta (Esperando firma): ${nombreColaborador}`);
        }
      } else {
        mostrarAvisoTemporal(`✓ Salida de turno registrada: ${nombreColaborador}`);
      }

      await cargarDatos();
    } catch (err) {
      alert('Error al procesar registro: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleSolicitarIngresoEnAusencia = async (emp, inc) => {
    const esVac = String(inc?.etiqueta || '').toLowerCase().includes('vacaciones');
    const msg = esVac
      ? `${emp.nombre_completo} está de VACACIONES hoy.\n\n¿Enviar a "Pases de Puerta" para solicitar autorización de reincorporación a Jefatura / RH?`
      : `${emp.nombre_completo} tenía FALTA programada hoy pero se presentó.\n\n¿Enviar a "Pases de Puerta" para solicitar autorización de ingreso a Jefatura / RH?`;
    if (!window.confirm(msg)) return;

    setProcesandoId(`${emp.id}-inusual`);
    try {
      await solicitarAutorizacionInusualCaseta(
        inc.paseId,
        esVac ? 'presentacion_en_vacaciones' : 'presentacion_en_falta'
      );
      await cargarDatos();
      navigate('/caseta');
      setSubTabPases('por_cruzar');
    } catch (err) {
      alert('Error al solicitar autorización: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleRetenerPorFaltaSinAviso = async (emp) => {
    if (!window.confirm(`¿Retener a ${emp.nombre_completo} por haber faltado sin aviso previo?\n\nPasará a "Pases de Puerta" esperando dictamen de Jefatura / RH.`)) return;
    setProcesandoId(`${emp.id}-falta`);
    try {
      await registrarRetardoEnPuerta(
        emp.id,
        usuario?.id || null,
        '[FALTA PREVIA SIN AVISO] El colaborador se presenta tras faltar sin aviso previo. Retenido en Vigilancia para dictamen de Jefatura / RH.'
      );
      setBusquedaTexto('');
      await cargarDatos();
      navigate('/caseta');
      setSubTabPases('por_cruzar');
    } catch (err) {
      alert('Error al retener por falta: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleSolicitarReingresoSalidaDefinitiva = async (pase) => {
    if (!window.confirm(`${pase.usuarios?.nombre_completo} salió con PASE DEFINITIVO.\n\n¿Retener en puerta y solicitar autorización a Jefatura / RH para permitir su reingreso?`)) return;
    setProcesandoId(pase.id);
    try {
      await solicitarAutorizacionInusualCaseta(pase.id, 'reingreso_salida_definitiva');
      setSubTabPases('por_cruzar');
      await cargarDatos();
    } catch (err) {
      alert('Error al solicitar reingreso: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDeshacerEntrada = async (empleadoId) => {
    setProcesandoId(`${empleadoId}-deshacer`);
    try {
      await deshacerEntradaReciente(empleadoId);
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
      box-sizing: border-box;
    }
    .caseta-search-box {
      padding: 12px 14px;
      border-radius: 14px;
    }
    .caseta-search-input {
      width: 100%;
      height: 48px;
      padding: 0 40px 0 42px;
      border-radius: 11px;
      font-size: 15px;
      font-weight: 700;
      box-sizing: border-box;
      outline: none;
    }
    .caseta-refresh-btn {
      width: 48px;
      height: 48px;
      border-radius: 11px;
      flex-shrink: 0;
    }
    .caseta-list-item {
      border-radius: 12px;
      padding: 11px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-sizing: border-box;
      width: 100%;
    }
    .caseta-emp-name {
      font-size: 14.5px;
      font-weight: 800;
      line-height: 1.25;
      word-break: break-word;
    }
    @media (max-width: 768px) {
      .caseta-wrap { padding-top: 42px; gap: 10px; }
      .caseta-tabs-bar { height: 38px; border-radius: 10px !important; }
      .caseta-tabs-bar .tab-btn { font-size: 11.5px !important; padding: 0 4px !important; gap: 4px !important; }
      .caseta-tabs-bar .tab-btn svg { display: none !important; }
      .caseta-card { flex-direction: column !important; align-items: stretch !important; padding: 11px 12px !important; gap: 9px !important; }
      .caseta-card-actions { width: 100% !important; justify-content: stretch !important; }
      .caseta-card-actions > button { flex: 1 !important; width: 100% !important; justify-content: center !important; }
    }
  `;

  // ====================================================================
  // VISTA 1: PASES DE PUERTA (EXCEPCIONES, RETENIDOS Y CRUCES INTERMEDIOS)
  // ====================================================================
  if (vista === 'pases') {
    const totalEnPuerta = pasesPorCruzar.length + retenidosEnEspera.length;

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
            {totalEnPuerta > 0 && (
              <span className="tab-badge" style={{ fontSize: '11px', padding: '1px 6px' }}>
                {totalEnPuerta}
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
              <span className="tab-badge" style={{ fontSize: '11px', padding: '1px 6px' }}>
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

        {/* PESTAÑA 1: EN PUERTA (LISTOS PARA CRUZAR + RETENIDOS ESPERANDO FIRMA) */}
        {subTabPases === 'por_cruzar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {/* A) Listos para cruzar con veredicto ya emitido */}
            {pasesPorCruzar.map((p) => {
              const esSalida = p.tipo_permiso === 'salida';
              const esRegresoCasa = Boolean(p.seRegresaACasa);
              const colorBorde = esRegresoCasa ? '#ef4444' : (esSalida ? '#0284c7' : '#16a34a');
              const bgBadge = esRegresoCasa ? 'rgba(239,68,68,0.14)' : (esSalida ? 'rgba(2,132,199,0.12)' : 'rgba(22,163,74,0.12)');
              const textoBadge = esRegresoCasa
                ? '🚫 ORDEN RH: SE REGRESA A CASA'
                : (esSalida ? (p.requiereRegreso ? '🔵 SALIDA CON REGRESO' : '🔵 SALIDA DEFINITIVA') : '🟢 ACCESO AUTORIZADO');

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
                      <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text, lineHeight: 1.2 }}>
                        {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '5px',
                          background: bgBadge, color: colorBorde
                        }}>
                          {textoBadge}
                        </span>
                        <span style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '700' }}>
                          #{p.usuarios?.numero_empleado} {p.horarioProgramado ? `• ${p.horarioProgramado}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="caseta-card-actions">
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
            })}

            {/* B) Retenidos en puerta esperando autorización (Con motivo específico y claro) */}
            {retenidosEnEspera.map((p) => (
              <div
                key={p.id}
                className="caseta-card"
                style={{
                  borderLeft: '5px solid #f59e0b',
                  background: c.surfaceCard
                }}
              >
                <div className="caseta-card-left">
                  <AvatarColaborador u={p.usuarios} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text, lineHeight: 1.2 }}>
                      {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px', fontSize: '11.5px', fontWeight: '700' }}>
                      <span style={{ color: '#d97706', background: 'rgba(245,158,11,0.14)', padding: '2px 8px', borderRadius: '5px' }}>
                        {p.etiquetaMotivoPuerta || '⏳ Retenido en puerta'}
                      </span>
                      <span style={{ color: c.textMuted }}>
                        • Esperando firma de: <strong style={{ color: c.text }}>{p.esperandoFirmaDe}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: '11.5px', fontWeight: '800', color: '#d97706',
                  display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0
                }}>
                  <Hourglass size={14} /> En espera
                </span>
              </div>
            ))}

            {pasesPorCruzar.length === 0 && retenidosEnEspera.length === 0 && (
              <div style={{
                background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
                padding: '36px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
              }}>
                No hay personas detenidas ni pases pendientes en puerta en este momento.
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: POR REGRESAR (FUERA CON PASE TEMPORAL) */}
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
                        {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
                      </div>
                      <div style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '700', marginTop: '3px' }}>
                        #{p.usuarios?.numero_empleado} • {p.horarioProgramado}
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
                      {procesandoId === p.id ? 'Verificando...' : 'Confirmar Reingreso'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* PESTAÑA 3: SELLADOS HOY */}
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
                      <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>
                        {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
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
                            ✓ Salida: {p.horaSalidaCaseta}
                          </span>
                        )}
                        {p.horaEntradaCaseta && (
                          <span style={{ background: c.accentSoft, color: c.accent, padding: '4px 9px', borderRadius: '6px' }}>
                            {p.tipo_permiso === 'salida' ? `✓ Reingreso: ${p.horaEntradaCaseta}` : `✓ Entrada: ${p.horaEntradaCaseta}`}
                          </span>
                        )}
                        {p.tipo_permiso === 'salida' && p.horaSalidaCaseta && !p.horaEntradaCaseta && !p.requiereRegreso && (
                          <button
                            type="button"
                            onClick={() => handleSolicitarReingresoSalidaDefinitiva(p)}
                            disabled={Boolean(procesandoId)}
                            style={{
                              padding: '4px 9px', borderRadius: '6px', border: '1px solid #d97706',
                              background: 'rgba(245,158,11,0.14)', color: '#d97706', fontSize: '11px',
                              fontWeight: '800', cursor: 'pointer'
                            }}
                          >
                            Solicitar Reingreso
                          </button>
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
  // VISTA 2: PASE DE LISTA DIARIO (3 PESTAÑAS LIMPIAS SIN REVOLTIJO)
  //   1. Por Llegar (Buscador de Entrada)
  //   2. En Planta (Asistencia actual y Salida de fin de turno)
  //   3. Ausentes Hoy (Vacaciones y Faltas programadas)
  // ====================================================================
  const termino = (busquedaTexto || '').toLowerCase().trim();
  const letrasSinEspacios = termino.replace(/\s+/g, '');
  const tieneMinimo3Letras = letrasSinEspacios.length >= 3;

  const todosSinEntrada = empleadosSede.filter(emp => !mapaAsistencias[emp.id]?.hora_entrada);
  const ausentesProgramadosHoy = todosSinEntrada.filter((emp) => {
    const inc = mapaIncidenciasHoy[emp.id];
    return inc?.tipo === 'ausencia_autorizada';
  });
  const pendientesPorLlegar = todosSinEntrada.filter((emp) => {
    const inc = mapaIncidenciasHoy[emp.id];
    return inc?.tipo !== 'ausencia_autorizada';
  });
  const todosEnPlanta = empleadosSede.filter(emp => Boolean(mapaAsistencias[emp.id]?.hora_entrada));

  const coincidePorInicioDePalabra = (emp, busq) => {
    const limpioBusq = busq.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!limpioBusq) return false;
    const textoCompleto = `${emp.nombre_completo || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.nombre || ''} ${emp.numero_empleado || ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const palabrasBusqueda = limpioBusq.split(/\s+/).filter(Boolean);
    const tokensEmpleado = textoCompleto.split(/[\s,]+/).filter(Boolean);
    return palabrasBusqueda.every(pb => tokensEmpleado.some(tok => tok.startsWith(pb)));
  };

  const coincidenciasEntrada = tieneMinimo3Letras
    ? pendientesPorLlegar.filter((emp) => coincidePorInicioDePalabra(emp, termino))
    : [];

  const demasiadasCoincidenciasEntrada = tieneMinimo3Letras && coincidenciasEntrada.length > 3;

  const coincidenciasEnPlanta = termino
    ? todosEnPlanta.filter((emp) => coincidePorInicioDePalabra(emp, termino))
    : todosEnPlanta;

  return (
    <div className="caseta-wrap">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{estilosComunesCaseta}</style>

      {/* MODAL DE DOBLE CONFIRMACIÓN */}
      {modalConfirmacion && (
        <div
          onClick={() => { if (!procesandoId) setModalConfirmacion(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.68)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: c.surfaceCard,
              border: `2px solid ${modalConfirmacion.tipoMarca === 'salida' ? '#0284c7' : c.accent}`,
              borderRadius: '18px', padding: '24px 22px', width: '100%', maxWidth: '410px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px'
            }}
          >
            <span style={{
              fontSize: '11.5px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em',
              padding: '4px 12px', borderRadius: '999px',
              background: modalConfirmacion.tipoMarca === 'salida' ? 'rgba(2,132,199,0.14)' : c.accentSoft,
              color: modalConfirmacion.tipoMarca === 'salida' ? '#0284c7' : c.accent
            }}>
              {modalConfirmacion.tipoMarca === 'salida' ? 'Confirmar Fin de Turno' : 'Confirmar Entrada a Planta'}
            </span>

            <AvatarColaborador u={modalConfirmacion.emp} size={68} />

            <div>
              <div style={{ fontSize: '15.5px', fontWeight: '900', color: c.text, lineHeight: 1.25 }}>
                {formatearApellidosNombre(modalConfirmacion.emp?.nombre_completo, modalConfirmacion.emp)}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: c.textMuted, marginTop: '5px' }}>
                #{modalConfirmacion.emp?.numero_empleado}
                {modalConfirmacion.emp?.departamentos?.nombre ? ` • ${modalConfirmacion.emp.departamentos.nombre}` : ''}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '10px', width: '100%', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setModalConfirmacion(null)}
                disabled={Boolean(procesandoId)}
                style={{
                  height: '50px', borderRadius: '12px', border: `1.5px solid ${c.border}`,
                  background: c.bg, color: c.textMuted, fontSize: '14px', fontWeight: '800', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <X size={18} /> Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmarDesdeModal}
                disabled={Boolean(procesandoId)}
                style={{
                  height: '50px', borderRadius: '12px', border: 'none',
                  background: modalConfirmacion.tipoMarca === 'salida' ? '#0284c7' : c.accent,
                  color: '#ffffff', fontSize: '15px', fontWeight: '900', cursor: procesandoId ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Check size={20} strokeWidth={3} />
                <span>{procesandoId ? 'Registrando...' : 'Confirmar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 PESTAÑAS DEL PASE DE LISTA: POR LLEGAR | EN PLANTA | AUSENTES HOY */}
      <div className="tabs-aprobacion-bar caseta-tabs-bar">
        <button
          className={`tab-btn ${subTabAsistencia === 'por_llegar' ? 'active' : ''}`}
          onClick={() => setSubTabAsistencia('por_llegar')}
        >
          <Users size={15} />
          <span>Por Llegar</span>
          <span className="tab-badge" style={{ fontSize: '11px', padding: '1px 6px' }}>
            {pendientesPorLlegar.length}
          </span>
        </button>

        <button
          className={`tab-btn ${subTabAsistencia === 'en_planta' ? 'active' : ''}`}
          onClick={() => setSubTabAsistencia('en_planta')}
        >
          <UserCheck size={15} />
          <span>En Planta</span>
          <span className="tab-badge" style={{ fontSize: '11px', padding: '1px 6px' }}>
            {todosEnPlanta.length}
          </span>
        </button>

        <button
          className={`tab-btn ${subTabAsistencia === 'ausentes' ? 'active' : ''}`}
          onClick={() => setSubTabAsistencia('ausentes')}
        >
          <CalendarOff size={15} />
          <span>Ausentes Hoy</span>
          {ausentesProgramadosHoy.length > 0 && (
            <span className="tab-badge" style={{ fontSize: '11px', padding: '1px 6px' }}>
              {ausentesProgramadosHoy.length}
            </span>
          )}
        </button>
      </div>

      {/* BUSCADOR (SOLO PARA "POR LLEGAR" Y "EN PLANTA") */}
      {subTabAsistencia !== 'ausentes' && (
        <div
          className="caseta-search-box"
          style={{
            background: c.surfaceCard,
            border: `1.5px solid ${tieneMinimo3Letras ? c.accent : c.border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search
                size={17}
                style={{
                  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                  color: tieneMinimo3Letras ? c.accent : c.textMuted, pointerEvents: 'none'
                }}
              />
              <input
                ref={inputBusquedaRef}
                type="text"
                className="caseta-search-input"
                placeholder="Buscar por apellido o nombre..."
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                style={{
                  border: `1.5px solid ${tieneMinimo3Letras ? c.accent : c.border}`,
                  background: c.bg,
                  color: c.text
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
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    width: '34px', height: '34px', borderRadius: '8px',
                    background: 'rgba(239,68,68,0.12)', border: 'none', color: '#ef4444',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              )}
            </div>

            <button
              onClick={cargarDatos}
              title="Actualizar"
              className="caseta-refresh-btn"
              style={{
                border: `1.5px solid ${c.border}`, background: c.bg, color: c.text,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {ultimoRegistradoTexto && (
            <div style={{
              background: c.accentSoft, border: `1.5px solid ${c.accent}`, color: c.accent,
              borderRadius: '10px', padding: '9px 12px', fontSize: '13.5px', fontWeight: '900', textAlign: 'center'
            }}>
              {ultimoRegistradoTexto}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 1: POR LLEGAR (LIMPIA, SOLO BUSCADOR) */}
      {subTabAsistencia === 'por_llegar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {!tieneMinimo3Letras ? (
            <div style={{
              background: c.surfaceCard, border: `1px dashed ${c.border}`, borderRadius: '12px',
              padding: '32px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              Escribe al menos <strong style={{ color: c.text }}>3 letras</strong> del apellido o nombre para registrar entrada.
            </div>
          ) : demasiadasCoincidenciasEntrada ? (
            <div style={{
              background: 'rgba(245, 158, 11, 0.10)', border: '1.5px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px', padding: '24px 18px', textAlign: 'center', color: '#d97706', fontSize: '14px', fontWeight: '800'
            }}>
              Hay {coincidenciasEntrada.length} coincidencias.<br />
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: c.textMuted }}>
                Escribe una letra más para ver máximo 3 resultados.
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
                  className="caseta-list-item"
                  style={{
                    background: c.surfaceCard,
                    border: `1.5px solid ${c.border}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <AvatarColaborador u={emp} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="caseta-emp-name" style={{ color: c.text }}>
                        {formatearApellidosNombre(emp.nombre_completo, emp)}
                      </div>
                      <div style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '600', marginTop: '2px' }}>
                        <strong style={{ color: c.text }}>#{emp.numero_empleado}</strong>
                        {emp.departamentos?.nombre && ` • ${emp.departamentos.nombre}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {tipoInc === 'retardo_en_espera' ? (
                      <button
                        type="button"
                        onClick={() => navigate('/caseta')}
                        style={{
                          height: '38px', padding: '0 12px', borderRadius: '8px',
                          border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.14)',
                          color: '#d97706', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer'
                        }}
                      >
                        ⏳ Ver en Pases de Puerta
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRetenerPorFaltaSinAviso(emp)}
                          disabled={Boolean(procesandoId)}
                          title="Retener porque faltó sin aviso"
                          style={{
                            height: '44px', padding: '0 11px', borderRadius: '10px',
                            border: '1.5px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)',
                            color: '#ef4444', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer'
                          }}
                        >
                          Faltó s/aviso
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalConfirmacion({ emp, tipoMarca: 'entrada' })}
                          disabled={Boolean(procesandoId)}
                          style={{
                            minWidth: '60px', height: '44px', padding: '0 18px', borderRadius: '10px', border: 'none',
                            background: c.accent, color: '#fff', fontSize: '13px', fontWeight: '900',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Check size={20} strokeWidth={3} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PESTAÑA 2: EN PLANTA (SOLO ASISTENCIA DEL DÍA Y SALIDA DE TURNO) */}
      {subTabAsistencia === 'en_planta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {todosEnPlanta.length === 0 ? (
            <div style={{
              background: c.surfaceCard, border: `1px dashed ${c.border}`, borderRadius: '12px',
              padding: '32px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              Aún no hay colaboradores registrados en planta el día de hoy.
            </div>
          ) : (
            coincidenciasEnPlanta.map((emp) => {
              const reg = mapaAsistencias[emp.id];
              const tieneSalida = Boolean(reg?.hora_salida);

              return (
                <div
                  key={emp.id}
                  className="caseta-list-item"
                  style={{
                    background: c.surfaceCard,
                    border: `1.5px solid ${c.border}`,
                    borderLeft: `4px solid ${tieneSalida ? '#64748b' : '#16a34a'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <AvatarColaborador u={emp} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="caseta-emp-name" style={{ color: c.text }}>
                        {formatearApellidosNombre(emp.nombre_completo, emp)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11.5px', color: c.textMuted, fontWeight: '600', marginTop: '2px' }}>
                        <strong style={{ color: c.text }}>#{emp.numero_empleado}</strong>
                        {emp.departamentos?.nombre && <span>• {emp.departamentos.nombre}</span>}
                        {reg?.hora_entrada && (
                          <span style={{ fontSize: '10.5px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', color: '#16a34a', background: 'rgba(22,163,74,0.12)' }}>
                            Entrada: {reg.hora_entrada}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {tieneSalida ? (
                      <>
                        <span style={{
                          fontSize: '11.5px', fontWeight: '800', color: '#0284c7',
                          background: 'rgba(2,132,199,0.10)', padding: '6px 10px', borderRadius: '8px'
                        }}>
                          Salida: {reg.hora_salida}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeshacerSalida(emp.id)}
                          disabled={Boolean(procesandoId)}
                          title="Deshacer salida"
                          style={{
                            width: '36px', height: '36px', borderRadius: '9px',
                            border: `1px solid ${c.border}`, background: c.bg, color: c.textMuted,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Undo2 size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setModalConfirmacion({ emp, tipoMarca: 'salida' })}
                          disabled={Boolean(procesandoId)}
                          style={{
                            height: '38px', padding: '0 14px', borderRadius: '9px', border: `1.5px solid ${c.border}`,
                            background: c.bg, color: c.text, fontSize: '12px', fontWeight: '800',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          <LogOut size={14} /> Salida
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeshacerEntrada(emp.id)}
                          disabled={Boolean(procesandoId)}
                          title="Deshacer entrada"
                          style={{
                            width: '38px', height: '38px', borderRadius: '9px',
                            border: `1px solid ${c.border}`, background: 'transparent', color: c.textMuted,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                          }}
                        >
                          <Undo2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PESTAÑA 3: AUSENTES HOY (VACACIONES Y FALTAS PROGRAMADAS — SIN TECLEAR NADA) */}
      {subTabAsistencia === 'ausentes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {ausentesProgramadosHoy.length === 0 ? (
            <div style={{
              background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
              padding: '36px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              No hay colaboradores con Vacaciones ni Faltas programadas el día de hoy.
            </div>
          ) : (
            ausentesProgramadosHoy.map((emp) => {
              const inc = mapaIncidenciasHoy[emp.id];
              return (
                <div
                  key={emp.id}
                  className="caseta-list-item"
                  style={{
                    background: c.surfaceCard,
                    border: `1.5px solid ${c.border}`,
                    borderLeft: `4px solid ${inc.color}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <AvatarColaborador u={emp} size={40} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="caseta-emp-name" style={{ color: c.text }}>
                        {formatearApellidosNombre(emp.nombre_completo, emp)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '3px' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '5px',
                          color: inc.color, background: inc.bg
                        }}>
                          {inc.etiqueta}
                        </span>
                        <span style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '700' }}>
                          #{emp.numero_empleado} {emp.departamentos?.nombre ? `• ${emp.departamentos.nombre}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSolicitarIngresoEnAusencia(emp, inc)}
                    disabled={Boolean(procesandoId)}
                    style={{
                      height: '38px', padding: '0 13px', borderRadius: '9px',
                      border: '1.5px solid #d97706', background: 'rgba(245,158,11,0.12)',
                      color: '#d97706', fontSize: '12px', fontWeight: '800', cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    Solicitar Acceso
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
