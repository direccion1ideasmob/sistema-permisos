import React, { useState } from 'react';
import miLogo from '../../assets/logo.png';
import { supabase } from '../api/supabaseClient';

export default function Login({ alEntrar }) {
  const [idUsuario, setIdUsuario] = useState('');
  const [pass, setPass] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    if (cargando) return;
    
    setCargando(true);
    const usuarioDigitado = idUsuario.trim();
    const pinDigitado = pass.trim();

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .ilike('usuario_login', usuarioDigitado)
        .eq('pin', pinDigitado)
        .single();

      if (error || !data) {
        alert("Credenciales incorrectas");
      } else {
        localStorage.setItem("permisos_sesion", JSON.stringify({
          id: data.id,
          usuario: data.usuario_login,
          nombre_completo: data.nombre_completo,
          rol: data.rol,
          area: data.area,
          departamento_id: data.departamento_id
        }));

        alEntrar(data); 
      }
    } catch (err) {
      alert("Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  const solicitarAyudaRH = () => {
    const msj = encodeURIComponent(`Hola RH, solicito apoyo para restaurar mi PIN de acceso al sistema ERP.`);
    window.open(`https://wa.me/?text=${msj}`, '_blank');
  };

  return (
    <div style={styles.fondo}>
      <div style={styles.contenedor}>
        <img src={miLogo} alt="Logo" style={styles.logo} />
        <h3 style={styles.rh}>RH</h3>
        <h2 style={styles.titulo}>ACCESOS & SALIDAS</h2>
        
        <form onSubmit={entrar} style={styles.form}>
          <input 
            style={styles.input} 
            placeholder="USUARIO LOGIN" 
            autoCapitalize="none"
            value={idUsuario}
            onChange={(e) => setIdUsuario(e.target.value)}
          />
          <input 
            style={styles.input} 
            type="password" 
            placeholder="PIN DE SEGURIDAD" 
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button type="submit" disabled={cargando} style={styles.boton}>
            {cargando ? 'VALIDANDO...' : 'ENTRAR'}
          </button>
        </form>
        
        <button type="button" onClick={solicitarAyudaRH} style={styles.btnOlvidado}>
          ¿Olvidaste tu PIN?
        </button>

        <div style={styles.footerBox}>
          <span style={styles.footerLine1}>RH CONTROL &amp; MANAGEMENT SYSTEM V1.0 • © 2026</span>
          <span style={styles.footerLine2}>
            POWERED BY <strong style={styles.footerStrong}>ING. ALEJANDRO VALENZO</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  fondo: { 
    minHeight: '100vh', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#fff',
    padding: '20px',
    boxSizing: 'border-box',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
  },
  contenedor: { 
    width: '100%', 
    maxWidth: '390px',
    textAlign: 'center',
    boxSizing: 'border-box'
  },
  logo: { 
    width: '100%', 
    maxWidth: '320px', 
    marginBottom: '14px',
    objectFit: 'contain'
  },
  rh: {
    fontSize: '17px',
    letterSpacing: '5px',
    color: '#0f172a',
    margin: '0 0 4px 0',
    fontWeight: '900'
  },
  titulo: { 
    fontSize: '12px', 
    letterSpacing: '3.5px', 
    color: '#64748b', 
    marginBottom: '32px', 
    fontWeight: '800' 
  },
  form: { 
    width: '100%', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '14px' 
  },
  input: { 
    width: '100%',
    padding: '16px 18px', 
    border: '1.5px solid #e2e8f0', 
    borderRadius: '12px', 
    fontSize: '15px',
    outline: 'none',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    transition: '0.2s',
    boxSizing: 'border-box',
    fontFamily: '"Inter", monospace',
    fontWeight: '600',
    letterSpacing: '0.5px'
  },
  boton: { 
    width: '100%',
    padding: '17px', 
    backgroundColor: '#0f172a', 
    color: '#fff', 
    border: 'none',
    borderRadius: '12px', 
    fontSize: '14px', 
    fontWeight: '800', 
    cursor: 'pointer',
    marginTop: '6px',
    letterSpacing: '2px',
    boxSizing: 'border-box'
  },
  btnOlvidado: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: '600',
    marginTop: '20px',
    cursor: 'pointer',
    textDecoration: 'underline',
    letterSpacing: '0.3px'
  },
  footerBox: {
    marginTop: '36px',
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    userSelect: 'none'
  },
  footerLine1: {
    fontSize: '9.5px',
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: '0.12em'
  },
  footerLine2: {
    fontSize: '9.5px',
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: '0.1em'
  },
  footerStrong: {
    color: '#334155',
    fontWeight: '800'
  }
};
