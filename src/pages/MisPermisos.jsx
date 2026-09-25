import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

import { obtenerTemaPermisos, generarEstilosPermisos } from '../components/permisos/permisosStyles';
import FormularioSolicitud from '../components/permisos/FormularioSolicitud';
import HistorialPermisos from '../components/permisos/HistorialPermisos';
import ModalPapeletaPDF from '../components/permisos/ModalPapeletaPDF';

export default function MisPermisos() {
  const { usuario } = useAuth();

  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaPermisos(modoOscuro);

  const [misPermisos, setMisPermisos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [papeletaSeleccionada, setPapeletaSeleccionada] = useState(null);

const cargarHistorial = useCallback(async () => {
    if (!usuario?.id) return;
    setCargandoHistorial(true);

    const { data, error } = await supabase
      .from('permisos')
      .select(`
        *,
        usuarios:usuario_id (
          numero_empleado,
          nombre_completo,
          area,
          puesto,
          firma_url,
          departamentos:departamento_id (nombre)
        ),
        jefe:firma_1_id (nombre_completo, firma_url),
        gerente:firma_2_id (nombre_completo, firma_url),
        rh:firma_3_id (nombre_completo, firma_url)
      `)
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error al cargar historial:", error);
    } else {
      setMisPermisos(data || []);
    }
    setCargandoHistorial(false);
  }, [usuario?.id]);
  
  useEffect(() => {
    if (usuario?.id) {
      cargarHistorial();
    }
  }, [usuario?.id, cargarHistorial]);

  return (
    <div className="permisos-container">
      <style>{generarEstilosPermisos(c, modoOscuro)}</style>

      {/* 1. FORMULARIO CON SERIES P-26, A-26, O-26 */}
      <FormularioSolicitud 
        usuario={usuario} 
        onSolicitudCreada={cargarHistorial} 
        c={c} 
        modoOscuro={modoOscuro} 
      />

      {/* 2. HISTORIAL DE SOLICITUDES */}
      <HistorialPermisos 
        permisos={misPermisos} 
        onVerPapeleta={(p) => setPapeletaSeleccionada(p)} 
        cargando={cargandoHistorial} 
        c={c} 
      />

      {/* 3. MODAL DE PAPELETA OFICIAL DIGITAL */}
      <ModalPapeletaPDF 
        permiso={papeletaSeleccionada} 
        onClose={() => setPapeletaSeleccionada(null)} 
      />
    </div>
  );
}