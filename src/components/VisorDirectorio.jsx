import React, { useState } from 'react';
import DirectorioGrid from './DirectorioGrid'; // Conexión a tu archivo original existente
import VistaArbol from './VistaArbol';
import ModalFotoZoom from './ModalFotoZoom';
import ModalGestionDepto from './ModalGestionDepto';

export default function VisorDirectorio({ 
  usuarios = [], vista = 'arbol', onToggleEstado, onRestablecerPin, 
  departamentos = [], sedes = [], areas = [], puestos = [], recargarDatos, modoOscuro 
}) {
  const [deptosAbiertos, setDeptosAbiertos] = useState({});
  const [fotoZoom, setFotoZoom] = useState(null);
  const [deptoEditando, setDeptoEditando] = useState(null);

  const toggleDepto = (id) => {
    setDeptosAbiertos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Si la vista activa es DataGrid, delega a tu DirectorioGrid existente
  if (vista === 'excel') {
    return (
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
    );
  }

  // Si la vista activa es Estructura
  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      <VistaArbol 
        usuarios={usuarios}
        departamentos={departamentos}
        deptosAbiertos={deptosAbiertos} 
        toggleDepto={toggleDepto} 
        onToggleEstado={onToggleEstado} 
        onRestablecerPin={onRestablecerPin} 
        setFotoZoom={setFotoZoom} 
        onEditarDepto={(depto) => setDeptoEditando(depto)}
        modoOscuro={modoOscuro} 
      />

      {/* MODAL PARA VER FOTO AMPLIADA */}
      <ModalFotoZoom fotoZoom={fotoZoom} onClose={() => setFotoZoom(null)} />

      {/* MODAL PARA RECLASIFICAR DEPARTAMENTO */}
      {deptoEditando && (
        <ModalGestionDepto 
          deptoEditando={deptoEditando}
          onClose={() => setDeptoEditando(null)}
          onSuccess={() => {
            setDeptoEditando(null);
            if (recargarDatos) recargarDatos();
          }}
          modoOscuro={modoOscuro}
        />
      )}
    </div>
  );
}