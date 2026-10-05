import React from 'react';

export default function BuscadorPersonal({ empleados, seleccionado, setSeleccionado }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
        Selecciona al Empleado (Tu Sede):
      </label>
      <select 
        value={seleccionado} 
        onChange={(e) => setSeleccionado(e.target.value)}
        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '24px', fontSize: '14px', background: '#f8fafc' }}
      >
        <option value="">-- Buscar empleado... --</option>
        {empleados.map(emp => (
          <option key={emp.id} value={emp.id}>{emp.nombre_completo} (#{emp.numero_empleado})</option>
        ))}
      </select>
    </div>
  );
}