import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { obtenerHistorialGeneralPermisos, obtenerCatalogoDepartamentosSimple } from '../services/permisosService';
import TablaHistorial from './TablaHistorial';
import ModalPapeletaPDF from './ModalPapeletaPDF';
import ModalExportarExcel from './ModalExportarExcel';
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
      console.error("Error al cargar historial general para RH:", err);
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

      {cargando ? (
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
