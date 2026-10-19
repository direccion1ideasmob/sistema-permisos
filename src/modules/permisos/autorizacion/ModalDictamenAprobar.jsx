import React, { useState, useEffect } from 'react';
import { X, Check, Banknote, Receipt, Clock, UserCog, MessageSquare, ShieldCheck } from 'lucide-react';

export default function ModalDictamenAprobar({ 
  solicitud, usuarioFirmante, onClose, onConfirmarAprobacion, procesando, c 
}) {
  const [dictamenPago, setDictamenPago] = useState('Pendiente');
  const [comentarios, setComentarios] = useState('');

  // Saber si el que tiene abierto el modal es de Recursos Humanos
  const esRH = usuarioFirmante?.rol === 'rh_nominas' || usuarioFirmante?.rol === 'gerente_rh';
  const esVacaciones = solicitud?.tipo_permiso?.toLowerCase() === 'vacaciones';

  useEffect(() => {
    // 1. LIMPIEZA DE MEMORIA FANTASMA
    setComentarios('');
    
    // 2. LÓGICA DE DICTAMEN INICIAL
    if (esVacaciones) {
      setDictamenPago('Con goce'); // Vacaciones por ley obligan goce
    } else if (solicitud?.pago && !solicitud.pago.toLowerCase().includes('pendiente')) {
      setDictamenPago(solicitud.pago); // Respetar si el jefe anterior ya dictaminó
    } else {
      // Si venía pendiente, el Jefe lo ve como "Pendiente" (Delegar a RH)
      // Pero si RH lo abre, lo obligamos a elegir "Con goce" por defecto para que decida.
      setDictamenPago(esRH ? 'Con goce' : 'Pendiente');
    }
  }, [solicitud, esVacaciones, esRH]);

  if (!solicitud) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (procesando) return;
    onConfirmarAprobacion(solicitud, dictamenPago, comentarios);
  };

  // 3. LA PARADOJA DE RH RESUELTA: 
  // Filtramos las opciones. Si es RH, desaparecemos el botón de "Delegar a RH".
  const opciones = [
    { key: 'Con goce', label: 'Con Goce', icon: Banknote },
    { key: 'Sin goce', label: 'Sin Goce', icon: Receipt },
    { key: 'Con tiempo', label: 'Repone Tiempo', icon: Clock },
    ...(esRH ? [] : [{ key: 'Pendiente', label: 'Delegar a RH', icon: UserCog }])
  ];

  return (
    <>
      <style>{`
        .modal-container { 
          background-color: ${c.surfaceCard}; border: 1px solid ${c.border}; 
          border-radius: 20px; width: 100%; max-width: 400px; 
          padding: 24px; box-sizing: border-box; 
          display: flex; flex-direction: column; gap: 20px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          font-family: "Inter", system-ui, -apple-system, sans-serif;
        }
        .grid-opciones { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .botones-accion { display: flex; gap: 10px; margin-top: 4px; }
        
        @media (max-width: 480px) {
          .modal-container { padding: 20px !important; border-radius: 16px !important; }
          .grid-opciones { grid-template-columns: 1fr !important; gap: 8px !important; }
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
                Autorizando a <strong style={{ color: c.text }}>{solicitud.usuarios?.nombre_completo?.split(' ')[0]}</strong>
                <span style={{ background: c.accentSoft, color: c.accent, padding: '2px 6px', borderRadius: '6px', fontWeight: '800', fontSize: '10.5px', letterSpacing: '0.02em' }}>
                  {solicitud.tipo_permiso?.toUpperCase()}
                </span>
              </div>
            </div>
            <button 
              onClick={onClose} 
              style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.textMuted, cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* GRID DE OPCIONES RESTAURADO PARA EL JEFE */}
            <div className="grid-opciones">
              {opciones.map(op => {
                const seleccionada = dictamenPago === op.key;
                const Icono = op.icon;
                
                return (
                  <div
                    key={op.key} 
                    onClick={() => {
                      if (esVacaciones && op.key !== 'Con goce') return; // Bloquea si son vacaciones
                      setDictamenPago(op.key);
                    }}
                    style={{
                      padding: '14px 12px', borderRadius: '12px', textAlign: 'center',
                      border: seleccionada ? `2px solid ${c.accent}` : `1px solid ${c.border}`,
                      backgroundColor: seleccionada ? c.accentSoft : c.surface,
                      cursor: (esVacaciones && op.key !== 'Con goce') ? 'not-allowed' : 'pointer', 
                      opacity: (esVacaciones && op.key !== 'Con goce') ? 0.5 : 1,
                      transition: 'all 0.15s ease', 
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                      position: 'relative', overflow: 'hidden'
                    }}
                  >
                    <Icono size={22} color={seleccionada ? c.accent : c.textMuted} strokeWidth={seleccionada ? 2.5 : 1.5} />
                    <span style={{ fontSize: '12.5px', fontWeight: seleccionada ? '800' : '600', color: seleccionada ? c.accent : c.text, letterSpacing: '-0.01em' }}>
                      {op.label}
                    </span>
                    
                    {seleccionada && (
                      <div style={{ position: 'absolute', top: '6px', right: '6px' }}>
                        <Check size={12} color={c.accent} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* TEXTAREA DE NOTAS ELEGANTE */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '14px', left: '12px', color: c.textSubtle }}>
                <MessageSquare size={16} />
              </div>
              <textarea 
                placeholder="Agregar nota o instrucción (opcional)..."
                value={comentarios} onChange={e => setComentarios(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '12px 12px 12px 38px', borderRadius: '12px',
                  border: `1px solid ${c.inputBorder}`, backgroundColor: c.inputBg,
                  color: c.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s', fontWeight: '500', resize: 'none',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = c.accent}
                onBlur={(e) => e.target.style.borderColor = c.inputBorder}
              />
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="botones-accion">
              <button 
                type="button" onClick={onClose} 
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${c.border}`, background: 'transparent', color: c.textMuted, fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s' }}
              >
                Cancelar
              </button>
              <button 
                type="submit" disabled={procesando} 
                style={{ flex: 1.5, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: c.accent, color: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: `0 4px 15px rgba(22, 163, 74, 0.2)` }}
              >
                <ShieldCheck size={18} /> {procesando ? 'Guardando...' : 'Firmar y Autorizar'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </>
  );
}