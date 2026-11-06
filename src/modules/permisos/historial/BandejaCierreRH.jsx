import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { obtenerBandejaCierreRH, aplicarAccionCierreRH } from '../services/permisosService';
import { formatearApellidosNombre } from '../../../core/utils/ordenNombre';

const ETIQUETAS_ACCION = {
  convertir_falta: 'Marcar falta',
  salida_definitiva: 'Tomar como salida definitiva',
  cancelar_pase: 'Cancelar pase',
  ir_aprobaciones: 'Ir a Aprobaciones',
  marcar_revisado: 'Dejar sin cambios'
};

const CONFIRMACIONES_ACCION = {
  convertir_falta: '¿Convertir este retardo en FALTA sin goce (8 h)?',
  salida_definitiva: '¿Registrar este pase como salida definitiva a la hora real en que salió?',
  cancelar_pase: '¿Cancelar este pase de salida que no se utilizó?'
};

const COLORES_CATEGORIA = {
  retardo_sin_llegada: '#dc2626',
  detenido_sin_resolver: '#d97706',
  salida_sin_regreso: '#0284c7',
  salida_no_usada: '#64748b',
  pendiente_firma: '#8b5cf6'
};

export default function BandejaCierreRH({ usuario, c, selectorModo = null, onCambio = null }) {
  const navigate = useNavigate();
  const [pendientes, setPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setPendientes(await obtenerBandejaCierreRH());
    } catch (err) {
      console.error('Error cargando bandeja de cierre:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const ejecutar = async (item, accion) => {
    if (accion === 'ir_aprobaciones') {
      navigate('/aprobaciones');
      return;
    }
    let nota = '';
    if (accion === 'marcar_revisado') {
      const resp = window.prompt('Motivo para dejarlo sin cambios (queda en la bitácora del pase):');
      if (resp === null) return;
      if (!resp.trim()) return alert('Escribe un motivo para dejar constancia.');
      nota = resp;
    } else if (!window.confirm(CONFIRMACIONES_ACCION[accion] || '¿Aplicar esta acción?')) {
      return;
    }

    setProcesandoId(item.permiso.id);
    try {
      await aplicarAccionCierreRH({ permisoId: item.permiso.id, accion, usuario, nota });
      await cargar();
      if (onCambio) onCambio();
    } catch (err) {
      alert(err.message);
      await cargar();
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap',
        background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '8px 12px'
      }}>
        {selectorModo}
        <div style={{ fontSize: '13px', fontWeight: '700', color: c.textMuted, flex: 1, minWidth: '200px' }}>
          Lo que quedó abierto en días ya cerrados. Nada cambia hasta que RH decide.
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          style={{
            height: '34px', padding: '0 12px', borderRadius: '8px', border: `1px solid ${c.border}`,
            background: c.bg, color: c.text, fontSize: '12.5px', fontWeight: '700', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '44px', color: c.textMuted, fontSize: '14px', fontWeight: '600' }}>
          Revisando días cerrados...
        </div>
      ) : pendientes.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '44px 20px', background: c.surfaceCard,
          border: `1.5px dashed ${c.border}`, borderRadius: '14px', color: c.textMuted
        }}>
          <CheckCircle2 size={34} color={c.accent} style={{ marginBottom: '8px' }} />
          <div style={{ fontSize: '15px', fontWeight: '800', color: c.text }}>Sin pendientes de cierre</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>Todos los pases de días cerrados están resueltos.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pendientes.map((item) => {
            const p = item.permiso;
            const colorCat = COLORES_CATEGORIA[item.categoria] || c.textMuted;
            const ocupado = procesandoId === p.id;
            const horario = String(p.observaciones || '').split(' | ')[0].replace(/🕒|📅/g, '').trim();
            return (
              <div
                key={p.id}
                style={{
                  background: c.surfaceCard, border: `1px solid ${c.border}`, borderLeft: `5px solid ${colorCat}`,
                  borderRadius: '12px', padding: '12px 14px', display: 'flex', gap: '12px',
                  alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap'
                }}
              >
                <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '900', color: colorCat, textTransform: 'uppercase' }}>
                    {item.titulo}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: c.text, marginTop: '3px' }}>
                    {formatearApellidosNombre(p.usuarios?.nombre_completo || 'Colaborador', p.usuarios)}
                    <span style={{ color: c.textMuted, fontWeight: '600', fontSize: '13px' }}>
                      {' '}· #{p.usuarios?.numero_empleado || 'S/N'} · {p.usuarios?.departamentos?.nombre || 'General'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: c.textMuted, fontWeight: '600', marginTop: '3px' }}>
                    {p.fecha_permiso} · {String(p.tipo_permiso || '').toUpperCase()} · {p.folio} · {horario}
                  </div>
                  <div style={{ fontSize: '12.5px', color: c.text, fontWeight: '700', marginTop: '4px' }}>
                    Sugerencia: {item.sugerencia}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {item.acciones.map((acc, idx) => (
                    <button
                      key={acc}
                      type="button"
                      disabled={ocupado}
                      onClick={() => ejecutar(item, acc)}
                      style={{
                        height: '34px', padding: '0 12px', borderRadius: '8px',
                        border: idx === 0 ? 'none' : `1px solid ${c.border}`,
                        background: idx === 0 ? colorCat : c.bg,
                        color: idx === 0 ? '#ffffff' : c.text,
                        fontSize: '12.5px', fontWeight: '800', cursor: ocupado ? 'default' : 'pointer',
                        opacity: ocupado ? 0.6 : 1
                      }}
                    >
                      {ocupado ? '...' : ETIQUETAS_ACCION[acc]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
