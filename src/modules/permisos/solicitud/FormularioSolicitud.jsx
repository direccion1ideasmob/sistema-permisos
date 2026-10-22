import React, { useState, useEffect } from 'react';
import { Send, Clock, Calendar, AlertTriangle, ShieldAlert, Info, User, Stethoscope, Briefcase } from 'lucide-react';
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
  const tieneSegundoCampoHorario = ['vacaciones', 'retardo', 'salida'].includes(tipoPermiso);

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
        };
          background: ${t.inputBg};
          color: ${t.text};
          font-size: 15px;
          font-weight: 600;
          outline: none;
          transition: all 0.2s;
          box-sizing: border-box;
          font-family: inherit;
          -webkit-appearance: none;
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
          gap: 9px;
          padding: 16px 10px;
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
        };
          background: ${t.surface};
          color: ${t.textMuted};
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
          min-width: 0;
        }
        .pill-movimiento:active {
          transform: scale(0.98);
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
            padding: 14px 8px;
            font-size: 13px;
            gap: 7px;
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
            <div className="form-subtitle-user">{sesionActual.nombre_completo || usuario?.nombre_completo}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '800', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Elaboración</div>
            <div style={{ fontSize: '16.5px', fontWeight: '800', color: t.text, marginTop: '2px' }}>{fechaHoy}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label className="zinc-label">1. Tipo de Movimiento / Permiso</label>
            <div className="grid-responsivo-tipos">
              {catalogoTipos.map(item => {
                const Icono = item.icon;
                const activo = tipoPermiso === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTipoPermiso(item.key)}
                    className="pill-movimiento"
                    style={activo ? {
                      borderColor: item.color,
                      backgroundColor: item.bg,
                      color: item.color
                    } : {}}
                  >
                    <Icono size={23} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {alertaReincidencia && tipoPermiso === 'retardo' && (
            <div style={{ padding: '13px 15px', borderRadius: '11px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', fontSize: '13.5px', color: '#d97706', display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.45' }}>
              <Info size={19} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span><strong>Atención:</strong> El sistema detecta incidencias previas de retardo en tu historial reciente. Esta información será anexada para la evaluación de tu Jefatura y Recursos Humanos.</span>
            </div>
          )}

          {esRetardoUrgente && (
            <div style={{ padding: '13px 15px', borderRadius: '11px', background: t.dangerSoft, border: `1px solid ${t.danger}`, fontSize: '13.5px', color: t.danger, display: 'flex', alignItems: 'flex-start', gap: '10px', lineHeight: '1.45' }}>
              <ShieldAlert size={19} color={t.danger} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span><strong>ALERTA DE ACCESO:</strong> Estás registrando un aviso de retardo de último momento. Al enviar, el Gerente recibirá una notificación urgente para dictaminar tu acceso o si debes regresar a casa.</span>
            </div>
          )}

          {tipoPermiso && tipoPermiso !== 'vacaciones' && (
            <div>
              <label className="zinc-label">2. Naturaleza del Asunto</label>
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

          <div className="grid-responsivo-fechas">
            <div style={{ minWidth: 0 }}>
              <label className="zinc-label">{tipoPermiso === 'vacaciones' ? 'Fecha Inicio *' : 'Fecha en que aplica el pase *'}</label>
              <input type="date" required className="zinc-input" min={minDate} value={fechaPermiso} onChange={e => setFechaPermiso(e.target.value)} />
            </div>

            {tipoPermiso === 'vacaciones' && (
              <div style={{ minWidth: 0 }}>
                <label className="zinc-label">Fecha Fin *</label>
                <input type="date" required className="zinc-input" min={fechaPermiso} value={fechaFinVacaciones} onChange={e => setFechaFinVacaciones(e.target.value)} />
              </div>
            )}

            {tipoPermiso === 'retardo' && (
              <div style={{ minWidth: 0 }}>
                <label className="zinc-label">Hora Estimada de Llegada *</label>
                <input type="time" required className="zinc-input" value={horaLlegadaRetardo} onChange={e => setHoraLlegadaRetardo(e.target.value)} />
              </div>
            )}

            {tipoPermiso === 'salida' && (
              <div style={{ minWidth: 0 }}>
                <label className="zinc-label">Hora en que te retiras *</label>
                <input type="time" required className="zinc-input" value={horaSalida} onChange={e => setHoraSalida(e.target.value)} />
              </div>
            )}
          </div>

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
            type="submit" disabled={guardando || !tipoPermiso}
            style={{
              padding: '15px', borderRadius: '12px', border: 'none',
              backgroundColor: !tipoPermiso ? t.surface : (esRetardoUrgente ? t.danger : t.accent), 
              color: !tipoPermiso ? t.textMuted : '#ffffff',
              fontSize: '15px', fontWeight: '800', cursor: !tipoPermiso ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s', 
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
