import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  Send, Clock, Calendar, AlertTriangle, Briefcase, 
  ShieldAlert, CheckCircle2 
} from 'lucide-react';

export default function FormularioSolicitud({ usuario, onSolicitudCreada, c, modoOscuro }) {
  const sesionActual = JSON.parse(localStorage.getItem("permisos_sesion") || '{}');

  const [tipoPermiso, setTipoPermiso] = useState('salida'); // 'salida' | 'retardo' | 'falta' | 'vacaciones' | 'comision'
  const [naturaleza, setNaturaleza] = useState('Personal');
  const [fechaPermiso, setFechaPermiso] = useState(new Date().toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState('');
  const [horaInicio, setHoraInicio] = useState('07:00');
  const [horaFin, setHoraFin] = useState('08:00');
  const [motivo, setMotivo] = useState('');
  const [requiereCaseta, setRequiereCaseta] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Cálculo automático de horas
  const calcularHoras = () => {
    if (tipoPermiso === 'falta' || tipoPermiso === 'vacaciones') return 8;
    if (!horaInicio || !horaFin) return 0;
    const [h1, m1] = horaInicio.split(':');
    const [h2, m2] = horaFin.split(':');
    const d1 = new Date(2000, 0, 1, h1, m1);
    const d2 = new Date(2000, 0, 1, h2, m2);
    const diff = (d2 - d1) / 3600000;
    return diff > 0 ? parseFloat(diff.toFixed(2)) : 0;
  };

  // Generador consecutivo oficial de Folio: P-26-0001, A-26-0018, O-26-0001
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
    if (!motivo.trim()) return alert("Por favor escribe la justificación o motivo.");

    const userId = usuario?.id || sesionActual.id;
    const deptoId = usuario?.departamento_id || sesionActual.departamento_id;

    if (!userId || !deptoId) {
      return alert("Error: Sesión incompleta. Vuelve a iniciar sesión.");
    }

    setGuardando(true);
    try {
      // 1. Obtener jerarquía del departamento
      const { data: depto, error: errD } = await supabase
        .from('departamentos')
        .select('nombre, clasificacion, jefe_id, gerente_id, rh_id')
        .eq('id', deptoId)
        .single();

      if (errD) throw new Error("No se encontró el departamento del usuario.");

      // 2. Determinar serie: P (Producción), A (Administración), O (Obra)
      const clasif = (depto.clasificacion || sesionActual.tipo_personal || 'produccion').toLowerCase();
      let letra = 'P';
      if (clasif.includes('admin')) letra = 'A';
      else if (clasif.includes('obra')) letra = 'O';

      const anio = new Date().getFullYear().toString().slice(-2);
      const folioFinal = await generarFolioOficial(letra, anio);
      const totalHoras = calcularHoras();

      // 3. Guardar en Supabase usando exactamente las columnas reales de tu tabla
      const { data: nuevoPermiso, error: errInsert } = await supabase
        .from('permisos')
        .insert([{
          folio: folioFinal,
          usuario_id: userId,
          fecha_permiso: fechaPermiso,
          fecha_fin: (tipoPermiso === 'vacaciones' || tipoPermiso === 'falta') ? (fechaFin || fechaPermiso) : null,
          tipo_permiso: tipoPermiso,
          pago: 'Pendiente de dictamen', // Dictaminado posteriormente por Jefe y RH
          asunto_motivo: `[${naturaleza.toUpperCase()}] ${motivo.trim()}`,
          total_horas: totalHoras,
          observaciones: (tipoPermiso === 'falta' || tipoPermiso === 'vacaciones')
            ? `Día completo solicitado`
            : `Horario: ${horaInicio} a ${horaFin} hrs.`,
          firma_empleado: true,
          firma_1_id: depto.jefe_id,
          firma_1_estado: 'pendiente',
          firma_2_id: depto.gerente_id,
          firma_2_estado: 'pendiente',
          firma_3_id: depto.rh_id,
          firma_3_estado: 'pendiente',
          requiere_caseta: requiereCaseta,
          estado_general: 'en_firmas'
        }])
        .select()
        .single();

      if (errInsert) throw errInsert;

      // 4. Notificación push al jefe de área si tiene suscripción
      if (depto.jefe_id) {
        try {
          const { data: subs } = await supabase
            .from('suscripciones_push')
            .select('subscription')
            .eq('usuario_id', depto.jefe_id);

          if (subs && subs.length > 0) {
            subs.forEach(async (item) => {
              try {
                await fetch('/api/notificar', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    subscription: item.subscription,
                    titulo: '⚠️ NUEVO PASE POR AUTORIZAR',
                    mensaje: `${sesionActual.nombre_completo || 'Un colaborador'} solicitó permiso (Folio: ${folioFinal}).`
                  })
                });
              } catch (_) {}
            });
          }
        } catch (_) {}
      }

      alert(`✅ Solicitud registrada con éxito.\nFolio Oficial: ${folioFinal}`);
      setMotivo('');
      if (onSolicitudCreada) onSolicitudCreada();
    } catch (err) {
      alert("Error al enviar solicitud: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="permiso-card-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: c.text }}>SOLICITUD DE PASE O PERMISO</div>
          <div style={{ fontSize: '11px', color: c.textMuted }}>
            {sesionActual.nombre_completo || usuario?.nombre_completo} (#{sesionActual.numero_empleado || usuario?.numero_empleado})
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* 1. SELECCIÓN DEL TIPO DE PERMISO */}
        <div>
          <label className="clean-label-permiso">1. Tipo de Incidencia / Movimiento</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { key: 'salida', label: 'Salida Anticipada', icon: Clock },
              { key: 'retardo', label: 'Llegada Tarde (Retardo)', icon: AlertTriangle },
              { key: 'falta', label: 'Falta Programada', icon: Calendar },
              { key: 'vacaciones', label: 'Vacaciones', icon: Calendar },
              { key: 'comision', label: 'Comisión / Trabajo', icon: Briefcase }
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
                  <Icono size={13} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ALERTA DE TOLERANCIA SI ES RETARDO */}
        {tipoPermiso === 'retardo' && (
          <div style={{
            padding: '10px 12px', borderRadius: '8px', background: c.warningSoft,
            border: `1px solid ${c.warning}`, fontSize: '11.5px', color: c.warning,
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>
              <strong>Límite de entrada: 07:10 AM.</strong> Después de esa hora, tu Jefe de Área determinará el acceso operativo en planta y Recursos Humanos dictaminará la deducción o reposición de tiempo correspondiente.
            </span>
          </div>
        )}

        {/* 2. NATURALEZA DEL ASUNTO */}
        <div>
          <label className="clean-label-permiso">2. Naturaleza del Asunto</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Personal / Familiar', 'Cita Médica', 'Asunto de Trabajo / Obra'].map(nat => (
              <button
                key={nat}
                type="button"
                onClick={() => setNaturaleza(nat)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px',
                  border: `1px solid ${naturaleza === nat ? c.accent : c.border}`,
                  background: naturaleza === nat ? c.accentSoft : 'transparent',
                  color: naturaleza === nat ? c.accent : c.textMuted,
                  fontSize: '11.5px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                {nat}
              </button>
            ))}
          </div>
        </div>

        {/* 3. FECHAS Y HORARIOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
          <div>
            <label className="clean-label-permiso">
              {tipoPermiso === 'vacaciones' ? 'Fecha Inicio' : 'Fecha del Permiso'}
            </label>
            <input 
              type="date" required className="input-permiso"
              value={fechaPermiso} onChange={e => setFechaPermiso(e.target.value)} 
            />
          </div>

          {(tipoPermiso === 'vacaciones' || tipoPermiso === 'falta') && (
            <div>
              <label className="clean-label-permiso">Fecha Fin</label>
              <input 
                type="date" className="input-permiso"
                value={fechaFin} onChange={e => setFechaFin(e.target.value)} 
              />
            </div>
          )}

          {tipoPermiso !== 'falta' && tipoPermiso !== 'vacaciones' && (
            <>
              <div>
                <label className="clean-label-permiso">Hora Inicio</label>
                <input 
                  type="time" required className="input-permiso"
                  value={horaInicio} onChange={e => setHoraInicio(e.target.value)} 
                />
              </div>
              <div>
                <label className="clean-label-permiso">Hora Fin</label>
                <input 
                  type="time" required className="input-permiso"
                  value={horaFin} onChange={e => setHoraFin(e.target.value)} 
                />
              </div>
            </>
          )}
        </div>

        {/* PREGUNTA PARA VIGILANCIA EN SANTA CATARINA */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px', borderRadius: '8px',
          background: c.surface, border: `1px solid ${c.border}`
        }}>
          <input 
            type="checkbox" id="checkCaseta"
            checked={requiereCaseta} onChange={e => setRequiereCaseta(e.target.checked)}
            style={{ width: '15px', height: '15px', accentColor: c.accent, cursor: 'pointer' }}
          />
          <label htmlFor="checkCaseta" style={{ fontSize: '11.5px', color: c.text, cursor: 'pointer', fontWeight: '500' }}>
            ¿Requiere chequeo de entrada o salida física en la <strong>Caseta de Vigilancia de Santa Catarina</strong>?
          </label>
        </div>

        {/* MOTIVO */}
        <div>
          <label className="clean-label-permiso">Motivo o Justificación Detallada *</label>
          <textarea 
            required rows={3}
            placeholder="Explica detalladamente la situación que origina este pase..."
            value={motivo} onChange={e => setMotivo(e.target.value)}
            className="input-permiso"
            style={{ height: 'auto', padding: '10px', resize: 'vertical' }}
          />
        </div>

        {/* NOTA INSTITUCIONAL */}
        <div style={{ fontSize: '11px', color: c.textMuted, fontStyle: 'italic' }}>
          * Nota: El dictamen final de goce de sueldo, descuento por hora o reposición de tiempo será determinado por tu Jefatura de Área y formalizado por Recursos Humanos.
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
          <Send size={14} /> {guardando ? 'Registrando solicitud...' : 'Enviar Solicitud con Firma Digital'}
        </button>
      </form>
    </div>
  );
}