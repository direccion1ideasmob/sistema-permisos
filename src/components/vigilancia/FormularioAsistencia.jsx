import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import BuscadorPersonal from './BuscadorPersonal';

export default function FormularioAsistencia({ abierto, cerrar, empleadosSede, empleadoSeleccionado, setEmpleadoSeleccionado, generarRegistro, procesandoId }) {
  if (!abierto) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle color="#f59e0b" size={20} />
            Registrar Llegada en Caseta
          </h3>
          <button onClick={cerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>
        
        <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px', lineHeight: 1.4 }}>
          Usa esta opción si el colaborador llegó a planta sin pase tramitado previamente. Se registrará la hora exacta de entrada con la marca <strong>"Generado por Vigilancia"</strong> para su justificación posterior en la cadena de mando.
        </p>

        <BuscadorPersonal 
          empleados={empleadosSede} 
          seleccionado={empleadoSeleccionado} 
          setSeleccionado={setEmpleadoSeleccionado} 
        />

        <button 
          onClick={generarRegistro}
          disabled={!empleadoSeleccionado || procesandoId === 'nuevo'}
          style={{ 
            width: '100%', padding: '14px', background: '#0f172a', color: '#fff', 
            border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '800', 
            cursor: (!empleadoSeleccionado || procesandoId === 'nuevo') ? 'not-allowed' : 'pointer', 
            opacity: (!empleadoSeleccionado || procesandoId === 'nuevo') ? 0.5 : 1 
          }}
        >
          {procesandoId === 'nuevo' ? 'Sellando hora...' : 'REGISTRAR LLEGADA AHORA'}
        </button>
      </div>
    </div>
  );
}