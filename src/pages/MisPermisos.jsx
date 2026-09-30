import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

import { obtenerTemaPermisos, generarEstilosPermisos } from '../components/permisos/permisosStyles';
import HistorialPermisos from '../components/permisos/HistorialPermisos';
import ModalPapeletaPDF from '../components/permisos/ModalPapeletaPDF';
import { Clock, CheckCircle2, AlertCircle, FileText, ChevronRight, ShieldAlert } from 'lucide-react';

export default function MisPermisos() {
  const { usuario } = useAuth();

  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaPermisos(modoOscuro);

  const [misPermisos, setMisPermisos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [papeletaSeleccionada, setPapeletaSeleccionada] = useState(null);
  const [pestaña, setPestaña] = useState('proceso'); // 'proceso' | 'historial'

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

  // Filtrado de trámites
  const enProceso = misPermisos.filter(p => p.estado_general === 'en_firmas');
  const finalizados = misPermisos.filter(p => p.estado_general !== 'en_firmas');

  // Función para determinar el estado de la firma
  const getEstadoFirma = (estado) => {
    if (estado === 'aprobado' || estado === 'auto_aprobado') return { texto: 'Aprobado', color: '#16a34a' };
    if (estado === 'rechazado') return { texto: 'Rechazado', color: '#ef4444' };
    return { texto: 'Pendiente', color: '#f59e0b' };
  };

  return (
    <div className="permisos-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
      <style>{generarEstilosPermisos(c, modoOscuro)}</style>

      {/* CABECERA Y NAVEGACIÓN POR PESTAÑAS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: c.text, margin: 0 }}>Mis Solicitudes y Pases</h2>
          <p style={{ fontSize: '12px', color: c.textMuted, margin: '4px 0 0 0' }}>Seguimiento en tiempo real de tus permisos.</p>
        </div>

        <div style={{ display: 'flex', background: c.card, padding: '4px', borderRadius: '10px', border: `1px solid ${c.border}` }}>
          <button
            onClick={() => setPestaña('proceso')}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: pestaña === 'proceso' ? c.accent : 'transparent',
              color: pestaña === 'proceso' ? '#ffffff' : c.textMuted,
              fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <Clock size={14} /> En Proceso ({enProceso.length})
          </button>
          <button
            onClick={() => setPestaña('historial')}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: pestaña === 'historial' ? c.accent : 'transparent',
              color: pestaña === 'historial' ? '#ffffff' : c.textMuted,
              fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <FileText size={14} /> Historial / Archivo ({finalizados.length})
          </button>
        </div>
      </div>

      {/* CONTENIDO DE PESTAÑAS */}
      {cargandoHistorial ? (
        <div style={{ padding: '30px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>
          Cargando registros...
        </div>
      ) : pestaña === 'proceso' ? (
        /* VISTA: TRÁMITES EN PROCESO */
        <div>
          {enProceso.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: c.card, borderRadius: '12px', border: `1px dashed ${c.border}` }}>
              <CheckCircle2 size={36} color={c.accent} style={{ marginBottom: '8px', opacity: 0.6 }} />
              <h4 style={{ margin: '0 0 4px 0', color: c.text, fontSize: '14px' }}>Sin trámites pendientes</h4>
              <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>No tienes solicitudes activas en flujo de firmas.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {enProceso.map(p => (
                <div 
                  key={p.id}
                  style={{
                    background: c.card, border: `1px solid ${c.border}`, borderRadius: '12px',
                    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${c.border}`, paddingBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: c.accent, textTransform: 'uppercase' }}>{p.tipo_permiso}</span>
                      <h4 style={{ margin: 0, fontSize: '14px', color: c.text }}>Folio: {p.folio}</h4>
                    </div>
                    <button 
                      onClick={() => setPapeletaSeleccionada(p)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${c.border}`, background: 'transparent', color: c.text, fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Ver Papeleta <ChevronRight size={14} />
                    </button>
                  </div>

                  <div style={{ fontSize: '12px', color: c.textMuted }}>
                    <strong>Motivo:</strong> {p.asunto_motivo}
                  </div>

                  {/* ESTATUS DE FIRMAS DE TRÁMITE */}
                  <div style={{ background: c.bg, padding: '12px', borderRadius: '8px', border: `1px solid ${c.border}` }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: c.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>Estatus de Firmas</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                      
                      {/* Firma 1: Jefe */}
                      <div style={{ padding: '6px', borderRadius: '6px', background: c.card, border: `1px solid ${c.border}` }}>
                        <div style={{ fontSize: '10px', color: c.textMuted }}>1. Jefe Directo</div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: getEstadoFirma(p.firma_1_estado).color }}>
                          {getEstadoFirma(p.firma_1_estado).texto}
                        </div>
                      </div>

                      {/* Firma 2: Gerente */}
                      <div style={{ padding: '6px', borderRadius: '6px', background: c.card, border: `1px solid ${c.border}` }}>
                        <div style={{ fontSize: '10px', color: c.textMuted }}>2. Gerencia</div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: getEstadoFirma(p.firma_2_estado).color }}>
                          {getEstadoFirma(p.firma_2_estado).texto}
                        </div>
                      </div>

                      {/* Firma 3: RH */}
                      <div style={{ padding: '6px', borderRadius: '6px', background: c.card, border: `1px solid ${c.border}` }}>
                        <div style={{ fontSize: '10px', color: c.textMuted }}>3. Recursos Humanos</div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: getEstadoFirma(p.firma_3_estado).color }}>
                          {getEstadoFirma(p.firma_3_estado).texto}
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VISTA: HISTORIAL FINALIZADO */
        <HistorialPermisos 
          permisos={finalizados} 
          onVerPapeleta={(p) => setPapeletaSeleccionada(p)} 
          cargando={cargandoHistorial} 
          c={c} 
        />
      )}

      {/* MODAL PAPELETA DIGITAL */}
      <ModalPapeletaPDF 
        permiso={papeletaSeleccionada} 
        onClose={() => setPapeletaSeleccionada(null)} 
      />
    </div>
  );
}