import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { RefreshCw, AlertTriangle, Bug } from 'lucide-react';

import TablaRegistrosVig from './TablaRegistrosVig';
import FormularioAsistencia from './FormularioAsistencia';

export default function ControlCaseta({ c }) {
  const [pases, setPases] = useState([]);
  const [empleadosSede, setEmpleadosSede] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  
  const [modalAbierto, setModalAbierto] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');

  // Escáner de pases ocultos para diagnóstico
  const [pasesOcultos, setPasesOcultos] = useState([]);

  const sedeGuardia = c?.sede_id;
  const theme = { bg: c?.background || '#f8fafc', surface: c?.surface || '#ffffff', text: c?.text || '#0f172a', textMuted: c?.textMuted || '#64748b', border: c?.border || '#e2e8f0', accent: c?.accent || '#16a34a' };

  const cargarDatos = async () => {
    setCargando(true);
    try {
      // Ajuste de zona horaria correcto para México
      const hoy = new Date();
      hoy.setMinutes(hoy.getMinutes() - hoy.getTimezoneOffset());
      const hoyISO = hoy.toISOString().split('T')[0];

      // AQUÍ ESTÁ LA SOLUCIÓN DEL ERROR PGRST201: Se especifica la llave foránea exacta
      const { data: pasesData, error: pasesError } = await supabase
        .from('permisos')
        .select(`id, folio, tipo_permiso, observaciones, hora_salida_caseta, hora_llegada_caseta, creado_por_vigilancia, firma_1_estado, firma_2_estado, estado_general, usuarios!permisos_usuario_id_fkey!inner ( id, nombre_completo, numero_empleado, foto_url, sede_id, departamentos ( nombre ) )`)
        .eq('fecha_permiso', hoyISO)
        .eq('usuarios.sede_id', sedeGuardia);

      if (pasesError) throw pasesError;

      const pasesValidos = [];
      const ocultos = [];

      // Filtro Inteligente (A prueba de mayúsculas y diferentes estados)
      const estadosAprobacion = ['autorizado', 'aprobado', 'auto_aprobado', 'omitido', 'completado'];

      (pasesData || []).forEach(p => {
        const tipo = (p.tipo_permiso || '').toLowerCase();
        const f1 = (p.firma_1_estado || '').toLowerCase();
        const f2 = (p.firma_2_estado || '').toLowerCase();
        const estado = (p.estado_general || '').toLowerCase();

        let razonOculto = "";

        if (tipo !== 'salida' && tipo !== 'retardo') {
          razonOculto = `No es salida/retardo (Es: ${tipo})`;
        } else if (estado === 'rechazado') {
          razonOculto = "Estado general es Rechazado";
        } else if (!p.creado_por_vigilancia) {
          const f1Listo = estadosAprobacion.includes(f1);
          const f2Listo = estadosAprobacion.includes(f2);
          
          if (!f1Listo) razonOculto = `Firma 1 falta o no coincide (Actual: '${f1}')`;
          else if (!f2Listo) razonOculto = `Firma 2 falta o no coincide (Actual: '${f2}')`;
        }

        if (razonOculto === "") {
          pasesValidos.push(p);
        } else {
          ocultos.push({ ...p, razon: razonOculto });
        }
      });

      setPases(pasesValidos);
      setPasesOcultos(ocultos);

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

  if (!sedeGuardia) return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>Error: No hay Sede asignada al guardia.</div>;

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

      {/* PANEL DE DIAGNÓSTICO PARA VER POR QUÉ SE OCULTA MAXIMUS */}
      {pasesOcultos.length > 0 && (
        <div style={{ marginTop: '40px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#991b1b', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Bug size={16} /> Escáner: {pasesOcultos.length} pase(s) detectado(s) pero bloqueado(s) por el sistema
          </h3>
          <ul style={{ fontSize: '12px', color: '#7f1d1d', margin: 0, paddingLeft: '20px' }}>
            {pasesOcultos.map(po => (
              <li key={po.id} style={{ marginBottom: '6px' }}>
                <strong>{po.usuarios?.nombre_completo}</strong> (Folio: {po.folio || 'N/A'}) 
                <br/> <span style={{ background: '#fecaca', padding: '2px 4px', borderRadius: '4px' }}>Motivo del bloqueo: {po.razon}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}