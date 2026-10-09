import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function BuscadorPersonal({ empleados, seleccionado, setSeleccionado }) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarLista, setMostrarLista] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!seleccionado) {
      setBusqueda('');
    }
  }, [seleccionado]);

  useEffect(() => {
    const handleClickFuera = (event) => {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target)) {
        setMostrarLista(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  // Convierte "Alejandro Valenzo Batalla" -> "Valenzo Batalla Alejandro"
  const formatearApellidosPrimero = (nombreCompleto = '') => {
    const partes = nombreCompleto.trim().split(/\s+/);
    if (partes.length <= 1) return nombreCompleto;
    if (partes.length === 2) {
      return `${partes[1]} ${partes[0]}`; // "Pérez Juan"
    }
    // Para 3 o más palabras, toma los últimos 2 como apellidos y los primeros como nombres
    const apellidos = partes.slice(-2).join(' ');
    const nombres = partes.slice(0, -2).join(' ');
    return `${apellidos} ${nombres}`;
  };

  // Mapeamos los empleados agregando el campo 'nombreFormateado'
  const listaProcesada = empleados.map(emp => ({
    ...emp,
    nombreFormateado: formatearApellidosPrimero(emp.nombre_completo)
  }));

  // Ordenamiento alfabético directo por la cadena de apellidos
  const empleadosOrdenados = listaProcesada.sort((a, b) => 
    a.nombreFormateado.localeCompare(b.nombreFormateado, 'es', { sensitivity: 'base' })
  );

  // Filtro en vivo (permite buscar por apellidos, por nombre o por # de empleado)
  const filtrados = empleadosOrdenados.filter(emp => {
    const termino = busqueda.toLowerCase().trim();
    return (
      emp.nombreFormateado.toLowerCase().includes(termino) || 
      emp.nombre_completo.toLowerCase().includes(termino) || 
      emp.numero_empleado.toString().toLowerCase().includes(termino)
    );
  });

  const seleccionarEmpleado = (emp) => {
    setSeleccionado(emp.id);
    setBusqueda(`${emp.nombreFormateado} (#${emp.numero_empleado})`);
    setMostrarLista(false);
  };

  return (
    <div ref={contenedorRef} style={{ position: 'relative', marginBottom: '24px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
        Buscar Empleado (Apellidos o Nombre):
      </label>
      
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
        <input 
          type="text"
          placeholder="Escribe apellido o nombre..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setSeleccionado('');
            setMostrarLista(true);
          }}
          onFocus={() => setMostrarLista(true)}
          style={{ 
            width: '100%', padding: '12px 12px 12px 36px', 
            borderRadius: '8px', border: '1px solid #cbd5e1', 
            fontSize: '14px', background: '#f8fafc', boxSizing: 'border-box',
            outline: 'none', color: '#0f172a'
          }}
        />
      </div>

      {/* LISTA DESPLEGABLE: Muestra "Valenzo Batalla Alejandro" */}
      {mostrarLista && filtrados.length > 0 && (
        <ul style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, 
          background: '#ffffff', border: '1px solid #e2e8f0', 
          borderRadius: '8px', marginTop: '4px', padding: 0, 
          listStyle: 'none', maxHeight: '180px', overflowY: 'auto', 
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50 
        }}>
          {filtrados.map(emp => (
            <li 
              key={emp.id} 
              onClick={() => seleccionarEmpleado(emp)}
              style={{ 
                padding: '12px', fontSize: '13px', color: '#334155', 
                cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                display: 'flex', justifyContent: 'space-between'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <strong style={{ color: '#0f172a' }}>{emp.nombreFormateado}</strong> 
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>#{emp.numero_empleado}</span>
            </li>
          ))}
        </ul>
      )}

      {mostrarLista && busqueda && filtrados.length === 0 && (
        <div style={{ 
          position: 'absolute', top: '100%', left: 0, right: 0, 
          background: '#fff', border: '1px solid #fca5a5', 
          borderRadius: '8px', marginTop: '4px', padding: '12px', 
          fontSize: '13px', color: '#dc2626', textAlign: 'center', zIndex: 50 
        }}>
          No se encontró ningún empleado.
        </div>
      )}
    </div>
  );
}