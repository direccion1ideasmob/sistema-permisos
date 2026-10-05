import React, { useState } from 'react';
import BuscadorPersonal from './BuscadorPersonal';
import FormularioAsistencia from './FormularioAsistencia';
import TablaRegistrosVig from './TablaRegistrosVig';

export default function ControlCaseta() {
  const [personalSeleccionado, setPersonalSeleccionado] = useState(null);
  const [registros, setRegistros] = useState([]);

  const handleSeleccionarPersona = (persona) => {
    setPersonalSeleccionado(persona);
  };

  const handleRegistrarAcceso = (nuevoRegistro) => {
    setRegistros([nuevoRegistro, ...registros]);
    setPersonalSeleccionado(null); // Limpiar pantalla tras registrar
  };

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Garita de Control - Vigilancia</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 p-4 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-2">Búsqueda de Acceso</h3>
          <BuscadorPersonal onSeleccionar={handleSeleccionarPersona} />
          
          {personalSeleccionado && (
            <FormularioAsistencia 
              persona={personalSeleccionado} 
              onRegistrar={handleRegistrarAcceso} 
            />
          )}
        </div>

        <div className="bg-slate-800 p-4 rounded-xl shadow">
          <h3 className="text-lg font-semibold mb-2">Bitácora Activa en Caseta</h3>
          <TablaRegistrosVig registros={registros} />
        </div>
      </div>
    </div>
  );
}