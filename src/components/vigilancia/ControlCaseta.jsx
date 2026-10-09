import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { RefreshCw, AlertTriangle, DoorOpen, UserMinus, FileText } from 'lucide-react';

import TablaRegistrosVig from './TablaRegistrosVig';
import FormularioAsistencia from './FormularioAsistencia';

export default function ControlCaseta({ c }) {
  // Pestañas operativas
  const [tabActiva, setTabActiva] = useState('en_vivo'); // 'en_vivo', 'fuera_planta', 'faltas'

  // Cubetas de datos
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

  // Candado 1: Identificador de sede
  const sedeGuardia = c?.sede_id;

  const theme = { 
    bg: c?.background || '#f8fafc', surface: c?.surface || '#ffffff', 
    text: c?.text || '#0f172a', textMuted: c?.textMuted || '#64748b', 
    border: c?.border || '#e2e8f0', accent: c?.accent || '#16a34a' 
  };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const hoy = new Date();
      hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
      const hoyISO = hoy.toISOString().split('T')[0];

      // Candado 2: Consulta estricta filtrada por sede_id de Santa Catarina
      const { data: pasesData, error: pasesError } = await supabase
        .from('permisos')
        .select(`
          id, folio, tipo_permiso, observaciones, hora_salida_caseta, hora_llegada_caseta, 
          creado_por_vigilancia, firma_1_estado, firma_2_estado, firma_3_estado, estado_general, asunto_motivo,
          usuarios!permisos_usuario_id_fkey!inner ( 
            id, nombre_completo, numero_empleado, foto_url, sede_id, 
            departamentos!usuarios_departamento_id_fkey ( nombre ) 
          )
        `)
        .eq('fecha_permiso', hoyISO)
        .eq('usuarios.sede_id', sedeGuardia);

      if (pasesError) throw pasesError;

      // Variables temporales para clasificar
      const tempAutorizados = [];
      const tempEspera = [];
      const tempRechazados = [];
      const tempFuera = [];
      const tempFaltas = [];
      const tempCompletados = [];

      const estadosValidos = ['autorizado', 'aprobado', 'auto_aprobado', 'omitido', 'completado'];

      (pasesData || []).forEach(p => {
        const f1 = (p.firma_1_estado || '').toLowerCase();
        const f2 = (p.firma_2_estado || '').toLowerCase();
        const f3 = (p.firma_3_estado || '').toLowerCase();
        const estadoGral = (p.estado_general || '').toLowerCase();
        const tipo = (p.tipo_permiso || '').toLowerCase();

        // 1. Faltas y Vacaciones
        if (tipo === 'falta' || tipo === 'vacaciones') {
          tempFaltas.push(p);
          return;
        }

        // 2. Dictamen Negativo
        const esRechazado = estadoGral === 'rechazado' || f1 === 'rechazado' || f2 === 'rechazado' || f3 === 'rechazado';
        if (esRechazado) {
          tempRechazados.push(p);
          return;
        }

        // 3. Ya completados (Ciclo cerrado en puerta)
        const retardoCompletado = tipo === 'retardo' && p.hora_llegada_caseta;
        const salidaDefinitivaCompletada = tipo === 'salida' && p.hora_salida_caseta && !p.observaciones?.includes('Regresa');
        const salidaConRegresoCompletada = tipo === 'salida' && p.hora_salida_caseta && p.hora_llegada_caseta;
        
        if (retardoCompletado || salidaDefinitivaCompletada || salidaConRegresoCompletada) {
          tempCompletados.push(p);
          return;
        }

        // 4. Fuera de Planta (Salidas con reingreso pendiente)
        if (tipo === 'salida' && p.hora_salida_caseta && !p.hora_llegada_caseta && p.observaciones?.includes('Regresa')) {
          tempFuera.push(p);
          return;
        }

        // 5. Análisis de Firmas para pases vivos (Entradas pendientes o salidas sin salir)
        // BYPASS DE RH: Si RH firma o el general es autorizado, pasa directo.
        const estaAutorizado = estadosValidos.includes(f3) || estadoGral === 'autorizado' || (estadosValidos.includes(f1) && estadosValidos.includes(f2));

        if (estaAutorizado) {
          tempAutorizados.push(p);
        } else {
          // Si no está autorizado, está en espera
          let nivel = "Gerencia/RH";
          if (f1 === 'pendiente') nivel = "Jefe de Área";
          else if (f2 === 'pendiente') nivel = "Gerente de Área";
          else if (f3 === 'pendiente') nivel = "Recursos Humanos";
          
          tempEspera.push({ ...p, nivelEspera: nivel });
        }
      });

      setPasesAutorizados(tempAutorizados);
      setPasesEnEspera(tempEspera);
      setPasesRechazados(tempRechazados);
      setPersonalFuera(tempFuera);
      setFaltasProgramadas(tempFaltas);
      setCompletados(tempCompletados);

      // Catalogo de empleados para el buscador manual (Candado 3)
      const { data: empData } = await supabase
        .from('usuarios').select('id, nombre_completo, numero_empleado')
        .eq('sede_id', sedeGuardia).eq('activo', true).order('nombre_completo');
      if (empData) setEmpleadosSede(empData);

    } catch (error) {
      console.error("Error al cargar datos en Caseta:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (sedeGuardia) { 
      cargarDatos(); 
      const intervalo = setInterval(cargarDatos, 10000); // Polling rápido cada 10 segs
      return () => clearInterval(intervalo); 
    }
  }, [sedeGuardia]);

  const registrarMovimiento = async (id, tipoMovimiento) => {
    setProcesandoId(id);
    try {
      const ahora = new Date().toISOString();
      // tipoMovimiento puede ser 'salida' o 'llegada'
      const actualizacion = tipoMovimiento === 'salida' 
        ? { hora_salida_caseta: ahora } 
        : { hora_llegada_caseta: ahora };

      await supabase.from('permisos').update(actualizacion).eq('id', id);
      await cargarDatos();
    } catch (error) { alert("Error registrando en puerta: " + error.message); } 
    finally { setProcesandoId(null); }
  };

  const generarLlegadaSinPase = async () => {
    if (!empleadoSeleccionado) return;
    setProcesandoId('nuevo');
    try {
      const ahora = new Date();
      const hoyISO = ahora.toISOString().split('T')[0];
      const horaMinuto = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const { data: empData } = await supabase.from('usuarios').select('departamento_id, tipo_personal, nombre_completo, foto_url').eq('id', empleadoSeleccionado).single();
      const { data: depto } = await supabase.from('departamentos').select('nombre, clasificacion, jefe_id, gerente_id, rh_id').eq('id', empData.departamento_id).single();

      let jefeFinalId = depto?.jefe_id || (await supabase.from('usuarios').select('id').eq('departamento_id', empData.departamento_id).eq('rol', 'jefe_area').limit(1).maybeSingle()).data?.id;
      let gerenteFinalId = depto?.gerente_id || (await supabase.from('usuarios').select('id').eq('rol', (depto?.clasificacion || empData.tipo_personal || '').includes('admin') ? 'gerente_admin' : 'gerente_produccion').limit(1).maybeSingle()).data?.id;
      let rhFinalId = depto?.rh_id || (await supabase.from('usuarios').select('id').in('rol', ['gerente_rh', 'rh_nominas']).limit(1).maybeSingle()).data?.id;

      let estadoFirma1 = 'pendiente';
      let notificarA = [];

      if (!jefeFinalId || jefeFinalId === empleadoSeleccionado) {
        estadoFirma1 = 'omitido';
        if (gerenteFinalId) notificarA = [gerenteFinalId];
      } else {
        estadoFirma1 = 'pendiente';
        notificarA = [jefeFinalId];
      }

      const folioTemporal = `VIG-${Math.floor(100000 + Math.random() * 900000)}`;

      // INSERCIÓN: estado "en_firmas" y SIN "hora_llegada_caseta"
      await supabase.from('permisos').insert([{ 
        folio: folioTemporal, usuario_id: empleadoSeleccionado, 
        fecha_elaboracion: hoyISO, fecha_permiso: hoyISO, tipo_permiso: 'retardo', 
        pago: 'Pendiente de dictamen', asunto_motivo: '[GENERADO POR VIGILANCIA] Empleado en puerta sin pase. En espera de autorización.',
        total_horas: 0, observaciones: `🕒 Esperando en puerta desde: ${horaMinuto} hrs`,
        firma_empleado: true, firma_1_id: jefeFinalId, firma_1_estado: estadoFirma1,
        firma_2_id: gerenteFinalId, firma_2_estado: 'pendiente', firma_3_id: rhFinalId, firma_3_estado: 'pendiente',
        requiere_caseta: true, estado_general: 'en_firmas', creado_por_vigilancia: true
      }]);

      if (notificarA.length > 0) {
        // Enviar PUSH
        const { data: subs } = await supabase.from('suscripciones_push').select('subscription').in('usuario_id', notificarA);
        if (subs) {
          subs.forEach(async (item) => {
            let subLimpia = typeof item.subscription === 'string' ? JSON.parse(item.subscription) : item.subscription;
            fetch('/api/notificar', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: subLimpia, titulo: '🚨 RETARDO EN PUERTA',
                mensaje: `👤 ${empData.nombre_completo}\n🏠 GENERADO EN CASETA\n🕒 En puerta: ${horaMinuto} hrs\n💬 Requiere autorización para entrar.`,
                fotoUrl: empData.foto_url, urlDestino: '/aprobaciones'
              })
            });
          });
        }
      }

      setModalAbierto(false); 
      setEmpleadoSeleccionado(''); 
      await cargarDatos();
    } catch (error) { alert("Error: " + error.message); } 
    finally { setProcesandoId(null); }
  };

  if (!sedeGuardia) return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>Error de Sesión: Sede de caseta no configurada.</div>;

  return (
    <div style={{ padding: '24px', background: theme.bg, minHeight: '100vh' }}>
      
      {/* HEADER DE CASETA */}
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

      {/* PESTAÑAS OPERATIVAS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: `2px solid ${theme.border}`, paddingBottom: '12px' }}>
        <button onClick={() => setTabActiva('en_vivo')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: tabActiva === 'en_vivo' ? theme.accent : 'transparent', color: tabActiva === 'en_vivo' ? '#fff' : theme.textMuted, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
          <DoorOpen size={16} /> Control en Vivo (Puerta)
        </button>
        <button onClick={() => setTabActiva('fuera_planta')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: tabActiva === 'fuera_planta' ? '#3b82f6' : 'transparent', color: tabActiva === 'fuera_planta' ? '#fff' : theme.textMuted, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
          <UserMinus size={16} /> Fuera de Planta ({personalFuera.length})
        </button>
        <button onClick={() => setTabActiva('faltas')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: tabActiva === 'faltas' ? '#64748b' : 'transparent', color: tabActiva === 'faltas' ? '#fff' : theme.textMuted, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
          <FileText size={16} /> Faltas y Cierre ({faltasProgramadas.length})
        </button>
      </div>

      {/* COMPONENTE VISUAL */}
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
      
      <FormularioAsistencia abierto={modalAbierto} cerrar={() => setModalAbierto(false)} empleadosSede={empleadosSede} empleadoSeleccionado={empleadoSeleccionado} setEmpleadoSeleccionado={setEmpleadoSeleccionado} generarRegistro={generarLlegadaSinPase} procesandoId={procesandoId} />
    </div>
  );
}