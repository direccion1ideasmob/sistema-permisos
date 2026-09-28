import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  Send, Clock, Calendar, AlertTriangle, Briefcase, 
  ShieldAlert
} from 'lucide-react';

export default function FormularioSolicitud({ usuario, onSolicitudCreada, c, modoOscuro }) {
  const sesionActual = JSON.parse(localStorage.getItem("permisos_sesion") || '{}');

  const [tipoPermiso, setTipoPermiso] = useState('salida');
  const [naturaleza, setNaturaleza] = useState('Personal');

  const fechaHoy = new Date().toISOString().split('T')[0];
  const [fechaPermiso, setFechaPermiso] = useState(fechaHoy);
  const [fechaFinVacaciones, setFechaFinVacaciones] = useState('');

  // Horarios
  const [horaSalida, setHoraSalida] = useState('14:00');
  const [regresaMismoDia, setRegresaMismoDia] = useState(false);
  const [horaRegreso, setHoraRegreso] = useState('16:00');
  const [horaLlegadaRetardo, setHoraLlegadaRetardo] = useState('07:30');

  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cálculo de horas
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
      if (regresaMismoDia) {
        const [h1, m1] = (horaSalida || '14:00').split(':');
        const [h2, m2] = (horaRegreso || '16:00').split(':');
        const d1 = new Date(2000, 0, 1, parseInt(h1, 10), parseInt(m1, 10));
        const d2 = new Date(2000, 0, 1, parseInt(h2, 10), parseInt(m2, 10));
        const diff = (d2 - d1) / 3600000;
        return diff > 0 ? parseFloat(diff.toFixed(2)) : 0;
      } else {
        const [h1, m1] = (horaSalida || '14:00').split(':');
        const d1 = new Date(2000, 0, 1, parseInt(h1, 10), parseInt(m1, 10));
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

 // =========================================================================
      // ENVÍO DE NOTIFICACIONES RESTAURADO CON Promise.allSettled (TU CÓDIGO ORIGINAL)
      // Espera a que la conexión con Vercel termine antes de lanzar el alert
      // =========================================================================
      if (jefeFinalId) {
        try {
          const { data: suscripcionesJefe, error: errSub } = await supabase
            .from('suscripciones_push')
            .select('subscription')
            .eq('usuario_id', jefeFinalId);

          if (errSub) {
            console.error("❌ Error al consultar suscripción del jefe:", errSub);
          }

          if (suscripcionesJefe && suscripcionesJefe.length > 0) {
            const envios = suscripcionesJefe.map(async (item) => {
              try {
                const res = await fetch('/api/notificar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    subscription: item.subscription,
                    titulo: '⚠️ NUEVO PASE POR FIRMAR',
                    mensaje: `${sesionActual.nombre_completo || 'Un colaborador'} ha solicitado un permiso (Folio: ${folioFinal}).`
                  })
                });
                const resJson = await res.json();
                console.log("📡 Respuesta notificación:", resJson);
              } catch (errFetch) {
                console.error("❌ Error en el fetch Push:", errFetch);
              }
            });

            // ESPERA OBLIGATORIA: no avanza hasta que Vercel y Google confirmen
            await Promise.allSettled(envios);
          } else {
            console.warn("⚠️ No se encontraron suscripciones activas para el jefe:", jefeFinalId);
          }
        } catch (errNotif) {
          console.error("❌ Error en el proceso de notificación:", errNotif);
        }
      }

      // Solo después de que se enviaron las alertas por red, sale el alert
      alert(`✅ Solicitud enviada con éxito.\nFolio Oficial: ${folioFinal}`);
      setMotivo('');
      setRegresaMismoDia(false);
      if (onSolicitudCreada) onSolicitudCreada();
      
  return (
    <div className="permiso-card-box">
      
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: `1px solid ${c.borderSubtle}`, paddingBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: c.text }}>NUEVA SOLICITUD DE PASE</div>
          <div style={{ fontSize: '11.5px', color: c.textMuted }}>
            {sesionActual.nombre_completo || usuario?.nombre_completo} (#{sesionActual.numero_empleado || usuario?.numero_empleado})
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
              { key: 'vacaciones', label: 'Vacaciones', icon: Calendar },
              { key: 'comision', label: 'Comisión Trabajo', icon: Briefcase }
            ].map(t => {
              const Icono = t.icon;
              const activo = tipoPermiso === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipoPermiso(t.key)}
                  className={`pill-movimiento ${activo ? 'active' : ''}`}
                >
                  <Icono size={16} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ALERTA DE TOLERANCIA */}
        {tipoPermiso === 'retardo' && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px', background: c.warningSoft,
            border: `1.5px solid ${c.warning}`, fontSize: '11.5px', color: c.text,
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <ShieldAlert size={18} color={c.warning} style={{ flexShrink: 0 }} />
            <span>
              <strong>Entrada oficial: 07:00 AM (Límite 07:10 AM).</strong> Se registrará tu hora estimada para autorización de tu Jefe y dictamen de Recursos Humanos.
            </span>
          </div>
        )}

        {/* 2. NATURALEZA */}
        <div>
          <label className="label-permiso">2. Naturaleza del Asunto</label>
          <div className="grid-naturaleza">
            {['Personal / Familiar', 'Cita Médica', 'Asunto de Trabajo'].map(nat => (
              <button
                key={nat}
                type="button"
                onClick={() => setNaturaleza(nat)}
                style={{
                  padding: '9px 6px', borderRadius: '6px',
                  border: `1.5px solid ${naturaleza === nat ? c.accent : c.border}`,
                  background: naturaleza === nat ? c.accentSoft : 'transparent',
                  color: naturaleza === nat ? c.accent : c.textMuted,
                  fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {nat}
              </button>
            ))}
          </div>
        </div>

        {/* 3. FECHAS Y HORAS RESPONSIVAS */}
        <div className="grid-fechas-horas">
          <div>
            <label className="label-permiso">
              {tipoPermiso === 'vacaciones' ? 'Fecha Inicio' : 'Fecha en que aplica el pase *'}
            </label>
            <input 
              type="date" required className="input-permiso"
              value={fechaPermiso} onChange={e => setFechaPermiso(e.target.value)} 
            />
          </div>

          {tipoPermiso === 'vacaciones' && (
            <div>
              <label className="label-permiso">Fecha Fin *</label>
              <input 
                type="date" required className="input-permiso"
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

        {/* SALIDA: PREGUNTA SI REGRESA EN EL TURNO */}
        {tipoPermiso === 'salida' && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px',
            background: c.surface, border: `1px solid ${c.border}`,
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
            placeholder="Explica la razón de tu solicitud..."
            value={motivo} onChange={e => setMotivo(e.target.value)}
            className="input-permiso"
            style={{ height: 'auto', padding: '10px 12px', resize: 'vertical' }}
          />
        </div>

        <div style={{ fontSize: '10.5px', color: c.textMuted, fontStyle: 'italic' }}>
          * El goce de sueldo, descuento o reposición de tiempo será dictaminado por Jefatura y formalizado por Recursos Humanos.
        </div>

        <button 
          type="submit" disabled={guardando}
          style={{
            padding: '12px', borderRadius: '8px', border: 'none',
            backgroundColor: c.accent, color: '#ffffff',
            fontSize: '13px', fontWeight: '800', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
          }}
        >
          <Send size={15} /> {guardando ? 'Registrando...' : 'Firmar y Enviar Solicitud'}
        </button>
      </form>
    </div>
  );
}