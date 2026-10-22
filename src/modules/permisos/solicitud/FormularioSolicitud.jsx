import React, { useState, useEffect } from 'react';
import { Send, Clock, Calendar, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { contarReincidenciasRetardo, crearNuevaSolicitudPermiso } from '../services/permisosService';
import { obtenerTemaGlobal } from '../../../core/theme/temaGlobal';

export default function FormularioSolicitud({ usuario, onSolicitudCreada, modoOscuro }) {
  const sesionActual = JSON.parse(localStorage.getItem("permisos_sesion") || '{}');
  const userId = usuario?.id || sesionActual?.id;
  const rolUsuario = usuario?.rol || sesionActual?.rol || 'empleado';
  const deptoId = usuario?.departamento_id || sesionActual?.departamento_id;
  const sedeId = usuario?.sede_id || sesionActual?.sede_id;

  const hoy = new Date();
  const fechaHoy = hoy.toISOString().split('T')[0];
  
  const hace7Dias = new Date(hoy);
  hace7Dias.setDate(hoy.getDate() - 7);
  const minDate = hace7Dias.toISOString().split('T')[0];

  const [tipoPermiso, setTipoPermiso] = useState('');
  const [naturaleza, setNaturaleza] = useState('');
  const [fechaPermiso, setFechaPermiso] = useState(fechaHoy);
  const [fechaFinVacaciones, setFechaFinVacaciones] = useState('');

  const [horaSalida, setHoraSalida] = useState('14:00');
  const [regresaMismoDia, setRegresaMismoDia] = useState(false);
  const [horaRegreso, setHoraRegreso] = useState('16:00');
  const [horaLlegadaRetardo, setHoraLlegadaRetardo] = useState('07:30');

  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [alertaReincidencia, setAlertaReincidencia] = useState(false);

  const tema = obtenerTemaGlobal(modoOscuro);
  const t = {
    ...tema,
    bg: tema.surfaceCard,
  };

  useEffect(() => {
    if (tipoPermiso === 'vacaciones') {
      setNaturaleza('Vacaciones');
    } else if (naturaleza === 'Vacaciones' && tipoPermiso !== 'vacaciones') {
      setNaturaleza('');
    }

    if (tipoPermiso === 'retardo' && userId) {
      contarReincidenciasRetardo(userId).then(count => setAlertaReincidencia(count > 0)).catch(() => {});
    } else {
      setAlertaReincidencia(false);
    }
  }, [tipoPermiso, userId, naturaleza]);

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
    if (!e.target.reportValidity()) return;

    if (!tipoPermiso) return alert("Por favor, selecciona el Tipo de Movimiento / Permiso.");
    if (tipoPermiso !== 'vacaciones' && !naturaleza) return alert("Por favor, selecciona la Naturaleza del Asunto.");
    if (!motivo.trim()) return alert("Por favor escribe la justificación del pase.");
    if (!userId || !deptoId) return alert("Error: Sesión incompleta. Vuelve a iniciar sesión.");

    if (tipoPermiso === 'vacaciones') {
      if (new Date(fechaFinVacaciones) < new Date(fechaPermiso)) {
        return alert("Incongruencia detectada: La Fecha de Fin no puede ser anterior a la Fecha de Inicio de las vacaciones.");
      }
    }

    if (tipoPermiso === 'salida' && regresaMismoDia) {
      const [hSalida, mSalida] = horaSalida.split(':').map(Number);
      const [hRegreso, mRegreso] = horaRegreso.split(':').map(Number);
      if ((hRegreso * 60 + mRegreso) <= (hSalida * 60 + mSalida)) {
        return alert("Incongruencia detectada: La hora de regreso debe ser posterior a tu hora de salida.");
      }
    }

    if (tipoPermiso === 'retardo') {
      const [hLlegada, mLlegada] = horaLlegadaRetardo.split(':').map(Number);
      if (hLlegada < 7 || (hLlegada === 7 && mLlegada === 0)) {
        return alert("Incongruencia detectada: Un retardo implica llegar después de tu hora oficial de entrada (07:00 hrs).");
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

  return (
    <>
      <style>{`
        .form-card-container {
          width: 100%;
          max-width: 760px;
          margin: 12px auto;
          background: ${t.bg};
          border: 1px solid ${t.border};
          border-radius: 18px;
          padding: 30px 34px;
          box-shadow: ${modoOscuro ? '0 8px 30px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.04)'};
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
          box-sizing: border-box;
        }
        .zinc-label {
          display: block;
          font-size: 12.5px;
          font-weight: 800;
          color: ${t.textMuted};
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
        }
        .zinc-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 10px;
          border: 1px solid ${t.inputBorder};
          background: ${t.inputBg};
          color: ${t.text};
          font-size: 15px;
          font-weight: 600;
          outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
          font-family: inherit;
        }
        .zinc-input:focus {
          border-color: ${t.accent};
          box-shadow: 0 0 0 3px ${t.accentSoft};
        }
        .grid-responsivo-tipos {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .grid-responsivo-fechas {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }
        .pill-movimiento {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 20px 10px;
          border-radius: 13px;
          border: 1.5px solid ${t.border};
          background: ${t.surface};
          color: ${t.textMuted};
          font-size: 13.5px;
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
        @media (max-width: 760px) {
          .form-card-container { padding: 18px; }
          .grid-responsivo-tipos { grid-template-columns: repeat(2, 1fr); }
          .grid-responsivo-fechas { grid-template-columns: 1fr; gap: 12px; }
          .pill-movimiento { padding: 14px 8px; font-size: 12.5px; }
        }
      `}</style>

      <div className="form-card-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: `1px solid ${t.border}`, paddingBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '19px', fontWeight: '800', color: t.text, letterSpacing: '-0.01em' }}>NUEVA SOLICITUD DE PASE</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: t.textMuted, marginTop: '3px' }}>{sesionActual.nombre_completo || usuario?.nombre_completo}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elaboración</div>
            <div style={{ fontSize: '17px', fontWeight: '800', color: t.text, marginTop: '2px' }}>{fechaHoy}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
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
                    <Icono size={23} /> <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {alertaReincidencia && tipoPermiso === 'retardo' && (
            <div style={{ padding: '13px 16px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: `1px solid #f59e0b`, fontSize: '14px', color: '#d97706', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.45' }}>
              <Info size={19} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span><strong>Atención:</strong> El sistema detecta incidencias previas de retardo en tu historial reciente. Esta información será anexada para la evaluación de tu Jefatura y Recursos Humanos.</span>
            </div>
          )}

          {esRetardoUrgente && (
            <div style={{ padding: '13px 16px', borderRadius: '10px', background: t.dangerSoft, border: `1px solid ${t.danger}`, fontSize: '14px', color: t.danger, display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.45' }}>
              <ShieldAlert size={20} color={t.danger} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span><strong>ALERTA DE ACCESO:</strong> Estás registrando un aviso de retardo de último momento. Al enviar, el Gerente recibirá una notificación urgente para dictaminar tu acceso o si debes regresar a casa.</span>
            </div>
          )}

          {tipoPermiso && tipoPermiso !== 'vacaciones' && (
            <div>
              <label className="zinc-label">2. Naturaleza del Asunto</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                {['Personal / Familiar', 'Cita Médica', 'Asunto de Trabajo'].map(nat => (
                  <button
                    key={nat} type="button" onClick={() => setNaturaleza(nat)}
                    style={{
                      padding: '12px 14px', borderRadius: '10px',
                      border: `1.5px solid ${naturaleza === nat ? t.accent : t.border}`,
                      background: naturaleza === nat ? t.accentSoft : t.surface,
                      color: naturaleza === nat ? t.accent : t.textMuted,
                      fontSize: '14px', fontWeight: '700', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                    }}
                  >
                    {nat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid-responsivo-fechas">
            <div>
              <label className="zinc-label">{tipoPermiso === 'vacaciones' ? 'Fecha Inicio *' : 'Fecha en que aplica el pase *'}</label>
              <input type="date" required className="zinc-input" min={minDate} value={fechaPermiso} onChange={e => setFechaPermiso(e.target.value)} />
            </div>

            {tipoPermiso === 'vacaciones' && (
              <div>
                <label className="zinc-label">Fecha Fin *</label>
                <input type="date" required className="zinc-input" min={fechaPermiso} value={fechaFinVacaciones} onChange={e => setFechaFinVacaciones(e.target.value)} />
              </div>
            )}

            {tipoPermiso === 'retardo' && (
              <div>
                <label className="zinc-label">Hora Estimada de Llegada *</label>
                <input type="time" required className="zinc-input" value={horaLlegadaRetardo} onChange={e => setHoraLlegadaRetardo(e.target.value)} />
              </div>
            )}

            {tipoPermiso === 'salida' && (
              <div>
                <label className="zinc-label">Hora en que te retiras *</label>
                <input type="time" required className="zinc-input" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} />
              </div>
            )}
          </div>

          {tipoPermiso === 'salida' && (
            <div style={{ padding: '16px', borderRadius: '11px', background: t.surface, border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="checkRegresa" checked={regresaMismoDia} onChange={e => setRegresaMismoDia(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: t.accent, cursor: 'pointer' }} />
                <label htmlFor="checkRegresa" style={{ fontSize: '14.5px', color: t.text, cursor: 'pointer', fontWeight: '700' }}>
                  ¿Regresas a laborar en el mismo turno? (Salida y reingreso)
                </label>
              </div>

              {regresaMismoDia && (
                <div style={{ marginTop: '4px' }}>
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
            type="submit" disabled={guardando || !tipoPermiso}
            style={{
              padding: '15px', borderRadius: '11px', border: 'none',
              backgroundColor: !tipoPermiso ? t.surface : (esRetardoUrgente ? t.danger : t.accent), 
              color: !tipoPermiso ? t.textMuted : '#ffffff',
              fontSize: '14.5px', fontWeight: '800', cursor: !tipoPermiso ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s', 
              boxShadow: !tipoPermiso ? 'none' : (esRetardoUrgente ? '0 4px 14px rgba(239, 68, 68, 0.3)' : `0 4px 14px ${t.accentSoft}`)
            }}
          >
            <Send size={18} /> {guardando ? 'Registrando en sistema...' : (esRetardoUrgente ? 'ENVIAR AVISO DE URGENCIA' : 'FIRMAR Y ENVIAR SOLICITUD')}
          </button>
        </form>
      </div>
    </>
  );
}
