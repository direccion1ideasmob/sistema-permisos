import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, DoorOpen, UserMinus, FileText } from 'lucide-react';
import { obtenerDatosCaseta, registrarCheckCaseta, registrarRetardoEnPuerta } from './services/vigilanciaService';
import TablaRegistrosVig from './TablaRegistrosVig';
import FormularioAsistencia from './FormularioAsistencia';

export default function ControlCaseta({ c }) {
  const [tabActiva, setTabActiva] = useState('en_vivo');

  const [pasesAutorizados, setPasesAutorizados] = useState([]);
  const [pasesEnEspera, setPasesEnEspera] = useState([]);
  const [pasesRechazados, setPasesRechazados] = useState([]);
  const [personalFuera, setPersonalFuera] = useState([]);
  const [faltasProgramadas, setFaltasProgramadas] = useState([]);
  const [completados, setCompletados] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');

  const sedeGuardia = c?.sede_id;

  const theme = { 
    bg: c?.background || '#fafafa',
    surface: c?.surface || '#ffffff', 
    text: c?.text || '#171717',
    textMuted: c?.textMuted || '#737373', 
    border: c?.border || '#e5e5e5',
    accent: c?.accent || '#16a34a' 
  };

  const cargarDatos = useCallback(async () => {
    if (!sedeGuardia) return;
    setCargando(true);
    try {
      const data = await obtenerDatosCaseta(sedeGuardia);
      setPasesAutorizados(data.pasesAutorizados);
      setPasesEnEspera(data.pasesEnEspera);
      setPasesRechazados(data.pasesRechazados);
      setPersonalFuera(data.personalFuera);
      setFaltasProgramadas(data.faltasProgramadas);
      setCompletados(data.completados);
      setEmpleadosSede(data.empleadosSede);
    } catch (error) {
      console.error("Error al cargar datos en Caseta:", error);
    } finally {
      setCargando(false);
    }
  }, [sedeGuardia]);

  useEffect(() => {
    if (sedeGuardia) { 
      cargarDatos(); 
      const intervalo = setInterval(cargarDatos, 10000);
      return () => clearInterval(intervalo); 
    }
  }, [sedeGuardia, cargarDatos]);

  const registrarMovimiento = async (id, tipoMovimiento) => {
    setProcesandoId(id);
    try {
      await registrarCheckCaseta(id, tipoMovimiento);
      await cargarDatos();
    } catch (error) {
      alert("Error registrando en puerta: " + error.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const generarLlegadaSinPase = async () => {
    if (!empleadoSeleccionado) return;
    setProcesandoId('nuevo');
    try {
      await registrarRetardoEnPuerta(empleadoSeleccionado);
      setModalAbierto(false); 
      setEmpleadoSeleccionado(''); 
      await cargarDatos();
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setProcesandoId(null);
    }
  };

  if (!sedeGuardia) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>Error de Sesión: Sede de caseta no configurada.</div>;
  }

  return (
    <div style={{ padding: '24px', background: theme.bg, minHeight: '100vh', fontFamily: '"Inter", -apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '900', color: theme.text, margin: 0 }}>Control Caseta - Santa Catarina</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setModalAbierto(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
            <AlertTriangle size={16} /> Llegada sin Pase
          </button>
          <button onClick={cargarDatos} style={{ padding: '10px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '8px', cursor: 'pointer', color: theme.text }}>
            <RefreshCw size={14} className={cargando ? "spin" : ""} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: `2px solid ${theme.border}`, paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => setTabActiva('en_vivo')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: tabActiva === 'en_vivo' ? theme.accent : 'transparent', color: tabActiva === 'en_vivo' ? '#fff' : theme.textMuted, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
          <DoorOpen size={16} /> Control en Vivo (Puerta)
        </button>
        <button onClick={() => setTabActiva('fuera_planta')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: tabActiva === 'fuera_planta' ? '#3b82f6' : 'transparent', color: tabActiva === 'fuera_planta' ? '#fff' : theme.textMuted, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
          <UserMinus size={16} /> Fuera de Planta ({personalFuera.length})
        </button>
        <button onClick={() => setTabActiva('faltas')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: tabActiva === 'faltas' ? '#525252' : 'transparent', color: tabActiva === 'faltas' ? '#fff' : theme.textMuted, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
          <FileText size={16} /> Faltas y Cierre ({faltasProgramadas.length})
        </button>
      </div>

      <TablaRegistrosVig 
        tabActiva={tabActiva}
        pasesAutorizados={pasesAutorizados} 
        pasesEnEspera={pasesEnEspera}
        pasesRechazados={pasesRechazados}
        personalFuera={personalFuera}
        faltasProgramadas={faltasProgramadas}
        completados={completados}
        registrarMovimiento={registrarMovimiento} 
        procesandoId={procesandoId} 
        theme={theme} 
      />
      
      <FormularioAsistencia 
        abierto={modalAbierto} 
        cerrar={() => setModalAbierto(false)} 
        empleadosSede={empleadosSede} 
        empleadoSeleccionado={empleadoSeleccionado} 
        setEmpleadoSeleccionado={setEmpleadoSeleccionado} 
        generarRegistro={generarLlegadaSinPase} 
        procesandoId={procesandoId} 
      />
    </div>
  );
}
