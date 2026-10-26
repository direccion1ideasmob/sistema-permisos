import React, { useState, useEffect } from 'react';
import { Send, Clock, Calendar, AlertTriangle, ShieldAlert, Info, User, Stethoscope, Briefcase, Lock } from 'lucide-react';
import { contarReincidenciasRetardo, crearNuevaSolicitudPermiso } from '../services/permisosService';
import { obtenerHoraLimiteTolerancia, obtenerHoraSalidaOficial } from '../../vigilancia/services/vigilanciaService';
import { obtenerTemaGlobal } from '../../../core/theme/temaGlobal';
import { supabase } from '../../../core/api/supabaseClient';
import { formatearApellidosNombre } from '../../../core/utils/ordenNombre';

export default function FormularioSolicitud({ usuario, onSolicitudCreada, modoOscuro }) {
  const sesionActual = JSON.parse(localStorage.getItem("permisos_sesion") || '{}');
  const userId = usuario?.id || sesionActual?.id;
  const rolUsuario = usuario?.rol || sesionActual?.rol || 'empleado';
  const deptoId = usuario?.departamento_id || sesionActual?.departamento_id;
  const sedeId = usuario?.sede_id || sesionActual?.sede_id;

  const hoy = new Date();
  const formatearLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fechaHoy = formatearLocal(hoy);

  const hace7Dias = new Date(hoy);
  hace7Dias.setDate(hoy.getDate() - 7);
  const minDate = formatearLocal(hace7Dias);

  const [tipoPermiso, setTipoPermiso] = useState('');
  const [naturaleza, setNaturaleza] = useState('');
  const [fechaPermiso, setFechaPermiso] = useState(fechaHoy);
  const [fechaFinVacaciones, setFechaFinVacaciones] = useState('');

  const [horaSalida, setHoraSalida] = useState('14:00');
  const [regresaMismoDia, setRegresaMismoDia] = useState(false);
  const [horaRegreso, setHoraRegreso] = useState('16:00');
  const [horaLimiteRH, setHoraLimiteRH] = useState(() => localStorage.getItem('hora_limite_retardo_rh') || '07:15');
  const [horaSalidaOficialRH, setHoraSalidaOficialRH] = useState(() => localStorage.getItem('hora_salida_oficial_rh') || '17:00');
  const [horaLlegadaRetardo, setHoraLlegadaRetardo] = useState('07:30');

  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [alertaReincidencia, setAlertaReincidencia] = useState(false);

  // Estado completo de bloqueos del día para deshabilitar botones e inputs sin dejar escribir en vano
  const [bloqueoFechaActiva, setBloqueoFechaActiva] = useState(null);
  const [jornadaTotalmenteCerrada, setJornadaTotalmenteCerrada] = useState(false);
  const [tiposBloqueadosMapa, setTiposBloqueadosMapa] = useState({});

  const tema = obtenerTemaGlobal(modoOscuro);
  const t = {
    ...tema,
    bg: tema.surfaceCard,
  };

  useEffect(() => {
    if (!userId || !fechaPermiso) {
      setBloqueoFechaActiva(null);
      setJornadaTotalmenteCerrada(false);
      setTiposBloqueadosMapa({});
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const finConsulta = tipoPermiso === 'vacaciones' && fechaFinVacaciones ? fechaFinVacaciones : fechaPermiso;
        const [{ data }, { data: asistHoy }] = await Promise.all([
          supabase
            .from('permisos')
            .select('id, folio, fecha_permiso, fecha_fin, tipo_permiso, estado_general, pago, observaciones')
            .eq('usuario_id', userId)
            .lte('fecha_permiso', finConsulta),
          supabase
            .from('asistencias_caseta')
            .select('hora_entrada, hora_salida')
            .eq('usuario_id', userId)
            .eq('fecha', fechaPermiso)
            .maybeSingle()
        ]);

        if (cancelado) return;
        const activos = (data || []).filter(p => {
          const finP = p.fecha_fin || p.fecha_permiso;
          if (!(p.fecha_permiso <= finConsulta && finP >= fechaPermiso)) return false;
          const pagoL = String(p.pago || '').toLowerCase();
          const obsL = String(p.observaciones || '');
          if (pagoL === 'cancelado' || /CANCELADO por/i.test(obsL)) return false;
          const esRegreso = pagoL.includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(obsL);
          if (p.estado_general === 'rechazado' && !esRegreso) return false;
          return true;
        });

        const regCasa = activos.find(p => (p.pago || '').toLowerCase().includes('regresa') || /\[REGRESADO EN PUERTA:/i.test(p.observaciones || ''));
        const faltaOVac = activos.find(p => ['falta', 'vacaciones'].includes((p.tipo_permiso || '').toLowerCase()));
        const retardoHoy = activos.find(p => (p.tipo_permiso || '').toLowerCase() === 'retardo');
        const salidasHoy = activos.filter(p => (p.tipo_permiso || '').toLowerCase() === 'salida');
        const salidaAbierta = salidasHoy.find(s => !/\[REINGRESO CASETA:/i.test(String(s.observaciones || '')));
        const tieneSelloRetardo = retardoHoy && /\[(?:LLEGADA EN PUERTA|ENTRADA CASETA|REINGRESO CASETA):/i.test(retardoHoy.observaciones || '');

        const mapaBloqueos = {};

        // 1. Bloqueos de día completo (nada se puede pedir para esta fecha)
        if (regCasa) {
          const msg = `Jornada cerrada para el ${fechaPermiso}: Ya cuentas con un dictamen de retiro en puerta (Falta por retardo • Folio ${regCasa.folio}). No es posible solicitar otro permiso ni salida en esta fecha.`;
          setJornadaTotalmenteCerrada(true);
          setTiposBloqueadosMapa({ salida: msg, retardo: msg, falta: msg, vacaciones: msg });
          setBloqueoFechaActiva(msg);
          if (tipoPermiso) setTipoPermiso('');
          return;
        }

        if (faltaOVac) {
          const msg = `Jornada cubierta para el ${fechaPermiso}: Ya cuentas con un registro de ${(faltaOVac.tipo_permiso || '').toUpperCase()} (${faltaOVac.folio}). No es posible registrar otro permiso en la misma fecha.`;
          setJornadaTotalmenteCerrada(true);
          setTiposBloqueadosMapa({ salida: msg, retardo: msg, falta: msg, vacaciones: msg });
          setBloqueoFechaActiva(msg);
          if (tipoPermiso) setTipoPermiso('');
          return;
        }

        if (asistHoy?.hora_salida) {
          const msg = `Jornada concluida el ${fechaPermiso}: Ya registraste tu salida definitiva de planta (${asistHoy.hora_salida} hrs).`;
          setJornadaTotalmenteCerrada(true);
          setTiposBloqueadosMapa({ salida: msg, retardo: msg, falta: msg, vacaciones: msg });
          setBloqueoFechaActiva(msg);
          if (tipoPermiso) setTipoPermiso('');
          return;
        }

        // 2. Bloqueos parciales por tipo de movimiento
        if (retardoHoy) {
          mapaBloqueos.retardo = `Ya tienes un pase de Retardo (${retardoHoy.folio}) registrado para el ${fechaPermiso}.`;
        } else if (asistHoy?.hora_entrada) {
          mapaBloqueos.retardo = `Ya cuentas con registro de entrada en planta (${asistHoy.hora_entrada} hrs) el ${fechaPermiso}.`;
        } else if (salidasHoy.length > 0) {
          mapaBloqueos.retardo = `Ya tienes un pase de Salida (${salidasHoy[0].folio}) para el ${fechaPermiso}.`;
        }

        if (retardoHoy && retardoHoy.estado_general === 'en_firmas') {
          mapaBloqueos.salida = `Tienes un pase de Retardo (${retardoHoy.folio}) pendiente de autorización. Podrás solicitar Salida cuando se autorice tu acceso.`;
        } else if (salidaAbierta) {
          mapaBloqueos.salida = `Ya cuentas con un pase de Salida activo (${salidaAbierta.folio}) para el ${fechaPermiso}.`;
        }

        if (asistHoy?.hora_entrada) {
          mapaBloqueos.falta = `Ya tienes registro de entrada en planta (${asistHoy.hora_entrada} hrs) el ${fechaPermiso}.`;
          mapaBloqueos.vacaciones = `Ya tienes registro de entrada en planta (${asistHoy.hora_entrada} hrs) el ${fechaPermiso}.`;
        } else if (tieneSelloRetardo) {
          mapaBloqueos.falta = `Ya tienes llegada registrada en Caseta (${retardoHoy.folio}) el ${fechaPermiso}.`;
          mapaBloqueos.vacaciones = `Ya tienes llegada registrada en Caseta (${retardoHoy.folio}) el ${fechaPermiso}.`;
        }

        const todosBloqueados = ['salida', 'retardo', 'falta', 'vacaciones'].every(k => Boolean(mapaBloqueos[k]));
        setJornadaTotalmenteCerrada(todosBloqueados);
        setTiposBloqueadosMapa(mapaBloqueos);

        if (todosBloqueados) {
          setBloqueoFechaActiva(mapaBloqueos.salida || mapaBloqueos.retardo || 'No hay movimientos disponibles para esta fecha.');
          if (tipoPermiso) setTipoPermiso('');
        } else if (tipoPermiso && mapaBloqueos[tipoPermiso]) {
          setBloqueoFechaActiva(mapaBloqueos[tipoPermiso]);
          setTipoPermiso('');
        } else {
          setBloqueoFechaActiva(null);
        }
      } catch (_) {}
    })();
    return () => { cancelado = true; };
  }, [userId, fechaPermiso, fechaFinVacaciones, tipoPermiso]);

  useEffect(() => {
    obtenerHoraLimiteTolerancia().then((h) => {
      if (h) setHoraLimiteRH(h);
    }).catch(() => {});
    obtenerHoraSalidaOficial().then((hSal) => {
      if (hSal) setHoraSalidaOficialRH(hSal);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tipoPermiso === 'vacaciones') {
      setNaturaleza('Vacaciones');
    } else if (naturaleza === 'Vacaciones' && tipoPermiso !== 'vacaciones') {
      setNaturaleza('');
    }

    if (tipoPermiso === 'retardo') {
      obtenerHoraLimiteTolerancia().then((h) => {
        if (!h) return;
        setHoraLimiteRH(h);
        const [hLim, mLim] = h.split(':').map(Number);
        const minLim = hLim * 60 + mLim;
        const [hAct, mAct] = (horaLlegadaRetardo || '07:30').split(':').map(Number);
        const minAct = hAct * 60 + mAct;
        if (minAct <= minLim) {
          const sugeridaMin = minLim + 15;
          const sH = String(Math.floor(sugeridaMin / 60) % 24).padStart(2, '0');
          const sM = String(sugeridaMin % 60).padStart(2, '0');
          setHoraLlegadaRetardo(`${sH}:${sM}`);
        }
      }).catch(() => {});
    }
    if (tipoPermiso === 'retardo' && userId) {
      contarReincidenciasRetardo(userId).then(count => setAlertaReincidencia(count > 0)).catch(() => {});
    } else {
      setAlertaReincidencia(false);
    }
  }, [tipoPermiso, userId, naturaleza]);

  const esRetardoUrgente = (() => {
    if (tipoPermiso !== 'retardo' || fechaPermiso !== fechaHoy) return false;
    if (naturaleza === 'Asunto de Trabajo') return false;
    const [hLim, mLim] = (horaLimiteRH || '07:15').split(':').map(Number);
    const minLimiteRH = (isNaN(hLim) ? 7 : hLim) * 60 + (isNaN(mLim) ? 15 : mLim);
    const minCorteAnticipado = Math.max(0, minLimiteRH - 90);
    const minActuales = hoy.getHours() * 60 + hoy.getMinutes();
    return minActuales >= minCorteAnticipado;
  })();
  const tieneSegundoCampoHorario = ['vacaciones', 'retardo', 'salida'].includes(tipoPermiso);

  const calcularHoras = () => {
    if (!tipoPermiso) return 0;
    if (tipoPermiso === 'falta' || tipoPermiso === 'vacaciones') return 8;

    if (tipoPermiso === 'retardo') {
      const [h, m] = (horaLlegadaRetardo || '07:30').split(':').map(Number);
      const [hLim, mLim] = (horaLimiteRH || '07:15').split(':').map(Number);
      const baseHora = hLim === 7 ? 7 : hLim;
      const baseMin = hLim === 7 ? 0 : mLim;
      const dInicio = new Date(2000, 0, 1, baseHora, baseMin);
      const dLlegada = new Date(2000, 0, 1, h, m);
      const diff = (dLlegada - dInicio) / 3600000;
      return diff > 0 ? parseFloat(diff.toFixed(2)) : 0;
    }

    if (tipoPermiso === 'salida') {
      const [h1, m1] = (horaSalida || '14:00').split(':');
      const d1 = new Date(2000, 0, 1, parseInt(h1, 10), parseInt(m1, 10));
      if (regresaMismoDia) {
        const [h2, m2] = (horaRegreso || '16:00').split(':');
        const d2 = new Date(2000, 0, 1, parseInt(h2, 10), parseInt(m2, 10));
        const diff = (d2 - d1) / 3600000;
        return diff > 0 ? parseFloat(diff.toFixed(2)) : 0;
      } else {
        const [hFin, mFin] = (horaSalidaOficialRH || '17:00').split(':').map(Number);
        const dFinTurno = new Date(2000, 0, 1, isNaN(hFin) ? 17 : hFin, isNaN(mFin) ? 0 : mFin);
        const diff = (dFinTurno - d1) / 3600000;
        return diff > 0 ? parseFloat(diff.toFixed(2)) : 0;
      }
    }
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;

    if (bloqueoFechaActiva || jornadaTotalmenteCerrada) return alert(bloqueoFechaActiva || 'No es posible registrar permisos en esta fecha.');
    if (!tipoPermiso) return alert("Por favor, selecciona el Tipo de Movimiento / Permiso.");
    if (tiposBloqueadosMapa[tipoPermiso]) return alert(tiposBloqueadosMapa[tipoPermiso]);
    if (tipoPermiso !== 'vacaciones' && !naturaleza) return alert("Por favor, selecciona la Naturaleza del Asunto.");
    if (!motivo.trim()) return alert("Por favor escribe la justificación del pase.");
    if (!userId || !deptoId) return alert("Error: Sesión incompleta. Vuelve a iniciar sesión.");

    if (tipoPermiso === 'vacaciones') {
      if (new Date(fechaFinVacaciones) < new Date(fechaPermiso)) {
        return alert("Incongruencia detectada: La Fecha de Fin no puede ser anterior a la Fecha de Inicio de las vacaciones.");
      }
    }

    if (tipoPermiso === 'salida') {
      const [hSalida, mSalida] = horaSalida.split(':').map(Number);
      const [hFinOf, mFinOf] = (horaSalidaOficialRH || '17:00').split(':').map(Number);
      const minSalida = hSalida * 60 + mSalida;
      const minFinOficial = (isNaN(hFinOf) ? 17 : hFinOf) * 60 + (isNaN(mFinOf) ? 0 : mFinOf);

      if (minSalida >= minFinOficial) {
        return alert(`Incongruencia detectada: La hora de salida oficial es a las ${horaSalidaOficialRH} hrs. Un pase de salida anticipada debe ser previo a las ${horaSalidaOficialRH} hrs.`);
      }

      if (fechaPermiso === fechaHoy && !['gerente_rh', 'rh_nominas', 'superadmin'].includes(rolUsuario)) {
        const ahoraReal = new Date();
        const minAhora = ahoraReal.getHours() * 60 + ahoraReal.getMinutes();
        if (minSalida < minAhora - 15) {
          return alert(`Incongruencia de horario: No puedes solicitar un pase de salida para hoy a las ${horaSalida} hrs porque esa hora ya pasó.`);
        }
      }

      if (regresaMismoDia) {
        const [hRegreso, mRegreso] = horaRegreso.split(':').map(Number);
        const minRegreso = hRegreso * 60 + mRegreso;
        if (minRegreso <= minSalida) {
          return alert("Incongruencia detectada: La hora de regreso debe ser posterior a tu hora de salida.");
        }
        if (minRegreso > minFinOficial) {
          return alert(`Incongruencia detectada: La hora de regreso (${horaRegreso} hrs) no puede ser posterior al cierre del turno (${horaSalidaOficialRH} hrs).`);
        }
      }
    }

    if (tipoPermiso === 'retardo') {
      const [hLlegada, mLlegada] = horaLlegadaRetardo.split(':').map(Number);
      const [hLim, mLim] = (horaLimiteRH || '07:15').split(':').map(Number);
      const minutosLlegada = hLlegada * 60 + mLlegada;
      const minutosLimite = (isNaN(hLim) ? 7 : hLim) * 60 + (isNaN(mLim) ? 15 : mLim);

      if (minutosLlegada <= minutosLimite) {
        return alert(`Incongruencia detectada: La tolerancia de entrada es hasta las ${horaLimiteRH} hrs. Un pase de retardo solo aplica para llegadas posteriores a las ${horaLimiteRH} hrs.`);
      }
    }

    const etiquetaAviso = esRetardoUrgente ? "AVISO URGENTE DE RETARDO" : `SOLICITUD DE ${tipoPermiso.toUpperCase()}`;
    if (!window.confirm(`¿Estás seguro de enviar esta ${etiquetaAviso}?\n\nRevisa que la fecha y los horarios sean los correctos antes de continuar.`)) return;

    setGuardando(true);
    try {
      await crearNuevaSolicitudPermiso({
        userId,
        rolUsuario,
        deptoId,
        sedeId,
        tipoPersonal: usuario?.tipo_personal || sesionActual?.tipo_personal,
        nombreSolicitante: usuario?.nombre_completo || sesionActual?.nombre_completo || 'Un colaborador',
        fotoSolicitante: usuario?.foto_url || sesionActual?.foto_url || null,
        tipoPermiso,
        naturaleza,
        fechaHoy,
        fechaPermiso,
        fechaFinVacaciones,
        horaSalida,
        regresaMismoDia,
        horaRegreso,
        horaLlegadaRetardo,
        motivo,
        totalHoras: calcularHoras(),
        esRetardoUrgente
      });

      alert(`✅ Solicitud enviada correctamente a revisión.\n(Tu folio oficial se asignará al concluir las firmas)`);

      setTipoPermiso('');
      setNaturaleza('');
      setMotivo('');
      setRegresaMismoDia(false);

      if (onSolicitudCreada) onSolicitudCreada();
    } catch (err) {
      alert("Error al enviar solicitud: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const catalogoTipos = [
    { key: 'salida', label: 'Salida Anticipada', icon: Clock, color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
    { key: 'retardo', label: 'Llegada Tarde', icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
    { key: 'falta', label: 'Falta Programada', icon: Calendar, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)' },
    { key: 'vacaciones', label: 'Vacaciones', icon: Calendar, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
  ];

  const catalogoNaturaleza = [
    { label: 'Personal / Familiar', icon: User },
    { label: 'Cita Médica', icon: Stethoscope },
    { label: 'Asunto de Trabajo', icon: Briefcase }
  ];

  return (
    <>
      <style>{`
        .form-card-container {
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          background: ${t.bg};
          border: 1.5px solid ${t.border};
          border-radius: 20px;
          padding: 34px 40px;
          box-shadow: ${modoOscuro ? '0 10px 35px rgba(0,0,0,0.4)' : '0 8px 30px rgba(0,0,0,0.05)'};
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
          box-sizing: border-box;
          overflow: hidden;
        }
        .form-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          border-bottom: 1.5px solid ${t.border};
          padding-bottom: 16px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .form-title-main {
          font-size: 21px;
          font-weight: 800;
          color: ${t.text};
          letter-spacing: -0.01em;
        }
        .form-subtitle-user {
          font-size: 14px;
          font-weight: 600;
          color: ${t.textMuted};
          margin-top: 3px;
        }
        .zinc-label {
          display: block;
          font-size: 12.5px;
          font-weight: 800;
          color: ${t.textMuted};
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 9px;
        }
        .zinc-input {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          min-height: 48px;
          padding: 12px 15px;
          border-radius: 11px;
          border: 1.5px solid ${t.inputBorder};
          background: ${t.inputBg};
          color: ${t.text};
          font-size: 15px;
          font-weight: 600;
          outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
          font-family: inherit;
          display: block;
          -webkit-appearance: none;
          appearance: none;
        }
        .zinc-input:focus {
          border-color: ${t.accent};
          box-shadow: 0 0 0 3px ${t.accentSoft};
        }
        .grid-responsivo-tipos {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        .grid-responsivo-naturaleza {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .grid-responsivo-fechas {
          display: grid;
          grid-template-columns: ${tieneSegundoCampoHorario ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'};
          gap: 18px;
        }
        .pill-movimiento {
          width: 100%;
          min-height: 88px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 10px;
          border-radius: 14px;
          border: 1.5px solid ${t.border};
          background: ${t.surface};
          color: ${t.textMuted};
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          box-sizing: border-box;
          min-width: 0;
        }
        @media (max-width: 760px) {
          .form-card-container {
            padding: 18px 16px;
            border-radius: 16px;
          }
          .form-header-row {
            margin-bottom: 18px;
            padding-bottom: 12px;
          }
          .form-title-main {
            font-size: 17px;
          }
          .form-subtitle-user {
            font-size: 12.5px;
          }
          .grid-responsivo-tipos {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          .grid-responsivo-naturaleza {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .grid-responsivo-fechas {
            grid-template-columns: minmax(0, 1fr);
            gap: 14px;
          }
          .pill-movimiento {
            padding: 12px 8px;
            font-size: 13px;
            gap: 6px;
          }
          .zinc-input {
            padding: 12px 13px;
            font-size: 14.5px;
          }
        }
      `}</style>

      <div className="form-card-container">
        <div className="form-header-row">
          <div>
            <div className="form-title-main">NUEVA SOLICITUD DE PASE</div>
            <div className="form-subtitle-user">{formatearApellidosNombre(sesionActual.nombre_completo || usuario?.nombre_completo)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '800', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elaboración</div>
            <div style={{ fontSize: '16.5px', fontWeight: '800', color: t.text, marginTop: '2px' }}>{fechaHoy}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* PASO 1: FECHA (SIEMPRE DISPONIBLE PARA CAMBIAR DE DÍA SI HOY ESTÁ CERRADO) */}
          <div className="grid-responsivo-fechas">
            <div style={{ minWidth: 0 }}>
              <label className="zinc-label">{tipoPermiso === 'vacaciones' ? '1. Fecha de Inicio *' : '1. Fecha en que aplica el pase *'}</label>
              <input
                type="date"
                required
                className="zinc-input"
                min={minDate}
                value={fechaPermiso}
                onChange={e => setFechaPermiso(e.target.value)}
              />
            </div>

            {!jornadaTotalmenteCerrada && tipoPermiso === 'vacaciones' && (
              <div style={{ minWidth: 0 }}>
                <label className="zinc-label">Fecha Fin *</label>
                <input type="date" required className="zinc-input" min={fechaPermiso} value={fechaFinVacaciones} onChange={e => setFechaFinVacaciones(e.target.value)} />
              </div>
            )}

            {!jornadaTotalmenteCerrada && tipoPermiso === 'retardo' && (
              <div style={{ minWidth: 0 }}>
                <label className="zinc-label">Hora Estimada de Llegada *</label>
                <input type="time" required min={horaLimiteRH} className="zinc-input" value={horaLlegadaRetardo} onChange={e => setHoraLlegadaRetardo(e.target.value)} />
              </div>
            )}

            {!jornadaTotalmenteCerrada && tipoPermiso === 'salida' && (
              <div style={{ minWidth: 0 }}>
                <label className="zinc-label">Hora en que te retiras *</label>
                <input type="time" required className="zinc-input" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} />
              </div>
            )}
          </div>

          {bloqueoFechaActiva && (
            <div style={{ padding: '14px 16px', borderRadius: '12px', background: t.dangerSoft, border: `1.5px solid ${t.danger}`, fontSize: '13.5px', color: t.danger, display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.45', fontWeight: '700' }}>
              <ShieldAlert size={20} color={t.danger} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <div>{bloqueoFechaActiva}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.9, marginTop: '4px' }}>
                  Si necesitas programar un permiso para otro día, cambia la fecha en el campo superior.
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: TARJETAS DE TIPO DE PERMISO (SE DESHABILITAN LAS QUE NO APLICAN EN ESA FECHA) */}
          <div>
            <label className="zinc-label">2. Tipo de Movimiento / Permiso</label>
            <div className="grid-responsivo-tipos">
              {catalogoTipos.map(item => {
                const Icono = item.icon;
                const activo = tipoPermiso === item.key;
                const motivoBloqueoItem = tiposBloqueadosMapa[item.key];
                const deshabilitado = Boolean(jornadaTotalmenteCerrada || motivoBloqueoItem);

                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={deshabilitado}
                    title={motivoBloqueoItem || item.label}
                    onClick={() => {
                      if (deshabilitado) return;
                      setBloqueoFechaActiva(null);
                      setTipoPermiso(item.key);
                    }}
                    className="pill-movimiento"
                    style={
                      deshabilitado
                        ? {
                            opacity: 0.38,
                            cursor: 'not-allowed',
                            background: t.bg,
                            borderColor: t.border
                          }
                        : activo
                        ? {
                            borderColor: item.color,
                            backgroundColor: item.bg,
                            color: item.color
                          }
                        : {}
                    }
                  >
                    <Icono size={22} />
                    <span>{item.label}</span>
                    {deshabilitado && (
                      <span style={{ fontSize: '10.5px', fontWeight: '800', color: t.danger, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Lock size={11} /> No disponible
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SI EL DÍA NO ESTÁ CERRADO Y YA ELIGIÓ UN TIPO DE PERMISO VÁLIDO, MOSTRAR EL RESTO DEL FORMULARIO */}
          {!jornadaTotalmenteCerrada && tipoPermiso && !tiposBloqueadosMapa[tipoPermiso] && (
            <>
              {alertaReincidencia && tipoPermiso === 'retardo' && (
                <div style={{ padding: '13px 15px', borderRadius: '11px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', fontSize: '13.5px', color: '#d97706', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.45' }}>
                  <Info size={19} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Atención:</strong> El sistema detecta incidencias previas de retardo en tu historial reciente. Esta información será anexada para la evaluación de tu Jefatura y Recursos Humanos.</span>
                </div>
              )}

              {esRetardoUrgente && (
                <div style={{ padding: '13px 15px', borderRadius: '11px', background: t.dangerSoft, border: `1px solid ${t.danger}`, fontSize: '13.5px', color: t.danger, display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.45' }}>
                  <ShieldAlert size={19} color={t.danger} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>AVISO DE RETARDO DEL DÍA:</strong> Estás registrando un retardo con menos de 1 hora y media de anticipación al límite de entrada ({horaLimiteRH} hrs). Tu Jefatura y Recursos Humanos recibirán la notificación para autorizar tu acceso.</span>
                </div>
              )}

              {tipoPermiso !== 'vacaciones' && (
                <div>
                  <label className="zinc-label">3. Naturaleza del Asunto</label>
                  <div className="grid-responsivo-naturaleza">
                    {catalogoNaturaleza.map(item => {
                      const nat = item.label;
                      const IconoNat = item.icon;
                      const activa = naturaleza === nat;
                      return (
                        <button
                          key={nat}
                          type="button"
                          onClick={() => setNaturaleza(nat)}
                          style={{
                            padding: '13px 14px',
                            borderRadius: '11px',
                            border: `1.5px solid ${activa ? t.text : t.border}`,
                            background: activa ? (modoOscuro ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)') : t.surface,
                            color: activa ? t.text : t.textMuted,
                            fontSize: '14px',
                            fontWeight: activa ? '800' : '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <IconoNat size={17} color={activa ? t.text : t.textMuted} strokeWidth={2} />
                          <span>{nat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {tipoPermiso === 'salida' && (
                <div style={{ padding: '14px 16px', borderRadius: '12px', background: t.surface, border: `1.5px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="checkbox" id="checkRegresa" checked={regresaMismoDia} onChange={e => setRegresaMismoDia(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: '#0ea5e9', cursor: 'pointer', flexShrink: 0 }} />
                    <label htmlFor="checkRegresa" style={{ fontSize: '14.5px', color: t.text, cursor: 'pointer', fontWeight: '700', lineHeight: 1.35 }}>
                      ¿Regresas a laborar en el mismo turno? (Salida y reingreso)
                    </label>
                  </div>

                  {regresaMismoDia && (
                    <div style={{ marginTop: '2px', minWidth: 0 }}>
                      <label className="zinc-label">Hora estimada de retorno al puesto *</label>
                      <input type="time" required className="zinc-input" value={horaRegreso} onChange={e => setHoraRegreso(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="zinc-label">Motivo / Justificación *</label>
                <textarea
                  required rows={4}
                  placeholder={tipoPermiso === 'vacaciones' ? "Ej. Vacaciones correspondientes al periodo..." : "Explica detalladamente la razón de tu solicitud..."}
                  value={motivo} onChange={e => setMotivo(e.target.value)}
                  className="zinc-input"
                  style={{ height: 'auto', resize: 'vertical', lineHeight: '1.5' }}
                />
              </div>

              <button
                type="submit"
                disabled={guardando || !tipoPermiso || Boolean(bloqueoFechaActiva) || jornadaTotalmenteCerrada}
                style={{
                  padding: '15px', borderRadius: '12px', border: 'none',
                  backgroundColor: esRetardoUrgente ? t.danger : t.accent,
                  color: '#ffffff',
                  fontSize: '15px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s',
                  boxShadow: esRetardoUrgente ? '0 4px 14px rgba(239, 68, 68, 0.3)' : `0 4px 14px ${t.accentSoft}`
                }}
              >
                <Send size={18} /> {guardando ? 'Registrando en sistema...' : (esRetardoUrgente ? 'ENVIAR AVISO DE URGENCIA' : 'FIRMAR Y ENVIAR SOLICITUD')}
              </button>
            </>
          )}
        </form>
      </div>
    </>
  );
}
