import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import ModalColaborador from '../components/ModalColaborador';
import VisorDirectorio from '../components/VisorDirectorio';
import { Plus, LayoutGrid, TableProperties } from 'lucide-react';

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [areasUnicas, setAreasUnicas] = useState([]);
  const [puestosUnicos, setPuestosUnicos] = useState([]);
  
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [vista, setVista] = useState('arbol');
  const [sedes, setSedes] = useState([]);

  const [modoOscuro, setModoOscuro] = useState(() => {
    return localStorage.getItem('tema_sistema') === 'oscuro';
  });

  useEffect(() => {
    const sincronizarTema = () => {
      setModoOscuro(localStorage.getItem('tema_sistema') === 'oscuro');
    };
    window.addEventListener('storage', sincronizarTema);
    const intervalo = setInterval(sincronizarTema, 500);
    return () => {
      window.removeEventListener('storage', sincronizarTema);
      clearInterval(intervalo);
    };
  }, []);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    
    const { data: listSedes } = await supabase.from('sedes').select('id, nombre').order('nombre', { ascending: true });
    if (listSedes) setSedes(listSedes);

    // SE AGREGARON: nombre, apellido_paterno, apellido_materno, fecha_nacimiento, fecha_baja, motivo_baja
    const { data: listUsuarios, error: errU } = await supabase
      .from('usuarios')
      .select('id, numero_empleado, nombre_completo, nombre, apellido_paterno, apellido_materno, fecha_nacimiento, usuario_login, puesto, area, rol, tipo_personal, foto_url, firma_url, activo, departamento_id, sede_id, pin, fecha_ingreso, fecha_baja, motivo_baja, celular, telefono, correo')
      .order('nombre_completo', { ascending: true });

    if (errU) console.error("Error usuarios:", errU);

    const { data: listDeptos, error: errD } = await supabase
      .from('departamentos')
      .select('id, nombre, clasificacion, jefe_id, gerente_id')
      .order('nombre', { ascending: true });

    if (errD) console.error("Error deptos:", errD);

    if (listUsuarios && listDeptos) {
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
  }, []);

  useEffect(() => { 
    cargarDatos(); 
  }, [cargarDatos]);

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

  // === PALETA GRIS CARBÓN PURO ===
  const t = {
    title: modoOscuro ? '#ffffff' : '#171717',
    sub: modoOscuro ? '#a3a3a3' : '#737373',
    switchBg: modoOscuro ? '#171717' : '#f5f5f5',
    switchText: modoOscuro ? '#a3a3a3' : '#737373',
    switchActiveBg: modoOscuro ? '#262626' : '#ffffff',
    switchActiveText: modoOscuro ? '#4ade80' : '#15803d',
    switchActiveBorder: modoOscuro ? '#404040' : '#e5e5e5',
    accent: '#16a34a',
    accentHover: '#15803d',
    loadingText: modoOscuro ? '#a3a3a3' : '#737373'
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
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
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
          border: 1px solid ${t.switchActiveBorder};
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
          box-shadow: ${modoOscuro ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.06)'};
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
        .btn-nuevo-main:hover { background: ${t.accentHover}; }
        .btn-nuevo-main:active { transform: scale(0.98); }
      `}</style>

      <div className="admin-container">
        <header className="admin-header">
          <div>
            <h1 className="admin-title">DIRECTORIO CORPORATIVO</h1>
            <p className="admin-sub">Organización y Estructura de Personal</p>
          </div>
          
          <div className="admin-actions">
            <div className="view-switch">
              <button 
                onClick={() => setVista('arbol')}
                className={`switch-btn ${vista === 'arbol' ? 'active' : ''}`}
              >
                <LayoutGrid size={15} /> <span className="hide-mobile">Empresa</span>
              </button>
              <button 
                onClick={() => setVista('excel')}
                className={`switch-btn ${vista === 'excel' ? 'active' : ''}`}
              >
                <TableProperties size={15} /> <span className="hide-mobile">Colaboradores</span>
              </button>
            </div>

            <button onClick={() => setModalAbierto(true)} className="btn-nuevo-main">
              <Plus size={16} strokeWidth={2.5} />
              <span>NUEVO</span>
            </button>
          </div>
        </header>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: t.loadingText, fontSize: '13px', fontWeight: '500' }}>
            Sincronizando estructura organizacional...
          </div>
        ) : (
          <VisorDirectorio 
            usuarios={usuarios} 
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
            onClose={() => setModalAbierto(false)} 
            onSuccess={() => { setModalAbierto(false); cargarDatos(); }}
            departamentos={departamentos} 
            areas={areasUnicas} 
            puestos={puestosUnicos} 
            sedes={sedes}
            modoOscuro={modoOscuro}
          />
        )}
      </div>
    </>
  );
}