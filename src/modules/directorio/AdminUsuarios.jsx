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
                .admin-container { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif; }
        .admin-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; width: 100%; box-sizing: border-box; }
        .admin-title { font-size: 19px; font-weight: 800; color: ${c.text}; margin: 0; letter-spacing: -0.02em; }
        .admin-sub { font-size: 12px; color: ${c.textMuted}; margin: 2px 0 0 0; font-weight: 400; }
        .admin-actions { display: flex; gap: 8px; align-items: center; width: 100%; max-width: 100%; justify-content: space-between; box-sizing: border-box; flex-wrap: nowrap; }
        .view-switch { display: flex; background: ${c.bg}; border-radius: 9px; padding: 3px; border: 1px solid ${c.border}; min-width: 0; flex-shrink: 1; }
        .switch-btn { display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 10px; border: 1px solid transparent; border-radius: 7px; cursor: pointer; font-weight: 600; font-size: 11.5px; background: transparent; color: ${c.textMuted}; transition: all 0.15s ease; white-space: nowrap; }
        .switch-btn.active { background: ${c.surfaceCard}; color: ${c.accent}; border-color: ${c.border}; box-shadow: ${modoOscuro ? "0 4px 12px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.06)"}; }
        .btn-nuevo-main { display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 12px; background: ${c.accent}; color: #fff; border: none; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25); transition: background-color 0.15s ease, transform 0.1s ease; white-space: nowrap; flex-shrink: 0; }
        .btn-nuevo-main:hover { background: ${c.accentHover}; }
        .btn-nuevo-main:active { transform: scale(0.98); }
        @media (max-width: 599px) {
          .admin-header > div:first-child { padding-left: 44px; }
          .admin-actions { padding-left: 0; width: 100%; }
          .switch-btn { padding: 6px 9px; font-size: 11px; }
          .btn-nuevo-main { padding: 7px 11px; font-size: 11px; }
        }
        @media (min-width: 600px) {
          .admin-title { font-size: 22px; }
          .admin-actions { width: auto; justify-content: flex-end; }
          .switch-btn { padding: 7px 12px; font-size: 12px; }
          .btn-nuevo-main { padding: 8px 14px; font-size: 12.5px; }
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
                <LayoutGrid size={15} /> <span className="hide-mobile">Empresa</span>
              </button>
              <button onClick={() => setVista('excel')} className={`switch-btn ${vista === 'excel' ? 'active' : ''}`}>
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
          <div style={{ textAlign: 'center', padding: '40px', color: c.textMuted, fontSize: '13px', fontWeight: '500' }}>
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
