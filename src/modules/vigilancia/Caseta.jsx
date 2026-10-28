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
  solicitarReautorizacionHorarioSalida,
  deshacerEntradaReciente,
  deshacerSalidaReciente,
  obtenerHoraLimiteTolerancia,
  obtenerHoraSalidaOficial,
  obtenerFechaLocalHoy
} from './services/vigilanciaService';
import {
  DoorOpen, RotateCcw, CheckCircle2, LogOut,
  Search, RefreshCw, UserCheck, Users, CalendarOff,
  Hourglass, CornerUpLeft, X, Check, Undo2, ShieldAlert, Zap
} from 'lucide-react';

export default function Caseta() {
  const { usuario } = useAuth();
  const location = useLocation();
  const inputBusquedaRef = useRef(null);

  // Panel 1: 'control' (/caseta) | Panel 2: 'tablero' (/caseta/asistencia)
  const rutaActual = location.pathname;
  const modoVista = rutaActual.includes('/asistencia') || rutaActual.includes('/retardo')
    ? 'tablero'
    : 'control';

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

  // Filtro activo en el Panel 2 (Tablero y Bitácora)
  const [kpiActivo, setKpiActivo] = useState('en_planta');

  const [retenidosEnEspera, setRetenidosEnEspera] = useState([]);
  const [pasesPorCruzar, setPasesPorCruzar] = useState([]);
  const [personalFuera, setPersonalFuera] = useState([]);
  const [crucesCompletadosHoy, setCrucesCompletadosHoy] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});
  const [mapaIncidenciasHoy, setMapaIncidenciasHoy] = useState({});
  const [horaLimiteStr, setHoraLimiteStr] = useState('07:15');
  const [horaSalidaOficialStr, setHoraSalidaOficialStr] = useState('17:00');

  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [procesandoId, setProcesandoId] = useState(null);

  // Barra flotante de resultado + Deshacer rápido (sin modales)
  const [feedbackAccion, setFeedbackAccion] = useState(null);
  const timerFeedbackRef = useRef(null);

  const sedeGuardia = usuario?.sede_id || null;
  const hoyStr = obtenerFechaLocalHoy();

  const lanzarFeedback = ( payload ) => {
    if (timerFeedbackRef.current) clearTimeout(timerFeedbackRef.current);
    setFeedbackAccion(payload);
    timerFeedbackRef.current = setTimeout(() => {
      setFeedbackAccion(null);
    }, payload.tipo === 'rojo' ? 5000 : 6000);
  };

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
      console.error('Error cargando datos de vigilancia:', err);
    }
  }, [sedeGuardia, hoyStr]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 5000);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  // Utilidades de tiempo en vivo
  const obtenerMinutosAhora = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };

  const parsearHoraAMinutos = (str = '07:15') => {
    const [h, m] = String(str).split(':').map(Number);
    return (isNaN(h) ? 7 : h) * 60 + (isNaN(m) ? 15 : m);
  };

  // ====================================================================
  // MOTOR DE LAS 12 VARIACIONES: Evalúa qué acción corresponde a cada empleado
  // ====================================================================
  const evaluarEstadoEmpleado = (emp) => {
    const regAsis = mapaAsistencias[emp.id];
    const inc = mapaIncidenciasHoy[emp.id];
    const tieneEntrada = Boolean(regAsis?.hora_entrada);
    const tieneSalida = Boolean(regAsis?.hora_salida);

    const pasePuerta = pasesPorCruzar.find(p => p.usuario_id === emp.id);
    const paseRetenido = retenidosEnEspera.find(p => p.usuario_id === emp.id);
    const paseFuera = personalFuera.find(p => p.usuario_id === emp.id);
    const paseSelladoDefinitivo = crucesCompletadosHoy.find(
      p => p.usuario_id === emp.id && p.tipo_permiso === 'salida' && !p.requiereRegreso && !p.horaEntradaCaseta
    );

    const minAhora = obtenerMinutosAhora();
    const minLimiteEntrada = parsearHoraAMinutos(horaLimiteStr);
    const minSalidaOficial = parsearHoraAMinutos(horaSalidaOficialStr);

    // 1. Ya está retenido en la reja esperando firma de Jefe / RH
    if (paseRetenido || inc?.tipo === 'retardo_en_espera') {
      return {
        codigo: 'EN_ESPERA_FIRMA',
        color: '#f59e0b',
        bg: modoOscuro ? 'rgba(245,158,11,0.10)' : '#fffbeb',
        etiqueta: paseRetenido?.etiquetaMotivoPuerta || inc?.etiqueta || '⏳ En espera de firma',
        subtexto: `Esperando autorización de: ${paseRetenido?.esperandoFirmaDe || inc?.esperandoFirmaDe || 'Jefatura / RH'}`,
        textoBoton: '⏳ Esperando Firma',
        deshabilitado: true
      };
    }

    // 2. Orden de RH / Jefe: Se regresa a casa (Acceso denegado)
    if (pasePuerta?.seRegresaACasa || (inc?.tipo === 'retardo_regresa' && !inc?.yaSeRetiroACasa)) {
      return {
        codigo: 'CONFIRMAR_RETIRO_CASA',
        color: '#dc2626',
        bg: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fef2f2',
        etiqueta: '🚫 ORDEN RH: SE REGRESA A CASA',
        subtexto: 'Acceso denegado — Confirmar que se retira de puerta',
        textoBoton: '↩️ Confirmar Retiro',
        paseId: pasePuerta?.id || inc?.paseId
      };
    }

    // 3. Está en la calle con pase temporal y viene a reingresar (Variación 11)
    if (paseFuera) {
      const obs = paseFuera.observacionesRaw || '';
      const mReg = obs.match(/Regresa:\s*(\d{1,2}):(\d{2})/i);
      const yaAvalado = /\[HORARIO AUTORIZADO EN CASETA\]/i.test(obs);
      let excedidoMin = 0;
      let horaPactada = '';
      if (mReg && !yaAvalado) {
        const minPactado = parseInt(mReg[1], 10) * 60 + parseInt(mReg[2], 10);
        excedidoMin = minAhora - minPactado;
        horaPactada = `${String(mReg[1]).padStart(2, '0')}:${mReg[2]}`;
      }
      if (excedidoMin > 15) {
        return {
          codigo: 'REINGRESO_EXCEDIDO',
          color: '#dc2626',
          bg: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fff5f5',
          etiqueta: `🛑 REGRESÓ +${excedidoMin} MIN TARDE (Límite ${horaPactada} hrs)`,
          subtexto: 'Horario no coincide — Retener y pedir autorización',
          textoBoton: '🛑 Retener (Excedió Hora)',
          paseId: paseFuera.id
        };
      }
      return {
        codigo: 'REINGRESO_PASE_OK',
        color: '#2563eb',
        bg: modoOscuro ? 'rgba(37,99,235,0.10)' : '#eff6ff',
        etiqueta: `🔵 EN LA CALLE CON PASE (${paseFuera.horarioProgramado})`,
        subtexto: 'En tiempo para reingresar a planta',
        textoBoton: '↙ Confirmar Reingreso',
        paseId: paseFuera.id
      };
    }

    // 4. Tiene Pase de Salida autorizado pendiente de salir (Variaciones 8 y 10)
    if (pasePuerta && pasePuerta.tipo_permiso === 'salida') {
      const obs = pasePuerta.observacionesRaw || '';
      const mSal = obs.match(/Salida(?:\s+definitiva)?:\s*(\d{1,2}):(\d{2})/i);
      const yaAvalado = /\[HORARIO AUTORIZADO EN CASETA\]/i.test(obs);
      if (mSal && !yaAvalado) {
        const minSal = parseInt(mSal[1], 10) * 60 + parseInt(mSal[2], 10);
        const diff = Math.abs(minAhora - minSal);
        const hSalStr = `${String(mSal[1]).padStart(2, '0')}:${mSal[2]}`;
        if (diff > 20) {
          return {
            codigo: 'SALIDA_DESFASADA',
            color: '#dc2626',
            bg: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fff5f5',
            etiqueta: `🛑 HORA DE SALIDA NO COINCIDE (Pase: ${hSalStr} hrs)`,
            subtexto: `Diferencia de ${diff} min respecto a su pase autorizado`,
            textoBoton: '��� Retener y Reautorizar Hora',
            paseId: pasePuerta.id
          };
        }
      }
      return {
        codigo: 'SALIDA_PASE_OK',
        color: '#0284c7',
        bg: modoOscuro ? 'rgba(2,132,199,0.10)' : '#f0f9ff',
        etiqueta: pasePuerta.requiereRegreso ? `🔵 PASE DE SALIDA CON REGRESO (${pasePuerta.horarioProgramado})` : `🔵 PASE DE SALIDA DEFINITIVA (${pasePuerta.horarioProgramado})`,
        subtexto: 'Pase autorizado listo para cruzar',
        textoBoton: '↗ Sellar Salida con Pase',
        paseId: pasePuerta.id
      };
    }

    // 5.AÚN NO HA ENTRADO HOY A PLANTA (Variaciones 1 a 7)
    if (!tieneEntrada) {
      // Variación 6: Faltó el día hábil anterior sin aviso
      if (inc?.tipo === 'falta_ayer_sin_aviso') {
        return {
          codigo: 'RETENER_FALTA_AYER',
          color: '#dc2626',
          bg: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fff5f5',
          etiqueta: '🛑 FALTÓ EL DÍA ANTERIOR SIN AVISO',
          subtexto: 'No dejar pasar — Requiere autorización de Jefatura / RH',
          textoBoton: '🛑 Retener en Puerta'
        };
      }

      // Variación 7: Tenía Vacaciones o Falta programada para hoy pero se presenta en puerta
      if (inc?.tipo === 'ausencia_autorizada') {
        const esVac = String(inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        return {
          codigo: 'RETENER_EN_AUSENCIA',
          color: '#dc2626',
          bg: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fff5f5',
          etiqueta: esVac ? '🏖️ ESTÁ DE VACACIONES HOY' : '📋 TIENE FALTA PROGRAMADA HOY',
          subtexto: 'Comportamiento inusual — Solicitar autorización para ingresar',
          textoBoton: '🛑 Retener y Pedir Acceso',
          inc
        };
      }

      // Variaciones 2, 3 y 4: Ya tenía un Retardo o Acceso Autorizado en puerta
      if (inc?.tipo === 'retardo_autorizado' || (pasePuerta && pasePuerta.tipo_permiso !== 'salida')) {
        const obs = pasePuerta?.observacionesRaw || '';
        const mEst = obs.match(/Llegada estimada:\s*(\d{1,2}):(\d{2})/i);
        const yaReautorizado = /\[COMPORTAMIENTO INUSUAL AUTORIZADO\]/i.test(obs);
        if (mEst && minAhora > minLimiteEntrada && !yaReautorizado) {
          const minPrometido = parseInt(mEst[1], 10) * 60 + parseInt(mEst[2], 10);
          const exceso = minAhora - minPrometido;
          const hProm = `${String(mEst[1]).padStart(2, '0')}:${mEst[2]}`;
          if (exceso > 15) {
            return {
              codigo: 'RETARDO_EXCEDIDO',
              color: '#dc2626',
              bg: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fff5f5',
              etiqueta: `🛑 LLEGÓ +${exceso} MIN DESPUÉS DE LO AVISADO (Avisó ${hProm} hrs)`,
              subtexto: 'Excedió la hora de su permiso de retardo',
              textoBoton: '🛑 Retener y Reautorizar',
              paseId: pasePuerta?.id || inc?.paseId
            };
          }
        }
        return {
          codigo: 'ENTRADA_AUTORIZADA_PUERTA',
          color: '#16a34a',
          bg: modoOscuro ? 'rgba(22,163,74,0.12)' : '#f0fdf4',
          etiqueta: '🟢 ACCESO AUTORIZADO POR JEFATURA / RH',
          subtexto: 'Listo para ingresar a planta',
          textoBoton: '↵ Dar Paso a Planta',
          paseId: pasePuerta?.id || inc?.paseId
        };
      }

      // Variación 5: Llega después de la hora límite de tolerancia sin permiso
      if (minAhora > minLimiteEntrada) {
        return {
          codigo: 'RETENER_RETARDO_NUEVO',
          color: '#dc2626',
          bg: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fff5f5',
          etiqueta: `🛑 LLEGADA TARDE (Límite ${horaLimiteStr} hrs)`,
          subtexto: 'Fuera de tolerancia — Retener para autorización de Jefe / RH',
          textoBoton: '🛑 Retener por Retardo'
        };
      }

      // Variación 1: Entrada normal en tiempo
      return {
        codigo: 'ENTRADA_PUNTUAL',
        color: '#16a34a',
        bg: modoOscuro ? 'rgba(22,163,74,0.08)' : '#f0fdf4',
        etiqueta: '🟢 EN TIEMPO — PASA A PLANTA',
        subtexto: `Entrada matutina normal (Límite ${horaLimiteStr} hrs)`,
        textoBoton: '↵ Dar Entrada'
      };
    }

    // 6. YA ESTÁ EN PLANTA (O YA SALIÓ DEFINITIVO HOY) — Variación 12
    if (!tieneSalida) {
      const esAntesDeFinDeTurno = minAhora < (minSalidaOficial - 30);
      return {
        codigo: 'SALIDA_DE_TURNO',
        color: esAntesDeFinDeTurno ? '#d97706' : '#0284c7',
        bg: c.surfaceCard,
        etiqueta: `🏭 EN PLANTA (Entró ${regAsis.hora_entrada} hrs)`,
        subtexto: esAntesDeFinDeTurno
          ? `⚠️ Aún no son las ${horaSalidaOficialStr} hrs y NO tiene Pase de Salida autorizado`
          : 'Registrar salida de fin de turno',
        textoBoton: esAntesDeFinDeTurno ? '⚠️ Registrar Salida sin Pase' : '↵ Dar Salida de Turno',
        requiereConfirmarSinPase: esAntesDeFinDeTurno
      };
    }

    // Variación 12-B: Ya tenía salida registrada hoy (o Salida Definitiva) y regresa a la reja
    return {
      codigo: 'YA_SALIO_HOY',
      color: '#64748b',
      bg: c.surfaceCard,
      etiqueta: `✅ SALIDA YA REGISTRADA HOY (${regAsis.hora_salida} hrs)`,
      subtexto: paseSelladoDefinitivo ? 'Salió con Pase Definitivo — ¿Regresa excepcionalmente?' : 'Turno concluido hoy',
      textoBoton: paseSelladoDefinitivo ? '🛑 Solicitar Reingreso Excepcional' : '↩ Deshacer Salida',
      paseDefinitivo: paseSelladoDefinitivo
    };
  };

  // ====================================================================
  // EJECUTAR ACCIÓN EN 1 TOQUE (O CON TECLA ENTER)
  // ====================================================================
  const ejecutarAccionDirecta = async (emp) => {
    if (procesandoId) return;
    const ev = evaluarEstadoEmpleado(emp);
    if (ev.deshabilitado) return;

    if (ev.requiereConfirmarSinPase) {
      const ok = window.confirm(`⚠️ ${emp.nombre_completo} NO tiene Pase de Salida autorizado y aún no es la hora de salida (${horaSalidaOficialStr} hrs).\n\n¿Deseas registrar su salida de turno de todos modos?`);
      if (!ok) return;
    }

    setProcesandoId(emp.id);
    try {
      setBusquedaTexto('');

      if (ev.codigo === 'ENTRADA_PUNTUAL' || ev.codigo === 'RETENER_RETARDO_NUEVO' || ev.codigo === 'RETENER_FALTA_AYER') {
        const res = await registrarAsistenciaLista(emp.id, 'entrada', usuario?.id || null, false);
        if (res?.resultado === 'ok' || res?.resultado === 'entrada_registrada') {
          lanzarFeedback({
            tipo: 'verde',
            texto: `✅ ADELANTE — PASA A PLANTA: ${emp.nombre_completo}`,
            deshacerFn: () => handleDeshacerEntrada(emp.id)
          });
        } else {
          lanzarFeedback({
            tipo: 'rojo',
            texto: `🛑 ALTO — NO DEJAR PASAR A ${emp.nombre_completo} (En espera de firma en la reja)`
          });
        }
      } else if (ev.codigo === 'RETENER_EN_AUSENCIA') {
        const esVac = String(ev.inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        await solicitarAutorizacionInusualCaseta(
          ev.inc.paseId,
          esVac ? 'presentacion_en_vacaciones' : 'presentacion_en_falta'
        );
        lanzarFeedback({
          tipo: 'rojo',
          texto: `🛑 ALTO — ${emp.nombre_completo} tenía ${esVac ? 'Vacaciones' : 'Falta'} hoy. En espera de autorización.`
        });
      } else if (ev.codigo === 'ENTRADA_AUTORIZADA_PUERTA' || ev.codigo === 'RETARDO_EXCEDIDO') {
        const res = await registrarAsistenciaLista(emp.id, 'entrada', usuario?.id || null, false);
        if (res?.resultado === 'retenido_por_inusual') {
          lanzarFeedback({
            tipo: 'rojo',
            texto: `🛑 ALTO — Excedió la hora avisada. Reabriendo autorización para ${emp.nombre_completo}.`
          });
        } else {
          if (ev.paseId) await registrarCheckCaseta(ev.paseId, 'entrada');
          lanzarFeedback({
            tipo: 'verde',
            texto: `✅ ADELANTE — PASA A PLANTA: ${emp.nombre_completo}`,
            deshacerFn: () => handleDeshacerEntrada(emp.id)
          });
        }
      } else if (ev.codigo === 'SALIDA_PASE_OK' || ev.codigo === 'SALIDA_DESFASADA') {
        const res = await registrarCheckCaseta(ev.paseId, 'salida');
        if (res?.resultado === 'retenido_por_horario') {
          lanzarFeedback({
            tipo: 'rojo',
            texto: `🛑 ALTO — Hora de salida no coincide (${res.detalleDesfase}). Esperando autorización.`
          });
        } else {
          lanzarFeedback({
            tipo: 'azul',
            texto: `↗ SALIDA CON PASE SELLADA: ${emp.nombre_completo}`
          });
        }
      } else if (ev.codigo === 'REINGRESO_PASE_OK' || ev.codigo === 'REINGRESO_EXCEDIDO') {
        const res = await registrarCheckCaseta(ev.paseId, 'reingreso');
        if (res?.resultado === 'retenido_por_horario') {
          lanzarFeedback({
            tipo: 'rojo',
            texto: `🛑 ALTO — Regresó fuera de horario (${res.detalleDesfase}). Esperando autorización.`
          });
        } else {
          lanzarFeedback({
            tipo: 'verde',
            texto: `✅ REINGRESO A PLANTA REGISTRADO: ${emp.nombre_completo}`
          });
        }
      } else if (ev.codigo === 'CONFIRMAR_RETIRO_CASA') {
        await registrarCheckCaseta(ev.paseId, 'retiro');
        lanzarFeedback({
          tipo: 'rojo',
          texto: `↩️ RETIRO A CASA CONFIRMADO: ${emp.nombre_completo}`
        });
      } else if (ev.codigo === 'SALIDA_DE_TURNO') {
        await registrarAsistenciaLista(emp.id, 'salida', usuario?.id || null, false);
        lanzarFeedback({
          tipo: 'azul',
          texto: `✓ SALIDA DE TURNO REGISTRADA: ${emp.nombre_completo}`,
          deshacerFn: () => handleDeshacerSalida(emp.id)
        });
      } else if (ev.codigo === 'YA_SALIO_HOY') {
        if (ev.paseDefinitivo) {
          await solicitarAutorizacionInusualCaseta(ev.paseDefinitivo.id, 'reingreso_salida_definitiva');
          lanzarFeedback({
            tipo: 'rojo',
            texto: `🛑 ALTO — Solicitud de reingreso enviada a Jefatura / RH para ${emp.nombre_completo}`
          });
        } else {
          await deshacerSalidaReciente(emp.id);
          lanzarFeedback({
            tipo: 'verde',
            texto: `↩ Salida deshecha: ${emp.nombre_completo} vuelve a figurar En Planta`
          });
        }
      }

      await cargarDatos();
      if (inputBusquedaRef.current) inputBusquedaRef.current.focus();
    } catch (err) {
      alert('Error en caseta: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDeshacerEntrada = async (empleadoId) => {
    setProcesandoId(`${empleadoId}-deshacer`);
    try {
      await deshacerEntradaReciente(empleadoId);
      setFeedbackAccion(null);
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
      setFeedbackAccion(null);
      await cargarDatos();
    } catch (err) {
      alert('No se pudo deshacer la salida: ' + err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const AvatarColaborador = ({ u, size = 42 }) => {
    const url = u?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.nombre_completo || 'C')}&background=16a34a&color=fff&bold=true`;
    return (
      <img
        src={url}
        alt=""
        style={{
          width: `${size}px`, height: `${size}px`, borderRadius: '10px',
          objectFit: 'cover', border: `1px solid ${c.border}`, flexShrink: 0
        }}
      />
    );
  };

  // Buscador inteligente
  const termino = (busquedaTexto || '').toLowerCase().trim();
  const letrasSinEspacios = termino.replace(/\s+/g, '');
  const tieneMinimo2Letras = letrasSinEspacios.length >= 2;

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

  const resultadosBuscador = tieneMinimo2Letras
    ? empleadosSede.filter(emp => coincidePorInicioDePalabra(emp, termino)).slice(0, 5)
    : [];

  // Listas clasificadas para el Panel 2 (Tablero y Bitácora)
  const todosEnPlanta = empleadosSede.filter(emp => Boolean(mapaAsistencias[emp.id]?.hora_entrada) && !mapaAsistencias[emp.id]?.hora_salida);
  const todosSinEntrada = empleadosSede.filter(emp => !mapaAsistencias[emp.id]?.hora_entrada);
  const ausentesConPermiso = todosSinEntrada.filter(emp => mapaIncidenciasHoy[emp.id]?.tipo === 'ausencia_autorizada');
  const faltanPorLlegar = todosSinEntrada.filter(emp => mapaIncidenciasHoy[emp.id]?.tipo !== 'ausencia_autorizada');

  // Empleados en la reja en este instante (Retenidos esperando firma + Listos para cruzar)
  const idsEnReja = new Set([
    ...pasesPorCruzar.map(p => p.usuario_id),
    ...retenidosEnEspera.map(p => p.usuario_id)
  ]);
  const empleadosEnReja = empleadosSede.filter(e => idsEnReja.has(e.id));

  // Empleados en la calle con pase temporal
  const idsEnCalle = new Set(personalFuera.map(p => p.usuario_id));
  const empleadosEnCalle = empleadosSede.filter(e => idsEnCalle.has(e.id));

  const estilosTorniquete = `
    .caseta-wrap {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .torniquete-row {
      border-radius: 13px;
      padding: 12px 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-sizing: border-box;
      width: 100%;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }
    .kpi-grid-5 {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
    }
    .kpi-card-btn {
      border-radius: 12px;
      padding: 11px 10px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      text-align: left;
      transition: all 0.15s ease;
    }
    @media (max-width: 768px) {
      .caseta-wrap { padding-top: 42px; gap: 10px; }
      .torniquete-row { flex-direction: column !important; align-items: stretch !important; }
      .kpi-grid-5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `;

  // Renderizador de tarjeta inteligente de empleado (Usado en el Buscador y en los Monitores Activos)
  const renderFilaInteligente = (emp, esPrimeraEnBusqueda = false) => {
    const ev = evaluarEstadoEmpleado(emp);
    const procesandoEste = procesandoId === emp.id;

    return (
      <div
        key={emp.id}
        className="torniquete-row"
        style={{
          background: ev.bg,
          border: `2px solid ${ev.color}`,
          boxShadow: esPrimeraEnBusqueda ? `0 6px 18px ${ev.color}26` : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
          <AvatarColaborador u={emp} size={44} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: '900', color: c.text }}>
                {formatearApellidosNombre(emp.nombre_completo, emp)}
              </span>
              <span style={{ fontSize: '12px', fontFamily: 'ui-monospace, monospace', fontWeight: '800', color: c.textMuted }}>
                #{emp.numero_empleado}
              </span>
              {emp.departamentos?.nombre && (
                <span style={{ fontSize: '11.5px', fontWeight: '700', color: c.textMuted }}>
                  • {emp.departamentos.nombre}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <span style={{
                fontSize: '11.5px', fontWeight: '900', padding: '2.5px 9px', borderRadius: '6px',
                background: `${ev.color}22`, color: ev.color
              }}>
                {ev.etiqueta}
              </span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: c.textMuted }}>
                {ev.subtexto}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={ev.deshabilitado || Boolean(procesandoId)}
          onClick={() => ejecutarAccionDirecta(emp)}
          style={{
            height: '46px',
            padding: '0 20px',
            borderRadius: '11px',
            border: 'none',
            background: ev.deshabilitado ? 'rgba(245,158,11,0.18)' : ev.color,
            color: ev.deshabilitado ? '#d97706' : '#ffffff',
            fontSize: '13.5px',
            fontWeight: '900',
            cursor: ev.deshabilitado || procesandoId ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: ev.deshabilitado ? 'none' : `0 4px 12px ${ev.color}40`
          }}
        >
          <span>{procesandoEste ? 'Procesando...' : ev.textoBoton}</span>
          {esPrimeraEnBusqueda && !ev.deshabilitado && (
            <span style={{
              fontSize: '10.5px', padding: '2px 6px', borderRadius: '4px',
              background: 'rgba(255,255,255,0.22)', fontWeight: '800'
            }}>
              Enter ↵
            </span>
          )}
        </button>
      </div>
    );
  };

  // ====================================================================
  // PANEL 1: ⚡ CONTROL DE PUERTA (TORNIQUETE EN VIVO — 1 SOLA PANTALLA)
  // ====================================================================
  if (modoVista === 'control') {
    return (
      <div className="caseta-wrap">
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
        <style>{estilosTorniquete}</style>

        {/* 1. BUSCADOR UNIVERSAL "TOCA Y PASA" CON SOPORTE DE TECLA ENTER */}
        <div style={{
          background: c.surfaceCard,
          border: `2px solid ${tieneMinimo2Letras ? c.accent : c.border}`,
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: tieneMinimo2Letras ? '0 8px 24px rgba(22,163,74,0.12)' : 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: '800', color: c.textMuted }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: c.text }}>
              <Zap size={15} color={c.accent} /> CONTROL INTELIGENTE DE PUERTA (Entradas, Salidas, Pases y Reingresos)
            </span>
            <span>Tolerancia entrada: <strong style={{ color: c.text }}>{horaLimiteStr} hrs</strong></span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={19}
                style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: tieneMinimo2Letras ? c.accent : c.textMuted, pointerEvents: 'none'
                }}
              />
              <input
                ref={inputBusquedaRef}
                type="text"
                autoFocus
                placeholder="Escribe apellido, nombre o # de empleado y presiona Enter ↵"
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && resultadosBuscador.length > 0) {
                    e.preventDefault();
                    ejecutarAccionDirecta(resultadosBuscador[0]);
                  } else if (e.key === 'Escape') {
                    setBusquedaTexto('');
                  }
                }}
                style={{
                  width: '100%',
                  height: '52px',
                  padding: '0 44px 0 44px',
                  borderRadius: '12px',
                  border: `1.5px solid ${tieneMinimo2Letras ? c.accent : c.border}`,
                  background: c.bg,
                  color: c.text,
                  fontSize: '16px',
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
              title="Actualizar ahora"
              style={{
                width: '52px', height: '52px', borderRadius: '12px',
                border: `1.5px solid ${c.border}`, background: c.bg, color: c.text,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {/* TIRITA FLOTANTE DE FEEDBACK + DESHACER EN 1 CLIC */}
          {feedbackAccion && (
            <div style={{
              background: feedbackAccion.tipo === 'rojo' ? '#dc2626' : (feedbackAccion.tipo === 'azul' ? '#0284c7' : '#16a34a'),
              color: '#ffffff',
              borderRadius: '11px',
              padding: '11px 15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '14.5px',
              fontWeight: '900',
              boxShadow: '0 6px 18px rgba(0,0,0,0.22)'
            }}>
              <span>{feedbackAccion.texto}</span>
              {feedbackAccion.deshacerFn && (
                <button
                  type="button"
                  onClick={feedbackAccion.deshacerFn}
                  style={{
                    padding: '5px 12px', borderRadius: '8px',
                    border: '1.5px solid rgba(255,255,255,0.65)',
                    background: 'rgba(0,0,0,0.20)', color: '#fff',
                    fontSize: '12.5px', fontWeight: '900', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0
                  }}
                >
                  <Undo2 size={14} /> Deshacer
                </button>
              )}
            </div>
          )}

          {/* RESULTADOS EN VIVO DEL BUSCADOR */}
          {tieneMinimo2Letras && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {resultadosBuscador.length === 0 ? (
                <div style={{ padding: '18px', textAlign: 'center', color: c.textMuted, fontSize: '13.5px', fontWeight: '700' }}>
                  No se encontró ningún colaborador con "{busquedaTexto}".
                </div>
              ) : (
                resultadosBuscador.map((emp, idx) => renderFilaInteligente(emp, idx === 0))
              )}
            </div>
          )}
        </div>

        {/* 2. MONITOR ACTIVO: EN LA REJA AHORITA (Retenidos esperando firma o Con pase listo para cruzar) */}
        <div style={{
          background: c.surfaceCard,
          border: `1.5px solid ${empleadosEnReja.length > 0 ? '#f59e0b' : c.border}`,
          borderRadius: '15px',
          padding: '13px 15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '12.5px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.03em',
            color: empleadosEnReja.length > 0 ? '#d97706' : c.textMuted
          }}>
            <span>🚪 En la Reja Ahorita (Pases por cruzar y Personas esperando firma)</span>
            <span style={{
              padding: '2px 9px', borderRadius: '999px',
              background: empleadosEnReja.length > 0 ? 'rgba(245,158,11,0.16)' : c.bg,
              color: empleadosEnReja.length > 0 ? '#d97706' : c.textMuted
            }}>
              {empleadosEnReja.length}
            </span>
          </div>

          {empleadosEnReja.length === 0 ? (
            <div style={{ fontSize: '13px', color: c.textMuted, fontWeight: '600', padding: '8px 2px' }}>
              Nadie detenido en la reja ni pases pendientes por cruzar en este momento.
            </div>
          ) : (
            empleadosEnReja.map(emp => renderFilaInteligente(emp, false))
          )}
        </div>

        {/* 3. MONITOR ACTIVO: EN LA CALLE CON PASE TEMPORAL (Por regresar a planta) */}
        <div style={{
          background: c.surfaceCard,
          border: `1.5px solid ${empleadosEnCalle.length > 0 ? '#2563eb' : c.border}`,
          borderRadius: '15px',
          padding: '13px 15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '12.5px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.03em',
            color: empleadosEnCalle.length > 0 ? '#2563eb' : c.textMuted
          }}>
            <span>🚶 En la Calle con Pase Temporal (Toca cuando regresen a la reja)</span>
            <span style={{
              padding: '2px 9px', borderRadius: '999px',
              background: empleadosEnCalle.length > 0 ? 'rgba(37,99,235,0.14)' : c.bg,
              color: empleadosEnCalle.length > 0 ? '#2563eb' : c.textMuted
            }}>
              {empleadosEnCalle.length}
            </span>
          </div>

          {empleadosEnCalle.length === 0 ? (
            <div style={{ fontSize: '13px', color: c.textMuted, fontWeight: '600', padding: '8px 2px' }}>
              Ningún colaborador fuera con pase temporal en este momento.
            </div>
          ) : (
            empleadosEnCalle.map(emp => renderFilaInteligente(emp, false))
          )}
        </div>
      </div>
    );
  }

  // ====================================================================
  // PANEL 2: 📊 TABLERO Y BITÁCORA DEL DÍA (VISUALIZACIÓN E HISTÓRICO)
  // ====================================================================
  const kpis = [
    { id: 'en_planta', label: 'En Planta', count: todosEnPlanta.length, color: '#16a34a' },
    { id: 'por_llegar', label: 'Faltan por Llegar', count: faltanPorLlegar.length, color: '#0284c7' },
    { id: 'ausentes', label: 'Vacaciones / Faltas', count: ausentesConPermiso.length, color: '#8b5cf6' },
    { id: 'en_calle', label: 'En la Calle', count: empleadosEnCalle.length, color: '#2563eb' },
    { id: 'bitacora', label: 'Bitácora Sellados', count: crucesCompletadosHoy.length, color: '#64748b' }
  ];

  return (
    <div className="caseta-wrap">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{estilosTorniquete}</style>

      {/* 5 TARJETAS KPI PARA FILTRAR LA VISUALIZACIÓN SIN MEZCLAR INFORMACIÓN */}
      <div className="kpi-grid-5">
        {kpis.map(k => {
          const activo = kpiActivo === k.id;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setKpiActivo(k.id)}
              className="kpi-card-btn"
              style={{
                background: activo ? `${k.color}15` : c.surfaceCard,
                border: `2px solid ${activo ? k.color : c.border}`
              }}
            >
              <span style={{ fontSize: '21px', fontWeight: '900', color: k.color, lineHeight: 1 }}>
                {k.count}
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: activo ? c.text : c.textMuted }}>
                {k.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* FILTRO RÁPIDO DENTRO DEL TABLERO */}
      <div style={{
        background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '13px',
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <Search size={16} color={c.textMuted} />
        <input
          type="text"
          placeholder="Filtrar en esta lista por nombre o # de empleado..."
          value={busquedaTexto}
          onChange={(e) => setBusquedaTexto(e.target.value)}
          style={{
            flex: 1, border: 'none', background: 'transparent', color: c.text,
            fontSize: '14px', fontWeight: '700', outline: 'none'
          }}
        />
        {busquedaTexto && (
          <button
            type="button"
            onClick={() => setBusquedaTexto('')}
            style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* LISTA 1: PERSONAL EN PLANTA */}
      {kpiActivo === 'en_planta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {todosEnPlanta
            .filter(emp => !termino || coincidePorInicioDePalabra(emp, termino))
            .map(emp => {
              const reg = mapaAsistencias[emp.id];
              return (
                <div key={emp.id} className="torniquete-row" style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderLeft: '4px solid #16a34a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <AvatarColaborador u={emp} size={38} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>
                        {formatearApellidosNombre(emp.nombre_completo, emp)}
                      </div>
                      <div style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '700' }}>
                        #{emp.numero_empleado} {emp.departamentos?.nombre ? `• ${emp.departamentos.nombre}` : ''} • <strong style={{ color: '#16a34a' }}>Entrada: {reg?.hora_entrada} hrs</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => ejecutarAccionDirecta(emp)}
                      style={{
                        height: '36px', padding: '0 12px', borderRadius: '8px', border: 'none',
                        background: '#0284c7', color: '#fff', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                      }}
                    >
                      Dar Salida
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeshacerEntrada(emp.id)}
                      title="Deshacer entrada registrada por error"
                      style={{
                        width: '36px', height: '36px', borderRadius: '8px', border: `1px solid ${c.border}`,
                        background: c.bg, color: c.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <Undo2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* LISTA 2: FALTAN POR LLEGAR */}
      {kpiActivo === 'por_llegar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {faltanPorLlegar
            .filter(emp => !termino || coincidePorInicioDePalabra(emp, termino))
            .map(emp => renderFilaInteligente(emp, false))}
        </div>
      )}

      {/* LISTA 3: VACACIONES Y FALTAS PROGRAMADAS HOY */}
      {kpiActivo === 'ausentes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ausentesConPermiso.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '28px', textAlign: 'center', color: c.textMuted, fontWeight: '600' }}>
              Ningún colaborador con Vacaciones o Falta programada para hoy.
            </div>
          ) : (
            ausentesConPermiso
              .filter(emp => !termino || coincidePorInicioDePalabra(emp, termino))
              .map(emp => renderFilaInteligente(emp, false))
          )}
        </div>
      )}

      {/* LISTA 4: EN LA CALLE CON PASE TEMPORAL */}
      {kpiActivo === 'en_calle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {empleadosEnCalle.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '28px', textAlign: 'center', color: c.textMuted, fontWeight: '600' }}>
              No hay colaboradores fuera con pase temporal.
            </div>
          ) : (
            empleadosEnCalle.map(emp => renderFilaInteligente(emp, false))
          )}
        </div>
      )}

      {/* LISTA 5: BITÁCORA DE MOVIMIENTOS SELLADOS HOY */}
      {kpiActivo === 'bitacora' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {crucesCompletadosHoy.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '28px', textAlign: 'center', color: c.textMuted, fontWeight: '600' }}>
              Aún no hay pases sellados en la bitácora de hoy.
            </div>
          ) : (
            crucesCompletadosHoy.map(p => (
              <div key={p.id} className="torniquete-row" style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderLeft: `4px solid ${p.seRegresaACasa ? '#ef4444' : '#16a34a'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <AvatarColaborador u={p.usuarios} size={36} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>
                      {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
                    </div>
                    <div style={{ fontSize: '11.5px', color: c.textMuted, fontWeight: '600' }}>
                      #{p.usuarios?.numero_empleado} • Folio {p.folio} • {p.horarioProgramado}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '800' }}>
                  {p.seRegresaACasa ? (
                    <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '4px 9px', borderRadius: '6px' }}>
                      ↩️ Retirado a casa ({p.horaRetiroCaseta})
                    </span>
                  ) : (
                    <>
                      {p.horaSalidaCaseta && (
                        <span style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7', padding: '4px 9px', borderRadius: '6px' }}>
                          ↗ Salida: {p.horaSalidaCaseta}
                        </span>
                      )}
                      {p.horaEntradaCaseta && (
                        <span style={{ background: c.accentSoft, color: c.accent, padding: '4px 9px', borderRadius: '6px' }}>
                          ↙ {p.tipo_permiso === 'salida' ? `Reingreso: ${p.horaEntradaCaseta}` : `Entrada: ${p.horaEntradaCaseta}`}
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
