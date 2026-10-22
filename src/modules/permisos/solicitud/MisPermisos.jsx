import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { obtenerPermisosUsuario, escalarPermisoAGerencia } from '../services/permisosService';
import { obtenerTemaPermisos, generarEstilosPermisos } from '../permisosStyles';
import { parsearDatosObservaciones, limpiarMotivo } from '../historial/TablaHistorial';
import { Clock, CheckCircle2, FileText, AlertTriangle, ShieldCheck, XCircle, FastForward, MessageSquare, DoorOpen, CornerUpLeft } from 'lucide-react';

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
    let config = {
      bg: modoOscuro ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
      border: c.border,
      color: c.textMuted,
      texto: 'EN REVISIÓN',
      icono: <Clock size={15} />
    };

    if (['autorizado', 'auto_aprobado', 'aprobado'].includes(est)) {
      config = {
        bg: 'rgba(34, 197, 94, 0.09)',
        border: 'rgba(34, 197, 94, 0.35)',
        color: '#16a34a',
        texto: 'APROBADO',
        icono: <ShieldCheck size={16} />
      };
    } else if (['escalado', 'omitido'].includes(est)) {
      config = {
        bg: 'rgba(59, 130, 246, 0.09)',
        border: 'rgba(59, 130, 246, 0.35)',
        color: '#2563eb',
        texto: est === 'escalado' ? 'ESCALADO' : 'NO APLICA',
        icono: <FastForward size={16} />
      };
    } else if (est === 'rechazado') {
      config = {
        bg: 'rgba(239, 68, 68, 0.09)',
        border: 'rgba(239, 68, 68, 0.35)',
        color: '#dc2626',
        texto: 'RECHAZADO',
        icono: <XCircle size={16} />
      };
    }

    return (
      <div style={{
        padding: '14px 12px',
        borderRadius: '12px',
        background: config.bg,
        border: `1.5px solid ${config.border}`,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ fontSize: '12px', fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {nombreArea}
        </span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: config.color, fontSize: '13.5px', fontWeight: '900' }}>
          {config.icono}<span>{config.texto}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="permisos-container" style={{ maxWidth: '1020px', margin: '0 auto', padding: '22px 24px', boxSizing: 'border-box' }}>
      <style>{generarEstilosPermisos(c, modoOscuro)}</style>

      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '23px', fontWeight: '800', color: c.text, margin: 0, letterSpacing: '-0.01em' }}>Mis Solicitudes de Pase</h2>
          <p style={{ fontSize: '14px', color: c.textMuted, margin: '4px 0 0 0', fontWeight: '500' }}>Estatus de autorización, comentarios y sellos de vigilancia.</p>
        </div>

        <div style={{ display: 'flex', background: c.surfaceCard, padding: '5px', borderRadius: '12px', border: `1.5px solid ${c.border}`, gap: '4px' }}>
          <button
            onClick={() => setPestaña('proceso')}
            style={{
              padding: '10px 18px', borderRadius: '9px', border: 'none',
              background: pestaña === 'proceso' ? c.accent : 'transparent',
              color: pestaña === 'proceso' ? '#ffffff' : c.textMuted,
              fontSize: '14px', fontWeight: '800', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s'
            }}
          >
            <Clock size={16} /> En Proceso ({enProceso.length})
          </button>
          <button
            onClick={() => setPestaña('historial')}
            style={{
              padding: '10px 18px', borderRadius: '9px', border: 'none',
              background: pestaña === 'historial' ? c.accent : 'transparent',
              color: pestaña === 'historial' ? '#ffffff' : c.textMuted,
              fontSize: '14px', fontWeight: '800', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s'
            }}
          >
            <FileText size={16} /> Concluidos ({finalizados.length})
          </button>
        </div>
      </div>

      {cargandoHistorial ? (
        <div style={{ padding: '40px', textAlign: 'center', color: c.textMuted, fontSize: '15px', fontWeight: '600' }}>
          Cargando solicitudes...
        </div>
      ) : pestaña === 'proceso' ? (
        enProceso.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '54px 24px', background: c.surfaceCard, borderRadius: '16px', border: `1.5px dashed ${c.border}` }}>
            <CheckCircle2 size={44} color={c.accent} style={{ marginBottom: '10px', opacity: 0.7 }} />
            <h4 style={{ margin: '0 0 6px 0', color: c.text, fontSize: '17px', fontWeight: '800' }}>Sin solicitudes en curso</h4>
            <p style={{ fontSize: '14px', color: c.textMuted, margin: 0 }}>Tus pases activos o en revisión aparecerán aquí.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {enProceso.map(p => {
              const horasTranscurridas = (horaActual - new Date(p.created_at)) / (1000 * 60 * 60);
              const puedeEscalar = p.firma_1_estado === 'pendiente' && horasTranscurridas >= 1;
              const { horarioSolicitado, supervisorSubarea, notasFlujo } = parsearDatosObservaciones(p.observaciones);
              const { categoria, texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);

              return (
                <div
                  key={p.id}
                  style={{
                    background: c.surfaceCard,
                    border: `1.5px solid ${c.border}`,
                    borderRadius: '16px',
                    padding: '22px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: modoOscuro ? '0 4px 18px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: c.text, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        {p.tipo_permiso}
                      </span>
                      <span style={{ fontSize: '14px', color: c.textMuted, fontWeight: '600' }}>
                        Fecha: <strong style={{ color: c.text }}>{p.fecha_permiso}{p.fecha_fin && p.fecha_fin !== p.fecha_permiso ? ` al ${p.fecha_fin}` : ''}</strong> • {horarioSolicitado}
                      </span>
                    </div>
                    {categoria && (
                      <span style={{ background: c.accentSoft, color: c.accent, padding: '6px 14px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '800' }}>
                        {categoria}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '15px', color: c.text, lineHeight: '1.5', background: c.bg, padding: '12px 16px', borderRadius: '10px', border: `1px solid ${c.border}` }}>
                    {motivoLimpio}
                    {supervisorSubarea && (
                      <div style={{ fontSize: '13.5px', color: '#16a34a', fontWeight: '700', marginTop: '8px' }}>
                        ✓ Avalado por Supervisor de Subárea: {supervisorSubarea}
                      </div>
                    )}
                    {notasFlujo && notasFlujo.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${c.border}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {notasFlujo.map((n, i) => (
                          <div key={i} style={{ fontSize: '13.5px', color: c.text }}>
                            <strong style={{ color: c.accent }}>Nota {n.autor}:</strong> {n.texto}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    {renderSelloArea('Jefatura', p.firma_1_estado)}
                    {renderSelloArea('Gerencia', p.firma_2_estado)}
                    {renderSelloArea('R. Humanos', p.firma_3_estado)}
                  </div>

                  {puedeEscalar && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px', borderTop: `1px dashed ${c.border}`, paddingTop: '12px' }}>
                      <button
                        onClick={() => escalarPermiso(p)}
                        disabled={procesandoEscalamiento}
                        style={{
                          padding: '9px 16px', borderRadius: '8px', border: 'none',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706',
                          fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <AlertTriangle size={15} /> {procesandoEscalamiento ? 'Escalando...' : 'Escalar por inactividad'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {finalizados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '54px 24px', background: c.surfaceCard, borderRadius: '16px', border: `1.5px dashed ${c.border}` }}>
              <p style={{ fontSize: '14.5px', color: c.textMuted, margin: 0, fontWeight: '600' }}>No tienes historial de pases concluidos.</p>
            </div>
          ) : (
            finalizados.map(p => {
              const esAutorizado = ['autorizado', 'aprobado', 'completado_caseta'].includes(p.estado_general);
              const seRegreso = (p.pago || '').toLowerCase().includes('regresa');
              const { horarioSolicitado, horaSalidaCaseta, horaEntradaCaseta, horaRegresadoCaseta, motivoRechazo, notasFlujo } = parsearDatosObservaciones(p.observaciones);
              const { categoria, texto: motivoLimpio } = limpiarMotivo(p.asunto_motivo);

              return (
                <div
                  key={p.id}
                  style={{
                    background: c.surfaceCard,
                    border: `1.5px solid ${c.border}`,
                    borderRadius: '16px',
                    padding: '20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: modoOscuro ? '0 4px 18px rgba(0,0,0,0.25)' : '0 2px 10px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {esAutorizado && p.folio && !p.folio.startsWith('REQ-') && !p.folio.startsWith('CAS-') && (
                          <span style={{
                            fontFamily: 'ui-monospace, monospace', fontSize: '13.5px', fontWeight: '900',
                            color: c.accent, background: c.accentSoft, padding: '3px 10px', borderRadius: '6px'
                          }}>
                            {p.folio}
                          </span>
                        )}
                        <span style={{ fontSize: '16px', fontWeight: '800', color: c.text, textTransform: 'uppercase' }}>
                          {p.tipo_permiso}
                        </span>
                        <span style={{
                          fontSize: '12px', fontWeight: '800',
                          color: !esAutorizado ? c.danger : seRegreso ? '#d97706' : c.accent,
                          background: !esAutorizado ? c.dangerSoft : seRegreso ? 'rgba(245,158,11,0.15)' : c.accentSoft,
                          padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase'
                        }}>
                          {esAutorizado ? (p.pago || 'AUTORIZADO') : 'RECHAZADO'}
                        </span>
                      </div>
                      <span style={{ fontSize: '14px', color: c.textMuted, fontWeight: '600' }}>
                        Fecha: <strong style={{ color: c.text }}>{p.fecha_permiso}{p.fecha_fin && p.fecha_fin !== p.fecha_permiso ? ` al ${p.fecha_fin}` : ''}</strong> • {horarioSolicitado}
                      </span>
                    </div>

                    {categoria && (
                      <span style={{ background: c.accentSoft, color: c.accent, padding: '6px 14px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '800' }}>
                        {categoria}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '15px', color: c.text, lineHeight: '1.5' }}>
                    {motivoLimpio}
                  </div>

                  {notasFlujo && notasFlujo.length > 0 && (
                    <div style={{
                      fontSize: '13.5px', color: c.text, background: c.bg,
                      padding: '10px 14px', borderRadius: '9px', border: `1px solid ${c.border}`,
                      display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      {notasFlujo.map((n, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MessageSquare size={14} color={c.accent} />
                          <span><strong style={{ color: c.accent }}>Nota {n.autor}:</strong> {n.texto}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(horaSalidaCaseta || horaEntradaCaseta || horaRegresadoCaseta) && (
                    <div style={{
                      fontSize: '13.5px', fontWeight: '800',
                      color: seRegreso ? '#d97706' : '#16a34a',
                      background: seRegreso ? 'rgba(245,158,11,0.12)' : 'rgba(22,163,74,0.09)',
                      padding: '8px 14px', borderRadius: '8px',
                      display: 'inline-flex', alignItems: 'center', gap: '16px', width: 'fit-content'
                    }}>
                      {horaSalidaCaseta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><DoorOpen size={15} /> Salida Caseta: {horaSalidaCaseta}</span>}
                      {horaEntradaCaseta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><DoorOpen size={15} /> Entrada Caseta: {horaEntradaCaseta}</span>}
                      {horaRegresadoCaseta && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><CornerUpLeft size={15} /> Regresado en puerta: {horaRegresadoCaseta}</span>}
                    </div>
                  )}

                  {!esAutorizado && motivoRechazo && (
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#ef4444', background: 'rgba(239,68,68,0.09)', padding: '9px 14px', borderRadius: '8px' }}>
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
