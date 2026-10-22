import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  obtenerPermisoPorId, 
  autorizarPermisoDirectoJefatura, 
  rechazarPermisoDirectoJefatura 
} from '../services/permisosService';
import { 
  CheckCircle2, XCircle, Clock, ShieldCheck, Check, X, AlertCircle, UserCog
} from 'lucide-react';

export default function AprobarDirecto() {
  const [searchParams] = useSearchParams();
  const permisoId = searchParams.get('id') || searchParams.get('folio');

  const [permiso, setPermiso] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mensajeResultado, setMensajeResultado] = useState(null);

  const [modoRechazo, setModoRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const cargarPermiso = useCallback(async () => {
    if (!permisoId) {
      setMensajeResultado({ tipo: 'error', texto: 'Enlace incompleto: No se proporcionó el identificador del permiso.' });
      setCargando(false);
      return;
    }

    setCargando(true);
    try {
      const data = await obtenerPermisoPorId(permisoId);

      if (data.firma_1_estado === 'autorizado') {
        setMensajeResultado({
          tipo: 'info',
          texto: `Esta solicitud (${data.folio}) ya fue autorizada por Jefatura.`
        });
      } else if (data.estado_general === 'rechazado' || data.firma_1_estado === 'rechazado') {
        setMensajeResultado({
          tipo: 'info',
          texto: `Esta solicitud (${data.folio}) ya fue rechazada previamente.`
        });
      }

      setPermiso(data);
    } catch (err) {
      setMensajeResultado({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }, [permisoId]);

  useEffect(() => {
    cargarPermiso();
  }, [cargarPermiso]);

  const resolverAprobacion = async (dictamenPago) => {
    setProcesando(true);
    try {
      const etiquetaNotificacion = await autorizarPermisoDirectoJefatura(permiso, dictamenPago);
      setMensajeResultado({
        tipo: 'exito',
        texto: `¡Pase ${permiso.folio} autorizado con éxito! Notificación enviada a ${etiquetaNotificacion}.`
      });
    } catch (err) {
      alert("Error al autorizar: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const resolverRechazo = async (e) => {
    e.preventDefault();
    if (!motivoRechazo.trim()) return alert("Por favor escribe el motivo del rechazo.");

    setProcesando(true);
    try {
      await rechazarPermisoDirectoJefatura(permiso, motivoRechazo);
      setMensajeResultado({ tipo: 'rechazado', texto: `El pase ${permiso.folio} ha sido rechazado.` });
    } catch (err) {
      alert("Error al rechazar: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const u = permiso?.usuarios || {};
  const urlFoto = u.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nombre_completo || 'U')}&background=16a34a&color=fff&bold=true`;

  const matchMotivo = (permiso?.asunto_motivo || '').match(/^\[(.*?)\]\s*(.*)/);
  const etiquetaMotivo = matchMotivo ? matchMotivo[1].trim() : '';
  const textoMotivo = matchMotivo ? matchMotivo[2].trim() : (permiso?.asunto_motivo || '');

  return (
    <div style={s.contenedor}>
      <div style={s.tarjeta}>
        <div style={s.header}>
          <img src="/LogoVerde-removebg-preview.png" alt="Logo" style={{ height: '32px', objectFit: 'contain' }} />
          <div style={s.subtituloHeader}>AUTORIZACIÓN RÁPIDA DE JEFATURA</div>
        </div>

        {cargando ? (
          <div style={{ padding: '40px', color: '#737373', fontSize: '13px' }}>Cargando solicitud...</div>
        ) : mensajeResultado ? (
          <div style={s.cajaResultado}>
            {mensajeResultado.tipo === 'exito' && <CheckCircle2 size={44} color="#16a34a" style={{ marginBottom: '10px' }} />}
            {mensajeResultado.tipo === 'rechazado' && <XCircle size={44} color="#ef4444" style={{ marginBottom: '10px' }} />}
            {mensajeResultado.tipo === 'info' && <ShieldCheck size={44} color="#3b82f6" style={{ marginBottom: '10px' }} />}
            {mensajeResultado.tipo === 'error' && <AlertCircle size={44} color="#ef4444" style={{ marginBottom: '10px' }} />}

            <div style={{ fontSize: '15px', fontWeight: '800', color: '#171717', marginBottom: '8px' }}>
              {mensajeResultado.texto}
            </div>
            <p style={{ fontSize: '11.5px', color: '#737373', margin: 0 }}>
              Ya puedes cerrar esta ventana en tu teléfono.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={s.bloqueUsuario}>
              <img src={urlFoto} alt="" style={s.avatar} />
              <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#171717' }}>{u.nombre_completo}</div>
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '700' }}>
                  #{u.numero_empleado} • {u.departamentos?.nombre || 'General'}
                </div>
                <div style={{ fontSize: '11px', color: '#737373' }}>
                  {u.puesto || u.area || 'Sin puesto'}
                </div>
              </div>
            </div>

            <div style={s.bloqueDetalle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e5e5', paddingBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#171717', textTransform: 'uppercase' }}>{permiso.tipo_permiso}</span>
                {etiquetaMotivo && (
                  <span style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '800' }}>
                    {etiquetaMotivo}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e5e5', paddingBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: '#737373', fontWeight: '700' }}>FECHA:</span>
                <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#171717' }}>{permiso.fecha_permiso}</span>
              </div>
              {permiso.observaciones && (
                <div style={{ fontSize: '11px', color: '#525252' }}>{permiso.observaciones}</div>
              )}
              <div style={{ fontSize: '12.5px', color: '#171717', fontWeight: '500', background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e5e5' }}>
                {textoMotivo}
              </div>
              <div style={{ fontSize: '10px', color: '#a3a3a3', fontWeight: '700', textAlign: 'right' }}>
                REF: {permiso.folio}
              </div>
            </div>

            {modoRechazo ? (
              <form onSubmit={resolverRechazo} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', textAlign: 'left' }}>
                  MOTIVO DEL RECHAZO *
                </label>
                <textarea 
                  required rows={2} autoFocus
                  placeholder="Explica brevemente por qué se rechaza..."
                  value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                  style={s.textarea}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => setModoRechazo(false)} style={s.btnSecundario}>Cancelar</button>
                  <button type="submit" disabled={procesando} style={s.btnConfirmarRechazo}>
                    {procesando ? 'Rechazando...' : 'Confirmar Rechazo'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#737373', textTransform: 'uppercase' }}>
                  Toca una opción para autorizar y dictaminar:
                </div>

                <button onClick={() => resolverAprobacion('Con goce')} disabled={procesando} style={s.btnGoce}>
                  <Check size={16} /> Con Goce de Sueldo
                </button>

                <button onClick={() => resolverAprobacion('Sin goce')} disabled={procesando} style={s.btnSinGoce}>
                  <Clock size={16} /> Sin Goce (Deducción)
                </button>

                <button onClick={() => resolverAprobacion('Con tiempo')} disabled={procesando} style={s.btnTiempo}>
                  <Clock size={16} /> Reposición de Tiempo
                </button>

                <button onClick={() => resolverAprobacion('Pendiente')} disabled={procesando} style={s.btnSinGoce}>
                  <UserCog size={16} /> Delegar Dictamen a RH
                </button>

                <button onClick={() => setModoRechazo(true)} disabled={procesando} style={s.btnRechazar}>
                  <X size={15} /> Rechazar Solicitud
                </button>
              </div>
            )}
          </div>
        )}

        <div style={s.footer}>IDEAS MOBILIARIUM • CONTROL ERP</div>
      </div>
    </div>
  );
}

const s = {
  contenedor: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#171717', padding: '16px', boxSizing: 'border-box', fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' },
  tarjeta: { width: '100%', maxWidth: '400px', backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', textAlign: 'center', boxSizing: 'border-box' },
  header: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', borderBottom: '1px solid #e5e5e5', paddingBottom: '12px', marginBottom: '14px' },
  subtituloHeader: { fontSize: '10px', fontWeight: '800', color: '#737373', letterSpacing: '0.04em' },
  bloqueUsuario: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#fafafa', borderRadius: '10px', border: '1px solid #e5e5e5' },
  avatar: { width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #16a34a' },
  bloqueDetalle: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: '#fafafa', borderRadius: '10px', border: '1px solid #e5e5e5', textAlign: 'left' },
  cajaResultado: { padding: '30px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  btnGoce: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 3px 10px rgba(22, 163, 74, 0.25)' },
  btnSinGoce: { width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid #d4d4d4', backgroundColor: '#ffffff', color: '#171717', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  btnTiempo: { width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid #fde68a', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  btnRechazar: { width: '100%', padding: '9px', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', color: '#ef4444', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' },
  textarea: { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d4d4d4', fontSize: '12px', outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' },
  btnSecundario: { flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #d4d4d4', background: '#fff', color: '#737373', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' },
  btnConfirmarRechazo: { flex: 1, padding: '8px', borderRadius: '6px', border: 'none', backgroundColor: '#ef4444', color: '#fff', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' },
  footer: { fontSize: '9px', color: '#a3a3a3', letterSpacing: '0.04em', marginTop: '16px' }
};
