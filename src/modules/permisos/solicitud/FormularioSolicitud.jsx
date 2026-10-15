import React, { useState, useEffect } from 'react';
import { supabase } from '../../../core/api/supabaseClient';
import { 
  Send, Clock, Calendar, AlertTriangle, ShieldAlert, Info
} from 'lucide-react';

export default function FormularioSolicitud({ usuario, onSolicitudCreada, modoOscuro }) {
  const sesionActual = JSON.parse(localStorage.getItem("permisos_sesion") || '{}');
  const userId = usuario?.id || sesionActual?.id;
  const rolUsuario = usuario?.rol || sesionActual?.rol || 'empleado';
  const deptoId = usuario?.departamento_id || sesionActual?.departamento_id;
  const sedeId = usuario?.sede_id || sesionActual?.sede_id;

  // Fechas y límites (Permite 7 días retroactivos para justificaciones)
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().split('T')[0];
  
  const hace7Dias = new Date(hoy);
  hace7Dias.setDate(hoy.getDate() - 7);
  const minDate = hace7Dias.toISOString().split('T')[0];

  // INICIAN VACÍOS PARA OBLIGAR LA SELECCIÓN CONSCIENTE
  const [tipoPermiso, setTipoPermiso] = useState('');
  const [naturaleza, setNaturaleza] = useState('');
  
  const [fechaPermiso, setFechaPermiso] = useState(fechaHoy);
  const [fechaFinVacaciones, setFechaFinVacaciones] = useState('');

  // Horarios
  const [horaSalida, setHoraSalida] = useState('14:00');
  const [regresaMismoDia, setRegresaMismoDia] = useState(false);
  const [horaRegreso, setHoraRegreso] = useState('16:00');
  const [horaLlegadaRetardo, setHoraLlegadaRetardo] = useState('07:30');

  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  
  // Estados inteligentes
  const [alertaReincidencia, setAlertaReincidencia] = useState(false);

  // === PALETA ZINC ===
  const t = {
    bg: modoOscuro ? '#27272a' : '#ffffff',
    surface: modoOscuro ? '#3f3f46' : '#f8fafc',
    border: modoOscuro ? '#52525b' : '#e2e8f0',
    text: modoOscuro ? '#f4f4f5' : '#0f172a',
    textMuted: modoOscuro ? '#a1a1aa' : '#64748b',
    inputBg: modoOscuro ? '#18181b' : '#ffffff',
    accent: '#16a34a',
    accentSoft: modoOscuro ? 'rgba(22, 163, 74, 0.15)' : '#dcfce7',
    danger: '#ef4444',
    dangerSoft: modoOscuro ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2'
  };

  useEffect(() => {
    if (tipoPermiso === 'vacaciones') {
      setNaturaleza('Vacaciones');
    } else if (naturaleza === 'Vacaciones' && tipoPermiso !== 'vacaciones') {
      setNaturaleza(''); 
    }

    if (tipoPermiso === 'retardo' && userId) {
      verificarReincidenciaOculta();
    } else {
      setAlertaReincidencia(false);
    }
  }, [tipoPermiso, userId, naturaleza]);

  const verificarReincidenciaOculta = async () => {
    try {
      const fecha15 = new Date();
      fecha15.setDate(fecha15.getDate() - 15);
      const limiteISO = fecha15.toISOString().split('T')[0];

      const { count } = await supabase
        .from('permisos')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', userId)
        .eq('tipo_permiso', 'retardo')
        .neq('estado_general', 'rechazado')
        .gte('fecha_permiso', limiteISO);

      if (count > 0) setAlertaReincidencia(true);
    } catch (error) {
      console.error("Error al verificar historial:", error);
    }
  };

  const esRetardoUrgente = tipoPermiso === 'retardo' && fechaPermiso === fechaHoy && hoy.getHours() >= 6;

  const calcularHoras = () => {
    if (!tipoPermiso) return 0;
    if (tipoPermiso === 'falta' || tipoPermiso === 'vacaciones') return 8;

    if (tipoPermiso === 'retardo') {
      const [h, m] = (horaLlegadaRetardo || '07:30').split(':');
      const dInicio = new Date(2000, 0, 1, 7, 0);
      const dLlegada = new Date(2000, 0, 1, parseInt(h, 10), parseInt(m, 10));
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
        const dFinTurno = new Date(2000, 0, 1, 17, 0);
        const diff = (dFinTurno - d1) / 3600000;
        return diff > 0 ? parseFloat(diff.toFixed(2)) : 0;
      }
    }
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. FORZAR VALIDACIÓN NATIVA
    if (!e.target.reportValidity()) return; 

    // === 2. VALIDACIONES DE CAMPOS VACÍOS ===
    if (!tipoPermiso) return alert("Por favor, selecciona el Tipo de Movimiento / Permiso.");
    if (tipoPermiso !== 'vacaciones' && !naturaleza) return alert("Por favor, selecciona la Naturaleza del Asunto.");
    if (!motivo.trim()) return alert("Por favor escribe la justificación del pase.");
    if (!userId || !deptoId) return alert("Error: Sesión incompleta. Vuelve a iniciar sesión.");

    // === 3. VALIDACIONES LÓGICAS DE CONGRUENCIA ===
    if (tipoPermiso === 'vacaciones') {
      const fInicio = new Date(fechaPermiso);
      const fFin = new Date(fechaFinVacaciones);
      if (fFin < fInicio) return alert("Incongruencia detectada: La Fecha de Fin no puede ser anterior a la Fecha de Inicio de las vacaciones.");
    }

    if (tipoPermiso === 'salida' && regresaMismoDia) {
      const [hSalida, mSalida] = horaSalida.split(':').map(Number);
      const [hRegreso, mRegreso] = horaRegreso.split(':').map(Number);
      const minSalida = hSalida * 60 + mSalida;
      const minRegreso = hRegreso * 60 + mRegreso;
      if (minRegreso <= minSalida) return alert("Incongruencia detectada: La hora de regreso debe ser posterior a tu hora de salida.");
    }

    if (tipoPermiso === 'retardo') {
      const [hLlegada, mLlegada] = horaLlegadaRetardo.split(':').map(Number);
      if (hLlegada < 7 || (hLlegada === 7 && mLlegada === 0)) {
        return alert("Incongruencia detectada: Un retardo implica llegar después de tu hora oficial de entrada (07:00 hrs).");
      }
    }

    // === 4. DOBLE VALIDACIÓN (ANTI-DEDAZOS) ===
    const etiquetaAviso = esRetardoUrgente ? "AVISO URGENTE DE RETARDO" : `SOLICITUD DE ${tipoPermiso.toUpperCase()}`;
    const confirmar = window.confirm(`¿Estás seguro de enviar esta ${etiquetaAviso}?\n\nRevisa que la fecha y los horarios sean los correctos antes de continuar.`);
    
    if (!confirmar) return;

    setGuardando(true);
    try {
      const { data: depto, error: errD } = await supabase
        .from('departamentos')
        .select('nombre, clasificacion, jefe_id, gerente_id, rh_id')
        .eq('id', deptoId)
        .single();
      if (errD) throw new Error("No se encontró el departamento del colaborador.");

      // BÚSQUEDA DE LÍDERES
      let jefeFinalId = depto.jefe_id;
      if (!jefeFinalId) {
        const { data: jefeEncontrado } = await supabase.from('usuarios').select('id').eq('departamento_id', deptoId).eq('rol', 'jefe_area').limit(1).maybeSingle();
        if (jefeEncontrado) jefeFinalId = jefeEncontrado.id;
      }

      const clasificacionDepto = (depto.clasificacion || sesionActual.tipo_personal || 'produccion').toLowerCase();
      const rolGerente = clasificacionDepto.includes('admin') ? 'gerente_admin' : 'gerente_produccion';
      
      const { data: gerenteData } = await supabase.from('usuarios').select('id').eq('rol', rolGerente).limit(1).maybeSingle();
      const gerenteFinalId = gerenteData?.id || depto.gerente_id;

      const { data: rhData } = await supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']).limit(1).maybeSingle();
      const rhFinalId = rhData?.id || depto.rh_id;

      // === LÓGICA DEL ÁRBITRO FINAL (AUTO-APROBACIONES INTELIGENTES) ===
      let estadoFirma1 = 'pendiente';
      let estadoFirma2 = 'pendiente';
      let estadoFirma3 = 'pendiente';

      // Evaluamos a los Jefes
      if (jefeFinalId) {
        estadoFirma1 = (jefeFinalId === userId) ? 'auto_aprobado' : 'pendiente';
      } else {
        estadoFirma1 = 'omitido';
      }

      // Evaluamos a los Gerentes
      if (gerenteFinalId) {
        estadoFirma2 = (gerenteFinalId === userId) ? 'auto_aprobado' : 'pendiente';
      } else {
        estadoFirma2 = 'omitido';
      }

      // Evaluamos a RH
      if (rhFinalId) {
        estadoFirma3 = (rhFinalId === userId) ? 'auto_aprobado' : 'pendiente';
      } else {
        estadoFirma3 = 'omitido';
      }

      // Si es Superadmin, aprueba absolutamente todo automáticamente
      if (rolUsuario === 'superadmin') {
        estadoFirma1 = 'auto_aprobado';
        estadoFirma2 = 'auto_aprobado';
        estadoFirma3 = 'auto_aprobado';
      }

      // Determinar quién es el PRIMERO en la línea para notificarlo
      let notificarA = [];
      if (estadoFirma1 === 'pendiente') {
        notificarA = [jefeFinalId];
      } else if (estadoFirma2 === 'pendiente') {
        notificarA = [gerenteFinalId];
      } else if (estadoFirma3 === 'pendiente') {
        notificarA = [rhFinalId];
      }

      // El Árbitro decide el Estado General de la solicitud
      const hayPendientes = [estadoFirma1, estadoFirma2, estadoFirma3].includes('pendiente');
      const estadoGeneral = hayPendientes ? 'en_firmas' : 'aprobado';

      // Otros datos
      let esSantaCatarina = false;
      if (sedeId) {
        const { data: sedeData } = await supabase.from('sedes').select('nombre').eq('id', sedeId).maybeSingle();
        if (sedeData && sedeData.nombre.toLowerCase().includes('catarina')) esSantaCatarina = true;
      }

      const numAleatorio = Math.floor(100000 + Math.random() * 900000);
      const folioTemporal = `REQ-${numAleatorio}`;

      let detalleHorarioTexto = '';
      if (tipoPermiso === 'salida') {
        detalleHorarioTexto = regresaMismoDia ? `🕒 Salida: ${horaSalida} hrs (Regresa: ${horaRegreso} hrs)` : `🕒 Salida definitiva: ${horaSalida} hrs`;
      } else if (tipoPermiso === 'retardo') {
        detalleHorarioTexto = `🕒 Llegada estimada: ${horaLlegadaRetardo} hrs`;
      } else if (tipoPermiso === 'vacaciones') {
        detalleHorarioTexto = `📅 Del ${fechaPermiso} al ${fechaFinVacaciones || fechaPermiso}`;
      } else {
        detalleHorarioTexto = `📅 Para el: ${fechaPermiso}`;
      }

      const requiereCasetaAuto = esSantaCatarina && (tipoPermiso === 'salida' || tipoPermiso === 'retardo');

      const { error: errInsert } = await supabase
        .from('permisos')
        .insert([{
          folio: folioTemporal,
          usuario_id: userId,
          fecha_elaboracion: fechaHoy,
          fecha_permiso: fechaPermiso,
          fecha_fin: tipoPermiso === 'vacaciones' ? (fechaFinVacaciones || fechaPermiso) : null,
          tipo_permiso: tipoPermiso,
          pago: 'Pendiente de dictamen',
          asunto_motivo: tipoPermiso === 'vacaciones' ? `[VACACIONES] ${motivo.trim()}` : `[${naturaleza.toUpperCase()}] ${motivo.trim()}`,
          total_horas: calcularHoras(),
          observaciones: detalleHorarioTexto,
          firma_empleado: true,
          firma_1_id: jefeFinalId,
          firma_1_estado: estadoFirma1,
          firma_2_id: gerenteFinalId,
          firma_2_estado: estadoFirma2,
          firma_3_id: rhFinalId,
          firma_3_estado: estadoFirma3,
          requiere_caseta: requiereCasetaAuto,
          estado_general: estadoGeneral
        }]);

      if (errInsert) throw errInsert;

      // NOTIFICACIONES
      if (notificarA.length > 0) {
        try {
          const fotoSolicitante = usuario?.foto_url || sesionActual?.foto_url || null;
          const nombreSolicitante = usuario?.nombre_completo || sesionActual?.nombre_completo || 'Un colaborador';

          const { data: subs } = await supabase.from('suscripciones_push').select('subscription').in('usuario_id', notificarA);

          if (subs && subs.length > 0) {
            let tituloNotif = '';
            if (tipoPermiso === 'salida') tituloNotif = 'SALIDA ANTICIPADA';
            else if (tipoPermiso === 'retardo') tituloNotif = 'RETARDO';
            else if (tipoPermiso === 'falta') tituloNotif = 'FALTA PROGRAMADA';
            else if (tipoPermiso === 'vacaciones') tituloNotif = 'VACACIONES';
            
            if (esRetardoUrgente) tituloNotif = `🚨 URGENTE: ${tituloNotif}`;

            let etiquetaNat = '🏠 PERSONAL / FAMILIAR';
            if (naturaleza === 'Asunto de Trabajo') etiquetaNat = '💼 ASUNTO LABORAL';
            else if (naturaleza === 'Cita Médica') etiquetaNat = '🏥 CITA MÉDICA';
            else if (tipoPermiso === 'vacaciones') etiquetaNat = '🌴 PERIODO VACACIONAL';

            const envios = subs.map(async (item) => {
              let subLimpia = item.subscription;
              if (typeof subLimpia === 'string') {
                try { subLimpia = JSON.parse(subLimpia); } catch (_) {}
              }
              const res = await fetch('/api/notificar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  subscription: subLimpia,
                  titulo: tituloNotif,
                  mensaje: `👤 ${nombreSolicitante}\n${etiquetaNat}\n${detalleHorarioTexto}\n💬 ${motivo.trim()}`,
                  fotoUrl: fotoSolicitante,
                  urlDestino: '/aprobaciones'
                })
              });
              return res.json();
            });
            await Promise.allSettled(envios);
          }
        } catch (errNotif) {
          console.error("Error notificación:", errNotif);
        }
      }

      alert(`✅ Solicitud enviada correctamente.\n\nFolio Temporal: ${folioTemporal}\n(El folio oficial se asignará tras la aprobación final)`);
      
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

  return (
    <>
      <style>{`
        .form-card-container {
          background: ${t.bg};
          border: 1.5px solid ${t.border};
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
        }

        .zinc-label {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: ${t.textMuted};
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 6px;
        }

        .zinc-input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 8px;
          border: 1.5px solid ${t.border};
          background: ${t.inputBg};
          color: ${t.text};
          font-size: 13.5px;
          outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
        }
        .zinc-input:focus {
          border-color: ${t.accent};
          box-shadow: 0 0 0 3px ${t.accentSoft};
        }

        .grid-responsivo-tipos {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        
        .grid-responsivo-fechas {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .pill-movimiento {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 8px;
          border-radius: 12px;
          border: 1.5px solid ${t.border};
          background: ${t.surface};
          color: ${t.textMuted};
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .pill-movimiento.active {
          border-color: ${t.accent};
          background: ${t.accentSoft};
          color: ${t.accent};
        }
        .pill-movimiento:active {
          transform: scale(0.97);
        }

        @media (max-width: 768px) {
          .form-card-container { padding: 16px; }
          .grid-responsivo-tipos { grid-template-columns: repeat(2, 1fr); }
          .grid-responsivo-fechas { grid-template-columns: 1fr; gap: 12px; }
          .pill-movimiento { padding: 12px 6px; font-size: 11px; }
        }
      `}</style>

      <div className="form-card-container">
        
        {/* CABECERA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1.5px solid ${t.border}`, paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: t.text }}>NUEVA SOLICITUD DE PASE</div>
            <div style={{ fontSize: '12.5px', color: t.textMuted, marginTop: '2px' }}>
              {sesionActual.nombre_completo || usuario?.nombre_completo}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontWeight: '800', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Elaboración</div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: t.text }}>{fechaHoy}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* 1. TIPO DE PERMISO */}
          <div>
            <label className="zinc-label">1. Tipo de Movimiento / Permiso</label>
            <div className="grid-responsivo-tipos">
              {[
                { key: 'salida', label: 'Salida Anticipada', icon: Clock },
                { key: 'retardo', label: 'Llegada Tarde', icon: AlertTriangle },
                { key: 'falta', label: 'Falta Programada', icon: Calendar },
                { key: 'vacaciones', label: 'Vacaciones', icon: Calendar }
              ].map(item => {
                const Icono = item.icon;
                const activo = tipoPermiso === item.key;
                return (
                  <button
                    key={item.key} type="button"
                    onClick={() => setTipoPermiso(item.key)}
                    className={`pill-movimiento ${activo ? 'active' : ''}`}
                    style={activo && item.key === 'retardo' ? { borderColor: t.danger, backgroundColor: t.dangerSoft, color: t.danger } : {}}
                  >
                    <Icono size={20} /> <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ALERTA DE REINCIDENCIA */}
          {alertaReincidencia && tipoPermiso === 'retardo' && (
            <div style={{
              padding: '12px 14px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)',
              border: `1.5px solid #f59e0b`, fontSize: '12px', color: '#d97706',
              display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.4'
            }}>
              <Info size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Atención:</strong> El sistema detecta incidencias previas de retardo en tu historial reciente. Esta información será anexada para la evaluación de tu Jefatura y Recursos Humanos.
              </span>
            </div>
          )}

          {/* ALERTA DE URGENCIA */}
          {esRetardoUrgente && (
            <div style={{
              padding: '12px 14px', borderRadius: '10px', background: t.dangerSoft,
              border: `1.5px solid ${t.danger}`, fontSize: '12px', color: t.danger,
              display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.4'
            }}>
              <ShieldAlert size={20} color={t.danger} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>ALERTA DE ACCESO:</strong> Estás registrando un aviso de retardo de último momento. 
                Al enviar, el Gerente recibirá una notificación urgente para dictaminar tu acceso o si debes regresar a casa.
              </span>
            </div>
          )}

          {/* 2. NATURALEZA */}
          {tipoPermiso && tipoPermiso !== 'vacaciones' && (
            <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
              <label className="zinc-label">2. Naturaleza del Asunto</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                {['Personal / Familiar', 'Cita Médica', 'Asunto de Trabajo'].map(nat => (
                  <button
                    key={nat} type="button" onClick={() => setNaturaleza(nat)}
                    style={{
                      padding: '10px', borderRadius: '8px',
                      border: `1.5px solid ${naturaleza === nat ? t.accent : t.border}`,
                      background: naturaleza === nat ? t.accentSoft : t.surface,
                      color: naturaleza === nat ? t.accent : t.textMuted,
                      fontSize: '12px', fontWeight: '700', cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    {nat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. FECHAS Y HORAS */}
          <div className="grid-responsivo-fechas">
            <div>
              <label className="zinc-label">
                {tipoPermiso === 'vacaciones' ? 'Fecha Inicio *' : 'Fecha en que aplica el pase *'}
              </label>
              <input 
                type="date" required className="zinc-input"
                min={minDate} 
                value={fechaPermiso} onChange={e => setFechaPermiso(e.target.value)} 
              />
            </div>

            {tipoPermiso === 'vacaciones' && (
              <div>
                <label className="zinc-label">Fecha Fin *</label>
                <input 
                  type="date" required className="zinc-input"
                  min={fechaPermiso}
                  value={fechaFinVacaciones} onChange={e => setFechaFinVacaciones(e.target.value)} 
                />
              </div>
            )}

            {tipoPermiso === 'retardo' && (
              <div>
                <label className="zinc-label">Hora Estimada de Llegada *</label>
                <input 
                  type="time" required className="zinc-input"
                  value={horaLlegadaRetardo} onChange={e => setHoraLlegadaRetardo(e.target.value)} 
                />
              </div>
            )}

            {tipoPermiso === 'salida' && (
              <div>
                <label className="zinc-label">Hora en que te retiras *</label>
                <input 
                  type="time" required className="zinc-input"
                  value={horaSalida} onChange={e => setHoraSalida(e.target.value)} 
                />
              </div>
            )}
          </div>

          {/* SALIDA: REGRESA EN EL TURNO */}
          {tipoPermiso === 'salida' && (
            <div style={{
              padding: '14px', borderRadius: '10px', background: t.surface, border: `1.5px solid ${t.border}`,
              display: 'flex', flexDirection: 'column', gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" id="checkRegresa"
                  checked={regresaMismoDia} onChange={e => setRegresaMismoDia(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: t.accent, cursor: 'pointer' }}
                />
                <label htmlFor="checkRegresa" style={{ fontSize: '13px', color: t.text, cursor: 'pointer', fontWeight: '700' }}>
                  ¿Regresas a laborar en el mismo turno? (Salida y reingreso)
                </label>
              </div>

              {regresaMismoDia && (
                <div style={{ marginTop: '6px' }}>
                  <label className="zinc-label">Hora estimada de retorno al puesto *</label>
                  <input 
                    type="time" required className="zinc-input"
                    value={horaRegreso} onChange={e => setHoraRegreso(e.target.value)} 
                  />
                </div>
              )}
            </div>
          )}

          {/* MOTIVO */}
          <div>
            <label className="zinc-label">Motivo / Justificación *</label>
            <textarea 
              required rows={3}
              placeholder={tipoPermiso === 'vacaciones' ? "Ej. Vacaciones correspondientes al periodo 2024-2025..." : "Explica detalladamente la razón de tu solicitud..."}
              value={motivo} onChange={e => setMotivo(e.target.value)}
              className="zinc-input"
              style={{ height: 'auto', resize: 'vertical', lineHeight: '1.4' }}
            />
          </div>

          {/* BOTÓN ENVIAR */}
          <button 
            type="submit" disabled={guardando || !tipoPermiso}
            style={{
              padding: '14px', borderRadius: '10px', border: 'none',
              backgroundColor: !tipoPermiso ? t.surface : (esRetardoUrgente ? t.danger : t.accent), 
              color: !tipoPermiso ? t.textMuted : '#ffffff',
              fontSize: '13.5px', fontWeight: '800', cursor: !tipoPermiso ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s', 
              boxShadow: !tipoPermiso ? 'none' : (esRetardoUrgente ? '0 4px 14px rgba(239, 68, 68, 0.3)' : `0 4px 14px ${t.accentSoft}`)
            }}
            onMouseDown={e => { if(tipoPermiso) e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={e => { if(tipoPermiso) e.currentTarget.style.transform = 'scale(1)' }}
            onMouseLeave={e => { if(tipoPermiso) e.currentTarget.style.transform = 'scale(1)' }}
          >
            <Send size={18} /> {guardando ? 'Registrando en sistema...' : (esRetardoUrgente ? 'ENVIAR AVISO DE URGENCIA' : 'FIRMAR Y ENVIAR SOLICITUD')}
          </button>
        </form>
      </div>
    </>
  );
}