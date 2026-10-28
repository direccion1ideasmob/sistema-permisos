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
  obtenerHoraSalidaOficial,
  obtenerFechaLocalHoy
} from './services/vigilanciaService';
import {
  Search, RefreshCw, X, Undo2, Check, ShieldAlert, Clock,
  ArrowUpRight, ArrowDownLeft, Lock, Unlock, Users, FileCheck2, CalendarOff
} from 'lucide-react';

export default function Caseta() {
  const { usuario } = useAuth();
  const location = useLocation();
  const inputRef = useRef(null);

  // /caseta/asistencia = Terminal Operativa de Pase de Lista
  // /caseta = Monitor Tabular de Pases de Puerta, Ausencias y Planta
  const esTerminalLista = location.pathname.includes('/asistencia') || location.pathname.includes('/retardo');

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

  const [retenidosEnEspera, setRetenidosEnEspera] = useState([]);
  const [pasesPorCruzar, setPasesPorCruzar] = useState([]);
  const [personalFuera, setPersonalFuera] = useState([]);
  const [crucesCompletadosHoy, setCrucesCompletadosHoy] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});
  const [mapaIncidenciasHoy, setMapaIncidenciasHoy] = useState({});
  const [horaLimiteStr, setHoraLimiteStr] = useState('07:15');
  const [horaSalidaOficialStr, setHoraSalidaOficialStr] = useState('17:00');

  const [busqueda, setBusqueda] = useState('');
  const [filtroMonitor, setFiltroMonitor] = useState('pases_activos');
  const [procesandoId, setProcesandoId] = useState(null);
  const [bitacoraReciente, setBitacoraReciente] = useState([]);
  const [ultimoBanner, setUltimoBanner] = useState(null);

  const sedeGuardia = usuario?.sede_id || null;
  const hoyStr = obtenerFechaLocalHoy();

  const cargarDatos = useCallback(async () => {
    try {
      const [data, limEntrada, limSalida] = await Promise.all([
        obtenerDatosCaseta(sedeGuardia, hoyStr),
        obtenerHoraLimiteTolerancia(),
        obtenerHoraSalidaOficial()
      ]);
      setHoraLimiteStr(limEntrada || '07:15');
      setHoraSalidaOficialStr(limSalida || '17:00');
      setRetenidosEnEspera(data.retenidosEnEspera || []);
      setPasesPorCruzar(data.pasesPorCruzar || []);
      setPersonalFuera(data.personalFuera || []);
      setCrucesCompletadosHoy(data.crucesCompletadosHoy || []);
      setEmpleadosSede(data.empleadosSede || []);
      setMapaAsistencias(data.mapaAsistencias || {});
      setMapaIncidenciasHoy(data.mapaIncidenciasHoy || {});
    } catch (err) {
      console.error('Error cargando datos de caseta:', err);
    }
  }, [sedeGuardia, hoyStr]);

  useEffect(() => {
    cargarDatos();
    const t = setInterval(cargarDatos, 5000);
    return () => clearInterval(t);
  }, [cargarDatos]);

  const minActuales = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };

  const aMinutos = (hhmm = '07:15') => {
    const [h, m] = String(hhmm).split(':').map(Number);
    return (isNaN(h) ? 7 : h) * 60 + (isNaN(m) ? 15 : m);
  };

  // ====================================================================
  // CLASIFICADOR INDUSTRIAL ESTRICTO (ANDON: VERDE / ÁMBAR / ROJO / AZUL)
  // ====================================================================
  const diagnosticar = (emp) => {
    const asis = mapaAsistencias[emp.id];
    const inc = mapaIncidenciasHoy[emp.id];
    const entro = Boolean(asis?.hora_entrada);
    const salio = Boolean(asis?.hora_salida);

    const pasePuerta = pasesPorCruzar.find(p => p.usuario_id === emp.id);
    const paseRetenido = retenidosEnEspera.find(p => p.usuario_id === emp.id);
    const paseFuera = personalFuera.find(p => p.usuario_id === emp.id);
    const paseDefSellado = crucesCompletadosHoy.find(
      p => p.usuario_id === emp.id && p.tipo_permiso === 'salida' && !p.requiereRegreso && !p.horaEntradaCaseta
    );

    const ahoraM = minActuales();
    const limEntM = aMinutos(horaLimiteStr);
    const limSalM = aMinutos(horaSalidaOficialStr);

    // 1. RETENIDO EN ESPERA DE FIRMA
    if (paseRetenido || inc?.tipo === 'retardo_en_espera') {
      const autorizador = paseRetenido?.esperandoFirmaDe || inc?.esperandoFirmaDe || 'RH';
      const causa = paseRetenido?.etiquetaMotivoPuerta || 'INCIDENCIA';
      return {
        andon: 'AMBAR',
        color: '#d97706',
        bg: modoOscuro ? 'rgba(217,119,6,0.12)' : '#fffbeb',
        codigoEstado: 'RETENIDO EN PUERTA',
        detalle: `${causa} · PENDIENTE: ${autorizador.toUpperCase()}`,
        accionTexto: 'ESPERANDO FIRMA',
        codigoAccion: 'NINGUNA',
        bloqueado: true
      };
    }

    // 2. DICTAMEN DE RETIRO A CASA
    if (pasePuerta?.seRegresaACasa || (inc?.tipo === 'retardo_regresa' && !inc?.yaSeRetiroACasa)) {
      return {
        andon: 'ROJO',
        color: '#dc2626',
        bg: modoOscuro ? 'rgba(220,38,38,0.14)' : '#fef2f2',
        codigoEstado: 'ACCESO DENEGADO',
        detalle: 'ORDEN DE JEFATURA / RH: SE RETIRA',
        accionTexto: 'CONFIRMAR RETIRO',
        codigoAccion: 'RETIRO_CASA',
        paseId: pasePuerta?.id || inc?.paseId
      };
    }

    // 3. RETORNO DE SALIDA TEMPORAL
    if (paseFuera) {
      const obs = paseFuera.observacionesRaw || '';
      const mReg = obs.match(/Regresa:\s*(\d{1,2}):(\d{2})/i);
      const yaAvalado = /\[HORARIO AUTORIZADO EN CASETA\]/i.test(obs);
      if (mReg && !yaAvalado) {
        const pactadoM = parseInt(mReg[1], 10) * 60 + parseInt(mReg[2], 10);
        const exceso = ahoraM - pactadoM;
        if (exceso > 15) {
          return {
            andon: 'ROJO',
            color: '#dc2626',
            bg: modoOscuro ? 'rgba(220,38,38,0.12)' : '#fef2f2',
            codigoEstado: 'RETORNO VENCIDO',
            detalle: `EXCESO +${exceso} MIN (${paseFuera.horarioProgramado})`,
            accionTexto: 'RETENER / REAUTORIZAR',
            codigoAccion: 'REINGRESO_PASE',
            paseId: paseFuera.id
          };
        }
      }
      return {
        andon: 'AZUL',
        color: '#2563eb',
        bg: modoOscuro ? 'rgba(37,99,235,0.12)' : '#eff6ff',
        codigoEstado: 'RETORNO DE PASE',
        detalle: paseFuera.horarioProgramado,
        accionTexto: 'SELLAR REINGRESO',
        codigoAccion: 'REINGRESO_PASE',
        paseId: paseFuera.id
      };
    }

    // 4. SALIDA CON PASE AUTORIZADO
    if (pasePuerta && pasePuerta.tipo_permiso === 'salida') {
      const obs = pasePuerta.observacionesRaw || '';
      const mSal = obs.match(/Salida(?:\s+definitiva)?:\s*(\d{1,2}):(\d{2})/i);
      const yaAvalado = /\[HORARIO AUTORIZADO EN CASETA\]/i.test(obs);
      if (mSal && !yaAvalado) {
        const salM = parseInt(mSal[1], 10) * 60 + parseInt(mSal[2], 10);
        if (Math.abs(ahoraM - salM) > 20) {
          return {
            andon: 'ROJO',
            color: '#dc2626',
            bg: modoOscuro ? 'rgba(220,38,38,0.12)' : '#fef2f2',
            codigoEstado: 'HORA NO COINCIDE',
            detalle: `PROGRAMADO: ${pasePuerta.horarioProgramado}`,
            accionTexto: 'RETENER / REAUTORIZAR',
            codigoAccion: 'SALIDA_PASE',
            paseId: pasePuerta.id
          };
        }
      }
      return {
        andon: 'AZUL',
        color: '#0284c7',
        bg: modoOscuro ? 'rgba(2,132,199,0.12)' : '#f0f9ff',
        codigoEstado: pasePuerta.requiereRegreso ? 'PASE TEMPORAL' : 'PASE DEFINITIVO',
        detalle: pasePuerta.horarioProgramado,
        accionTexto: 'SELLAR SALIDA',
        codigoAccion: 'SALIDA_PASE',
        paseId: pasePuerta.id
      };
    }

    // 5. EVALUACIÓN DE ENTRADA A PLANTA
    if (!entro) {
      if (inc?.tipo === 'falta_ayer_sin_aviso') {
        return {
          andon: 'ROJO',
          color: '#dc2626',
          bg: modoOscuro ? 'rgba(220,38,38,0.12)' : '#fef2f2',
          codigoEstado: 'BLOQUEO · FALTA PREVIA',
          detalle: 'INAUSENCIA DÍA ANTERIOR SIN AVISO',
          accionTexto: 'RETENER EN PUERTA',
          codigoAccion: 'PROCESAR_ENTRADA'
        };
      }
      if (inc?.tipo === 'ausencia_autorizada') {
        const esVac = String(inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        return {
          andon: 'ROJO',
          color: '#dc2626',
          bg: modoOscuro ? 'rgba(220,38,38,0.12)' : '#fef2f2',
          codigoEstado: esVac ? 'BLOQUEO · VACACIONES' : 'BLOQUEO · FALTA HOY',
          detalle: 'AUSENCIA PROGRAMADA VIGENTE HOY',
          accionTexto: 'SOLICITAR INGRESO',
          codigoAccion: 'CAMBIO_AUSENCIA',
          inc
        };
      }
      if (inc?.tipo === 'retardo_autorizado' || (pasePuerta && pasePuerta.tipo_permiso !== 'salida')) {
        const obs = pasePuerta?.observacionesRaw || '';
        const mEst = obs.match(/Llegada estimada:\s*(\d{1,2}):(\d{2})/i);
        const yaAvalado = /\[COMPORTAMIENTO INUSUAL AUTORIZADO\]/i.test(obs);
        if (mEst && ahoraM > limEntM && !yaAvalado) {
          const promM = parseInt(mEst[1], 10) * 60 + parseInt(mEst[2], 10);
          if (ahoraM - promM > 15) {
            return {
              andon: 'ROJO',
              color: '#dc2626',
              bg: modoOscuro ? 'rgba(220,38,38,0.12)' : '#fef2f2',
              codigoEstado: 'TIEMPO EXCEDIDO',
              detalle: `LLEGADA +${ahoraM - promM} MIN SOBRE AVISO`,
              accionTexto: 'RETENER / REAUTORIZAR',
              codigoAccion: 'PROCESAR_ENTRADA',
              paseId: pasePuerta?.id || inc?.paseId
            };
          }
        }
        return {
          andon: 'VERDE',
          color: '#16a34a',
          bg: modoOscuro ? 'rgba(22,163,74,0.14)' : '#f0fdf4',
          codigoEstado: 'PASE LIBRE · AUTORIZADO',
          detalle: 'INGRESO APROBADO POR JEFATURA / RH',
          accionTexto: 'DAR ACCESO',
          codigoAccion: 'ACCESO_AUTORIZADO',
          paseId: pasePuerta?.id || inc?.paseId
        };
      }
      if (ahoraM > limEntM) {
        return {
          andon: 'ROJO',
          color: '#dc2626',
          bg: modoOscuro ? 'rgba(220,38,38,0.12)' : '#fef2f2',
          codigoEstado: 'BLOQUEO · RETARDO',
          detalle: `FUERA DE TOLERANCIA (${horaLimiteStr} HRS)`,
          accionTexto: 'RETENER EN PUERTA',
          codigoAccion: 'PROCESAR_ENTRADA'
        };
      }
      return {
        andon: 'VERDE',
        color: '#16a34a',
        bg: modoOscuro ? 'rgba(22,163,74,0.08)' : '#f0fdf4',
        codigoEstado: 'PASE LIBRE · EN TIEMPO',
        detalle: `ASISTENCIA ORDINARIA (LÍMITE ${horaLimiteStr})`,
        accionTexto: 'REGISTRAR ENTRADA',
        codigoAccion: 'PROCESAR_ENTRADA'
      };
    }

    // 6. EN PLANTA -> SALIDA DE FIN DE TURNO
    if (!salio) {
      const antesDeHora = ahoraM < (limSalM - 30);
      return {
        andon: antesDeHora ? 'AMBAR' : 'AZUL',
        color: antesDeHora ? '#d97706' : '#0284c7',
        bg: c.surfaceCard,
        codigoEstado: `EN PLANTA (${asis.hora_entrada})`,
        detalle: antesDeHora ? `SIN PASE DE SALIDA (TURNO CONCLUYE ${horaSalidaOficialStr})` : 'SALIDA ORDINARIA DE FIN DE TURNO',
        accionTexto: antesDeHora ? 'SALIDA ANTICIPADA' : 'REGISTRAR SALIDA',
        codigoAccion: 'SALIDA_TURNO',
        confirmarAnticipada: antesDeHora
      };
    }

    // 7. JORNADA CONCLUIDA HOY
    return {
      andon: 'GRIS',
      color: '#64748b',
      bg: c.surfaceCard,
      codigoEstado: `JORNADA CERRADA (${asis.hora_salida})`,
      detalle: paseDefSellado ? 'SALIÓ CON PASE DEFINITIVO' : 'ENTRADA Y SALIDA REGISTRADAS',
      accionTexto: paseDefSellado ? 'PEDIR REINGRESO' : 'REVERTIR SALIDA',
      codigoAccion: 'JORNADA_CERRADA',
      paseDefSellado
    };
  };

  const registrarEnBitacoraLocal = (emp, movimiento, color, deshacerFn = null) => {
    const hora = new Date().toTimeString().slice(0, 5);
    const item = {
      id: `${emp.id}-${Date.now()}`,
      empId: emp.id,
      nombre: formatearApellidosNombre(emp.nombre_completo, emp),
      num: emp.numero_empleado,
      hora,
      movimiento,
      color,
      deshacerFn
    };
    setBitacoraReciente(prev => [item, ...prev.filter(x => x.empId !== emp.id)].slice(0, 5));
    setUltimoBanner(item);
  };

  const ejecutarOperacion = async (emp) => {
    if (procesandoId) return;
    const diag = diagnosticar(emp);
    if (diag.bloqueado) return;

    if (diag.confirmarAnticipada) {
      const ok = window.confirm(`ATENCIÓN: ${emp.nombre_completo} NO cuenta con Pase de Salida y el turno concluye a las ${horaSalidaOficialStr} hrs.\n\n¿Confirmar salida de planta?`);
      if (!ok) return;
    }

    setProcesandoId(emp.id);
    try {
      setBusqueda('');

      if (diag.codigoAccion === 'PROCESAR_ENTRADA') {
        const res = await registrarAsistenciaLista(emp.id, 'entrada', usuario?.id || null, false);
        if (res?.resultado === 'ok' || res?.resultado === 'entrada_registrada') {
          registrarEnBitacoraLocal(emp, 'ENTRADA EN PLANTA', '#16a34a', () => revertirEntrada(emp.id));
        } else {
          registrarEnBitacoraLocal(emp, 'RETENIDO EN PUERTA · ESPERANDO FIRMA', '#dc2626');
        }
      } else if (diag.codigoAccion === 'CAMBIO_AUSENCIA') {
        const esVac = String(diag.inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        await solicitarAutorizacionInusualCaseta(
          diag.inc.paseId,
          esVac ? 'presentacion_en_vacaciones' : 'presentacion_en_falta'
        );
        registrarEnBitacoraLocal(emp, 'RETENIDO · SOLICITUD ENVIADA A RH', '#dc2626');
      } else if (diag.codigoAccion === 'ACCESO_AUTORIZADO') {
        if (diag.paseId) await registrarCheckCaseta(diag.paseId, 'entrada');
        else await registrarAsistenciaLista(emp.id, 'entrada', usuario?.id || null, true);
        registrarEnBitacoraLocal(emp, 'ACCESO AUTORIZADO · EN PLANTA', '#16a34a', () => revertirEntrada(emp.id));
      } else if (diag.codigoAccion === 'SALIDA_PASE') {
        const res = await registrarCheckCaseta(diag.paseId, 'salida');
        if (res?.resultado === 'retenido_por_horario') {
          registrarEnBitacoraLocal(emp, 'RETENIDO · HORA DE SALIDA NO COINCIDE', '#dc2626');
        } else {
          registrarEnBitacoraLocal(emp, 'SALIDA CON PASE SELLADA', '#0284c7');
        }
      } else if (diag.codigoAccion === 'REINGRESO_PASE') {
        const res = await registrarCheckCaseta(diag.paseId, 'reingreso');
        if (res?.resultado === 'retenido_por_horario') {
          registrarEnBitacoraLocal(emp, 'RETENIDO · RETORNO FUERA DE HORA', '#dc2626');
        } else {
          registrarEnBitacoraLocal(emp, 'REINGRESO A PLANTA SELLADO', '#16a34a');
        }
      } else if (diag.codigoAccion === 'RETIRO_CASA') {
        await registrarCheckCaseta(diag.paseId, 'retiro');
        registrarEnBitacoraLocal(emp, 'RETIRO DE PLANTA CONFIRMADO', '#dc2626');
      } else if (diag.codigoAccion === 'SALIDA_TURNO') {
        await registrarAsistenciaLista(emp.id, 'salida', usuario?.id || null, false);
        registrarEnBitacoraLocal(emp, 'SALIDA DE TURNO REGISTRADA', '#0284c7', () => revertirSalida(emp.id));
      } else if (diag.codigoAccion === 'JORNADA_CERRADA') {
        if (diag.paseDefSellado) {
          await solicitarAutorizacionInusualCaseta(diag.paseDefSellado.id, 'reingreso_salida_definitiva');
          registrarEnBitacoraLocal(emp, 'REINGRESO EXTRAORDINARIO SOLICITADO', '#d97706');
        } else {
          await deshacerSalidaReciente(emp.id);
          registrarEnBitacoraLocal(emp, 'SALIDA REVERTIDA · ACTIVO EN PLANTA', '#16a34a');
        }
      }

      await cargarDatos();
      if (inputRef.current) inputRef.current.focus();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const revertirEntrada = async (empId) => {
    setProcesandoId(empId);
    try {
      await deshacerEntradaReciente(empId);
      setBitacoraReciente(prev => prev.filter(x => x.empId !== empId));
      setUltimoBanner(null);
      await cargarDatos();
    } finally {
      setProcesandoId(null);
    }
  };

  const revertirSalida = async (empId) => {
    setProcesandoId(empId);
    try {
      await deshacerSalidaReciente(empId);
      setBitacoraReciente(prev => prev.filter(x => x.empId !== empId));
      setUltimoBanner(null);
      await cargarDatos();
    } finally {
      setProcesandoId(null);
    }
  };

  const Avatar = ({ u, size = 36 }) => {
    const url = u?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.nombre_completo || 'C')}&background=0f172a&color=fff&bold=true`;
    return (
      <img
        src={url}
        alt=""
        style={{
          width: `${size}px`, height: `${size}px`, borderRadius: '6px',
          objectFit: 'cover', border: `1px solid ${c.border}`, flexShrink: 0
        }}
      />
    );
  };

  const termino = (busqueda || '').toLowerCase().trim();
  const hayBusqueda = termino.replace(/\s+/g, '').length >= 2;

  const coincide = (emp, q) => {
    const limpio = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!limpio) return false;
    const full = `${emp.nombre_completo || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.nombre || ''} ${emp.numero_empleado || ''}`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const partes = limpio.split(/\s+/).filter(Boolean);
    const tokens = full.split(/[\s,]+/).filter(Boolean);
    return partes.every(p => tokens.some(t => t.startsWith(p)));
  };

  const coincidencias = hayBusqueda
    ? empleadosSede.filter(e => coincide(e, termino)).slice(0, 5)
    : [];

  const enPlantaList = empleadosSede.filter(e => Boolean(mapaAsistencias[e.id]?.hora_entrada) && !mapaAsistencias[e.id]?.hora_salida);
  const sinEntradaList = empleadosSede.filter(e => !mapaAsistencias[e.id]?.hora_entrada);
  const ausenciasProgramadasList = sinEntradaList.filter(e => mapaIncidenciasHoy[e.id]?.tipo === 'ausencia_autorizada');
  const pendientesLlegarList = sinEntradaList.filter(e => mapaIncidenciasHoy[e.id]?.tipo !== 'ausencia_autorizada');

  // Cola unificada de Control de Acceso (Carril Derecho fijo en Pase de Lista)
  const idsColaDerecha = new Set([
    ...retenidosEnEspera.map(p => p.usuario_id),
    ...pasesPorCruzar.map(p => p.usuario_id),
    ...personalFuera.map(p => p.usuario_id)
  ]);
  const colaControlDerecha = empleadosSede.filter(e => idsColaDerecha.has(e.id));

  const cssHMI = `
    .hmi-shell {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .hmi-statusbar {
      background: ${modoOscuro ? '#0f172a' : '#1e293b'};
      color: #f8fafc;
      border-radius: 10px;
      padding: 9px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .hmi-split {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 14px;
      align-items: start;
      width: 100%;
    }
    .hmi-panel {
      background: ${c.surfaceCard};
      border: 1.5px solid ${c.border};
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .hmi-panel-header {
      padding: 10px 14px;
      background: ${modoOscuro ? 'rgba(255,255,255,0.03)' : '#f8fafc'};
      border-bottom: 1px solid ${c.border};
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: ${c.textMuted};
    }
    .hmi-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .hmi-table th {
      text-align: left;
      padding: 9px 12px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${c.textMuted};
      border-bottom: 1.5px solid ${c.border};
      background: ${modoOscuro ? 'rgba(255,255,255,0.02)' : '#f8fafc'};
    }
    .hmi-table td {
      padding: 9px 12px;
      border-bottom: 1px solid ${c.border};
      vertical-align: middle;
    }
    @media (max-width: 960px) {
      .hmi-split { grid-template-columns: 1fr; }
    }
  `;

  // ====================================================================
  // VISTA 1: 📋 PASE DE LISTA (/caseta/asistencia) — TERMINAL HMI SPLIT-SCREEN
  // ====================================================================
  if (esTerminalLista) {
    return (
      <div className="hmi-shell">
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
        <style>{cssHMI}</style>

        {/* BARRA SUPERIOR DE TELEMETRÍA INDUSTRIAL */}
        <div className="hmi-statusbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span>TERMINAL DE CONTROL DE ACCESO</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>TOLERANCIA ENTRADA: <strong style={{ color: '#4ade80' }}>{horaLimiteStr} HRS</strong></span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>CIERRE TURNO: <strong style={{ color: '#38bdf8' }}>{horaSalidaOficialStr} HRS</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span>EN PLANTA: <strong style={{ color: '#4ade80' }}>{enPlantaList.length}</strong></span>
            <span>POR LLEGAR: <strong>{pendientesLlegarList.length}</strong></span>
            <span>AUSENCIAS: <strong style={{ color: '#c084fc' }}>{ausenciasProgramadasList.length}</strong></span>
            <span>EN PUERTA / CALLE: <strong style={{ color: '#fbbf24' }}>{colaControlDerecha.length}</strong></span>
          </div>
        </div>

        {/* PANTALLA DIVIDIDA FIJA (IZQUIERDA: CAPTURA | DERECHA: EXCEPCIONES Y RETENIDOS) */}
        <div className="hmi-split">
          {/* COLUMNA IZQUIERDA: ESTACIÓN DE LECTURA Y REGISTRO INMEDIATO */}
          <div className="hmi-panel">
            <div className="hmi-panel-header">
              <span>1. Estación de Registro (Entrada / Salida / Pase)</span>
              <span>Tecla [Enter ↵] ejecuta primer resultado</span>
            </div>

            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search
                    size={18}
                    style={{
                      position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                      color: hayBusqueda ? c.accent : c.textMuted
                    }}
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    autoFocus
                    placeholder="Buscar por # de nómina, apellido o nombre..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && coincidencias.length > 0) {
                        e.preventDefault();
                        ejecutarOperacion(coincidencias[0]);
                      } else if (e.key === 'Escape') {
                        setBusqueda('');
                      }
                    }}
                    style={{
                      width: '100%', height: '48px', padding: '0 38px 0 40px',
                      borderRadius: '8px', border: `2px solid ${hayBusqueda ? c.accent : c.border}`,
                      background: c.bg, color: c.text, fontSize: '15px', fontWeight: '800',
                      boxSizing: 'border-box', outline: 'none'
                    }}
                  />
                  {busqueda && (
                    <button
                      type="button"
                      onClick={() => { setBusqueda(''); if (inputRef.current) inputRef.current.focus(); }}
                      style={{
                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        border: 'none', background: 'transparent', color: c.textMuted, cursor: 'pointer'
                      }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={cargarDatos}
                  title="Sincronizar"
                  style={{
                    width: '48px', height: '48px', borderRadius: '8px',
                    border: `1.5px solid ${c.border}`, background: c.bg, color: c.text,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <RefreshCw size={17} />
                </button>
              </div>

              {/* BANNER DE ÚLTIMA OPERACIÓN EJECUTADA */}
              {ultimoBanner && (
                <div style={{
                  background: ultimoBanner.color,
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '13px',
                  fontWeight: '900'
                }}>
                  <div>
                    <span style={{ opacity: 0.85, marginRight: '8px', fontFamily: 'ui-monospace, monospace' }}>
                      [{ultimoBanner.hora}]
                    </span>
                    <span>#{ultimoBanner.num} {ultimoBanner.nombre} — {ultimoBanner.movimiento}</span>
                  </div>
                  {ultimoBanner.deshacerFn && (
                    <button
                      type="button"
                      onClick={ultimoBanner.deshacerFn}
                      style={{
                        padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.25)',
                        color: '#fff', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Undo2 size={13} /> Revertir
                    </button>
                  )}
                </div>
              )}

              {/* TABLA DE RESULTADOS DE BÚSQUEDA CON SEMÁFORO ANDON */}
              <div style={{ minHeight: '210px' }}>
                {!hayBusqueda ? (
                  <div style={{
                    height: '210px', border: `1px dashed ${c.border}`, borderRadius: '8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    color: c.textMuted, fontSize: '13px', fontWeight: '600', gap: '6px'
                  }}>
                    <span>Terminal lista para lectura.</span>
                    <span style={{ fontSize: '11.5px' }}>Ingresa mínimo 2 caracteres del apellido, nombre o # de nómina.</span>
                  </div>
                ) : coincidencias.length === 0 ? (
                  <div style={{
                    height: '210px', border: `1px solid ${c.border}`, borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: c.textMuted, fontSize: '13px', fontWeight: '700'
                  }}>
                    SIN REGISTROS PARA "{busqueda.toUpperCase()}"
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {coincidencias.map((emp, idx) => {
                      const d = diagnosticar(emp);
                      return (
                        <div
                          key={emp.id}
                          style={{
                            background: d.bg,
                            border: `1.5px solid ${idx === 0 ? d.color : c.border}`,
                            borderLeft: `5px solid ${d.color}`,
                            borderRadius: '8px',
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <Avatar u={emp} size={38} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '12px', fontWeight: '900', color: c.textMuted }}>
                                  #{emp.numero_empleado}
                                </span>
                                <span style={{ fontSize: '14px', fontWeight: '900', color: c.text }}>
                                  {formatearApellidosNombre(emp.nombre_completo, emp)}
                                </span>
                                {emp.departamentos?.nombre && (
                                  <span style={{ fontSize: '11px', color: c.textMuted, fontWeight: '700' }}>
                                    [{emp.departamentos.nombre}]
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', fontSize: '11px', fontWeight: '800' }}>
                                <span style={{ color: d.color }}>{d.codigoEstado}</span>
                                <span style={{ color: c.textMuted }}>· {d.detalle}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={d.bloqueado || Boolean(procesandoId)}
                            onClick={() => ejecutarOperacion(emp)}
                            style={{
                              height: '38px', padding: '0 14px', borderRadius: '6px', border: 'none',
                              background: d.bloqueado ? c.bg : d.color,
                              color: d.bloqueado ? c.textMuted : '#fff',
                              fontSize: '12px', fontWeight: '900',
                              cursor: d.bloqueado || procesandoId ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap', flexShrink: 0
                            }}
                          >
                            {procesandoId === emp.id ? 'PROCESANDO...' : d.accionTexto}
                            {idx === 0 && !d.bloqueado ? ' ↵' : ''}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BITÁCORA DE LOS ÚLTIMOS 5 REGISTROS EN ESTA SESIÓN */}
              {bitacoraReciente.length > 0 && (
                <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: '10px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '900', color: c.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Últimos movimientos registrados
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {bitacoraReciente.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          fontSize: '11.5px', padding: '5px 8px', borderRadius: '6px', background: c.bg
                        }}
                      >
                        <div>
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '800', color: c.textMuted, marginRight: '6px' }}>
                            {item.hora}
                          </span>
                          <strong style={{ color: c.text }}>#{item.num} {item.nombre}</strong>
                          <span style={{ color: item.color, fontWeight: '800', marginLeft: '8px' }}>
                            · {item.movimiento}
                          </span>
                        </div>
                        {item.deshacerFn && (
                          <button
                            type="button"
                            onClick={item.deshacerFn}
                            style={{
                              border: 'none', background: 'transparent', color: c.textMuted,
                              fontSize: '11px', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline'
                            }}
                          >
                            Revertir
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLUMNA DERECHA FIJA: COLA DE EXCEPCIONES, RETENIDOS Y PASES ACTIVOS */}
          <div className="hmi-panel">
            <div className="hmi-panel-header">
              <span>2. Cola de Control en Puerta y Retornos ({colaControlDerecha.length})</span>
              <span>Actualización automática</span>
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '295px' }}>
              {colaControlDerecha.length === 0 ? (
                <div style={{
                  height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: c.textMuted, fontSize: '12.5px', fontWeight: '600', textAlign: 'center'
                }}>
                  SIN PERSONAL RETENIDO NI PASES PENDIENTES DE CRUCE
                </div>
              ) : (
                colaControlDerecha.map(emp => {
                  const d = diagnosticar(emp);
                  return (
                    <div
                      key={emp.id}
                      style={{
                        background: d.bg,
                        border: `1.5px solid ${c.border}`,
                        borderLeft: `5px solid ${d.color}`,
                        borderRadius: '8px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <Avatar u={emp} size={34} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '900', color: c.text }}>
                            #{emp.numero_empleado} · {formatearApellidosNombre(emp.nombre_completo, emp)}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: d.color, marginTop: '2px' }}>
                            {d.codigoEstado} — <span style={{ color: c.textMuted }}>{d.detalle}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={d.bloqueado || Boolean(procesandoId)}
                        onClick={() => ejecutarOperacion(emp)}
                        style={{
                          height: '34px', padding: '0 12px', borderRadius: '6px', border: 'none',
                          background: d.bloqueado ? 'rgba(217,119,6,0.15)' : d.color,
                          color: d.bloqueado ? '#d97706' : '#fff',
                          fontSize: '11.5px', fontWeight: '900',
                          cursor: d.bloqueado || procesandoId ? 'default' : 'pointer',
                          whiteSpace: 'nowrap', flexShrink: 0
                        }}
                      >
                        {procesandoId === emp.id ? '...' : d.accionTexto}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // VISTA 2: 🏢 PASES DE PUERTA (/caseta) — MONITOR TABULAR INDUSTRIAL
  // ====================================================================
  const tabsMonitor = [
    { id: 'pases_activos', label: 'Pases y Retenidos Activos', count: colaControlDerecha.length },
    { id: 'ausencias_hoy', label: 'Vacaciones y Faltas Hoy', count: ausenciasProgramadasList.length },
    { id: 'en_planta', label: 'Personal en Planta', count: enPlantaList.length },
    { id: 'por_llegar', label: 'Pendientes de Entrada', count: pendientesLlegarList.length },
    { id: 'bitacora_sellados', label: 'Bitácora de Cruces Hoy', count: crucesCompletadosHoy.length }
  ];

  const listaTablaActual = (() => {
    const base =
      filtroMonitor === 'pases_activos' ? colaControlDerecha :
      filtroMonitor === 'ausencias_hoy' ? ausenciasProgramadasList :
      filtroMonitor === 'en_planta' ? enPlantaList :
      filtroMonitor === 'por_llegar' ? pendientesLlegarList : [];
    return termino ? base.filter(e => coincide(e, termino)) : base;
  })();

  return (
    <div className="hmi-shell">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{cssHMI}</style>

      {/* SELECTOR DE VISTA TABULAR + BUSCADOR DE TABLA */}
      <div style={{
        background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '10px',
        padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {tabsMonitor.map(t => {
            const act = filtroMonitor === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFiltroMonitor(t.id)}
                style={{
                  height: '34px', padding: '0 12px', borderRadius: '7px',
                  border: `1.5px solid ${act ? c.accent : c.border}`,
                  background: act ? c.accentSoft : c.bg,
                  color: act ? c.accent : c.text,
                  fontSize: '12px', fontWeight: '800', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '6px'
                }}
              >
                <span>{t.label}</span>
                <span style={{
                  padding: '1px 6px', borderRadius: '99px', fontSize: '11px',
                  background: act ? c.accent : c.border, color: act ? '#fff' : c.text
                }}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px' }}>
          <Search size={15} color={c.textMuted} />
          <input
            type="text"
            placeholder="Filtrar tabla..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              flex: 1, height: '32px', border: `1px solid ${c.border}`, borderRadius: '6px',
              padding: '0 10px', background: c.bg, color: c.text, fontSize: '12.5px', fontWeight: '700', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* TABLA INDUSTRIAL DE DATOS */}
      <div className="hmi-panel">
        {filtroMonitor === 'bitacora_sellados' ? (
          <table className="hmi-table">
            <thead>
              <tr>
                <th># Nómina</th>
                <th>Colaborador</th>
                <th>Folio</th>
                <th>Tipo / Horario</th>
                <th>Sellos Caseta</th>
              </tr>
            </thead>
            <tbody>
              {crucesCompletadosHoy.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: c.textMuted, fontWeight: '600' }}>
                    SIN MOVIMIENTOS SELLADOS EN LA BITÁCORA DE HOY
                  </td>
                </tr>
              ) : (
                crucesCompletadosHoy.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '800', color: c.textMuted }}>
                      #{p.usuarios?.numero_empleado}
                    </td>
                    <td style={{ fontWeight: '800', color: c.text }}>
                      {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '700', color: c.textMuted }}>
                      {p.folio}
                    </td>
                    <td style={{ fontWeight: '700', color: c.text }}>
                      {p.tipo_permiso?.toUpperCase()} · {p.horarioProgramado}
                    </td>
                    <td style={{ fontWeight: '800' }}>
                      {p.seRegresaACasa ? (
                        <span style={{ color: '#dc2626' }}>RETIRADO ({p.horaRetiroCaseta})</span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>
                          {p.horaSalidaCaseta ? `SALIDA: ${p.horaSalidaCaseta} ` : ''}
                          {p.horaEntradaCaseta ? `· ENTRADA/RETORNO: ${p.horaEntradaCaseta}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="hmi-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}># Nómina</th>
                <th>Colaborador</th>
                <th>Departamento</th>
                <th>Estado Operativo</th>
                <th>Detalle / Horario</th>
                <th style={{ textAlign: 'right', width: '190px' }}>Acción en Puerta</th>
              </tr>
            </thead>
            <tbody>
              {listaTablaActual.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: c.textMuted, fontWeight: '600' }}>
                    SIN REGISTROS EN ESTA VISTA
                  </td>
                </tr>
              ) : (
                listaTablaActual.map(emp => {
                  const d = diagnosticar(emp);
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontWeight: '800', color: c.textMuted }}>
                        #{emp.numero_empleado}
                      </td>
                      <td style={{ fontWeight: '800', color: c.text }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar u={emp} size={28} />
                          <span>{formatearApellidosNombre(emp.nombre_completo, emp)}</span>
                        </div>
                      </td>
                      <td style={{ fontWeight: '700', color: c.textMuted, fontSize: '12px' }}>
                        {emp.departamentos?.nombre || '—'}
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '900',
                          background: `${d.color}18`, color: d.color
                        }}>
                          {d.codigoEstado}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', fontWeight: '700', color: c.textMuted }}>
                        {d.detalle}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          disabled={d.bloqueado || Boolean(procesandoId)}
                          onClick={() => ejecutarOperacion(emp)}
                          style={{
                            height: '32px', padding: '0 12px', borderRadius: '6px', border: 'none',
                            background: d.bloqueado ? c.bg : d.color,
                            color: d.bloqueado ? c.textMuted : '#fff',
                            fontSize: '11.5px', fontWeight: '900',
                            cursor: d.bloqueado || procesandoId ? 'default' : 'pointer'
                          }}
                        >
                          {procesandoId === emp.id ? '...' : d.accionTexto}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
