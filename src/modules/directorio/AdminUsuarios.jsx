import React, { useState, useEffect, useCallback } from 'react';
import ModalColaborador from './ModalColaborador';
import VisorDirectorio from './VisorDirectorio';
import { obtenerDatosDirectorio } from './services/directorioService';
import { obtenerTemaGlobal } from '../../core/theme/temaGlobal';
import { Plus, LayoutGrid, TableProperties } from 'lucide-react';

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [areasUnicas, setAreasUnicas] = useState([]);
  const [puestosUnicos, setPuestosUnicos] = useState([]);
  const [sedes, setSedes] = useState([]);
  
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [vista, setVista] = useState('arbol');

  const [modoOscuro, setModoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');

  useEffect(() => {
    const sincronizarTema = () => setModoOscuro(localStorage.getItem('tema_sistema') === 'oscuro');
    window.addEventListener('storage', sincronizarTema);
    const intervalo = setInterval(sincronizarTema, 500);
    return () => {
      window.removeEventListener('storage', sincronizarTema);
      clearInterval(intervalo);
    };
  }, []);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerDatosDirectorio();
      setSedes(data.sedes);
      setDepartamentos(data.departamentos);
      setUsuarios(data.usuarios);
      setAreasUnicas(data.areasUnicas);
      setPuestosUnicos(data.puestosUnicos);
    } catch (err) {
      console.error("Error cargando directorio:", err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const c = obtenerTemaGlobal(modoOscuro);

  return (
    <>
      <style>{`
        .admin-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 100%;
          overflow-x: hidden;
          box-sizing: border-box;
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
        }
        .admin-title {
          font-size: 20px;
          font-weight: 800;
          color: ${c.text};
          margin: 0;
          letter-spacing: -0.02em;
        }
        .admin-sub {
          font-size: 12.5px;
          color: ${c.textMuted};
          margin: 2px 0 0 0;
          font-weight: 500;
        }
        .admin-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          box-sizing: border-box;
        }
        .view-switch {
          display: flex;
          background: ${c.surfaceCard};
          border-radius: 10px;
          padding: 3px;
          border: 1px solid ${c.border};
          gap: 3px;
        }
        .switch-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 34px;
          padding: 0 12px;
          border: none;
          border-radius: 7px;
          cursor: pointer;
          font-weight: 700;
          font-size: 12.5px;
          background: transparent;
          color: ${c.textMuted};
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .switch-btn.active {
          background: ${modoOscuro ? '#27272a' : '#0f172a'};
          color: #ffffff;
        }
        .btn-nuevo-main {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          height: 40px;
          padding: 0 14px;
          background: ${c.accent};
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 12.5px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .admin-container {
            padding-top: 6px;
            gap: 10px;
          }
          .admin-header > div:first-child {
            padding-left: 48px;
          }
          .admin-title {
            font-size: 18px;
          }
          .admin-sub {
            font-size: 11.5px;
          }
          .admin-actions {
            width: 100%;
            justify-content: space-between;
          }
          .view-switch {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
          .switch-btn {
            height: 32px;
            font-size: 12px;
            padding: 0 8px;
          }
          .btn-nuevo-main {
            height: 38px;
            padding: 0 12px;
            font-size: 12px;
          }
        }
      `}</style>

      <div className="admin-container">
        <header className="admin-header">
          <div>
            <h1 className="admin-title">DIRECTORIO CORPORATIVO</h1>
            <p className="admin-sub">Organización y Estructura de Personal</p>
          </div>
          
          <div className="admin-actions">
            <div className="view-switch">
              <button onClick={() => setVista('arbol')} className={`switch-btn ${vista === 'arbol' ? 'active' : ''}`}>
                <LayoutGrid size={14} /> <span>Empresa</span>
              </button>
              <button onClick={() => setVista('excel')} className={`switch-btn ${vista === 'excel' ? 'active' : ''}`}>
                <TableProperties size={14} /> <span>Colaboradores</span>
              </button>
            </div>

            <button onClick={() => setModalAbierto(true)} className="btn-nuevo-main">
              <Plus size={15} strokeWidth={2.5} />
              <span>NUEVO</span>
            </button>
          </div>
        </header>

        {cargando ? (
          <div style={{ textAlign: 'center', padding: '40px', color: c.textMuted, fontSize: '13.5px', fontWeight: '600' }}>
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
