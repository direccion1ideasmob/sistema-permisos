import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- Importamos el navegador
import { useAuth } from '../context/AuthContext';
import FormularioSolicitud from '../components/permisos/FormularioSolicitud';
import { obtenerTemaPermisos, generarEstilosPermisos } from '../components/permisos/permisosStyles';

export default function Solicitar() {
  const { usuario } = useAuth();
  const navigate = useNavigate(); // <-- Instanciamos el navegador
  
  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaPermisos(modoOscuro);

  // Función que se dispara cuando el formulario termina de guardar en Supabase
  const manejarExito = () => {
    // Redireccionamos al empleado a su panel de seguimiento
    navigate('/mis-permisos');
  };

  return (
    <div className="permisos-container" style={{ maxWidth: '650px', margin: '0 auto', padding: '16px' }}>
      <style>{generarEstilosPermisos(c, modoOscuro)}</style>

      <FormularioSolicitud 
        usuario={usuario} 
        onSolicitudCreada={manejarExito} // <-- Le pasamos la instrucción de redirección
        c={c} 
        modoOscuro={modoOscuro} 
      />
    </div>
  );
}