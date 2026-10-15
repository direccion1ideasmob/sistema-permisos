import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { obtenerHistorialGeneralPermisos, obtenerCatalogoDepartamentosSimple } from '../services/permisosService';
import TablaHistorial from './TablaHistorial';
import ModalPapeletaPDF from './ModalPapeletaPDF';
import ModalExportarExcel from './ModalExportarExcel';
import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../aprobacionesStyles';
import { FileSpreadsheet, RefreshCw, Shield } from 'lucide-react';

export default function ControlHistorial() {
  const { usuario } = useAuth();
  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaAprobaciones(modoOscuro);

  const [solicitudes, setSolicitudes] = useState([]);
  const [departamentos, setDepartamentos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [deptoFiltro, setDeptoFiltro] = useState('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');

  const [papeletaSeleccionada, setPapeletaSeleccionada] = useState(null);
  const [mostrarModalExportar, setMostrarModalExportar] = useState(false);

  useEffect(() => {
    obtenerCatalogoDepartamentosSimple().then(setDepartamentos).catch(() => {});
  }, []);

  const cargarTodasSolicitudes = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerHistorialGeneralPermisos({ deptoFiltro, tipoFiltro, fechaInicio, fechaFin });
      setSolicitudes(data);
    } catch (err) {
      console.error("Error al cargar historial general para RH:", err);
    } finally {
      setCargando(false);
    }
  }, [deptoFiltro, tipoFiltro, fechaInicio, fechaFin]);

  useEffect(() => {
    if (usuario?.id) cargarTodasSolicitudes();
  }, [usuario?.id, cargarTodasSolicitudes]);

  return (
    <div className="control-historial-container" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color={c.accent} />
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: c.text, margin: 0 }}>Control General e Historial RH</h2>
          </div>
          <p style={{ fontSize: '12px', color: c.textMuted, margin: '4px 0 0 0' }}>Auditoría central, archivo de pases y generación de reportes de nómina.</p>
        </div>

        <button
          onClick={() => setMostrarModalExportar(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px',
            border: 'none', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '12px', fontWeight: '800',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
          }}
        >
          <FileSpreadsheet size={16} /> Exportar Excel (.CSV)
        </button>
      </div>

      <div style={{ background: c.surfaceCard, padding: '14px 18px', borderRadius: '14px', border: `1px solid ${c.border}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Departamento</label>
          <select value={deptoFiltro} onChange={(e) => setDeptoFiltro(e.target.value)} style={{ width: '100%', background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: '700', outline: 'none' }}>
            <option value="todos">Todos los Departamentos</option>
            {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Tipo de Pase</label>
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} style={{ width: '100%', background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '8px', fontSize: '12px', fontWeight: '700', outline: 'none' }}>
            <option value="todos">Todos los Tipos</option>
            <option value="salida">Salida Anticipada</option>
            <option value="retardo">Retardo</option>
            <option value="falta">Falta Programada</option>
            <option value="vacaciones">Vacaciones</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Desde (Fecha)</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ width: '100%', background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '7px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>Hasta (Fecha)</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ width: '100%', background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '7px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div>
          <button
            onClick={() => { setDeptoFiltro('todos'); setTipoFiltro('todos'); setFechaInicio(''); setFechaFin(''); }}
            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: `1px solid ${c.border}`, background: c.bg, color: c.textMuted, fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <RefreshCw size={13} /> Limpiar Filtros
          </button>
        </div>
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '40px', color: c.textMuted, fontSize: '12px' }}>Cargando base de datos de pases...</div>
      ) : (
        <TablaHistorial solicitudes={solicitudes} c={c} modoOscuro={modoOscuro} esControlRH={true} onSeleccionarPapeleta={(permiso) => setPapeletaSeleccionada(permiso)} />
      )}

      {papeletaSeleccionada && <ModalPapeletaPDF permiso={papeletaSeleccionada} onClose={() => setPapeletaSeleccionada(null)} />}
      {mostrarModalExportar && <ModalExportarExcel departamentos={departamentos} onClose={() => setMostrarModalExportar(false)} />}
    </div>
  );
}
