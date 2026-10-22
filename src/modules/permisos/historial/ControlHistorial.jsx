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
    <div className="aprobaciones-container" style={{ padding: '18px 22px', boxSizing: 'border-box' }}>
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

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
