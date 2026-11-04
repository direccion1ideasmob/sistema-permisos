import React, { useState, useEffect } from 'react';
import DirectorioGrid from './DirectorioGrid';
import VistaArbol from './VistaArbol';
import ModalFotoZoom from '../../core/ui/ModalFotoZoom';

export default function VisorDirectorio({ 
  usuarios = [], vista = 'arbol', 
  departamentos = [], sedes = [], areas = [], puestos = [], recargarDatos, modoOscuro 
}) {
  const [deptosAbiertos, setDeptosAbiertos] = useState({});
  const [fotoZoom, setFotoZoom] = useState(null);

  // Candado único en memoria: dura toda la edición en Tabla y Árbol, pero se bloquea solo al recargar (F5) o salir del módulo
  const [seguridadDesbloqueada, setSeguridadDesbloqueada] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem('arbol_pin_desbloqueado');
    return () => {
      sessionStorage.removeItem('arbol_pin_desbloqueado');
    };
  }, []);

  const toggleDepto = (id) => {
    setDeptosAbiertos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {vista === 'excel' ? (
        <DirectorioGrid 
          usuarios={usuarios} 
          departamentos={departamentos} 
          sedes={sedes}
          areas={areas} 
          puestos={puestos} 
          recargarDatos={recargarDatos} 
          setFotoZoom={setFotoZoom}
          modoOscuro={modoOscuro}
          seguridadDesbloqueada={seguridadDesbloqueada}
          setSeguridadDesbloqueada={setSeguridadDesbloqueada}
        />
      ) : (
        <VistaArbol 
          usuarios={usuarios}
          departamentos={departamentos}
          deptosAbiertos={deptosAbiertos} 
          toggleDepto={toggleDepto} 
          setFotoZoom={setFotoZoom} 
          recargarDatos={recargarDatos}
          modoOscuro={modoOscuro}
          seguridadDesbloqueada={seguridadDesbloqueada}
          setSeguridadDesbloqueada={setSeguridadDesbloqueada}
        />
      )}

      <ModalFotoZoom fotoZoom={fotoZoom} onClose={() => setFotoZoom(null)} />
    </div>
  );
}