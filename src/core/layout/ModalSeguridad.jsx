import React, { useState } from 'react';
import { supabase } from '../api/supabaseClient';
import { Lock, Key, X } from 'lucide-react';

export default function ModalSeguridad({ onClose, usuarioLogueado, tema, modoOscuro }) {
  const [nuevoPin, setNuevoPin] = useState('');
  const [confirmarPin, setConfirmarPin] = useState('');
  const [guardandoPin, setGuardandoPin] = useState(false);

  // === LÓGICA PARA CAMBIAR PIN DE ACCESO ===
  const handleCambiarPin = async (e) => {
    e.preventDefault();
    if (nuevoPin.length < 6) return alert("El nuevo PIN debe tener al menos 6 dígitos numéricos.");
    if (nuevoPin !== confirmarPin) return alert("Los PINes no coinciden. Intenta de nuevo.");

    setGuardandoPin(true);
    try {
      // Como tu Login es manual, SOLO actualizamos el PIN en la tabla 'usuarios'
      const { error: dbError } = await supabase
        .from('usuarios')
        .update({ pin: nuevoPin })
        .eq('id', usuarioLogueado.id);
        
      if (dbError) throw dbError;

      alert("✅ Tu PIN de seguridad se ha actualizado con éxito.");
      onClose();
    } catch (err) {
      alert("Error al actualizar PIN: " + err.message);
    } finally {
      setGuardandoPin(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      
      <div style={{
        ...s.modalBox,
        backgroundColor: tema.sidebarBg, 
        border: `1.5px solid ${tema.border}`, 
        boxShadow: modoOscuro ? '0 20px 25px -5px rgba(0, 0, 0, 0.6)' : '0 25px 50px -12px rgba(0,0,0,0.3)'
      }} onClick={e => e.stopPropagation()}>
        
        {/* ENCABEZADO DEL MODAL */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={{ ...s.iconWrapper, color: tema.accent }}>
              <Lock size={20} />
            </div>
            <div>
              <div style={{ ...s.title, color: tema.textPrimary }}>Seguridad</div>
              <div style={{ ...s.subtitle, color: tema.textSecondary }}>Cambia tu PIN de acceso</div>
            </div>
          </div>
          <button onClick={onClose} style={{ ...s.closeBtn, color: tema.textSecondary }}>
            <X size={18} />
          </button>
        </div>

        {/* FORMULARIO */}
        <form onSubmit={handleCambiarPin} style={s.form}>
          <div>
            <label style={{ ...s.label, color: tema.textSecondary }}>
              Nuevo PIN (Mínimo 6 dígitos)
            </label>
            <div style={s.inputWrapper}>
              <Key size={14} color={tema.textSecondary} style={s.inputIcon} />
              <input 
                type="password" required minLength={6} maxLength={10} placeholder="••••••"
                value={nuevoPin} onChange={e => setNuevoPin(e.target.value.replace(/\D/g, ''))} // Solo permite números
                style={{
                  ...s.input,
                  border: `1.5px solid ${tema.border}`,
                  background: tema.inputBg, 
                  color: tema.textPrimary
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ ...s.label, color: tema.textSecondary }}>
              Confirmar Nuevo PIN
            </label>
            <div style={s.inputWrapper}>
              <Key size={14} color={tema.textSecondary} style={s.inputIcon} />
              <input 
                type="password" required minLength={6} maxLength={10} placeholder="••••••"
                value={confirmarPin} onChange={e => setConfirmarPin(e.target.value.replace(/\D/g, ''))}
                style={{
                  ...s.input,
                  border: `1.5px solid ${tema.border}`,
                  background: tema.inputBg, 
                  color: tema.textPrimary
                }}
              />
            </div>
          </div>

          <div style={{ ...s.nota, color: tema.textSecondary, background: modoOscuro ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
            <strong>Nota:</strong> Si olvidas tu PIN en el futuro, no podrás entrar al sistema y deberás solicitar una restauración al departamento de RH.
          </div>

          <div style={s.actionRow}>
            <button type="button" onClick={onClose} style={{ ...s.btnCancel, border: `1.5px solid ${tema.border}`, color: tema.textPrimary }}>
              Cancelar
            </button>
            <button type="submit" disabled={guardandoPin} style={{ ...s.btnSubmit, background: tema.accent, opacity: guardandoPin ? 0.7 : 1 }}>
              {guardandoPin ? 'Guardando...' : 'Actualizar PIN'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px'
  },
  modalBox: {
    borderRadius: '24px', width: '100%', maxWidth: '360px', padding: '28px', position: 'relative'
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px'
  },
  headerLeft: {
    display: 'flex', alignItems: 'center', gap: '12px'
  },
  iconWrapper: {
    background: 'rgba(22, 163, 74, 0.1)', padding: '10px', borderRadius: '12px'
  },
  title: {
    fontSize: '16px', fontWeight: '800', letterSpacing: '-0.01em'
  },
  subtitle: {
    fontSize: '12px', marginTop: '2px'
  },
  closeBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px'
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '16px'
  },
  label: {
    display: 'block', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px'
  },
  inputWrapper: {
    position: 'relative'
  },
  inputIcon: {
    position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)'
  },
  input: {
    width: '100%', padding: '12px 14px 12px 34px', borderRadius: '10px', 
    fontSize: '16px', fontFamily: 'monospace', letterSpacing: '4px', 
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s'
  },
  nota: {
    fontSize: '11px', padding: '10px', borderRadius: '8px', lineHeight: '1.4'
  },
  actionRow: {
    display: 'flex', gap: '10px', marginTop: '8px'
  },
  btnCancel: {
    flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', 
    fontSize: '13px', fontWeight: '700',  cursor: 'pointer', transition: 'background 0.2s'
  },
  btnSubmit: {
    flex: 1, padding: '12px', borderRadius: '10px', border: 'none', color: '#ffffff', 
    fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)', 
    transition: 'transform 0.1s'
  }
};