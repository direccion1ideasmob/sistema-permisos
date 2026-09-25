import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import ModalColaborador from '../components/ModalColaborador';
import VisorDirectorio from '../components/VisorDirectorio';
import { Search, Plus, LayoutGrid, TableProperties } from 'lucide-react';

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [areasUnicas, setAreasUnicas] = useState([]);
  const [puestosUnicos, setPuestosUnicos] = useState([]);
  
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [vista, setVista] = useState('arbol');
const [sedes, setSedes] = useState([]);
  // === DETECCIÓN REACTIVA DEL TEMA (CLARO / OSCURO) ===
  const [modoOscuro, setModoOscuro] = useState(() => {
    return localStorage.getItem('tema_sistema') === 'oscuro';
  });

  useEffect(() => {
    const sincronizarTema = () => {
      setModoOscuro(localStorage.getItem('tema_sistema') === 'oscuro');
    };
    window.addEventListener('storage', sincronizarTema);
    // Intervalo ligero de respaldo por si cambia en la misma pestaña
    const intervalo = setInterval(sincronizarTema, 500);
    return () => {
      window.removeEventListener('storage', sincronizarTema);
      clearInterval(intervalo);
    };
  }, []);

const cargarDatos = async () => {
    setCargando(true);
    
    // Cargar sedes
const { data: listSedes } = await supabase
  .from('sedes')
  .select('id, nombre')
  .order('nombre', { ascending: true });

if (listSedes) setSedes(listSedes);
    // 1. Traer usuarios
   const { data: listUsuarios, error: errU } = await supabase
      .from('usuarios')
      .select('id, numero_empleado, nombre_completo, usuario_login, puesto, area, rol, tipo_personal, foto_url, firma_url, activo, departamento_id, fecha_ingreso, celular, telefono, correo')
      .order('nombre_completo', { ascending: true });

    if (errU) console.error("Error usuarios:", errU);

    // 2. Traer departamentos PIDIENDO EXPRESAMENTE clasificacion, jefe_id y gerente_id
    const { data: listDeptos, error: errD } = await supabase
      .from('departamentos')
      .select('id, nombre, clasificacion, jefe_id, gerente_id')
      .order('nombre', { ascending: true });

    if (errD) console.error("Error deptos:", errD);

    if (listUsuarios && listDeptos) {
      // Formatear departamentos conservando la clasificacion y las llaves de jefatura
      const deptosFormateados = listDeptos
        .map(d => ({ 
          ...d, 
          nombre: (d.nombre || '').toUpperCase(),
          clasificacion: (d.clasificacion || 'produccion').toLowerCase().trim(),
          jefe_id: d.jefe_id,
          gerente_id: d.gerente_id
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
        
      setDepartamentos(deptosFormateados);

      // Cruzar datos vinculando la clasificación a cada usuario
      const usuariosCruzados = listUsuarios.map(user => {
        const deptoEncontrado = deptosFormateados.find(d => d.id === user.departamento_id);
        return {
          ...user,
          departamentos: { 
            id: deptoEncontrado?.id,
            nombre: deptoEncontrado ? deptoEncontrado.nombre : 'SIN DEPARTAMENTO',
            clasificacion: deptoEncontrado ? deptoEncontrado.clasificacion : 'produccion',
            jefe_id: deptoEncontrado?.jefe_id,
            gerente_id: deptoEncontrado?.gerente_id
          }
        };
      });

      setUsuarios(usuariosCruzados);
      
      const estandar = (txt) => txt ? txt.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
      setAreasUnicas([...new Set(listUsuarios.map(u => u.area ? estandar(u.area) : null).filter(Boolean))].sort());
      setPuestosUnicos([...new Set(listUsuarios.map(u => u.puesto ? estandar(u.puesto) : null).filter(Boolean))].sort());
    }
    setCargando(false);
  };

  useEffect(() => { cargarDatos(); }, []);

  const toggleEstado = async (id, actual) => {
    await supabase.from('usuarios').update({ activo: !actual }).eq('id', id);
    cargarDatos(); 
  };

  const restablecerPin = async (id, nombre) => {
    const nuevoPin = prompt(`NUEVO PIN (Mínimo 6 dígitos) para ${nombre.toUpperCase()}:`);
    if (nuevoPin && nuevoPin.length >= 6) {
      await supabase.from('usuarios').update({ pin: nuevoPin }).eq('id', id);
      alert('PIN actualizado correctamente.');
      cargarDatos();
    } else if (nuevoPin) {
      alert("El PIN debe tener al menos 6 dígitos.");
    }
  };

  const usuariosFiltrados = usuarios.filter(u =>
    u.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.area?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.puesto?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.numero_empleado?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.correo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // === PALETA LOCAL BASADA EN EL MODO ===
  const t = {
    title: modoOscuro ? '#ffffff' : '#09090b',
    sub: modoOscuro ? '#a1a1aa' : '#71717a',
    switchBg: modoOscuro ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
    switchText: modoOscuro ? '#a1a1aa' : '#64748b',
    switchActiveBg: modoOscuro ? '#18181b' : '#ffffff',
    switchActiveText: modoOscuro ? '#4ade80' : '#15803d',
    switchActiveBorder: modoOscuro ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
    inputBg: modoOscuro ? '#111114' : '#ffffff',
    inputBorder: modoOscuro ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    inputText: modoOscuro ? '#ffffff' : '#0f172a',
    inputPlaceholder: modoOscuro ? '#71717a' : '#94a3b8',
    accent: '#16a34a',
    accentHover: '#15803d',
    loadingText: modoOscuro ? '#a1a1aa' : '#64748b'
  };

  return (
    <>
      <style>{`
        .admin-container {
          display: flex;
          flex-direction: column;
          gap: 15px;
          width: 100%;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .admin-title {
          font-size: 20px;
          font-weight: 800;
          color: ${t.title};
          margin: 0;
          letter-spacing: -0.02em;
        }

        .admin-sub {
          font-size: 12px;
          color: ${t.sub};
          margin: 3px 0 0 0;
          font-weight: 400;
        }

        .admin-actions {
          display: flex;
          gap: 10px;
          align-items: center;
          width: 100%;
          justify-content: space-between;
        }

        @media (min-width: 600px) {
          .admin-title { font-size: 22px; }
          .admin-actions { width: auto; justify-content: flex-end; }
        }

        .view-switch {
          display: flex;
          background: ${t.switchBg};
          border-radius: 9px;
          padding: 3px;
          border: 1px solid ${modoOscuro ? 'rgba(255, 255, 255, 0.06)' : 'transparent'};
        }

        .switch-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border: 1px solid transparent;
          border-radius: 7px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
          background: transparent;
          color: ${t.switchText};
          transition: all 0.15s ease;
        }

        .switch-btn.active {
          background: ${t.switchActiveBg};
          color: ${t.switchActiveText};
          border-color: ${t.switchActiveBorder};
          box-shadow: ${modoOscuro ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.06)'};
        }

        .btn-nuevo-main {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: ${t.accent};
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
          transition: background-color 0.15s ease, transform 0.1s ease;
        }

        .btn-nuevo-main:hover {
          background: ${t.accentHover};
        }

        .btn-nuevo-main:active {
          transform: scale(0.98);
        }

        .search-box {
          position: relative;
          width: 100%;
        }

        .search-input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border-radius: 9px;
          border: 1px solid ${t.inputBorder};
          outline: none;
          font-size: 13.5px;
          box-sizing: border-box;
          background: ${t.inputBg};
          color: ${t.inputText};
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .search-input::placeholder {
          color: ${t.inputPlaceholder};
        }

        .search-input:focus {
          border-color: ${t.accent};
          box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
        }
      `}</style>

      <div className="admin-container">
        <header className="admin-header">
          <div>
            <h1 className="admin-title">DIRECTORIO CORPORATIVO</h1>
            <p className="admin-sub">Organización y Estructura de Personal ERP</p>
          </div>
          
          <div className="admin-actions">
            <div className="view-switch">
              <button 
                onClick={() => setVista('arbol')}
                className={`switch-btn ${vista === 'arbol' ? 'active' : ''}`}
              >
                <LayoutGrid size={15} /> <span className="hide-mobile">Estructura</span>
              </button>
              <button 
                onClick={() => setVista('excel')}
                className={`switch-btn ${vista === 'excel' ? 'active' : ''}`}
              >
                <TableProperties size={15} /> <span className="hide-mobile">DataGrid</span>
              </button>
            </div>

            <button onClick={() => setModalAbierto(true)} className="btn-nuevo-main">
              <Plus size={16} strokeWidth={2.5} />
              <span>NUEVO</span>
            </button>
          </div>
        </header>

        <div className="search-box">
          <Search 
            size={16} 
            color={t.inputPlaceholder} 
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} 
          />
          <input 
            type="text" 
            placeholder="Buscar por nombre, área, puesto, num. empleado..." 
            className="search-input"
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)} 
          />
        </div>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: t.loadingText, fontSize: '13px', fontWeight: '500' }}>
            Sincronizando estructura organizacional...
          </div>
        ) : (
          <VisorDirectorio 
  usuarios={usuariosFiltrados} 
  vista={vista} 
  departamentos={departamentos}
  sedes={sedes}
  areas={areasUnicas}
  puestos={puestosUnicos}
  onToggleEstado={toggleEstado} 
  onRestablecerPin={restablecerPin} 
  recargarDatos={cargarDatos}
  modoOscuro={modoOscuro}
/>
        )}

        {modalAbierto && (
          <ModalColaborador 
            departamentos={departamentos} 
            areas={areasUnicas} 
            puestos={puestosUnicos}
            onClose={() => setModalAbierto(false)} 
            onSuccess={() => { setModalAbierto(false); cargarDatos(); }}
            modoOscuro={modoOscuro}
          />
        )}
      </div>
    </>
  );
}