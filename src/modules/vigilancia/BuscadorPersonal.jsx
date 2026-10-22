import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';

export default function BuscadorPersonal({ empleados = [], seleccionado, setSeleccionado }) {
  const [busqueda, setBusqueda] = useState('');
  const [mostrarLista, setMostrarLista] = useState(false);
  const contenedorRef = useRef(null);

  const modoOscuro = localStorage.getItem('tema_sistema') === 'oscuro';
  const c = obtenerTemaGlobal(modoOscuro);

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

  const formatearApellidosPrimero = (nombreCompleto = '') => {
    const partes = nombreCompleto.trim().split(/\s+/);
    if (partes.length <= 1) return nombreCompleto;
    if (partes.length === 2) return `${partes[1]} ${partes[0]}`;
    const apellidos = partes.slice(-2).join(' ');
    const nombres = partes.slice(0, -2).join(' ');
    return `${apellidos} ${nombres}`;
  };

  const listaProcesada = empleados.map(emp => ({
    ...emp,
    nombreFormateado: formatearApellidosPrimero(emp.nombre_completo)
  }));

  const empleadosOrdenados = listaProcesada.sort((a, b) =>
    a.nombreFormateado.localeCompare(b.nombreFormateado, 'es', { sensitivity: 'base' })
  );

  const filtrados = empleadosOrdenados.filter(emp => {
    const termino = busqueda.toLowerCase().trim();
    return (
      emp.nombreFormateado.toLowerCase().includes(termino) ||
      emp.nombre_completo.toLowerCase().includes(termino) ||
      String(emp.numero_empleado || '').toLowerCase().includes(termino)
    );
  });

  const seleccionarEmpleado = (emp) => {
    setSeleccionado(emp.id);
    setBusqueda(`${emp.nombreFormateado} (#${emp.numero_empleado})`);
    setMostrarLista(false);
  };

  return (
    <div ref={contenedorRef} style={{ position: 'relative', marginBottom: '18px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
        Colaborador en puerta:
      </label>

      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: c.textMuted, pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Buscar por apellido, nombre o # de nómina..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setSeleccionado('');
            setMostrarLista(true);
          }}
          onFocus={() => setMostrarLista(true)}
          style={{
            width: '100%', height: '42px', padding: '0 34px 0 38px',
            borderRadius: '10px', border: `1.5px solid ${seleccionado ? c.accent : c.border}`,
            fontSize: '14px', fontWeight: '600', background: c.bg,
            boxSizing: 'border-box', outline: 'none', color: c.text
          }}
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => { setBusqueda(''); setSeleccionado(''); setMostrarLista(true); }}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer', display: 'flex', padding: '2px' }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {mostrarLista && filtrados.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: c.surfaceCard, border: `1.5px solid ${c.border}`,
          borderRadius: '10px', marginTop: '6px', padding: 0,
          listStyle: 'none', maxHeight: '220px', overflowY: 'auto',
          boxShadow: '0 14px 28px rgba(0,0,0,0.25)', zIndex: 100
        }}>
          {filtrados.map(emp => (
            <li
              key={emp.id}
              onClick={() => seleccionarEmpleado(emp)}
              style={{
                padding: '10px 14px', fontSize: '13.5px', color: c.text,
                cursor: 'pointer', borderBottom: `1px solid ${c.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
              }}
            >
              <strong style={{ color: c.text, fontWeight: '700' }}>{emp.nombreFormateado}</strong>
              <span style={{ color: c.textMuted, fontSize: '12px', fontFamily: 'ui-monospace, monospace', fontWeight: '700' }}>
                #{emp.numero_empleado}
              </span>
            </li>
          ))}
        </ul>
      )}

      {mostrarLista && busqueda && filtrados.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: c.surfaceCard, border: `1px solid ${c.border}`,
          borderRadius: '10px', marginTop: '6px', padding: '12px',
          fontSize: '13px', color: '#ef4444', fontWeight: '700', textAlign: 'center', zIndex: 100
        }}>
          No se encontró ningún colaborador con ese criterio.
        </div>
      )}
    </div>
  );
}
