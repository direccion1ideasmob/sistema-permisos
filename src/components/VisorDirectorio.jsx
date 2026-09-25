import React, { useState } from 'react';
import DirectorioGrid from './DirectorioGrid';
import VistaArbol from './VistaArbol';
import ModalFotoZoom from './ModalFotoZoom';

export default function VisorDirectorio({ 
  usuarios = [], vista = 'arbol', onToggleEstado, onRestablecerPin, 
  departamentos = [], sedes = [], areas = [], puestos = [], recargarDatos, modoOscuro 
}) {
  const [deptosAbiertos, setDeptosAbiertos] = useState({});
  const [fotoZoom, setFotoZoom] = useState(null);

  const toggleDepto = (id) => {
    setDeptosAbiertos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      
      {/* RENDERIZA LA VISTA ACTIVA */}
      {vista === 'excel' ? (
        <DirectorioGrid 
          usuarios={usuarios} 
          departamentos={departamentos} 
          sedes={sedes}
          areas={areas} 
          puestos={puestos} 
          recargarDatos={recargarDatos} 
          onRestablecerPin={onRestablecerPin}
          setFotoZoom={setFotoZoom}
          modoOscuro={modoOscuro} 
        />
      ) : (
        <VistaArbol 
          usuarios={usuarios}
          departamentos={departamentos}
          deptosAbiertos={deptosAbiertos} 
          toggleDepto={toggleDepto} 
          onToggleEstado={onToggleEstado} 
          onRestablecerPin={onRestablecerPin} 
          setFotoZoom={setFotoZoom} 
          recargarDatos={recargarDatos}
          modoOscuro={modoOscuro} 
        />
      )}

      {/* VISOR DE FOTO AMPLIADA */}
      <ModalFotoZoom fotoZoom={fotoZoom} onClose={() => setFotoZoom(null)} />

    </div>
  );
}