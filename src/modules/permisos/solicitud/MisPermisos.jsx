import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { obtenerPermisosUsuario, escalarPermisoAGerencia } from '../services/permisosService';
import { obtenerTemaPermisos, generarEstilosPermisos } from '../permisosStyles';
import { Clock, CheckCircle2, FileText, AlertTriangle, ShieldCheck, XCircle, FastForward } from 'lucide-react';

export default function MisPermisos() {
  const { usuario } = useAuth();
  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaPermisos(modoOscuro);

  const [misPermisos, setMisPermisos] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [pestaña, setPestaña] = useState('proceso'); 
  const [procesandoEscalamiento, setProcesandoEscalamiento] = useState(false);
  const [horaActual, setHoraActual] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const cargarHistorial = useCallback(async () => {
    if (!usuario?.id) return;
    setCargandoHistorial(true);
    try {
      const data = await obtenerPermisosUsuario(usuario.id);
      setMisPermisos(data);
    } catch (err) {
      console.error("Error al cargar historial:", err);
    } finally {
      setCargandoHistorial(false);
    }
  }, [usuario?.id]);
  
  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);

  const escalarPermiso = async (permiso) => {
    if (!window.confirm("¿Estás seguro de escalar esta solicitud a la Gerencia? Usa esta opción solo si tu Jefe Directo no ha respondido en más de 1 hora.")) return;
    setProcesandoEscalamiento(true);
    try {
      await escalarPermisoAGerencia(permiso);
      alert("✅ Solicitud escalada a Gerencia correctamente.");
      await cargarHistorial();
    } catch (error) {
      console.error("Error al escalar:", error);
      alert("Hubo un problema al intentar escalar la solicitud.");
    } finally {
      setProcesandoEscalamiento(false);
    }
  };

  const enProceso = misPermisos.filter(p => p.estado_general === 'en_firmas');
  const finalizados = misPermisos.filter(p => p.estado_general !== 'en_firmas');

  const renderSelloArea = (nombreArea, estado) => {
    const est = (estado || 'pendiente').toLowerCase();
    let config = { bg: modoOscuro ? 'rgba(255, 255, 255, 0.03)' : '#f5f5f5', border: c.border, color: c.textMuted, texto: 'EN REVISIÓN', icono: <Clock size={12} /> };

    if (['autorizado', 'auto_aprobado', 'aprobado'].includes(est)) {
      config = { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.3)', color: '#16a34a', texto: 'SELLO APROBADO', icono: <ShieldCheck size={13} /> };
    } else if (['escalado', 'omitido'].includes(est)) {
      config = { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', color: '#2563eb', texto: est === 'escalado' ? 'ESCALADO' : 'OMITIDO', icono: <FastForward size={13} /> };
    } else if (est === 'rechazado') {
      config = { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.3)', color: '#dc2626', texto: 'RECHAZADO', icono: <XCircle size={13} /> };
    }

    return (
      <div style={{ padding: '10px 8px', borderRadius: '10px', background: config.bg, border: `1px solid ${config.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '9.5px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{nombreArea}</span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: config.color, fontSize: '11px', fontWeight: '900' }}>
          {config.icono}<span>{config.texto}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="permisos-container" style={{ maxWidth: '850px', margin: '0 auto', padding: '16px' }}>
      <style>{generarEstilosPermisos(c, modoOscuro)}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: c.text, margin: 0 }}>Mis Solicitudes de Pase</h2>
          <p style={{ fontSize: '12px', color: c.textMuted, margin: '4px 0 0 0' }}>Testigo digital y estatus de autorización.</p>
        </div>

        <div style={{ display: 'flex', background: c.surfaceCard, padding: '4px', borderRadius: '10px', border: `1px solid ${c.border}` }}>
          <button onClick={() => setPestaña('proceso')} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: pestaña === 'proceso' ? c.accent : 'transparent', color: pestaña === 'proceso' ? '#ffffff' : c.textMuted, fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} /> En Proceso ({enProceso.length})
          </button>
          <button onClick={() => setPestaña('historial')} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: pestaña === 'historial' ? c.accent : 'transparent', color: pestaña === 'historial' ? '#ffffff' : c.textMuted, fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} /> Concluidos ({finalizados.length})
          </button>
        </div>
      </div>

      {cargandoHistorial ? (
        <div style={{ padding: '30px', textAlign: 'center', color: c.textMuted, fontSize: '13px' }}>Cargando solicitudes...</div>
      ) : pestaña === 'proceso' ? (
        enProceso.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: c.surfaceCard, borderRadius: '12px', border: `1px dashed ${c.border}` }}>
            <CheckCircle2 size={36} color={c.accent} style={{ marginBottom: '8px', opacity: 0.6 }} />
            <h4 style={{ margin: '0 0 4px 0', color: c.text, fontSize: '14px' }}>Sin solicitudes en curso</h4>
            <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>Tus pases activos o en revisión aparecerán aquí.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {enProceso.map(p => {
              const horasTranscurridas = (horaActual - new Date(p.created_at)) / (1000 * 60 * 60);
              const puedeEscalar = p.firma_1_estado === 'pendiente' && horasTranscurridas >= 1;

              return (
                <div key={p.id} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: modoOscuro ? '0 4px 15px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: c.text, textTransform: 'uppercase' }}>{p.tipo_permiso}</span>
                      <span style={{ fontSize: '12px', color: c.textMuted, fontWeight: '600' }}>Fecha: {p.fecha_permiso}</span>
                    </div>
                    {p.asunto_motivo && p.asunto_motivo.includes('[') && (
                      <span style={{ background: c.accentSoft, color: c.accent, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                        {p.asunto_motivo.substring(p.asunto_motivo.indexOf('[') + 1, p.asunto_motivo.indexOf(']'))}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: c.text, lineHeight: '1.5' }}>
                    {p.asunto_motivo && p.asunto_motivo.includes(']') ? p.asunto_motivo.substring(p.asunto_motivo.indexOf(']') + 1).trim() : p.asunto_motivo}
                    {p.observaciones && <div style={{ fontSize: '12px', color: c.textMuted, marginTop: '4px', background: c.surface, padding: '6px 8px', borderRadius: '6px' }}>{p.observaciones}</div>}
                  </div>

                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Validación Institucional</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {renderSelloArea('Jefatura', p.firma_1_estado)}
                      {renderSelloArea('Gerencia', p.firma_2_estado)}
                      {renderSelloArea('R. Humanos', p.firma_3_estado)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: `1px dashed ${c.border}`, paddingTop: '10px' }}>
                    <span style={{ fontSize: '10.5px', color: c.textSubtle, fontWeight: '700' }}>REF: {p.folio}</span>
                    {puedeEscalar && (
                      <button onClick={() => escalarPermiso(p)} disabled={procesandoEscalamiento} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={13} /> {procesandoEscalamiento ? 'Escalando...' : 'Escalar inactividad'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {finalizados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: c.surfaceCard, borderRadius: '12px', border: `1px dashed ${c.border}` }}>
              <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>No tienes historial de pases autorizados o rechazados.</p>
            </div>
          ) : (
            finalizados.map(p => {
              const esAutorizado = ['autorizado', 'aprobado'].includes(p.estado_general);
              return (
                <div key={p.id} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: modoOscuro ? '0 4px 15px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: c.text, textTransform: 'uppercase' }}>{p.tipo_permiso}</span>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: esAutorizado ? c.accent : c.danger, background: esAutorizado ? c.accentSoft : c.dangerSoft, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                          {esAutorizado ? 'AUTORIZADO' : 'RECHAZADO'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: c.textMuted, fontWeight: '600' }}>Fecha: {p.fecha_permiso}</span>
                    </div>
                    {p.asunto_motivo && p.asunto_motivo.includes('[') && (
                      <span style={{ background: c.accentSoft, color: c.accent, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                        {p.asunto_motivo.substring(p.asunto_motivo.indexOf('[') + 1, p.asunto_motivo.indexOf(']'))}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: c.text, lineHeight: '1.5' }}>
                    {p.asunto_motivo && p.asunto_motivo.includes(']') ? p.asunto_motivo.substring(p.asunto_motivo.indexOf(']') + 1).trim() : p.asunto_motivo}
                    {p.observaciones && <div style={{ fontSize: '12px', color: c.textMuted, marginTop: '4px', background: c.surface, padding: '6px 8px', borderRadius: '6px' }}>{p.observaciones}</div>}
                  </div>

                  <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {renderSelloArea('Jefatura', p.firma_1_estado)}
                      {renderSelloArea('Gerencia', p.firma_2_estado)}
                      {renderSelloArea('R. Humanos', p.firma_3_estado)}
                    </div>
                  </div>

                  <div style={{ marginTop: '4px', borderTop: `1px dashed ${c.border}`, paddingTop: '10px' }}>
                    <span style={{ fontSize: '10.5px', color: c.textSubtle, fontWeight: '700' }}>REF: {p.folio}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
