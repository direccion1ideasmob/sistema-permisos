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
  const esImpar = opciones.length % 2 !== 0;

  return (
    <>
      <style>{`
        .modal-dictamen-container {
          background-color: ${c.surfaceCard};
          border: 1.5px solid ${c.border};
          border-radius: 22px;
          width: 100%;
          max-width: 540px;
          padding: 30px 32px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.55);
          font-family: "Inter", system-ui, -apple-system, sans-serif;
        }
        .grid-opciones-dictamen {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .botones-accion-dictamen {
          display: flex;
          gap: 12px;
          margin-top: 4px;
        }
        @media (max-width: 520px) {
          .modal-dictamen-container { padding: 20px !important; border-radius: 16px !important; }
          .grid-opciones-dictamen { gap: 10px !important; }
          .botones-accion-dictamen { flex-direction: column !important; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 6000, padding: '20px'
      }}>
        <div className="modal-dictamen-container">

          {/* CABECERA DEL MODAL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '21px', fontWeight: '900', color: c.text, letterSpacing: '-0.02em' }}>
                Resolución de Pase
              </div>
              <div style={{ fontSize: '15px', color: c.textMuted, marginTop: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Evaluando a <strong style={{ color: c.text }}>{solicitud.usuarios?.nombre_completo}</strong></span>
                <span style={{ background: c.accentSoft, color: c.accent, padding: '3px 9px', borderRadius: '6px', fontWeight: '800', fontSize: '12.5px', letterSpacing: '0.03em' }}>
                  {solicitud.tipo_permiso?.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: c.surface, border: `1.5px solid ${c.border}`, color: c.textMuted,
                cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* COMENTARIOS PREVIOS EN EL FLUJO */}
          {notasFlujo && notasFlujo.length > 0 && (
            <div style={{
              background: c.surface, border: `1px solid ${c.border}`, borderRadius: '12px',
              padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '5px'
            }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Comentarios previos en el flujo:
              </span>
              {notasFlujo.map((n, idx) => (
                <div key={idx} style={{ fontSize: '14.5px', color: c.text, lineHeight: 1.4 }}>
                  <strong style={{ color: c.accent }}>{n.autor}:</strong> {n.texto}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* CUADRÍCULA DE DICTAMEN SIMÉTRICA */}
            <div className="grid-opciones-dictamen">
              {opciones.map((op, index) => {
                const seleccionada = dictamenPago === op.key;
                const Icono = op.icon;
                const colorActivo = op.esRegreso ? '#d97706' : c.accent;
                const bgActivo = op.esRegreso ? 'rgba(245, 158, 11, 0.13)' : c.accentSoft;
                const expandirUltima = esImpar && index === opciones.length - 1;

                return (
                  <div
                    key={op.key}
                    onClick={() => {
                      if (esVacaciones && op.key !== 'Con goce') return;
                      setDictamenPago(op.key);
                    }}
                    style={{
                      gridColumn: expandirUltima ? '1 / -1' : 'auto',
                      padding: expandirUltima ? '15px 18px' : '18px 14px',
                      borderRadius: '14px',
                      textAlign: 'center',
                      border: seleccionada ? `2px solid ${colorActivo}` : `1.5px solid ${c.border}`,
                      backgroundColor: seleccionada ? bgActivo : c.surface,
                      cursor: (esVacaciones && op.key !== 'Con goce') ? 'not-allowed' : 'pointer',
                      opacity: (esVacaciones && op.key !== 'Con goce') ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: expandirUltima ? 'row' : 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '9px',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <Icono size={23} color={seleccionada ? colorActivo : c.textMuted} strokeWidth={seleccionada ? 2.4 : 1.7} />
                    <span style={{ fontSize: '15px', fontWeight: seleccionada ? '800' : '700', color: seleccionada ? colorActivo : c.text }}>
                      {op.label}
                    </span>

                    {seleccionada && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                        <Check size={14} color={colorActivo} strokeWidth={3.5} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {esSeleccionRegreso && (
              <div style={{
                fontSize: '14px', color: '#b45309', background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '11px', padding: '11px 15px',
                fontWeight: '600', lineHeight: 1.4
              }}>
                ↩️ Se generará la papeleta oficial con la leyenda <strong>"SE REGRESA (SIN ACCESO)"</strong> para respaldo de RH y aviso a Vigilancia.
              </div>
            )}

            {/* CAMPO DE COMENTARIO */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '16px', left: '15px', color: c.textSubtle }}>
                <MessageSquare size={17} />
              </div>
              <textarea
                placeholder="Agregar comentario o instrucción para el siguiente nivel / papeleta..."
                value={comentarios} onChange={e => setComentarios(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: '14px 16px 14px 42px', borderRadius: '14px',
                  border: `1.5px solid ${c.inputBorder}`, backgroundColor: c.inputBg,
                  color: c.text, fontSize: '15px', outline: 'none', boxSizing: 'border-box',
                  fontWeight: '500', resize: 'none', fontFamily: 'inherit', lineHeight: 1.45
                }}
              />
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="botones-accion-dictamen">
              <button
                type="button" onClick={onClose}
                style={{
                  flex: 1, padding: '14px', borderRadius: '12px', border: `1.5px solid ${c.border}`,
                  background: 'transparent', color: c.textMuted, fontSize: '15px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={procesando}
                style={{
                  flex: 1.5, padding: '14px', borderRadius: '12px', border: 'none',
                  backgroundColor: esSeleccionRegreso ? '#d97706' : c.accent, color: '#fff',
                  fontSize: '15.5px', fontWeight: '800', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <ShieldCheck size={19} />
                {procesando ? 'Guardando...' : (esSeleccionRegreso ? 'Firmar y Regresar' : 'Firmar y Autorizar')}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}
