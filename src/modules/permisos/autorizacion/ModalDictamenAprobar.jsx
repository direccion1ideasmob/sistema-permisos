import React, { useState, useEffect } from 'react';
import { X, Check, Banknote, Receipt, Clock, UserCog, MessageSquare, ShieldCheck, CornerUpLeft } from 'lucide-react';
import { parsearDatosObservaciones } from '../historial/TablaHistorial';

export default function ModalDictamenAprobar({
  solicitud, usuarioFirmante, onClose, onConfirmarAprobacion, procesando, c
}) {
  const [dictamenPago, setDictamenPago] = useState('Pendiente');
  const [comentarios, setComentarios] = useState('');

  const esRH = usuarioFirmante?.rol === 'rh_nominas' || usuarioFirmante?.rol === 'gerente_rh';
  const tipo = solicitud?.tipo_permiso?.toLowerCase() || '';
  const esVacaciones = tipo === 'vacaciones';
  const esRetardo = tipo === 'retardo';

  useEffect(() => {
    setComentarios('');

    if (esVacaciones) {
      setDictamenPago('Con goce');
    } else if (solicitud?.pago && !solicitud.pago.toLowerCase().includes('pendiente')) {
      setDictamenPago(solicitud.pago);
    } else {
      setDictamenPago(esRH ? 'Con goce' : 'Pendiente');
    }
  }, [solicitud, esVacaciones, esRH]);

  if (!solicitud) return null;

  const { notasFlujo } = parsearDatosObservaciones(solicitud.observaciones);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (procesando) return;
    onConfirmarAprobacion(solicitud, dictamenPago, comentarios);
  };

  const opciones = [
    { key: 'Con goce', label: 'Con Goce', icon: Banknote },
    { key: 'Sin goce', label: 'Sin Goce', icon: Receipt },
    { key: 'Con tiempo', label: 'Repone Tiempo', icon: Clock },
    ...(esRetardo ? [{ key: 'Se regresa', label: 'Regresar a Casa', icon: CornerUpLeft, esRegreso: true }] : []),
    ...(esRH ? [] : [{ key: 'Pendiente', label: 'Delegar a RH', icon: UserCog }])
  ];

  const esSeleccionRegreso = dictamenPago === 'Se regresa';

  return (
    <>
      <style>{`
        .modal-container {
          background-color: ${c.surfaceCard}; border: 1px solid ${c.border};
          border-radius: 20px; width: 100%; max-width: 420px;
          padding: 24px; box-sizing: border-box;
          display: flex; flex-direction: column; gap: 18px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          font-family: "Inter", system-ui, -apple-system, sans-serif;
        }
        .grid-opciones { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .botones-accion { display: flex; gap: 10px; margin-top: 4px; }

        @media (max-width: 480px) {
          .modal-container { padding: 20px !important; border-radius: 16px !important; }
          .grid-opciones { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .botones-accion { flex-direction: column !important; }
          .botones-accion button { width: 100% !important; padding: 14px 10px !important; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 6000, padding: '20px'
      }}>
        <div className="modal-container">

          {/* CABECERA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: '900', color: c.text, letterSpacing: '-0.02em' }}>
                Resolución de Pase
              </div>
              <div style={{ fontSize: '13px', color: c.textMuted, marginTop: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Evaluando a <strong style={{ color: c.text }}>{solicitud.usuarios?.nombre_completo?.split(' ')[0]}</strong>
                <span style={{ background: c.accentSoft, color: c.accent, padding: '2px 6px', borderRadius: '6px', fontWeight: '800', fontSize: '10.5px', letterSpacing: '0.02em' }}>
                  {solicitud.tipo_permiso?.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.textMuted, cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* NOTAS DE NIVELES ANTERIORES (SI EXISTEN) */}
          {notasFlujo && notasFlujo.length > 0 && (
            <div style={{
              background: c.surface, border: `1px solid ${c.border}`, borderRadius: '10px',
              padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: '4px'
            }}>
              <span style={{ fontSize: '10px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase' }}>
                Comentarios previos en el flujo:
              </span>
              {notasFlujo.map((n, idx) => (
                <div key={idx} style={{ fontSize: '12px', color: c.text, lineHeight: 1.35 }}>
                  <strong style={{ color: c.accent }}>{n.autor}:</strong> {n.texto}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* GRID DE OPCIONES */}
            <div className="grid-opciones">
              {opciones.map(op => {
                const seleccionada = dictamenPago === op.key;
                const Icono = op.icon;
                const colorActivo = op.esRegreso ? '#d97706' : c.accent;
                const bgActivo = op.esRegreso ? 'rgba(245, 158, 11, 0.12)' : c.accentSoft;

                return (
                  <div
                    key={op.key}
                    onClick={() => {
                      if (esVacaciones && op.key !== 'Con goce') return;
                      setDictamenPago(op.key);
                    }}
                    style={{
                      padding: '13px 10px', borderRadius: '12px', textAlign: 'center',
                      border: seleccionada ? `2px solid ${colorActivo}` : `1px solid ${c.border}`,
                      backgroundColor: seleccionada ? bgActivo : c.surface,
                      cursor: (esVacaciones && op.key !== 'Con goce') ? 'not-allowed' : 'pointer',
                      opacity: (esVacaciones && op.key !== 'Con goce') ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
                      position: 'relative', overflow: 'hidden'
                    }}
                  >
                    <Icono size={21} color={seleccionada ? colorActivo : c.textMuted} strokeWidth={seleccionada ? 2.5 : 1.5} />
                    <span style={{ fontSize: '12px', fontWeight: seleccionada ? '800' : '600', color: seleccionada ? colorActivo : c.text }}>
                      {op.label}
                    </span>

                    {seleccionada && (
                      <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
                        <Check size={12} color={colorActivo} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {esSeleccionRegreso && (
              <div style={{
                fontSize: '11.5px', color: '#b45309', background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '9px', padding: '8px 11px',
                fontWeight: '600', lineHeight: 1.35
              }}>
                ↩️ Se generará la papeleta oficial con la leyenda <strong>"SE REGRESA (SIN ACCESO)"</strong> para respaldo de RH y aviso a Vigilancia.
              </div>
            )}

            {/* TEXTAREA DE NOTAS */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '14px', left: '12px', color: c.textSubtle }}>
                <MessageSquare size={16} />
              </div>
              <textarea
                placeholder="Agregar comentario o instrucción para el siguiente nivel / papeleta..."
                value={comentarios} onChange={e => setComentarios(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '12px 12px 12px 38px', borderRadius: '12px',
                  border: `1px solid ${c.inputBorder}`, backgroundColor: c.inputBg,
                  color: c.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  fontWeight: '500', resize: 'none', fontFamily: 'inherit'
                }}
              />
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="botones-accion">
              <button
                type="button" onClick={onClose}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${c.border}`, background: 'transparent', color: c.textMuted, fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={procesando}
                style={{
                  flex: 1.5, padding: '12px', borderRadius: '10px', border: 'none',
                  backgroundColor: esSeleccionRegreso ? '#d97706' : c.accent, color: '#fff',
                  fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <ShieldCheck size={18} />
                {procesando ? 'Guardando...' : (esSeleccionRegreso ? 'Firmar y Regresar' : 'Firmar y Autorizar')}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
