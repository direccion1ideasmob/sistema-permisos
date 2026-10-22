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
    <div className="solicitar-wrapper">
      <style>{generarEstilosPermisos(c, modoOscuro)}</style>
      <style>{`
        .solicitar-wrapper {
          width: 100%;
          max-width: 980px;
          min-height: calc(100vh - 110px);
          margin: 0 auto;
          padding: 22px 24px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-sizing: border-box;
        }
        @media (max-width: 760px) {
          .solicitar-wrapper {
            min-height: auto;
            justify-content: flex-start;
            padding: 12px 12px 28px 12px;
          }
        }
      `}</style>

      <FormularioSolicitud 
        usuario={usuario} 
        onSolicitudCreada={manejarExito}
        c={c} 
        modoOscuro={modoOscuro} 
      />
    </div>
  );
}
