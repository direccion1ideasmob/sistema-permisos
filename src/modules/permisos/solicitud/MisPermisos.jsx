import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { obtenerPermisosUsuario, escalarPermisoAGerencia } from '../services/permisosService';
import { obtenerTemaPermisos, generarEstilosPermisos } from '../permisosStyles';
import { parsearDatosObservaciones, limpiarMotivo } from '../historial/TablaHistorial';
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
      config = { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.3)', color: '#16a34a', texto: 'APROBADO', icono: <ShieldCheck size={13} /> };
    } else if (['escalado', 'omitido'].includes(est)) {
      config = { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)', color: '#2563eb', texto: est === 'escalado' ? 'ESCALADO' : 'NO APLICA', icono: <FastForward size={13} /> };
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
          <p style={{ fontSize: '12px', color: c.textMuted, margin: '4px 0 0 0' }}>Estatus de autorización y sellos de vigilancia.</p>
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
              const { horarioSolicitado, supervisorSubarea } = parsearDatosObservaciones(p.observaciones);
              const { categoria, texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);

              return (
                <div key={p.id} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: modoOscuro ? '0 4px 15px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: c.text, textTransform: 'uppercase' }}>{p.tipo_permiso}</span>
                      <span style={{ fontSize: '12px', color: c.textMuted, fontWeight: '600' }}>
                        Fecha: {p.fecha_permiso}{p.fecha_fin && p.fecha_fin !== p.fecha_permiso ? ` al ${p.fecha_fin}` : ''} • {horarioSolicitado}
                      </span>
                    </div>
                    {categoria && (
                      <span style={{ background: c.accentSoft, color: c.accent, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                        {categoria}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: c.text, lineHeight: '1.45' }}>
                    {motivoLimpio}
                    {supervisorSubarea && (
                      <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: '700', marginTop: '6px' }}>
                        ✓ Avalado por Supervisor de Subárea: {supervisorSubarea}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {renderSelloArea('Jefatura', p.firma_1_estado)}
                      {renderSelloArea('Gerencia', p.firma_2_estado)}
                      {renderSelloArea('R. Humanos', p.firma_3_estado)}
                    </div>
                  </div>

                  {puedeEscalar && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px', borderTop: `1px dashed ${c.border}`, paddingTop: '10px' }}>
                      <button onClick={() => escalarPermiso(p)} disabled={procesandoEscalamiento} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={13} /> {procesandoEscalamiento ? 'Escalando...' : 'Escalar por inactividad'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {finalizados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: c.surfaceCard, borderRadius: '12px', border: `1px dashed ${c.border}` }}>
              <p style={{ fontSize: '12px', color: c.textMuted, margin: 0 }}>No tienes historial de pases concluidos.</p>
            </div>
          ) : (
            finalizados.map(p => {
              const esAutorizado = ['autorizado', 'aprobado', 'completado_caseta'].includes(p.estado_general);
              const { horarioSolicitado, horaSalidaCaseta, horaEntradaCaseta, motivoRechazo } = parsearDatosObservaciones(p.observaciones);
              const { categoria, texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);

              return (
                <div key={p.id} style={{ background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: modoOscuro ? '0 4px 15px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {esAutorizado && p.folio && !p.folio.startsWith('REQ-') && !p.folio.startsWith('CAS-') && (
                          <span style={{ fontFamily: 'monospace', fontSize: '11.5px', fontWeight: '900', color: c.accent, background: c.accentSoft, padding: '2px 7px', borderRadius: '5px' }}>
                            {p.folio}
                          </span>
                        )}
                        <span style={{ fontSize: '13px', fontWeight: '800', color: c.text, textTransform: 'uppercase' }}>{p.tipo_permiso}</span>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: esAutorizado ? c.accent : c.danger, background: esAutorizado ? c.accentSoft : c.dangerSoft, padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>
                          {esAutorizado ? (p.pago || 'AUTORIZADO') : 'RECHAZADO'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: c.textMuted, fontWeight: '600' }}>
                        Fecha: {p.fecha_permiso}{p.fecha_fin && p.fecha_fin !== p.fecha_permiso ? ` al ${p.fecha_fin}` : ''} • {horarioSolicitado}
                      </span>
                    </div>

                    {categoria && (
                      <span style={{ background: c.accentSoft, color: c.accent, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                        {categoria}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: c.text, lineHeight: '1.45' }}>
                    {motivoLimpio}
                  </div>

                  {(horaSalidaCaseta || horaEntradaCaseta) && (
                    <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#16a34a', background: 'rgba(22,163,74,0.08)', padding: '6px 10px', borderRadius: '7px', display: 'inline-flex', gap: '12px', width: 'fit-content' }}>
                      {horaSalidaCaseta && <span>✓ Salida Caseta: {horaSalidaCaseta}</span>}
                      {horaEntradaCaseta && <span>✓ Entrada Caseta: {horaEntradaCaseta}</span>}
                    </div>
                  )}

                  {!esAutorizado && motivoRechazo && (
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '6px 10px', borderRadius: '7px' }}>
                      Motivo de rechazo: {motivoRechazo}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
