import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Clock, DoorOpen, ClipboardCheck, Search, Calendar } from 'lucide-react';
import {
  obtenerDatosCaseta,
  registrarCheckCaseta,
  registrarRetardoEnPuerta,
  registrarAsistenciaLista,
  obtenerFechaLocalHoy
} from './services/vigilanciaService';
import TablaRegistrosVig from './TablaRegistrosVig';
import FormularioAsistencia from './FormularioAsistencia';

export default function ControlCaseta({ c, usuario }) {
  const usr = usuario || c || {};
  const [tabActiva, setTabActiva] = useState('pases');

  const [retenidosEnEspera, setRetenidosEnEspera] = useState([]);
  const [pasesPorCruzar, setPasesPorCruzar] = useState([]);
  const [personalFuera, setPersonalFuera] = useState([]);
  const [crucesCompletadosHoy, setCrucesCompletadosHoy] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);
  const [mapaAsistencias, setMapaAsistencias] = useState({});

  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [fechaConsulta, setFechaConsulta] = useState(obtenerFechaLocalHoy());

  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');

  const sedeGuardia = usr?.sede_id || null;

  const theme = {
    bg: c?.bgMain || '#f8fafc',
    surface: c?.surfaceCard || '#ffffff',
    text: c?.text || '#0f172a',
    textMuted: c?.textMuted || '#64748b',
    border: c?.border || '#e2e8f0',
    accent: c?.accent || '#16a34a'
  };

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const fechaTarget = tabActiva === 'consulta' ? fechaConsulta : obtenerFechaLocalHoy();
      const data = await obtenerDatosCaseta(sedeGuardia, fechaTarget);
      setRetenidosEnEspera(data.retenidosEnEspera || []);
      setPasesPorCruzar(data.pasesPorCruzar);
      setPersonalFuera(data.personalFuera);
      setCrucesCompletadosHoy(data.crucesCompletadosHoy);
      setEmpleadosSede(data.empleadosSede);
      setMapaAsistencias(data.mapaAsistencias);
    } catch (error) {
      console.error("Error al cargar datos en Caseta:", error);
    } finally {
      setCargando(false);
    }
  }, [sedeGuardia, tabActiva, fechaConsulta]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 12000);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const registrarMovimientoPase = async (id, tipoMovimiento) => {
    setProcesandoId(id);
    try {
      await registrarCheckCaseta(id, tipoMovimiento);
      await cargarDatos();
    } catch (error) {
      alert("Error registrando cruce: " + error.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const marcarAsistencia = async (empleadoId, tipoMarca) => {
    setProcesandoId(`${empleadoId}-${tipoMarca}`);
    try {
      await registrarAsistenciaLista(empleadoId, tipoMarca, usr?.id || null);
      await cargarDatos();
    } catch (error) {
      alert("Error al guardar asistencia: " + error.message);
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
      alert("⏳ Hora de llegada congelada en puerta. Esperando respuesta del Jefe de Área.");
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const totalPasesActivos = retenidosEnEspera.length + pasesPorCruzar.length + personalFuera.length;

  return (
    <div style={{ width: '100%', maxWidth: '960px', margin: '0 auto', paddingBottom: '40px', fontFamily: '"Inter", -apple-system, sans-serif' }}>
      
      {/* CABECERA COMPACTA ADAPTADA A CELULAR Y PC */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '19px', fontWeight: '900', color: theme.text, margin: 0 }}>
            Control de Puerta
          </h1>
          <div style={{ fontSize: '12px', color: theme.textMuted, fontWeight: '600' }}>
            Registro de entradas, salidas y pase de lista
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setModalAbierto(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '9px 14px', background: '#0f172a', color: '#fff',
              border: 'none', borderRadius: '9px', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer'
            }}
          >
            <Clock size={15} /> Apoyo: Generar Retardo
          </button>

          <button
            onClick={cargarDatos}
            title="Actualizar"
            style={{
              padding: '9px 11px', background: theme.surface,
              border: `1px solid ${theme.border}`, borderRadius: '9px',
              cursor: 'pointer', color: theme.text, display: 'inline-flex', alignItems: 'center'
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* BARRA DE 3 PESTAÑAS EJECUTIVAS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6px',
        background: theme.surface,
        padding: '5px',
        borderRadius: '11px',
        border: `1px solid ${theme.border}`,
        marginBottom: '16px'
      }}>
        <button
          onClick={() => setTabActiva('pases')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '9px 8px', borderRadius: '8px', border: 'none',
            background: tabActiva === 'pases' ? theme.accent : 'transparent',
            color: tabActiva === 'pases' ? '#fff' : theme.textMuted,
            fontSize: '12.5px', fontWeight: '800', cursor: 'pointer'
          }}
        >
          <DoorOpen size={15} />
          <span>Pases ({totalPasesActivos})</span>
        </button>

        <button
          onClick={() => {
            setFechaConsulta(obtenerFechaLocalHoy());
            setTabActiva('lista');
          }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '9px 8px', borderRadius: '8px', border: 'none',
            background: tabActiva === 'lista' ? theme.accent : 'transparent',
            color: tabActiva === 'lista' ? '#fff' : theme.textMuted,
            fontSize: '12.5px', fontWeight: '800', cursor: 'pointer'
          }}
        >
          <ClipboardCheck size={15} />
          <span>Pase de Lista</span>
        </button>

        <button
          onClick={() => setTabActiva('consulta')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '9px 8px', borderRadius: '8px', border: 'none',
            background: tabActiva === 'consulta' ? theme.accent : 'transparent',
            color: tabActiva === 'consulta' ? '#fff' : theme.textMuted,
            fontSize: '12.5px', fontWeight: '800', cursor: 'pointer'
          }}
        >
          <Search size={15} />
          <span>Consultar</span>
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA RÁPIDA (Y SELECTOR DE FECHA EN MODO CONSULTA) */}
      {(tabActiva === 'lista' || tabActiva === 'consulta') && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: theme.textMuted }} />
            <input
              type="text"
              placeholder="Buscar por # de nómina o nombre..."
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 34px',
                borderRadius: '9px', border: `1px solid ${theme.border}`,
                background: theme.surface, color: theme.text,
                fontSize: '13px', boxSizing: 'border-box', outline: 'none'
              }}
            />
          </div>

          {tabActiva === 'consulta' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: '9px', padding: '0 10px' }}>
              <Calendar size={14} color={theme.textMuted} />
              <input
                type="date"
                value={fechaConsulta}
                onChange={(e) => setFechaConsulta(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', color: theme.text,
                  fontSize: '12.5px', fontWeight: '700', padding: '8px 0', outline: 'none'
                }}
              />
            </div>
          )}
        </div>
      )}

      <TablaRegistrosVig
        tabActiva={tabActiva}
        retenidosEnEspera={retenidosEnEspera}
        pasesPorCruzar={pasesPorCruzar}
        personalFuera={personalFuera}
        crucesCompletadosHoy={crucesCompletadosHoy}
        empleadosSede={empleadosSede}
        mapaAsistencias={mapaAsistencias}
        busquedaTexto={busquedaTexto}
        registrarMovimientoPase={registrarMovimientoPase}
        marcarAsistencia={marcarAsistencia}
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
