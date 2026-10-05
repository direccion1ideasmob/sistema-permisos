import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { RefreshCw, AlertTriangle } from 'lucide-react';

// Importamos tus componentes modulares
import TablaRegistrosVig from './TablaRegistrosVig';
import FormularioAsistencia from './FormularioAsistencia';

export default function ControlCaseta({ c }) {
  const [pases, setPases] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');

  const sedeGuardia = c?.sede_id;
  const theme = { bg: c?.background || '#f8fafc', surface: c?.surface || '#ffffff', text: c?.text || '#0f172a', textMuted: c?.textMuted || '#64748b', border: c?.border || '#e2e8f0', accent: c?.accent || '#16a34a' };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const hoyISO = new Date().toISOString().split('T')[0];
      const { data: pasesData, error: pasesError } = await supabase
        .from('permisos')
        .select(`id, folio, tipo_permiso, observaciones, hora_salida_caseta, hora_llegada_caseta, creado_por_vigilancia, firma_1_estado, firma_2_estado, estado_general, usuarios!inner ( id, nombre_completo, numero_empleado, foto_url, sede_id, departamentos ( nombre ) )`)
        .eq('fecha_permiso', hoyISO)
        .in('tipo_permiso', ['salida', 'retardo'])
        .neq('estado_general', 'rechazado')
        .eq('usuarios.sede_id', sedeGuardia);

      if (pasesError) throw pasesError;

      const pasesValidos = pasesData.filter(p => p.creado_por_vigilancia || (['autorizado', 'auto_aprobado', 'omitido'].includes(p.firma_1_estado) && ['autorizado', 'auto_aprobado', 'omitido'].includes(p.firma_2_estado)));
      setPases(pasesValidos);

      const { data: empData } = await supabase.from('usuarios').select('id, nombre_completo, numero_empleado').eq('sede_id', sedeGuardia).eq('activo', true).order('nombre_completo');
      if (empData) setEmpleadosSede(empData);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (sedeGuardia) { cargarDatos(); const intervalo = setInterval(cargarDatos, 60000); return () => clearInterval(intervalo); }
  }, [sedeGuardia]);

  const registrarMovimiento = async (id, tipoMovimiento) => {
    setProcesandoId(id);
    try {
      const actualizacion = tipoMovimiento === 'salida' ? { hora_salida_caseta: new Date().toISOString() } : { hora_llegada_caseta: new Date().toISOString() };
      await supabase.from('permisos').update(actualizacion).eq('id', id);
      await cargarDatos();
    } catch (error) { alert("Error: " + error.message); } finally { setProcesandoId(null); }
  };

  const generarLlegadaSinPase = async () => {
    if (!empleadoSeleccionado) return;
    setProcesandoId('nuevo');
    try {
      const ahora = new Date().toISOString();
      await supabase.from('permisos').insert([{ usuario_id: empleadoSeleccionado, tipo_permiso: 'retardo', fecha_permiso: ahora.split('T')[0], creado_por_vigilancia: true, hora_llegada_caseta: ahora, estado_general: 'pendiente', asunto_motivo: '[REGISTRO DE CASETA] Llegada tarde sin pase previo. Requiere justificación.' }]);
      setModalAbierto(false); setEmpleadoSeleccionado(''); await cargarDatos();
    } catch (error) { alert("Error: " + error.message); } finally { setProcesandoId(null); }
  };

  if (!sedeGuardia) return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>Error: No hay Sede asignada.</div>;

  return (
    <div style={{ padding: '24px', background: theme.bg, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: theme.text, margin: 0 }}>Radar de Accesos</h1>
          <p style={{ fontSize: '13px', color: theme.textMuted, margin: '4px 0 0 0' }}>Excepciones autorizadas • Tu sede local</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setModalAbierto(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer' }}>
            <AlertTriangle size={16} /> Registrar Llegada sin Pase
          </button>
          <button onClick={cargarDatos} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '8px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', color: theme.text }}>
            <RefreshCw size={14} className={cargando ? "spin" : ""} />
          </button>
        </div>
      </div>

      <TablaRegistrosVig pases={pases} registrarMovimiento={registrarMovimiento} procesandoId={procesandoId} theme={theme} />
      
      <FormularioAsistencia abierto={modalAbierto} cerrar={() => setModalAbierto(false)} empleadosSede={empleadosSede} empleadoSeleccionado={empleadoSeleccionado} setEmpleadoSeleccionado={setEmpleadoSeleccionado} generarRegistro={generarLlegadaSinPase} procesandoId={procesandoId} />
    </div>
  );
}