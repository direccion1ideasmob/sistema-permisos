import { formatearApellidosNombre } from '../../core/utils/ordenNombre';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../permisos/aprobacionesStyles';
import {
  obtenerDatosCaseta,
  registrarCheckCaseta,
  registrarAsistenciaLista,
  solicitarAutorizacionInusualCaseta,
  deshacerEntradaReciente,
  deshacerSalidaReciente,
  obtenerHoraLimiteTolerancia,
  obtenerFechaLocalHoy
} from './services/vigilanciaService';
import {
  DoorOpen, RotateCcw, CheckCircle2, LogOut,
  Search, RefreshCw, UserCheck, Users, CalendarOff,
  Hourglass, CornerUpLeft, X, Check, Undo2, ShieldAlert
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
  const [horaLimiteStr, setHoraLimiteStr] = useState('07:15');

  const [modalConfirmacion, setModalConfirmacion] = useState(null);
  const [bannerResultado, setBannerResultado] = useState(null); // { tipo: 'verde' | 'rojo', texto: string }
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [procesandoId, setProcesandoId] = useState(null);

  const sedeGuardia = usuario?.sede_id || null;
  const hoyStr = obtenerFechaLocalHoy();

  const mostrarBanner = (tipo, texto) => {
    setBannerResultado({ tipo, texto });
    setTimeout(() => {
      setBannerResultado(null);
      if (inputBusquedaRef.current) inputBusquedaRef.current.focus();
    }, tipo === 'rojo' ? 4000 : 2000);
  };

  const cargarDatos = useCallback(async () => {
    try {
      const [data, lim] = await Promise.all([
        obtenerDatosCaseta(sedeGuardia, hoyStr),
        obtenerHoraLimiteTolerancia()
      ]);
      setHoraLimiteStr(lim || '07:15');
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
    const intervalo = setInterval(cargarDatos, 6000);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  // Saber si en este minuto ya pasó la hora de tolerancia
  const esDespuesDeTolerancia = () => {
    const ahora = new Date();
    const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const [hL, mL] = (horaLimiteStr || '07:15').split(':').map(Number);
    const minLim = (isNaN(hL) ? 7 : hL) * 60 + (isNaN(mL) ? 15 : mL);
    return minAhora > minLim;
  };

  const handleSellarPase = async (id, tipoMovimiento, nombreEmp = '') => {
    setProcesandoId(id);
    try {
      const res = await registrarCheckCaseta(id, tipoMovimiento);
      if (res?.resultado === 'retenido_por_horario') {
        mostrarBanner('rojo', `🛑 ALTO — HORARIO NO COINCIDE (${res.detalleDesfase}). Hazlo a un lado mientras autoriza Jefatura / RH.`);
        setSubTabPases('por_cruzar');
      } else if (tipoMovimiento === 'retiro') {
        mostrarBanner('rojo', `↩️ RETIRO CONFIRMADO ${nombreEmp ? ': ' + nombreEmp : ''}`);
      } else {
        mostrarBanner('verde', `✅ ADELANTE — CRUCE REGISTRADO ${nombreEmp ? ': ' + nombreEmp : ''}`);
      }
      await cargarDatos();
    } catch (err) {
      alert('Error al sellar movimiento: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleConfirmarEntradaModal = async () => {
    if (!modalConfirmacion || procesandoId) return;
    const { emp, inc } = modalConfirmacion;
    const empleadoId = emp.id;
    const nombreColaborador = emp.nombre_completo;

    setProcesandoId(`${empleadoId}-entrada`);
    try {
      // Si tenía Vacaciones o Falta programada hoy, solicita reautorización
      if (inc?.tipo === 'ausencia_autorizada') {
        const esVac = String(inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        await solicitarAutorizacionInusualCaseta(
          inc.paseId,
          esVac ? 'presentacion_en_vacaciones' : 'presentacion_en_falta'
        );
        setModalConfirmacion(null);
        setBusquedaTexto('');
        mostrarBanner('rojo', `🛑 ALTO — NO DEJAR PASAR A ${nombreColaborador} (Tenía ${esVac ? 'Vacaciones' : 'Falta'} hoy, esperando firma)`);
        await cargarDatos();
        return;
      }

      const res = await registrarAsistenciaLista(empleadoId, 'entrada', usuario?.id || null, false);
      setModalConfirmacion(null);
      setBusquedaTexto('');

      if (res?.resultado === 'ok' || res?.resultado === 'entrada_registrada') {
        mostrarBanner('verde', `✅ ADELANTE — PASA A PLANTA: ${nombreColaborador}`);
      } else {
        mostrarBanner('rojo', `🛑 ALTO — NO DEJAR PASAR A ${nombreColaborador} (Pásalo a espera en lo que autoriza su Jefe / RH)`);
      }

      await cargarDatos();
    } catch (err) {
      alert('Error al procesar registro: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  // Salida de turno directa en 1 solo clic para no hacer fila a las 5:00 PM
  const handleSalidaDirecta = async (emp) => {
    if (procesandoId) return;
    setProcesandoId(`${emp.id}-salida`);
    try {
      await registrarAsistenciaLista(emp.id, 'salida', usuario?.id || null, false);
      setBusquedaTexto('');
      mostrarBanner('verde', `✓ SALIDA DE TURNO REGISTRADA: ${emp.nombre_completo}`);
      await cargarDatos();
    } catch (err) {
      alert('Error al registrar salida: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleSolicitarReingresoSalidaDefinitiva = async (pase) => {
    setProcesandoId(pase.id);
    try {
      await solicitarAutorizacionInusualCaseta(pase.id, 'reingreso_salida_definitiva');
      setSubTabPases('por_cruzar');
      mostrarBanner('rojo', `🛑 ALTO — ${pase.usuarios?.nombre_completo} tenía Salida Definitiva. Esperando autorización para reingresar.`);
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
      height: 40px;
      padding: 0 16px;
      border-radius: 9px;
      border: none;
      font-size: 13px;
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

  // Banner Semáforo (Verde = Adelante / Rojo = Alto, no dejar pasar)
  const renderBannerSemaforo = () => {
    if (!bannerResultado) return null;
    const esRojo = bannerResultado.tipo === 'rojo';
    return (
      <div style={{
        background: esRojo ? '#dc2626' : '#16a34a',
        color: '#ffffff',
        borderRadius: '12px',
        padding: '13px 16px',
        fontSize: '15px',
        fontWeight: '900',
        textAlign: 'center',
        boxShadow: esRojo ? '0 8px 24px rgba(220,38,38,0.38)' : '0 6px 18px rgba(22,163,74,0.32)',
        letterSpacing: '0.01em'
      }}>
        {bannerResultado.texto}
      </div>
    );
  };

  // ====================================================================
  // VISTA 1: PASES DE PUERTA (SALIDAS DURANTE EL TURNO, REINGRESOS Y DETENIDOS)
  // ====================================================================
  if (vista === 'pases') {
    const totalEnPuerta = pasesPorCruzar.length + retenidosEnEspera.length;

    return (
      <div className="caseta-wrap">
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
        <style>{estilosComunesCaseta}</style>

        {renderBannerSemaforo()}

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

        {subTabPases === 'por_cruzar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {pasesPorCruzar.map((p) => {
              const esSalida = p.tipo_permiso === 'salida';
              const esRegresoCasa = Boolean(p.seRegresaACasa);
              const colorBorde = esRegresoCasa ? '#ef4444' : (esSalida ? '#0284c7' : '#16a34a');
              const bgBadge = esRegresoCasa ? 'rgba(239,68,68,0.14)' : (esSalida ? 'rgba(2,132,199,0.12)' : 'rgba(22,163,74,0.12)');
              const textoBadge = esRegresoCasa
                ? '🚫 ORDEN RH: SE REGRESA A CASA'
                : (esSalida ? (p.requiereRegreso ? '🔵 SALIDA CON REGRESO' : '🔵 SALIDA DEFINITIVA') : '🟢 AUTORIZADO — DAR PASO');

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
                      onClick={() => handleSellarPase(p.id, esRegresoCasa ? 'retiro' : (esSalida ? 'salida' : 'entrada'), p.usuarios?.nombre_completo)}
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

            {retenidosEnEspera.map((p) => (
              <div
                key={p.id}
                className="caseta-card"
                style={{
                  borderLeft: '5px solid #dc2626',
                  background: modoOscuro ? 'rgba(220,38,38,0.06)' : '#fff5f5'
                }}
              >
                <div className="caseta-card-left">
                  <AvatarColaborador u={p.usuarios} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '14.5px', fontWeight: '800', color: c.text, lineHeight: 1.2 }}>
                      {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px', fontSize: '11.5px', fontWeight: '700' }}>
                      <span style={{ color: '#dc2626', background: 'rgba(220,38,38,0.14)', padding: '2px 8px', borderRadius: '5px', fontWeight: '800' }}>
                        {p.etiquetaMotivoPuerta || '🛑 Detenido en puerta'}
                      </span>
                      <span style={{ color: c.textMuted }}>
                        • Esperando firma de: <strong style={{ color: c.text }}>{p.esperandoFirmaDe}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: '12px', fontWeight: '900', color: '#dc2626',
                  display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0
                }}>
                  <Hourglass size={14} /> NO DEJAR PASAR AÚN
                </span>
              </div>
            ))}

            {pasesPorCruzar.length === 0 && retenidosEnEspera.length === 0 && (
              <div style={{
                background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
                padding: '36px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
              }}>
                No hay pases pendientes ni personas detenidas en puerta en este momento.
              </div>
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
                        {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
                      </div>
                      <div style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '700', marginTop: '3px' }}>
                        #{p.usuarios?.numero_empleado} • {p.horarioProgramado}
                      </div>
                    </div>
                  </div>

                  <div className="caseta-card-actions">
                    <button
                      onClick={() => handleSellarPase(p.id, 'reingreso', p.usuarios?.nombre_completo)}
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
  // VISTA 2: PASE DE LISTA (FLUJO RÁPIDO CON SEMÁFORO Y SIN BRINCAR DE PANTALLA)
  // ====================================================================
  const termino = (busquedaTexto || '').toLowerCase().trim();
  const letrasSinEspacios = termino.replace(/\s+/g, '');
  const tieneMinimo3Letras = letrasSinEspacios.length >= 3;

  const todosSinEntrada = empleadosSede.filter(emp => !mapaAsistencias[emp.id]?.hora_entrada);
  const ausentesProgramadosHoy = todosSinEntrada.filter((emp) => {
    const inc = mapaIncidenciasHoy[emp.id];
    return inc?.tipo === 'ausencia_autorizada';
  });
  const todosEnPlanta = empleadosSede.filter(emp => Boolean(mapaAsistencias[emp.id]?.hora_entrada));

  // Personas actualmente paradas a un lado en la reja (En espera de firma o ya con resolución para darles paso / retiro)
  const detenidosEnReja = todosSinEntrada.filter((emp) => {
    const inc = mapaIncidenciasHoy[emp.id];
    const t = inc?.tipo || 'normal';
    if (t === 'retardo_regresa' && inc?.yaSeRetiroACasa) return false;
    return t === 'retardo_en_espera' || t === 'retardo_autorizado' || t === 'retardo_regresa';
  });

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
    ? todosSinEntrada.filter((emp) => coincidePorInicioDePalabra(emp, termino))
    : [];

  const demasiadasCoincidenciasEntrada = tieneMinimo3Letras && coincidenciasEntrada.length > 3;

  const coincidenciasEnPlanta = termino
    ? todosEnPlanta.filter((emp) => coincidePorInicioDePalabra(emp, termino))
    : todosEnPlanta;

  const fueraDeToleranciaAhora = esDespuesDeTolerancia();

  return (
    <div className="caseta-wrap">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{estilosComunesCaseta}</style>

      {/* MODAL DE CONFIRMACIÓN CON SEMÁFORO (VERDE = ENTRADA NORMAL / ROJO = RETENER EN PUERTA) */}
      {modalConfirmacion && (
        <div
          onClick={() => { if (!procesandoId) setModalConfirmacion(null); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: c.surfaceCard,
              border: `2.5px solid ${modalConfirmacion.requiereRetencion ? '#dc2626' : '#16a34a'}`,
              borderRadius: '18px', padding: '24px 22px', width: '100%', maxWidth: '420px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.45)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px'
            }}
          >
            <span style={{
              fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em',
              padding: '5px 14px', borderRadius: '999px',
              background: modalConfirmacion.requiereRetencion ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)',
              color: modalConfirmacion.requiereRetencion ? '#dc2626' : '#16a34a'
            }}>
              {modalConfirmacion.requiereRetencion ? `🛑 ${modalConfirmacion.motivoRetencion}` : '✅ ENTRADA NORMAL EN TIEMPO'}
            </span>

            <AvatarColaborador u={modalConfirmacion.emp} size={68} />

            <div>
              <div style={{ fontSize: '16px', fontWeight: '900', color: c.text, lineHeight: 1.25 }}>
                {formatearApellidosNombre(modalConfirmacion.emp?.nombre_completo, modalConfirmacion.emp)}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: c.textMuted, marginTop: '4px' }}>
                #{modalConfirmacion.emp?.numero_empleado}
                {modalConfirmacion.emp?.departamentos?.nombre ? ` • ${modalConfirmacion.emp.departamentos.nombre}` : ''}
              </div>
            </div>

            {modalConfirmacion.requiereRetencion && (
              <div style={{
                background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.35)',
                color: '#dc2626', borderRadius: '10px', padding: '8px 12px', fontSize: '12.5px', fontWeight: '800'
              }}>
                ⚠️ NO LO DEJES PASAR AÚN. Al confirmar, quedará en espera aquí mismo mientras su Jefe o RH autoriza.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '10px', width: '100%', marginTop: '4px' }}>
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
                onClick={handleConfirmarEntradaModal}
                disabled={Boolean(procesandoId)}
                style={{
                  height: '50px', borderRadius: '12px', border: 'none',
                  background: modalConfirmacion.requiereRetencion ? '#dc2626' : '#16a34a',
                  color: '#ffffff', fontSize: '14.5px', fontWeight: '900', cursor: procesandoId ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px'
                }}
              >
                {modalConfirmacion.requiereRetencion ? <ShieldAlert size={19} /> : <Check size={20} strokeWidth={3} />}
                <span>
                  {procesandoId
                    ? 'Procesando...'
                    : (modalConfirmacion.requiereRetencion ? 'Retener y Pedir Firma' : 'Dar Entrada')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑAS DEL PASE DE LISTA */}
      <div className="tabs-aprobacion-bar caseta-tabs-bar">
        <button
          className={`tab-btn ${subTabAsistencia === 'por_llegar' ? 'active' : ''}`}
          onClick={() => setSubTabAsistencia('por_llegar')}
        >
          <Users size={15} />
          <span>Entrada ({todosSinEntrada.length})</span>
        </button>

        <button
          className={`tab-btn ${subTabAsistencia === 'en_planta' ? 'active' : ''}`}
          onClick={() => setSubTabAsistencia('en_planta')}
        >
          <UserCheck size={15} />
          <span>En Planta / Salidas ({todosEnPlanta.length})</span>
        </button>

        <button
          className={`tab-btn ${subTabAsistencia === 'ausentes' ? 'active' : ''}`}
          onClick={() => setSubTabAsistencia('ausentes')}
        >
          <CalendarOff size={15} />
          <span>Vacaciones / Faltas ({ausentesProgramadosHoy.length})</span>
        </button>
      </div>

      {renderBannerSemaforo()}

      {/* BUSCADOR RÁPIDO */}
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
                placeholder={subTabAsistencia === 'en_planta' ? 'Filtrar personal en planta para dar salida...' : 'Escribe 3 letras del apellido o nombre...'}
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
        </div>
      )}

      {/* PESTAÑA 1: ENTRADA MATUTINA */}
      {subTabAsistencia === 'por_llegar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          {/* RESULTADOS DEL BUSCADOR CON SEMÁFORO VISUAL ANTES DE CONFIRMAR */}
          {!tieneMinimo3Letras ? (
            <div style={{
              background: c.surfaceCard, border: `1px dashed ${c.border}`, borderRadius: '12px',
              padding: '24px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              Escribe <strong style={{ color: c.text }}>3 letras</strong> del apellido o nombre para dar entrada (Hora límite hoy: <strong style={{ color: c.text }}>{horaLimiteStr} hrs</strong>).
            </div>
          ) : demasiadasCoincidenciasEntrada ? (
            <div style={{
              background: 'rgba(245, 158, 11, 0.10)', border: '1.5px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '12px', padding: '20px 18px', textAlign: 'center', color: '#d97706', fontSize: '14px', fontWeight: '800'
            }}>
              Hay {coincidenciasEntrada.length} coincidencias. Escribe una letra más.
            </div>
          ) : coincidenciasEntrada.length === 0 ? (
            <div style={{
              background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px',
              padding: '24px 20px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '600'
            }}>
              No se encontró ningún colaborador pendiente de entrada con "{busquedaTexto}".
            </div>
          ) : (
            coincidenciasEntrada.map((emp) => {
              const inc = mapaIncidenciasHoy[emp.id];
              const tipoInc = inc?.tipo || 'normal';

              // Determinar si requiere retención en puerta (Semáforo Rojo) o si pasa directo (Semáforo Verde)
              let requiereRetencion = false;
              let motivoRetencion = '';

              if (tipoInc === 'falta_ayer_sin_aviso') {
                requiereRetencion = true;
                motivoRetencion = 'FALTÓ AYER SIN AVISO';
              } else if (tipoInc === 'ausencia_autorizada') {
                requiereRetencion = true;
                motivoRetencion = String(inc?.etiqueta || '').includes('Vacaciones') ? 'ESTÁ DE VACACIONES HOY' : 'TIENE FALTA PROGRAMADA HOY';
              } else if (fueraDeToleranciaAhora && tipoInc !== 'retardo_autorizado') {
                requiereRetencion = true;
                motivoRetencion = `LLEGADA TARDE (Límite ${horaLimiteStr} hrs)`;
              }

              return (
                <div
                  key={emp.id}
                  className="caseta-list-item"
                  style={{
                    background: requiereRetencion ? (modoOscuro ? 'rgba(220,38,38,0.08)' : '#fff5f5') : c.surfaceCard,
                    border: `2px solid ${requiereRetencion ? '#dc2626' : '#16a34a'}`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <AvatarColaborador u={emp} size={42} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="caseta-emp-name" style={{ color: c.text }}>
                        {formatearApellidosNombre(emp.nombre_completo, emp)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '11.5px', color: c.textMuted, fontWeight: '700', marginTop: '3px' }}>
                        <strong style={{ color: c.text }}>#{emp.numero_empleado}</strong>
                        {emp.departamentos?.nombre && <span>• {emp.departamentos.nombre}</span>}
                        <span style={{
                          padding: '2px 8px', borderRadius: '5px', fontWeight: '800', fontSize: '11px',
                          background: requiereRetencion ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)',
                          color: requiereRetencion ? '#dc2626' : '#16a34a'
                        }}>
                          {requiereRetencion ? `🛑 ${motivoRetencion}` : '🟢 PASA A PLANTA'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {tipoInc === 'retardo_en_espera' ? (
                      <span style={{
                        padding: '8px 12px', borderRadius: '9px', background: 'rgba(220,38,38,0.14)',
                        color: '#dc2626', fontSize: '12px', fontWeight: '900'
                      }}>
                        🛑 Ya detenido esperando firma
                      </span>
                    ) : tipoInc === 'retardo_autorizado' ? (
                      <button
                        type="button"
                        onClick={() => handleSellarPase(inc.paseId, 'entrada', emp.nombre_completo)}
                        disabled={Boolean(procesandoId)}
                        style={{
                          height: '44px', padding: '0 16px', borderRadius: '10px', border: 'none',
                          background: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: '900', cursor: 'pointer'
                        }}
                      >
                        ✅ Dar Paso
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setModalConfirmacion({ emp, inc, requiereRetencion, motivoRetencion })}
                        disabled={Boolean(procesandoId)}
                        style={{
                          height: '46px', padding: '0 18px', borderRadius: '11px', border: 'none',
                          background: requiereRetencion ? '#dc2626' : '#16a34a',
                          color: '#fff', fontSize: '13px', fontWeight: '900', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}
                      >
                        {requiereRetencion ? (
                          <>🛑 Retener a un lado</>
                        ) : (
                          <><Check size={19} strokeWidth={3} /> Dar Entrada</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* CAJÓN EN LA MISMA PANTALLA: PERSONAS DETENIDAS EN LA REJA ESPERANDO RESPUESTA */}
          {detenidosEnReja.length > 0 && (
            <div style={{
              background: c.surfaceCard,
              border: '2px solid #dc2626',
              borderRadius: '14px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{
                fontSize: '12px', fontWeight: '900', color: '#dc2626',
                textTransform: 'uppercase', letterSpacing: '0.03em',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <span>🛑 Personas detenidas a un lado en la reja (No dejar pasar hasta que cambie a verde)</span>
                <span>{detenidosEnReja.length}</span>
              </div>

              {detenidosEnReja.map((emp) => {
                const inc = mapaIncidenciasHoy[emp.id];
                const t = inc?.tipo;
                const yaAutorizado = t === 'retardo_autorizado';
                const seRetira = t === 'retardo_regresa';

                return (
                  <div
                    key={emp.id}
                    className="caseta-list-item"
                    style={{
                      background: yaAutorizado
                        ? (modoOscuro ? 'rgba(22,163,74,0.16)' : '#f0fdf4')
                        : (modoOscuro ? 'rgba(220,38,38,0.10)' : '#fef2f2'),
                      border: `1.5px solid ${yaAutorizado ? '#16a34a' : '#dc2626'}`,
                      padding: '9px 12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <AvatarColaborador u={emp} size={38} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>
                          {formatearApellidosNombre(emp.nombre_completo, emp)}
                        </div>
                        <div style={{ fontSize: '11.5px', fontWeight: '800', color: yaAutorizado ? '#16a34a' : '#dc2626', marginTop: '2px' }}>
                          {inc?.etiqueta}
                        </div>
                      </div>
                    </div>

                    {yaAutorizado ? (
                      <button
                        type="button"
                        onClick={() => handleSellarPase(inc.paseId, 'entrada', emp.nombre_completo)}
                        disabled={Boolean(procesandoId)}
                        style={{
                          height: '40px', padding: '0 16px', borderRadius: '9px', border: 'none',
                          background: '#16a34a', color: '#fff', fontSize: '12.5px', fontWeight: '900', cursor: 'pointer'
                        }}
                      >
                        ✅ Dar Paso a Planta
                      </button>
                    ) : seRetira ? (
                      <button
                        type="button"
                        onClick={() => handleSellarPase(inc.paseId, 'retiro', emp.nombre_completo)}
                        disabled={Boolean(procesandoId)}
                        style={{
                          height: '40px', padding: '0 14px', borderRadius: '9px', border: 'none',
                          background: '#dc2626', color: '#fff', fontSize: '12.5px', fontWeight: '900', cursor: 'pointer'
                        }}
                      >
                        ↩️ Confirmar Retiro a Casa
                      </button>
                    ) : (
                      <span style={{ fontSize: '11.5px', fontWeight: '900', color: '#dc2626', whiteSpace: 'nowrap' }}>
                        ⏳ Esperando firma...
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: EN PLANTA / SALIDAS RÁPIDAS EN 1 CLIC */}
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
                          onClick={() => handleSalidaDirecta(emp)}
                          disabled={Boolean(procesandoId)}
                          style={{
                            height: '40px', padding: '0 16px', borderRadius: '9px', border: 'none',
                            background: '#0284c7', color: '#ffffff', fontSize: '12.5px', fontWeight: '800',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          <LogOut size={14} /> Dar Salida
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

      {/* PESTAÑA 3: VACACIONES Y FALTAS DE HOY */}
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
                    onClick={() => {
                      setSubTabAsistencia('por_llegar');
                      setModalConfirmacion({
                        emp,
                        inc,
                        requiereRetencion: true,
                        motivoRetencion: String(inc?.etiqueta || '').includes('Vacaciones') ? 'ESTÁ DE VACACIONES HOY' : 'TIENE FALTA PROGRAMADA HOY'
                      });
                    }}
                    disabled={Boolean(procesandoId)}
                    style={{
                      height: '38px', padding: '0 13px', borderRadius: '9px',
                      border: '1.5px solid #dc2626', background: 'rgba(220,38,38,0.10)',
                      color: '#dc2626', fontSize: '12px', fontWeight: '800', cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    🛑 Se presentó (Pedir Firma)
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
