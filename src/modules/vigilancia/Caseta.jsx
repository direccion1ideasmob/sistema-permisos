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
  Search, RefreshCw, X, Undo2, Check, Hand, Clock, LogOut, DoorOpen, CalendarOff, Users
} from 'lucide-react';

export default function Caseta() {
  const { usuario } = useAuth();
  const location = useLocation();
  const inputRef = useRef(null);

  const esPaseDeLista = !location.pathname.includes('/asistencia') && !location.pathname.includes('/actividad');

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

  const [tabPuerta, setTabPuerta] = useState('pases');
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
  const [procesandoId, setProcesandoId] = useState(null);
  const [avisoGrande, setAvisoGrande] = useState(null);
  const [confirmarAnularEntrada, setConfirmarAnularEntrada] = useState(null);
  const timerAvisoRef = useRef(null);

  const sedeGuardia = usuario?.sede_id || null;
  const hoyStr = obtenerFechaLocalHoy();

  const mostrarAviso = (tipo, texto, deshacerFn = null) => {
    if (timerAvisoRef.current) clearTimeout(timerAvisoRef.current);
    setAvisoGrande({ tipo, texto, deshacerFn });
    timerAvisoRef.current = setTimeout(() => {
      setAvisoGrande(null);
      if (inputRef.current) inputRef.current.focus();
    }, 4500);
  };

  const cargarDatos = useCallback(async () => {
    try {
      const [data, limEnt, limSal] = await Promise.all([
        obtenerDatosCaseta(sedeGuardia, hoyStr),
        obtenerHoraLimiteTolerancia(),
        obtenerHoraSalidaOficial()
      ]);
      setHoraLimiteStr(limEnt || '07:15');
      setHoraSalidaOficialStr(limSal || '17:00');
      setRetenidosEnEspera(data.retenidosEnEspera || []);
      setPasesPorCruzar(data.pasesPorCruzar || []);
      setPersonalFuera(data.personalFuera || []);
      setCrucesCompletadosHoy(data.crucesCompletadosHoy || []);
      setEmpleadosSede(data.empleadosSede || []);
      setMapaAsistencias(data.mapaAsistencias || {});
      setMapaIncidenciasHoy(data.mapaIncidenciasHoy || {});
    } catch (err) {
      console.error('Error cargando caseta:', err);
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
  // EL SISTEMA DECIDE TODO POR EL GUARDIA (SIMPLE Y DIRECTO)
  // ====================================================================
  const obtenerAccionSimple = (emp) => {
    const asis = mapaAsistencias[emp.id];
    const inc = mapaIncidenciasHoy[emp.id];
    const entro = Boolean(asis?.hora_entrada);
    const salio = Boolean(asis?.hora_salida);

    const pasePuerta = pasesPorCruzar.find(p => p.usuario_id === emp.id);
    const paseRetenido = retenidosEnEspera.find(p => p.usuario_id === emp.id);
    const paseFuera = personalFuera.find(p => p.usuario_id === emp.id);

    const ahoraM = minActuales();
    const limEntM = aMinutos(horaLimiteStr);

    // 1. Está esperando firma de RH / Jefe
    if (paseRetenido || inc?.tipo === 'retardo_en_espera') {
      return {
        color: '#d97706',
        fondo: modoOscuro ? 'rgba(245,158,11,0.12)' : '#fffbeb',
        estado: '⏳ Esperando autorización',
        boton: 'En espera...',
        deshabilitado: true
      };
    }

    // 2. RH ordenó que se regrese a casa
    if (pasePuerta?.seRegresaACasa || (inc?.tipo === 'retardo_regresa' && !inc?.yaSeRetiroACasa)) {
      return {
        color: '#dc2626',
        fondo: modoOscuro ? 'rgba(220,38,38,0.14)' : '#fef2f2',
        estado: '🚫 No autorizado (Se retira)',
        boton: '↩ SE VA A CASA',
        tipoAccion: 'RETIRO',
        paseId: pasePuerta?.id || inc?.paseId
      };
    }

    // 3. Viene regresando de la calle con pase
    if (paseFuera) {
      return {
        color: '#2563eb',
        fondo: modoOscuro ? 'rgba(37,99,235,0.10)' : '#eff6ff',
        estado: '🔵 Regresa de pase',
        boton: '✓ DAR REINGRESO',
        tipoAccion: 'REINGRESO_PASE',
        paseId: paseFuera.id
      };
    }

    // 4. Tiene pase para salir a la calle
    if (pasePuerta && pasePuerta.tipo_permiso === 'salida') {
      return {
        color: '#0284c7',
        fondo: modoOscuro ? 'rgba(2,132,199,0.10)' : '#f0f9ff',
        estado: '🔵 Tiene pase de salida',
        boton: '✓ DAR SALIDA',
        tipoAccion: 'SALIDA_PASE',
        paseId: pasePuerta.id
      };
    }

    // 5. Viene entrando a trabajar
    if (!entro) {
      // Ya autorizado por su jefe después de estar detenido
      if (inc?.tipo === 'retardo_autorizado' || (pasePuerta && pasePuerta.tipo_permiso !== 'salida')) {
        return {
          color: '#16a34a',
          fondo: modoOscuro ? 'rgba(22,163,74,0.14)' : '#f0fdf4',
          estado: '✅ Autorizado para entrar',
          boton: '✓ DEJAR PASAR',
          tipoAccion: 'ENTRADA_AUTORIZADA',
          paseId: pasePuerta?.id || inc?.paseId
        };
      }
      // Faltó ayer sin aviso
      if (inc?.tipo === 'falta_ayer_sin_aviso') {
        return {
          color: '#dc2626',
          fondo: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fef2f2',
          estado: '✋ Faltó ayer sin aviso',
          boton: '✋ DETENER',
          tipoAccion: 'ENTRADA_LISTA'
        };
      }
      // Está de vacaciones o tenía falta hoy
      if (inc?.tipo === 'ausencia_autorizada') {
        const esVac = String(inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        return {
          color: '#dc2626',
          fondo: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fef2f2',
          estado: esVac ? '🏖️ Está de vacaciones' : '📋 Tenía falta hoy',
          boton: '✋ PEDIR ACCESO',
          tipoAccion: 'ENTRADA_AUSENTE',
          inc
        };
      }
      // Llegó tarde
      if (ahoraM > limEntM) {
        return {
          color: '#dc2626',
          fondo: modoOscuro ? 'rgba(220,38,38,0.10)' : '#fef2f2',
          estado: '✋ Llegada tarde',
          boton: '✋ DETENER',
          tipoAccion: 'ENTRADA_LISTA'
        };
      }
      // Entrada normal a tiempo
      return {
        color: '#16a34a',
        fondo: c.surfaceCard,
        estado: '🟢 Entrada normal',
        boton: '✓ PASAR',
        tipoAccion: 'ENTRADA_LISTA'
      };
    }

    // 6. Ya está en planta -> Salida de turno
    if (!salio) {
      return {
        color: '#0284c7',
        fondo: c.surfaceCard,
        estado: '🏭 En planta',
        boton: '✓ SALIDA',
        tipoAccion: 'SALIDA_TURNO'
      };
    }

    // 7. Ya salió hoy (Revisar si fue por Salida Definitiva para permitir pedir reingreso si vuelve)
    const paseDef = crucesCompletadosHoy.find(
      p => p.usuario_id === emp.id && p.tipo_permiso === 'salida' && !p.requiereRegreso && !p.horaEntradaCaseta
    );
    if (paseDef) {
      return {
        color: '#d97706',
        fondo: c.surfaceCard,
        estado: '🔵 Salió con pase definitivo',
        boton: '✋ PEDIR REINGRESO',
        tipoAccion: 'REINGRESO_DEFINITIVO',
        paseId: paseDef.id
      };
    }
    return {
      color: '#64748b',
      fondo: c.surfaceCard,
      estado: '✓ Ya salió hoy',
      boton: '↩ Deshacer',
      tipoAccion: 'DESHACER_SALIDA'
    };
  };

  const tocarTarjeta = async (emp) => {
    if (procesandoId) return;
    const acc = obtenerAccionSimple(emp);
    if (acc.deshabilitado) return;

    setProcesandoId(emp.id);
    try {
      setBusqueda('');

      if (acc.tipoAccion === 'ENTRADA_LISTA') {
        const res = await registrarAsistenciaLista(emp.id, 'entrada', usuario?.id || null, false);
        if (res?.resultado === 'ok' || res?.resultado === 'entrada_registrada') {
          mostrarAviso('verde', `✅ PASA A PLANTA: ${emp.nombre_completo}`, () => revertirEntrada(emp.id));
        } else {
          mostrarAviso('rojo', `✋ DETENIDO: ${emp.nombre_completo} (Esperando autorización)`);
        }
      } else if (acc.tipoAccion === 'ENTRADA_AUSENTE') {
        const esVac = String(acc.inc?.etiqueta || '').toLowerCase().includes('vacaciones');
        await solicitarAutorizacionInusualCaseta(
          acc.inc.paseId,
          esVac ? 'presentacion_en_vacaciones' : 'presentacion_en_falta'
        );
        mostrarAviso('rojo', `✋ DETENIDO: Se pidió autorización para ${emp.nombre_completo}`);
      } else if (acc.tipoAccion === 'ENTRADA_AUTORIZADA') {
        const res = await registrarAsistenciaLista(emp.id, 'entrada', usuario?.id || null, false);
        if (res?.resultado === 'retenido_por_inusual' || res?.resultado === 'en_espera_rh') {
          mostrarAviso('rojo', `✋ DETENIDO: Llegó más tarde de la hora autorizada. Se pidió firma.`);
        } else {
          if (acc.paseId) await registrarCheckCaseta(acc.paseId, 'entrada');
          mostrarAviso('verde', `✅ PASA A PLANTA: ${emp.nombre_completo}`, () => revertirEntrada(emp.id));
        }
      } else if (acc.tipoAccion === 'SALIDA_PASE') {
        const res = await registrarCheckCaseta(acc.paseId, 'salida');
        if (res?.resultado === 'retenido_por_horario') {
          mostrarAviso('rojo', `✋ DETENIDO: Hora no coincide. Se pidió autorización.`);
        } else {
          mostrarAviso('verde', `✅ SALIDA AUTORIZADA: ${emp.nombre_completo}`);
        }
      } else if (acc.tipoAccion === 'REINGRESO_PASE') {
        const res = await registrarCheckCaseta(acc.paseId, 'reingreso');
        if (res?.resultado === 'retenido_por_horario') {
          mostrarAviso('rojo', `✋ DETENIDO: Regresó tarde. Se pidió autorización.`);
        } else {
          mostrarAviso('verde', `✅ REINGRESO LISTO: ${emp.nombre_completo}`);
        }
      } else if (acc.tipoAccion === 'RETIRO') {
        await registrarCheckCaseta(acc.paseId, 'retiro');
        mostrarAviso('rojo', `↩ SE RETIRÓ A CASA: ${emp.nombre_completo}`);
      } else if (acc.tipoAccion === 'SALIDA_TURNO') {
        await registrarAsistenciaLista(emp.id, 'salida', usuario?.id || null, false);
        mostrarAviso('verde', `✅ SALIDA REGISTRADA: ${emp.nombre_completo}`, () => revertirSalida(emp.id));
      } else if (acc.tipoAccion === 'REINGRESO_DEFINITIVO') {
        await solicitarAutorizacionInusualCaseta(acc.paseId, 'reingreso_salida_definitiva');
        mostrarAviso('rojo', `✋ DETENIDO: Se pidió autorización de reingreso para ${emp.nombre_completo}`);
      } else if (acc.tipoAccion === 'DESHACER_SALIDA') {
        await deshacerSalidaReciente(emp.id);
        mostrarAviso('verde', `↩ Salida deshecha: ${emp.nombre_completo}`);
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
      setAvisoGrande(null);
      await cargarDatos();
    } finally {
      setProcesandoId(null);
    }
  };

  const revertirSalida = async (empId) => {
    setProcesandoId(empId);
    try {
      await deshacerSalidaReciente(empId);
      setAvisoGrande(null);
      await cargarDatos();
    } finally {
      setProcesandoId(null);
    }
  };

  const Foto = ({ u }) => {
    const url = u?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.nombre_completo || 'C')}&background=16a34a&color=fff&bold=true`;
    return (
      <img
        src={url}
        alt=""
        style={{
          width: '54px', height: '54px', borderRadius: '12px',
          objectFit: 'cover', border: `1.5px solid ${c.border}`, flexShrink: 0
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

  const resultados = hayBusqueda
    ? empleadosSede.filter(e => coincide(e, termino)).slice(0, 4)
    : [];

  // Listas simples
  const idsDetenidos = new Set([
    ...retenidosEnEspera.map(p => p.usuario_id),
    ...pasesPorCruzar.filter(p => p.tipo_permiso !== 'salida' || p.seRegresaACasa).map(p => p.usuario_id)
  ]);
  const listaDetenidosEnPuerta = empleadosSede.filter(e => idsDetenidos.has(e.id));

  const idsPasesSalidaOReingreso = new Set([
    ...pasesPorCruzar.filter(p => p.tipo_permiso === 'salida' && !p.seRegresaACasa).map(p => p.usuario_id),
    ...personalFuera.map(p => p.usuario_id)
  ]);
  const listaSalidasYReingresos = empleadosSede.filter(e => idsPasesSalidaOReingreso.has(e.id));

  const listaNoVienenHoy = empleadosSede.filter(
    e => !mapaAsistencias[e.id]?.hora_entrada && mapaIncidenciasHoy[e.id]?.tipo === 'ausencia_autorizada'
  );

  const listaEnPlanta = empleadosSede.filter(
    e => Boolean(mapaAsistencias[e.id]?.hora_entrada) && !mapaAsistencias[e.id]?.hora_salida
  );

  // Tarjeta Grande y Fácil de Tocar para el Guardia
  const renderTarjetaGuardia = (emp) => {
    const acc = obtenerAccionSimple(emp);
    const cargando = procesandoId === emp.id;

    return (
      <div
        key={emp.id}
        onClick={() => { if (!acc.deshabilitado) tocarTarjeta(emp); }}
        style={{
          background: acc.fondo,
          border: `2.5px solid ${acc.color}`,
          borderRadius: '16px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          cursor: acc.deshabilitado ? 'default' : 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
          <Foto u={emp} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: '900', color: c.text, lineHeight: 1.2 }}>
              {formatearApellidosNombre(emp.nombre_completo, emp)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '5px' }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: acc.color }}>
                {acc.estado}
                {emp.departamentos?.nombre ? <span style={{ color: c.textMuted, fontWeight: '600' }}> · {emp.departamentos.nombre}</span> : ''}
              </span>
              {acc.tipoAccion === 'SALIDA_TURNO' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmarAnularEntrada(emp);
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: c.textMuted,
                    fontSize: '11.5px',
                    fontWeight: '700',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    opacity: 0.75
                  }}
                >
                  Corregir entrada
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          
          <button
          type="button"
          disabled={acc.deshabilitado || Boolean(procesandoId)}
          onClick={(e) => {
            e.stopPropagation();
            tocarTarjeta(emp);
          }}
          style={{
            height: '54px',
            minWidth: '160px',
            padding: '0 22px',
            borderRadius: '13px',
            border: 'none',
            background: acc.deshabilitado ? 'rgba(245,158,11,0.2)' : acc.color,
            color: acc.deshabilitado ? '#d97706' : '#ffffff',
            fontSize: '16px',
            fontWeight: '900',
            cursor: acc.deshabilitado ? 'default' : 'pointer',
            flexShrink: 0
          }}
        >
          {cargando ? '...' : acc.boton}
        </button>
        </div>
      </div>
    );
  };

  // ====================================================================
  // VISTA 1: 📋 PASE DE LISTA (GRANDE, LIMPIA, 1 SOLA COLUMNA)
  // ====================================================================
  if (esPaseDeLista) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '820px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
        <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      {confirmarAnularEntrada && (
        <div
          onClick={() => setConfirmarAnularEntrada(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: c.surfaceCard, border: '2px solid #dc2626',
              borderRadius: '18px', padding: '24px 22px', width: '100%', maxWidth: '400px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px'
            }}
          >
            <span style={{
              fontSize: '12px', fontWeight: '900', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: '99px',
              background: 'rgba(220,38,38,0.14)', color: '#dc2626'
            }}>
              Confirmar corrección de asistencia
            </span>
            <div style={{ fontSize: '16px', fontWeight: '900', color: c.text, lineHeight: 1.3 }}>
              ¿Seguro que deseas anular la entrada de hoy de {formatearApellidosNombre(confirmarAnularEntrada.nombre_completo, confirmarAnularEntrada)}?
            </div>
            <div style={{ fontSize: '13px', color: c.textMuted, fontWeight: '600' }}>
              El trabajador dejará de aparecer en planta y volverá a estar pendiente de entrada.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setConfirmarAnularEntrada(null)}
                style={{
                  height: '46px', borderRadius: '11px', border: `1.5px solid ${c.border}`,
                  background: c.bg, color: c.text, fontSize: '14px', fontWeight: '800', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const idBorrar = confirmarAnularEntrada.id;
                  setConfirmarAnularEntrada(null);
                  await revertirEntrada(idBorrar);
                }}
                style={{
                  height: '46px', borderRadius: '11px', border: 'none',
                  background: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: '900', cursor: 'pointer'
                }}
              >
                Sí, anular entrada
              </button>
            </div>
          </div>
        </div>
      )}


        {/* AVISO GIGANTE VERDE O ROJO */}
        {avisoGrande && (
          <div style={{
            background: avisoGrande.tipo === 'rojo' ? '#dc2626' : '#16a34a',
            color: '#fff',
            borderRadius: '16px',
            padding: '18px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '18px',
            fontWeight: '900',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <span>{avisoGrande.texto}</span>
            {avisoGrande.deshacerFn && (
              <button
                type="button"
                onClick={avisoGrande.deshacerFn}
                style={{
                  height: '42px', padding: '0 16px', borderRadius: '10px',
                  border: '2px solid #fff', background: 'rgba(0,0,0,0.2)',
                  color: '#fff', fontSize: '14px', fontWeight: '900', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0
                }}
              >
                <Undo2 size={16} /> Deshacer
              </button>
            )}
          </div>
        )}

        {/* BUSCADOR GRANDE */}
        <div style={{
          background: c.surfaceCard,
          border: `2px solid ${hayBusqueda ? c.accent : c.border}`,
          borderRadius: '18px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={24}
              style={{
                position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)',
                color: hayBusqueda ? c.accent : c.textMuted
              }}
            />
            <input
              ref={inputRef}
              type="text"
              autoFocus
              placeholder="Escribe el nombre o apellido del trabajador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && resultados.length > 0) {
                  e.preventDefault();
                  tocarTarjeta(resultados[0]);
                } else if (e.key === 'Escape') {
                  setBusqueda('');
                }
              }}
              style={{
                width: '100%',
                height: '62px',
                padding: '0 54px 0 54px',
                borderRadius: '14px',
                border: `2px solid ${c.border}`,
                background: c.bg,
                color: c.text,
                fontSize: '20px',
                fontWeight: '800',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => { setBusqueda(''); if (inputRef.current) inputRef.current.focus(); }}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  width: '40px', height: '40px', borderRadius: '10px',
                  border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <X size={24} />
              </button>
            )}
          </div>

          {/* RESULTADOS GRANDES */}
          {hayBusqueda && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {resultados.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: c.textMuted, fontSize: '16px', fontWeight: '700' }}>
                  No se encontró a nadie con "{busqueda}"
                </div>
              ) : (
                resultados.map(emp => renderTarjetaGuardia(emp))
              )}
            </div>
          )}
        </div>

        {/* PERSONAS DETENIDAS EN LA PUERTA (SOLO APARECE SI HAY ALGUIEN ESPERANDO) */}
        {listaDetenidosEnPuerta.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: '900', color: '#dc2626', textTransform: 'uppercase', paddingLeft: '4px' }}>
              ✋ Personas esperando en la puerta ({listaDetenidosEnPuerta.length})
            </div>
            {listaDetenidosEnPuerta.map(emp => renderTarjetaGuardia(emp))}
          </div>
        )}
      </div>
    );
  }

  // ====================================================================
  // VISTA 2: 🏢 PASES DE PUERTA (3 BOTONES GRANDES ARRIBA Y TARJETAS GRANDES)
  // ====================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '820px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      {confirmarAnularEntrada && (
        <div
          onClick={() => setConfirmarAnularEntrada(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.72)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: c.surfaceCard, border: '2px solid #dc2626',
              borderRadius: '18px', padding: '24px 22px', width: '100%', maxWidth: '400px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.4)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '14px'
            }}
          >
            <span style={{
              fontSize: '12px', fontWeight: '900', textTransform: 'uppercase',
              padding: '4px 12px', borderRadius: '99px',
              background: 'rgba(220,38,38,0.14)', color: '#dc2626'
            }}>
              Confirmar corrección de asistencia
            </span>
            <div style={{ fontSize: '16px', fontWeight: '900', color: c.text, lineHeight: 1.3 }}>
              ¿Seguro que deseas anular la entrada de hoy de {formatearApellidosNombre(confirmarAnularEntrada.nombre_completo, confirmarAnularEntrada)}?
            </div>
            <div style={{ fontSize: '13px', color: c.textMuted, fontWeight: '600' }}>
              El trabajador dejará de aparecer en planta y volverá a estar pendiente de entrada.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setConfirmarAnularEntrada(null)}
                style={{
                  height: '46px', borderRadius: '11px', border: `1.5px solid ${c.border}`,
                  background: c.bg, color: c.text, fontSize: '14px', fontWeight: '800', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const idBorrar = confirmarAnularEntrada.id;
                  setConfirmarAnularEntrada(null);
                  await revertirEntrada(idBorrar);
                }}
                style={{
                  height: '46px', borderRadius: '11px', border: 'none',
                  background: '#dc2626', color: '#fff', fontSize: '14px', fontWeight: '900', cursor: 'pointer'
                }}
              >
                Sí, anular entrada
              </button>
            </div>
          </div>
        </div>
      )}


      {avisoGrande && (
        <div style={{
          background: avisoGrande.tipo === 'rojo' ? '#dc2626' : '#16a34a',
          color: '#fff', borderRadius: '16px', padding: '18px 22px',
          fontSize: '18px', fontWeight: '900', textAlign: 'center'
        }}>
          {avisoGrande.texto}
        </div>
      )}

      {/* 3 BOTONES GRANDES Y CLAROS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <button
          type="button"
          onClick={() => setTabPuerta('pases')}
          style={{
            height: '56px', borderRadius: '14px',
            border: `2px solid ${tabPuerta === 'pases' ? '#2563eb' : c.border}`,
            background: tabPuerta === 'pases' ? 'rgba(37,99,235,0.12)' : c.surfaceCard,
            color: tabPuerta === 'pases' ? '#2563eb' : c.text,
            fontSize: '15px', fontWeight: '900', cursor: 'pointer'
          }}
        >
          Salidas y Regresos ({listaSalidasYReingresos.length})
        </button>

        <button
          type="button"
          onClick={() => setTabPuerta('ausentes')}
          style={{
            height: '56px', borderRadius: '14px',
            border: `2px solid ${tabPuerta === 'ausentes' ? '#8b5cf6' : c.border}`,
            background: tabPuerta === 'ausentes' ? 'rgba(139,92,246,0.12)' : c.surfaceCard,
            color: tabPuerta === 'ausentes' ? '#8b5cf6' : c.text,
            fontSize: '15px', fontWeight: '900', cursor: 'pointer'
          }}
        >
          No Vienen Hoy ({listaNoVienenHoy.length})
        </button>

        <button
          type="button"
          onClick={() => setTabPuerta('en_planta')}
          style={{
            height: '56px', borderRadius: '14px',
            border: `2px solid ${tabPuerta === 'en_planta' ? '#16a34a' : c.border}`,
            background: tabPuerta === 'en_planta' ? 'rgba(22,163,74,0.12)' : c.surfaceCard,
            color: tabPuerta === 'en_planta' ? '#16a34a' : c.text,
            fontSize: '15px', fontWeight: '900', cursor: 'pointer'
          }}
        >
          En Planta / Salidas ({listaEnPlanta.length})
        </button>
      </div>

      {/* LISTA 1: SALIDAS Y REGRESOS DE PASES */}
      {tabPuerta === 'pases' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {listaSalidasYReingresos.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '16px', padding: '40px 20px', textAlign: 'center', color: c.textMuted, fontSize: '16px', fontWeight: '700' }}>
              No hay nadie por salir ni pendiente de regresar ahorita.
            </div>
          ) : (
            listaSalidasYReingresos.map(emp => renderTarjetaGuardia(emp))
          )}
        </div>
      )}

      {/* LISTA 2: NO VIENEN HOY (VACACIONES Y FALTAS) */}
      {tabPuerta === 'ausentes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {listaNoVienenHoy.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '16px', padding: '40px 20px', textAlign: 'center', color: c.textMuted, fontSize: '16px', fontWeight: '700' }}>
              Nadie tiene vacaciones ni faltas programadas hoy.
            </div>
          ) : (
            listaNoVienenHoy.map(emp => renderTarjetaGuardia(emp))
          )}
        </div>
      )}

      {/* LISTA 3: EN PLANTA (PARA DAR SALIDA DE TURNO) */}
      {tabPuerta === 'en_planta' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {listaEnPlanta.length === 0 ? (
            <div style={{ background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '16px', padding: '40px 20px', textAlign: 'center', color: c.textMuted, fontSize: '16px', fontWeight: '700' }}>
              Aún no hay trabajadores registrados en planta hoy.
            </div>
          ) : (
            listaEnPlanta.map(emp => renderTarjetaGuardia(emp))
          )}
        </div>
      )}
    </div>
  );
}
