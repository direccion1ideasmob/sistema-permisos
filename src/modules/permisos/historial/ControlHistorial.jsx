import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { obtenerHistorialGeneralPermisos, obtenerCatalogoDepartamentosSimple } from '../services/permisosService';
import TablaHistorial from './TablaHistorial';
import ModalPapeletaPDF from './ModalPapeletaPDF';
import ModalExportarExcel from './ModalExportarExcel';
import VistaAsistenciaDiariaRH from './VistaAsistenciaDiariaRH';
import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../aprobacionesStyles';

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
      setSolicitudes(data || []);
    } catch (err) {
      console.error('Error al cargar historial general para RH:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (usuario?.id) cargarTodasSolicitudes();
  }, [usuario?.id, cargarTodasSolicitudes]);

  const bgActivoTab = modoOscuro ? '#27272a' : '#0f172a';

  const selectorModo = (
    <div style={{
      display: 'inline-flex',
      background: c.surfaceCard,
      border: `1px solid ${c.border}`,
      borderRadius: '9px',
      padding: '3px',
      gap: '3px',
      flexShrink: 0
    }}>
      <button
        type="button"
        onClick={() => setPestanaRH('permisos')}
        style={{
          height: '28px', padding: '0 12px', borderRadius: '6px', border: 'none',
          background: pestanaRH === 'permisos' ? bgActivoTab : 'transparent',
          color: pestanaRH === 'permisos' ? '#ffffff' : c.textMuted,
          fontWeight: '700',
          fontSize: '12.5px', cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        Permisos
      </button>
      <button
        type="button"
        onClick={() => setPestanaRH('asistencia_diaria')}
        style={{
          height: '28px', padding: '0 12px', borderRadius: '6px', border: 'none',
          background: pestanaRH === 'asistencia_diaria' ? bgActivoTab : 'transparent',
          color: pestanaRH === 'asistencia_diaria' ? '#ffffff' : c.textMuted,
          fontWeight: '700',
          fontSize: '12.5px', cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
      >
        Asistencia
      </button>
    </div>
  );

  return (
    <div className="aprobaciones-container control-historial-wrapper">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{`
        .control-historial-wrapper {
          padding: 16px 22px;
          box-sizing: border-box;
          width: 100%;
        }
        @media (max-width: 768px) {
          .control-historial-wrapper {
            padding: 42px 10px 28px 10px;
          }
        }
      `}</style>

      {pestanaRH === 'asistencia_diaria' ? (
        <VistaAsistenciaDiariaRH
          usuario={usuario}
          departamentos={departamentos}
          c={c}
          modoOscuro={modoOscuro}
          selectorModo={selectorModo}
        />
      ) : cargando ? (
        <div style={{ textAlign: 'center', padding: '44px', color: c.textMuted, fontSize: '14px', fontWeight: '600' }}>
          Cargando registros...
        </div>
      ) : (
        <TablaHistorial
          solicitudes={solicitudes}
          departamentos={departamentos}
          c={c}
          modoOscuro={modoOscuro}
          esControlRH={true}
          selectorModo={selectorModo}
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
          solicitudesPrecargadas={solicitudes}
          departamentos={departamentos}
          c={c}
          modoOscuro={modoOscuro}
          onClose={() => setMostrarModalExportar(false)}
        />
      )}
    </div>
  );
}
