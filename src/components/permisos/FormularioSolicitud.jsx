import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  Send, Clock, Calendar, AlertTriangle, ShieldAlert, Info
} from 'lucide-react';

export default function FormularioSolicitud({ usuario, onSolicitudCreada, c, modoOscuro }) {
  const sesionActual = JSON.parse(localStorage.getItem("permisos_sesion") || '{}');
  const userId = usuario?.id || sesionActual?.id;
  const deptoId = usuario?.departamento_id || sesionActual?.departamento_id;
  const sedeId = usuario?.sede_id || sesionActual?.sede_id;

  // Fechas y límites
  const hoy = new Date();
  const fechaHoy = hoy.toISOString().split('T')[0];
  
  const hace7Dias = new Date(hoy);
  hace7Dias.setDate(hoy.getDate() - 7);
  const minDate = hace7Dias.toISOString().split('T')[0]; // Bloqueo de 7 días hacia atrás

  const [tipoPermiso, setTipoPermiso] = useState('salida');
  const [naturaleza, setNaturaleza] = useState('Personal / Familiar');
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

  // 1. Efecto: Limpiar naturaleza en vacaciones y checar reincidencia en retardos
  useEffect(() => {
    if (tipoPermiso === 'vacaciones') {
      setNaturaleza('Vacaciones');
    } else if (naturaleza === 'Vacaciones') {
      setNaturaleza('Personal / Familiar');
    }

    if (tipoPermiso === 'retardo' && userId) {
      verificarReincidenciaOculta();
    } else {
      setAlertaReincidencia(false);
    }
  }, [tipoPermiso, userId]);

  // Motor silencioso de Reincidencia (Últimos 15 días)
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

  // Cálculo de la Urgencia (Corte a las 6:00 AM)
  const esRetardoUrgente = tipoPermiso === 'retardo' && fechaPermiso === fechaHoy && hoy.getHours() >= 6;

  // Cálculo de horas para RH
  const calcularHoras = () => {
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

  const generarFolioOficial = async (prefijoLetra, anio2Digitos) => {
    const patron = `${prefijoLetra}-${anio2Digitos}-%`;
    const { data } = await supabase
      .from('permisos')
      .select('folio')
      .ilike('folio', patron)
      .order('created_at', { ascending: false })
      .limit(1);

    let consecutivo = 1;
    if (data && data.length > 0 && data[0].folio) {
      const partes = data[0].folio.split('-');
      if (partes.length === 3) {
        const num = parseInt(partes[2], 10);
        if (!isNaN(num)) consecutivo = num + 1;
      }
    }
    return `${prefijoLetra}-${anio2Digitos}-${String(consecutivo).padStart(4, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!motivo.trim()) return alert("Por favor escribe la justificación del pase.");
    if (!userId || !deptoId) return alert("Error: Sesión incompleta. Vuelve a iniciar sesión.");

    setGuardando(true);
    try {
      // 1. Obtener datos del departamento
      const { data: depto, error: errD } = await supabase
        .from('departamentos')
        .select('nombre, clasificacion, jefe_id, gerente_id, rh_id')
        .eq('id', deptoId)
        .single();
      if (errD) throw new Error("No se encontró el departamento del colaborador.");

      // Encontrar Jefe de Área si existe
      let jefeFinalId = depto.jefe_id;
      if (!jefeFinalId) {
        const { data: jefeEncontrado } = await supabase
          .from('usuarios')
          .select('id')
          .eq('departamento_id', deptoId)
          .eq('rol', 'jefe_area')
          .limit(1)
          .maybeSingle();
        if (jefeEncontrado) jefeFinalId = jefeEncontrado.id;
      }
// ==========================================
      // MOTOR DE RUTAS INTELIGENTES ESTRICTO
      // ==========================================
      const clasificacionDepto = (depto.clasificacion || sesionActual.tipo_personal || 'produccion').toLowerCase();
      const rolGerente = clasificacionDepto.includes('admin') ? 'gerente_admin' : 'gerente_produccion';
      
      // Buscar al Gerente exacto en base a su rol
      const { data: gerenteData } = await supabase.from('usuarios').select('id').eq('rol', rolGerente).limit(1).maybeSingle();
      const gerenteFinalId = gerenteData?.id || depto.gerente_id;

      // Buscar a RH en base a su rol
      const { data: rhData } = await supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']).limit(1).maybeSingle();
      const rhFinalId = rhData?.id || depto.rh_id;

      // LÓGICA DE FIRMAS (ESTRICTAMENTE: JEFE -> GERENTE -> RH)
      let estadoFirma1 = 'pendiente';
      let notificarA = [];

      if (jefeFinalId && jefeFinalId !== userId) {
        // RUTA NORMAL: Todo pase le avisa obligatoriamente al Jefe primero
        estadoFirma1 = 'pendiente';
        notificarA = [jefeFinalId];
      } else {
        // Solo si el empleado NO tiene jefe (o él es el jefe), salta al Gerente
        estadoFirma1 = jefeFinalId === userId ? 'auto_aprobado' : 'omitido';
        if (gerenteFinalId) notificarA = [gerenteFinalId];
      }

      // 2. Consultar Sede Oficial
      let esSantaCatarina = false;
      if (sedeId) {
        const { data: sedeData } = await supabase.from('sedes').select('nombre').eq('id', sedeId).maybeSingle();
        if (sedeData && sedeData.nombre.toLowerCase().includes('catarina')) {
          esSantaCatarina = true;
        }
      }

      // Folio Automático
      let letra = 'P';
      if (clasificacionDepto.includes('admin')) letra = 'A';
      else if (clasificacionDepto.includes('obra')) letra = 'O';
      const anio = hoy.getFullYear().toString().slice(-2);
      const folioFinal = await generarFolioOficial(letra, anio);

      // Texto de Horarios
      let detalleHorarioTexto = '';
      if (tipoPermiso === 'salida') {
        detalleHorarioTexto = regresaMismoDia 
          ? `Salida: ${horaSalida} hrs | Regreso: ${horaRegreso} hrs`
          : `Salida definitiva: ${horaSalida} hrs`;
      } else if (tipoPermiso === 'retardo') {
        detalleHorarioTexto = `Llegada estimada: ${horaLlegadaRetardo} hrs`;
      } else if (tipoPermiso === 'vacaciones') {
        detalleHorarioTexto = `Vacaciones: Del ${fechaPermiso} al ${fechaFinVacaciones || fechaPermiso}`;
      } else {
        detalleHorarioTexto = `Falta programada día completo: ${fechaPermiso}`;
      }

      const requiereCasetaAuto = esSantaCatarina && (tipoPermiso === 'salida' || tipoPermiso === 'retardo');

      // 3. Guardar permiso en DB con los nuevos IDs inteligentes
      const { error: errInsert } = await supabase
        .from('permisos')
        .insert([{
          folio: folioFinal,
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
          firma_1_estado: estadoFirma1, // Puede ser 'omitido', 'pendiente' o 'auto_aprobado'
          firma_2_id: gerenteFinalId,
          firma_2_estado: 'pendiente',
          firma_3_id: rhFinalId,
          firma_3_estado: 'pendiente',
          requiere_caseta: requiereCasetaAuto,
          estado_general: 'en_firmas'
        }]);

      if (errInsert) throw errInsert;

      // 4. Notificaciones Push a la Ruta Inteligente
      if (notificarA.length > 0) {
        try {
          const fotoSolicitante = usuario?.foto_url || sesionActual?.foto_url || null;
          const nombreSolicitante = usuario?.nombre_completo || sesionActual?.nombre_completo || 'Un colaborador';

          const { data: subs } = await supabase
            .from('suscripciones_push')
            .select('subscription')
            .in('usuario_id', notificarA);

          if (subs && subs.length > 0) {
            // Formatear Título y Mensaje estilo WhatsApp
            const tipoPase = tipoPermiso.charAt(0).toUpperCase() + tipoPermiso.slice(1);
            const tituloNotif = tipoPermiso === 'vacaciones' ? 'Vacaciones' : `${tipoPase} (${naturaleza})`;
            
            let infoExtra = '';
            if (tipoPermiso === 'retardo') infoExtra = ` (Llegada aprox: ${horaLlegadaRetardo})`;
            else if (tipoPermiso === 'salida') infoExtra = ` (Aprox: ${horaSalida})`;
            else if (tipoPermiso === 'vacaciones') infoExtra = ` (Del ${fechaPermiso} al ${fechaFinVacaciones || fechaPermiso})`;

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
                  mensaje: `${nombreSolicitante}: "${motivo.trim()}"${infoExtra}`,
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

      alert(`✅ Solicitud enviada correctamente.\nFolio Oficial: ${folioFinal}`);
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
    <div className="permiso-card-box">
      
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `1px solid ${c.borderSubtle}`, paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>NUEVA SOLICITUD DE PASE</div>
          <div style={{ fontSize: '11.5px', color: c.textMuted }}>
            {sesionActual.nombre_completo || usuario?.nombre_completo}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: c.textMuted, textTransform: 'uppercase' }}>Elaboración</div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: c.text }}>{fechaHoy}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* 1. TIPO DE PERMISO */}
        <div>
          <label className="label-permiso">1. Tipo de Movimiento / Permiso</label>
          <div className="grid-tipo-pase">
            {[
              { key: 'salida', label: 'Salida Anticipada', icon: Clock },
              { key: 'retardo', label: 'Llegada Tarde', icon: AlertTriangle },
              { key: 'falta', label: 'Falta Programada', icon: Calendar },
              { key: 'vacaciones', label: 'Vacaciones', icon: Calendar }
            ].map(t => {
              const Icono = t.icon;
              const activo = tipoPermiso === t.key;
              return (
                <button
                  key={t.key} type="button"
                  onClick={() => setTipoPermiso(t.key)}
                  className={`pill-movimiento ${activo ? 'active' : ''}`}
                  style={activo && t.key === 'retardo' ? { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' } : {}}
                >
                  <Icono size={16} /> <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ALERTA DE REINCIDENCIA */}
        {alertaReincidencia && tipoPermiso === 'retardo' && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)',
            border: `1px solid #f59e0b`, fontSize: '11.5px', color: '#d97706',
            display: 'flex', alignItems: 'flex-start', gap: '10px'
          }}>
            <Info size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              <strong>Atención:</strong> El sistema detecta incidencias previas de retardo en tu historial reciente. Esta información será anexada para la evaluación de tu Jefatura y Recursos Humanos.
            </span>
          </div>
        )}

        {/* ALERTA DE URGENCIA */}
        {esRetardoUrgente && (
          <div style={{
            padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)',
            border: `1.5px solid #ef4444`, fontSize: '12px', color: '#b91c1c',
            display: 'flex', alignItems: 'flex-start', gap: '10px'
          }}>
            <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              <strong>ALERTA DE ACCESO:</strong> Estás registrando un aviso de retardo de último momento. 
              Al enviar, el Gerente recibirá una notificación urgente para dictaminar tu acceso o si debes regresar a casa.
            </span>
          </div>
        )}

        {/* 2. NATURALEZA */}
        {tipoPermiso !== 'vacaciones' && (
          <div>
            <label className="label-permiso">2. Naturaleza del Asunto</label>
            <div className="grid-naturaleza">
              {['Personal / Familiar', 'Cita Médica', 'Asunto de Trabajo'].map(nat => (
                <button
                  key={nat} type="button" onClick={() => setNaturaleza(nat)}
                  style={{
                    padding: '9px 6px', borderRadius: '6px',
                    border: `1.5px solid ${naturaleza === nat ? c.accent : c.border}`,
                    background: naturaleza === nat ? c.accentSoft : 'transparent',
                    color: naturaleza === nat ? c.accent : c.textMuted,
                    fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', textAlign: 'center'
                  }}
                >
                  {nat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. FECHAS Y HORAS */}
        <div className="grid-fechas-horas">
          <div>
            <label className="label-permiso">
              {tipoPermiso === 'vacaciones' ? 'Fecha Inicio *' : 'Fecha en que aplica el pase *'}
            </label>
            <input 
              type="date" required className="input-permiso"
              min={minDate} 
              value={fechaPermiso} onChange={e => setFechaPermiso(e.target.value)} 
            />
          </div>

          {tipoPermiso === 'vacaciones' && (
            <div>
              <label className="label-permiso">Fecha Fin *</label>
              <input 
                type="date" required className="input-permiso"
                min={fechaPermiso}
                value={fechaFinVacaciones} onChange={e => setFechaFinVacaciones(e.target.value)} 
              />
            </div>
          )}

          {tipoPermiso === 'retardo' && (
            <div>
              <label className="label-permiso">Hora Estimada de Llegada *</label>
              <input 
                type="time" required className="input-permiso"
                value={horaLlegadaRetardo} onChange={e => setHoraLlegadaRetardo(e.target.value)} 
              />
            </div>
          )}

          {tipoPermiso === 'salida' && (
            <div>
              <label className="label-permiso">Hora en que te retiras *</label>
              <input 
                type="time" required className="input-permiso"
                value={horaSalida} onChange={e => setHoraSalida(e.target.value)} 
              />
            </div>
          )}
        </div>

        {/* SALIDA: REGRESA EN EL TURNO */}
        {tipoPermiso === 'salida' && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px', background: c.surface, border: `1px solid ${c.border}`,
            display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" id="checkRegresa"
                checked={regresaMismoDia} onChange={e => setRegresaMismoDia(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: c.accent, cursor: 'pointer' }}
              />
              <label htmlFor="checkRegresa" style={{ fontSize: '12px', color: c.text, cursor: 'pointer', fontWeight: '700' }}>
                ¿Regresas a laborar en el mismo turno? (Salida y reingreso)
              </label>
            </div>

            {regresaMismoDia && (
              <div style={{ marginTop: '4px' }}>
                <label className="label-permiso">Hora estimada de retorno al puesto *</label>
                <input 
                  type="time" required className="input-permiso"
                  value={horaRegreso} onChange={e => setHoraRegreso(e.target.value)} 
                />
              </div>
            )}
          </div>
        )}

        {/* MOTIVO */}
        <div>
          <label className="label-permiso">Motivo / Justificación *</label>
          <textarea 
            required rows={3}
            placeholder={tipoPermiso === 'vacaciones' ? "Ej. Vacaciones correspondientes al periodo 2024-2025..." : "Explica la razón de tu solicitud..."}
            value={motivo} onChange={e => setMotivo(e.target.value)}
            className="input-permiso"
            style={{ height: 'auto', padding: '10px 12px', resize: 'vertical' }}
          />
        </div>

        <button 
          type="submit" disabled={guardando}
          style={{
            padding: '12px', borderRadius: '8px', border: 'none',
            backgroundColor: (esRetardoUrgente) ? '#ef4444' : c.accent, color: '#ffffff',
            fontSize: '13px', fontWeight: '800', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}
        >
          <Send size={15} /> {guardando ? 'Registrando...' : (esRetardoUrgente ? 'Enviar Aviso de Urgencia' : 'Firmar y Enviar Solicitud')}
        </button>
      </form>
    </div>
  );
}