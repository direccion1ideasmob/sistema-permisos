import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import FormularioSolicitud from './FormularioSolicitud';
import { obtenerTemaPermisos, generarEstilosPermisos } from '../permisosStyles';

export default function Solicitar() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  
  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaPermisos(modoOscuro);

  const manejarExito = () => {
    navigate('/mis-permisos');
  };

  return (
    <div
      className="permisos-container"
      style={{
        width: '100%',
        maxWidth: '940px',
        minHeight: 'calc(100vh - 110px)',
        margin: '0 auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}
    >
      <style>{generarEstilosPermisos(c, modoOscuro)}</style>

      <FormularioSolicitud 
        usuario={usuario} 
        onSolicitudCreada={manejarExito}
        c={c} 
        modoOscuro={modoOscuro} 
      />
    </div>
  );
}
