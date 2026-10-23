import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { obtenerHistorialGeneralPermisos, obtenerCatalogoDepartamentosSimple } from '../services/permisosService';
import TablaHistorial from './TablaHistorial';
import ModalPapeletaPDF from './ModalPapeletaPDF';
import ModalExportarExcel from './ModalExportarExcel';
import VistaAsistenciaDiariaRH from './VistaAsistenciaDiariaRH';
import ControlHoraCorteRH from '../autorizacion/ControlHoraCorteRH';
import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../aprobacionesStyles';
import { FileText, UserCheck } from 'lucide-react';

export default function ControlHistorial() {
  const { usuario } = useAuth();
  const [modoOscuro, setModoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');

  useEffect(() => {
    const syncTema = () => setModoOscuro(localStorage.getItem('tema_sistema') === 'oscuro');
    window.addEventListener('storage', syncTema);
    const timer = setInterval(syncTema, 800);
    return () => {
      window.removeEventListener('storage', syncTema);
      clearInterval(timer);
    };
  }, []);

  const c = obtenerTemaAprobaciones(modoOscuro);

  const [pestanaRH, setPestanaRH] = useState('permisos'); // 'permisos' | 'asistencia_diaria'
  const [solicitudes, setSolicitudes] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [papeletaSeleccionada, setPapeletaSeleccionada] = useState(null);
  const [mostrarModalExportar, setMostrarModalExportar] = useState(false);

  useEffect(() => {
    obtenerCatalogoDepartamentosSimple().then(setDepartamentos).catch(() => {});
  }, []);

  const cargarTodasSolicitudes = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerHistorialGeneralPermisos();
      setSolicitudes(data);
    } catch (err) {
      console.error('Error al cargar historial general para RH:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (usuario?.id) cargarTodasSolicitudes();
  }, [usuario?.id, cargarTodasSolicitudes]);

  return (
    <div className="aprobaciones-container control-historial-wrapper">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{`
        .control-historial-wrapper {
          padding: 18px 22px;
          box-sizing: border-box;
          width: 100%;
        }
        @media (max-width: 768px) {
          .control-historial-wrapper {
            padding: 10px 10px 28px 10px;
          }
        }
      `}</style>

      {/* BARRA SUPERIOR DE NAVEGACIÓN RH + RELOJ CON CANDADO */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        marginBottom: '12px',
        flexWrap: 'wrap'
      }}>
        <div className="tabs-aprobacion-bar" style={{
          display: 'inline-grid',
          gridTemplateColumns: 'repeat(2, auto)',
          gap: '4px',
          height: '38px',
          padding: '4px',
          margin: 0
        }}>
          <button
            type="button"
            className={`tab-btn ${pestanaRH === 'permisos' ? 'active' : ''}`}
            onClick={() => setPestanaRH('permisos')}
            style={{ padding: '0 14px', fontSize: '12.5px', gap: '6px' }}
          >
            <FileText size={14} />
            <span>Historial de Permisos</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${pestanaRH === 'asistencia_diaria' ? 'active' : ''}`}
            onClick={() => setPestanaRH('asistencia_diaria')}
            style={{ padding: '0 14px', fontSize: '12.5px', gap: '6px' }}
          >
            <UserCheck size={14} />
            <span>Lista de Asistencia Diaria</span>
          </button>
        </div>

        
      </div>

      {pestanaRH === 'asistencia_diaria' ? (
        <VistaAsistenciaDiariaRH
          usuario={usuario}
          departamentos={departamentos}
          c={c}
          modoOscuro={modoOscuro}
        />
      ) : cargando ? (
        <div style={{ textAlign: 'center', padding: '44px', color: c.textMuted, fontSize: '15px', fontWeight: '600' }}>
          Cargando historial...
        </div>
      ) : (
        <TablaHistorial
          solicitudes={solicitudes}
          departamentos={departamentos}
          c={c}
          modoOscuro={modoOscuro}
          esControlRH={true}
          onRecargar={cargarTodasSolicitudes}
          onAbrirExportar={() => setMostrarModalExportar(true)}
          onSeleccionarPapeleta={(permiso) => setPapeletaSeleccionada(permiso)}
        />
      )}

      {papeletaSeleccionada && (
        <ModalPapeletaPDF
          permiso={papeletaSeleccionada}
          onClose={() => setPapeletaSeleccionada(null)}
        />
      )}

      {mostrarModalExportar && (
        <ModalExportarExcel
          solicitudes={solicitudes}
          departamentos={departamentos}
          modoOscuro={modoOscuro}
          onClose={() => setMostrarModalExportar(false)}
        />
      )}
    </div>
  );
}
