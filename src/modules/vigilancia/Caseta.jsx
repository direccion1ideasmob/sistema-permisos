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
  Search, RefreshCw, X, Undo2, ArrowRight, Clock, ShieldAlert, Check
} from 'lucide-react';

export default function Caseta() {
  const { usuario } = useAuth();
  const location = useLocation();
  const inputBusquedaRef = useRef(null);

  // CONGRUENCIA CON EL MENÚ LATERAL:
  // - "Pase de Lista" (/caseta/asistencia) -> Operación de Acceso y Asistencia en vivo
  // - "Pases de Puerta" (/caseta) -> Monitor de Estado, Ausencias y Bitácora
  const esPaseDeLista = location.pathname.includes('/asistencia') || location.pathname.includes('/retardo');

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
  const [avisoOperacion, setAvisoOperacion] = useState(null);
  const timerAvisoRef = useRef(null);

  const sedeGuardia = usuario?.sede_id || null;
  const hoyStr = obtenerFechaLocalHoy();

  const notificar = (payload) => {
    if (timerAvisoRef.current) clearTimeout(timerAvisoRef.current);
    setAvisoOperacion(payload);
    timerAvisoRef.current = setTimeout(() => setAvisoOperacion(null), 5000);
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

  const obtenerMinutosAhora = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };

  const parsearMinutos = (str = '07:15') => {
    const [h, m] = String(str).split(':').map(Number);
    return (isNaN(h) ? 7 : h) * 60 + (isNaN(m) ? 15 : m);
  };

  // ====================================================================
  // EVALUADOR DE ESTADO (TEXTOS EJECUTIVOS DE MÁXIMO 3 PALABRAS)
  // ====================================================================
  const evaluarColaborador = (emp) => {
    const regAsis = mapaAsistencias[emp.id];
    const inc = mapaIncidenciasHoy[emp.id];
    const tieneEntrada = Boolean(regAsis?.hora_entrada);
    const tieneSalida = Boolean(regAsis?.hora_salida);

    const pasePuerta = pasesPorCruzar.find(p => p.usuario_id === emp.id);
    const paseRetenido = retenidosEnEspera.find(p => p.usuario_id === emp.id);
    const paseFuera = personalFuera.find(p => p.usuario_id === emp.id);
    const paseSelladoDef = crucesCompletadosHoy.find(
      p => p.usuario_id === emp.id && p.tipo_permiso === 'salida' && !p.requiereRegreso && !p.horaEntradaCaseta
    );

    const minAhora = obtenerMinutosAhora();
    const minLimEntrada = parsearMinutos(horaLimiteStr);
    const minLimSalida = parsearMinutos(horaSalidaOficialStr);

    // 1. En espera de firma
    if (paseRetenido || inc?.tipo === 'retardo_en_espera') {
      const firmante = paseRetenido?.esperandoFirmaDe || inc?.esperandoFirmaDe || 'RH';
      const motivoCorto = paseRetenido?.etiquetaMotivoPuerta || 'En revisión';
      return {
        codigo: 'EN_ESPERA',
        color: '#d97706',
        etiqueta: `${motivoCorto} · Firma: ${firmante}`,
        boton: 'En espera',
        deshabilitado: true
      };
    }

    // 2. Acceso denegado -> Confirmar retiro
    if (pasePuerta?.seRegresaACasa || (inc?.tipo === 'retardo_regresa' && !inc?.yaSeRetiroACasa)) {
      return {
        codigo: 'RETIRO_CASA',
        color: '#dc2626',
        etiqueta: 'Acceso denegado',
        boton: 'Confirmar Retiro',
        paseId: pasePuerta?.id || inc?.paseId
      };
    }

    // 3. Fuera con pase temporal -> Reingreso
    if (paseFuera) {
      const obs = paseFuera.observacionesRaw || '';
      const mReg = obs.match(/Regresa:\s*(\d{1,2}):(\d{2})/i);
      const yaAvalado = /\[HORARIO AUTORIZADO EN CASETA\]/i.test(obs);
      if (mReg && !yaAvalado) {
        const minPactado = parseInt(mReg[1], 10) * 60 + parseInt(mReg[2], 10);
        const exceso = minAhora - minPactado;
        if (exceso > 15) {
          return {
            codigo: 'REINGRESO_VENCIDO',
            color: '#dc2626',
            etiqueta: `Retorno vencido (+${exceso}m)`,
            boton: 'Solicitar Firma',
            paseId: paseFuera.id
          };
        }
      }
      return {
        codigo: 'REINGRESO_OK',
        color: '#2563eb',
        etiqueta: `En salida · ${paseFuera.horarioProgramado}`,
        boton: 'Sellar Reingreso',
        paseId: paseFuera.id
      };
    }

    // 4. Pase de salida autorizado listo para salir
    if (pasePuerta && pasePuerta.tipo_permiso === 'salida') {
      const obs = pasePuerta.observacionesRaw || '';
      const mSal = obs.match(/Salida(?:\s+definitiva)?:\s*(\d{1,2}):(\d{2})/i);
      const yaAvalado = /\[HORARIO AUTORIZADO EN CASETA\]/i.test(obs);
      if (mSal && !yaAvalado) {
        const minSal = parseInt(mSal[1], 10) * 60 + parseInt(mSal[2], 10);
        if (Math.abs(minAhora - minSal) > 20) {
          return {
            codigo: 'SALIDA_VENCIDA',
            color: '#dc2626',
            etiqueta: `Hora desfasada · ${pasePuerta.horarioProgramado}`,
            boton: 'Solicitar Firma',
            paseId: pasePuerta.id
          };
        }
      }
      return {
        codigo: 'SALIDA_PASE_OK',
        color: '#0284c7',
        etiqueta: `Pase salida · ${pasePuerta.horarioProgramado}`,
        boton: 'Sellar Salida',
        paseId: pasePuerta.id
      };
    }

    // 5. Sin entrada registrada hoy
    if (!tieneEntrada) {
      if (inc?.tipo === 'falta_ayer_sin_aviso') {
        return {
          codigo: 'FALTA_AYER',
          color: '#dc2626',
          etiqueta: 'Falta previa s/aviso',
          boton: 'Solicitar Firma'
        };
      }
      if (inc?.tipo === 'ausencia_autorizada') {
        const esVac = String(inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        return {
          codigo: 'AUSENCIA_HOY',
          color: '#d97706',
          etiqueta: esVac ? 'Vacaciones vigentes' : 'Falta programada',
          boton: 'Solicitar Firma',
          inc
        };
      }
      if (inc?.tipo === 'retardo_autorizado' || (pasePuerta && pasePuerta.tipo_permiso !== 'salida')) {
        const obs = pasePuerta?.observacionesRaw || '';
        const mEst = obs.match(/Llegada estimada:\s*(\d{1,2}):(\d{2})/i);
        const yaAvalado = /\[COMPORTAMIENTO INUSUAL AUTORIZADO\]/i.test(obs);
        if (mEst && minAhora > minLimEntrada && !yaAvalado) {
          const minProm = parseInt(mEst[1], 10) * 60 + parseInt(mEst[2], 10);
          if (minAhora - minProm > 15) {
            return {
              codigo: 'RETARDO_EXCEDIDO',
              color: '#dc2626',
              etiqueta: `Tiempo excedido (+${minAhora - minProm}m)`,
              boton: 'Solicitar Firma',
              paseId: pasePuerta?.id || inc?.paseId
            };
          }
        }
        return {
          codigo: 'ACCESO_AUTORIZADO',
          color: '#16a34a',
          etiqueta: 'Acceso autorizado',
          boton: 'Autorizar Paso',
          paseId: pasePuerta?.id || inc?.paseId
        };
      }
      if (minAhora > minLimEntrada) {
        return {
          codigo: 'FUERA_TOLERANCIA',
          color: '#dc2626',
          etiqueta: `Fuera de tolerancia (${horaLimiteStr})`,
          boton: 'Solicitar Firma'
        };
      }
      return {
        codigo: 'ENTRADA_NORMAL',
        color: '#16a34a',
        etiqueta: 'Acceso normal',
        boton: 'Registrar Entrada'
      };
    }

    // 6. En planta -> Salida de turno
    if (!tieneSalida) {
      const anticipada = minAhora < (minLimSalida - 30);
      return {
        codigo: 'SALIDA_TURNO',
        color: anticipada ? '#d97706' : '#0284c7',
        etiqueta: `En planta · ${regAsis.hora_entrada}`,
        boton: anticipada ? 'Salida s/pase' : 'Registrar Salida',
        anticipada
      };
    }

    // 7. Ya salió hoy
    return {
      codigo: 'TURNO_CERRADO',
      color: '#64748b',
      etiqueta: `Salida · ${regAsis.hora_salida}`,
      boton: paseSelladoDef ? 'Pedir Reingreso' : 'Deshacer Salida',
      paseDefinitivo: paseSelladoDef
    };
  };

  const procesarAccion = async (emp) => {
    if (procesandoId) return;
    const ev = evaluarColaborador(emp);
    if (ev.deshabilitado) return;

    if (ev.anticipada) {
      if (!window.confirm(`¿Registrar salida de turno sin pase a ${emp.nombre_completo} antes de las ${horaSalidaOficialStr} hrs?`)) return;
    }

    setProcesandoId(emp.id);
    try {
      setBusquedaTexto('');

      if (['ENTRADA_NORMAL', 'FUERA_TOLERANCIA', 'FALTA_AYER'].includes(ev.codigo)) {
        const res = await registrarAsistenciaLista(emp.id, 'entrada', usuario?.id || null, false);
        if (res?.resultado === 'ok' || res?.resultado === 'entrada_registrada') {
          notificar({
            tipo: 'ok',
            texto: `Entrada registrada · ${emp.nombre_completo}`,
            deshacerFn: () => handleDeshacerEntrada(emp.id)
          });
        } else {
          notificar({
            tipo: 'alerta',
            texto: `Solicitud enviada · ${emp.nombre_completo} en espera de firma`
          });
        }
      } else if (ev.codigo === 'AUSENCIA_HOY') {
        const esVac = String(ev.inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        await solicitarAutorizacionInusualCaseta(
          ev.inc.paseId,
          esVac ? 'presentacion_en_vacaciones' : 'presentacion_en_falta'
        );
        notificar({
          tipo: 'alerta',
          texto: `Solicitud enviada · ${emp.nombre_completo} en espera de firma`
        });
      } else if (['ACCESO_AUTORIZADO', 'RETARDO_EXCEDIDO'].includes(ev.codigo)) {
        const res = await registrarAsistenciaLista(emp.id, 'entrada', usuario?.id || null, false);
        if (res?.resultado === 'retenido_por_inusual') {
          notificar({ tipo: 'alerta', texto: `Tiempo excedido · Reabriendo firma para ${emp.nombre_completo}` });
        } else {
          if (ev.paseId) await registrarCheckCaseta(ev.paseId, 'entrada');
          notificar({
            tipo: 'ok',
            texto: `Acceso registrado · ${emp.nombre_completo}`,
            deshacerFn: () => handleDeshacerEntrada(emp.id)
          });
        }
      } else if (['SALIDA_PASE_OK', 'SALIDA_VENCIDA'].includes(ev.codigo)) {
        const res = await registrarCheckCaseta(ev.paseId, 'salida');
        if (res?.resultado === 'retenido_por_horario') {
          notificar({ tipo: 'alerta', texto: `Horario desfasado · En espera de firma` });
        } else {
          notificar({ tipo: 'info', texto: `Salida sellada · ${emp.nombre_completo}` });
        }
      } else if (['REINGRESO_OK', 'REINGRESO_VENCIDO'].includes(ev.codigo)) {
        const res = await registrarCheckCaseta(ev.paseId, 'reingreso');
        if (res?.resultado === 'retenido_por_horario') {
          notificar({ tipo: 'alerta', texto: `Retorno vencido · En espera de firma` });
        } else {
          notificar({ tipo: 'ok', texto: `Reingreso sellado · ${emp.nombre_completo}` });
        }
      } else if (ev.codigo === 'RETIRO_CASA') {
        await registrarCheckCaseta(ev.paseId, 'retiro');
        notificar({ tipo: 'alerta', texto: `Retiro confirmado · ${emp.nombre_completo}` });
      } else if (ev.codigo === 'SALIDA_TURNO') {
        await registrarAsistenciaLista(emp.id, 'salida', usuario?.id || null, false);
        notificar({
          tipo: 'info',
          texto: `Salida registrada · ${emp.nombre_completo}`,
          deshacerFn: () => handleDeshacerSalida(emp.id)
        });
      } else if (ev.codigo === 'TURNO_CERRADO') {
        if (ev.paseDefinitivo) {
          await solicitarAutorizacionInusualCaseta(ev.paseDefinitivo.id, 'reingreso_salida_definitiva');
          notificar({ tipo: 'alerta', texto: `Reingreso solicitado · ${emp.nombre_completo}` });
        } else {
          await deshacerSalidaReciente(emp.id);
          notificar({ tipo: 'ok', texto: `Salida revertida · ${emp.nombre_completo}` });
        }
      }

      await cargarDatos();
      if (inputBusquedaRef.current) inputBusquedaRef.current.focus();
    } catch (err) {
      alert(err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDeshacerEntrada = async (empleadoId) => {
    setProcesandoId(`${empleadoId}-des`);
    try {
      await deshacerEntradaReciente(empleadoId);
      setAvisoOperacion(null);
      await cargarDatos();
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDeshacerSalida = async (empleadoId) => {
    setProcesandoId(`${empleadoId}-des`);
    try {
      await deshacerSalidaReciente(empleadoId);
      setAvisoOperacion(null);
      await cargarDatos();
    } finally {
      setProcesandoId(null);
    }
  };

  const Avatar = ({ u, size = 38 }) => {
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

  const termino = (busquedaTexto || '').toLowerCase().trim();
  const tieneBusqueda = termino.replace(/\s+/g, '').length >= 2;

  const coincide = (emp, busq) => {
    const limpio = busq.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!limpio) return false;
    const txt = `${emp.nombre_completo || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''} ${emp.nombre || ''} ${emp.numero_empleado || ''}`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const partes = limpio.split(/\s+/).filter(Boolean);
    const tokens = txt.split(/[\s,]+/).filter(Boolean);
    return partes.every(p => tokens.some(t => t.startsWith(p)));
  };

  const resultadosBusqueda = tieneBusqueda
    ? empleadosSede.filter(e => coincide(e, termino)).slice(0, 4)
    : [];

  const todosEnPlanta = empleadosSede.filter(e => Boolean(mapaAsistencias[e.id]?.hora_entrada) && !mapaAsistencias[e.id]?.hora_salida);
  const todosSinEntrada = empleadosSede.filter(e => !mapaAsistencias[e.id]?.hora_entrada);
  const ausentesHoy = todosSinEntrada.filter(e => mapaIncidenciasHoy[e.id]?.tipo === 'ausencia_autorizada');
  const porLlegarHoy = todosSinEntrada.filter(e => mapaIncidenciasHoy[e.id]?.tipo !== 'ausencia_autorizada');

  const idsPendientesAcceso = new Set([
    ...pasesPorCruzar.map(p => p.usuario_id),
    ...retenidosEnEspera.map(p => p.usuario_id)
  ]);
  const listaPendientesAcceso = empleadosSede.filter(e => idsPendientesAcceso.has(e.id));

  const idsSalidasTemporales = new Set(personalFuera.map(p => p.usuario_id));
  const listaSalidasTemporales = empleadosSede.filter(e => idsSalidasTemporales.has(e.id));

  const renderRenglonEjecutivo = (emp, destacado = false) => {
    const ev = evaluarColaborador(emp);
    const ocupado = procesandoId === emp.id;

    return (
      <div
        key={emp.id}
        style={{
          background: c.surfaceCard,
          border: `1.5px solid ${destacado ? ev.color : c.border}`,
          borderLeft: `4px solid ${ev.color}`,
          borderRadius: '11px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0, flex: 1 }}>
          <Avatar u={emp} size={38} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>
                {formatearApellidosNombre(emp.nombre_completo, emp)}
              </span>
              <span style={{ fontSize: '11.5px', fontFamily: 'ui-monospace, monospace', fontWeight: '700', color: c.textMuted }}>
                #{emp.numero_empleado}
              </span>
              {emp.departamentos?.nombre && (
                <span style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>
                  · {emp.departamentos.nombre}
                </span>
              )}
            </div>

            <div style={{ marginTop: '3px' }}>
              <span style={{
                fontSize: '11px', fontWeight: '800', padding: '2px 7px', borderRadius: '5px',
                background: `${ev.color}18`, color: ev.color
              }}>
                {ev.etiqueta}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={ev.deshabilitado || Boolean(procesandoId)}
          onClick={() => procesarAccion(emp)}
          style={{
            height: '38px',
            padding: '0 15px',
            borderRadius: '9px',
            border: 'none',
            background: ev.deshabilitado ? c.bg : ev.color,
            color: ev.deshabilitado ? c.textMuted : '#ffffff',
            fontSize: '12.5px',
            fontWeight: '800',
            cursor: ev.deshabilitado || procesandoId ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          <span>{ocupado ? '...' : ev.boton}</span>
          {destacado && !ev.deshabilitado && (
            <span style={{ fontSize: '10px', opacity: 0.85 }}>↵</span>
          )}
        </button>
      </div>
    );
  };

  // ====================================================================
  // VISTA A: 📋 PASE DE LISTA (/caseta/asistencia) -> OPERACIÓN EN VIVO
  // ====================================================================
  if (esPaseDeLista) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', fontFamily: '"Inter", sans-serif' }}>
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

        {/* BUSCADOR DE PASE DE LISTA */}
        <div style={{
          background: c.surfaceCard,
          border: `1.5px solid ${tieneBusqueda ? c.accent : c.border}`,
          borderRadius: '14px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={17}
                style={{
                  position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                  color: tieneBusqueda ? c.accent : c.textMuted, pointerEvents: 'none'
                }}
              />
              <input
                ref={inputBusquedaRef}
                type="text"
                autoFocus
                placeholder="Buscar por apellido, nombre o # de empleado..."
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && resultadosBusqueda.length > 0) {
                    e.preventDefault();
                    procesarAccion(resultadosBusqueda[0]);
                  } else if (e.key === 'Escape') {
                    setBusquedaTexto('');
                  }
                }}
                style={{
                  width: '100%', height: '46px', padding: '0 38px 0 40px',
                  borderRadius: '10px', border: `1.5px solid ${c.border}`,
                  background: c.bg, color: c.text, fontSize: '15px', fontWeight: '700',
                  boxSizing: 'border-box', outline: 'none'
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
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    width: '30px', height: '30px', borderRadius: '7px', border: 'none',
                    background: 'transparent', color: c.textMuted, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <X size={17} />
                </button>
              )}
            </div>

            <button
              onClick={cargarDatos}
              title="Actualizar"
              style={{
                width: '46px', height: '46px', borderRadius: '10px',
                border: `1.5px solid ${c.border}`, background: c.bg, color: c.text,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {avisoOperacion && (
            <div style={{
              background: avisoOperacion.tipo === 'alerta' ? '#dc2626' : (avisoOperacion.tipo === 'info' ? '#0284c7' : '#16a34a'),
              color: '#fff', borderRadius: '9px', padding: '9px 13px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: '13px', fontWeight: '800'
            }}>
              <span>{avisoOperacion.texto}</span>
              {avisoOperacion.deshacerFn && (
                <button
                  type="button"
                  onClick={avisoOperacion.deshacerFn}
                  style={{
                    padding: '3px 10px', borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.18)',
                    color: '#fff', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Undo2 size={13} /> Deshacer
                </button>
              )}
            </div>
          )}

          {tieneBusqueda && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {resultadosBusqueda.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', color: c.textMuted, fontSize: '13px', fontWeight: '600' }}>
                  Sin coincidencias para "{busquedaTexto}".
                </div>
              ) : (
                resultadosBusqueda.map((emp, idx) => renderRenglonEjecutivo(emp, idx === 0))
              )}
            </div>
          )}
        </div>

        {/* MONITOR 1: PENDIENTES EN ACCESO (SOLO SE MUESTRA SI HAY ACTIVIDAD O COMPACTO) */}
        <div style={{
          background: c.surfaceCard,
          border: `1.5px solid ${c.border}`,
          borderRadius: '13px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em',
            color: c.textMuted
          }}>
            <span>Pendientes en Acceso ({listaPendientesAcceso.length})</span>
            <span>Límite entrada: {horaLimiteStr}</span>
          </div>

          {listaPendientesAcceso.length === 0 ? (
            <div style={{ fontSize: '12.5px', color: c.textMuted, padding: '6px 0' }}>
              Sin autorizaciones ni pases pendientes en puerta.
            </div>
          ) : (
            listaPendientesAcceso.map(emp => renderRenglonEjecutivo(emp, false))
          )}
        </div>

        {/* MONITOR 2: SALIDAS TEMPORALES PENDIENTES DE RETORNO */}
        {listaSalidasTemporales.length > 0 && (
          <div style={{
            background: c.surfaceCard,
            border: `1.5px solid ${c.border}`,
            borderRadius: '13px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{
              fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em',
              color: c.textMuted
            }}>
              Salidas Temporales ({listaSalidasTemporales.length})
            </div>
            {listaSalidasTemporales.map(emp => renderRenglonEjecutivo(emp, false))}
          </div>
        )}
      </div>
    );
  }

  // ====================================================================
  // VISTA B: 🏢 PASES DE PUERTA (/caseta) -> MONITOR Y BITÁCORA DEL DÍA
  // ====================================================================
  const indicadores = [
    { id: 'en_planta', label: 'En Planta', count: todosEnPlanta.length, color: '#16a34a' },
    { id: 'por_llegar', label: 'Por Llegar', count: porLlegarHoy.length, color: '#0284c7' },
    { id: 'ausencias', label: 'Ausencias Hoy', count: ausentesHoy.length, color: '#8b5cf6' },
    { id: 'salidas_temp', label: 'Fuera con Pase', count: listaSalidasTemporales.length, color: '#2563eb' },
    { id: 'bitacora', label: 'Bitácora Hoy', count: crucesCompletadosHoy.length, color: '#64748b' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', fontFamily: '"Inter", sans-serif' }}>
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

      {/* 5 INDICADORES EJECUTIVOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
        {indicadores.map(ind => {
          const activo = kpiActivo === ind.id;
          return (
            <button
              key={ind.id}
              type="button"
              onClick={() => setKpiActivo(ind.id)}
              style={{
                background: activo ? `${ind.color}14` : c.surfaceCard,
                border: `1.5px solid ${activo ? ind.color : c.border}`,
                borderRadius: '11px',
                padding: '10px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}
            >
              <span style={{ fontSize: '20px', fontWeight: '900', color: ind.color, lineHeight: 1 }}>
                {ind.count}
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: activo ? c.text : c.textMuted }}>
                {ind.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* FILTRO DE CONSULTA */}
      <div style={{
        background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '11px',
        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px'
      }}>
        <Search size={15} color={c.textMuted} />
        <input
          type="text"
          placeholder="Filtrar lista..."
          value={busquedaTexto}
          onChange={(e) => setBusquedaTexto(e.target.value)}
          style={{
            flex: 1, border: 'none', background: 'transparent', color: c.text,
            fontSize: '13.5px', fontWeight: '600', outline: 'none'
          }}
        />
        {busquedaTexto && (
          <button
            type="button"
            onClick={() => setBusquedaTexto('')}
            style={{ border: 'none', background: 'transparent', color: c.textMuted, cursor: 'pointer' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* CONTENIDO SEGÚN INDICADOR SELECCIONADO */}
      {kpiActivo === 'en_planta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {todosEnPlanta.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '11px', padding: '24px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>
              Sin personal registrado en planta.
            </div>
          ) : (
            todosEnPlanta
              .filter(e => !termino || coincide(e, termino))
              .map(emp => renderRenglonEjecutivo(emp, false))
          )}
        </div>
      )}

      {kpiActivo === 'por_llegar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {porLlegarHoy
            .filter(e => !termino || coincide(e, termino))
            .map(emp => renderRenglonEjecutivo(emp, false))}
        </div>
      )}

      {kpiActivo === 'ausencias' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {ausentesHoy.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '11px', padding: '24px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>
              Sin ausencias programadas hoy.
            </div>
          ) : (
            ausentesHoy
              .filter(e => !termino || coincide(e, termino))
              .map(emp => renderRenglonEjecutivo(emp, false))
          )}
        </div>
      )}

      {kpiActivo === 'salidas_temp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {listaSalidasTemporales.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '11px', padding: '24px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>
              Sin salidas temporales activas.
            </div>
          ) : (
            listaSalidasTemporales.map(emp => renderRenglonEjecutivo(emp, false))
          )}
        </div>
      )}

      {kpiActivo === 'bitacora' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {crucesCompletadosHoy.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '11px', padding: '24px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>
              Sin movimientos registrados hoy.
            </div>
          ) : (
            crucesCompletadosHoy.map(p => (
              <div
                key={p.id}
                style={{
                  background: c.surfaceCard,
                  border: `1.5px solid ${c.border}`,
                  borderLeft: `4px solid ${p.seRegresaACasa ? '#dc2626' : '#16a34a'}`,
                  borderRadius: '11px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar u={p.usuarios} size={34} />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>
                      {formatearApellidosNombre(p.usuarios?.nombre_completo, p.usuarios)}
                    </div>
                    <div style={{ fontSize: '11px', color: c.textMuted, fontWeight: '600' }}>
                      #{p.usuarios?.numero_empleado} · {p.folio}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800' }}>
                  {p.seRegresaACasa ? (
                    <span style={{ color: '#dc2626', background: 'rgba(220,38,38,0.12)', padding: '3px 8px', borderRadius: '5px' }}>
                      Retiro · {p.horaRetiroCaseta}
                    </span>
                  ) : (
                    <>
                      {p.horaSalidaCaseta && (
                        <span style={{ color: '#0284c7', background: 'rgba(2,132,199,0.12)', padding: '3px 8px', borderRadius: '5px' }}>
                          Salida · {p.horaSalidaCaseta}
                        </span>
                      )}
                      {p.horaEntradaCaseta && (
                        <span style={{ color: '#16a34a', background: 'rgba(22,163,74,0.12)', padding: '3px 8px', borderRadius: '5px' }}>
                          {p.tipo_permiso === 'salida' ? `Retorno · ${p.horaEntradaCaseta}` : `Entrada · ${p.horaEntradaCaseta}`}
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
