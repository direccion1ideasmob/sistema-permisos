import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { registrarSuscripcionPush } from '../services/notificaciones';

import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../components/aprobaciones/aprobacionesStyles';
import TarjetaAprobacion from '../components/aprobaciones/TarjetaAprobacion';
import ModalDictamenAprobar from '../components/aprobaciones/ModalDictamenAprobar';
import ModalRechazoPermiso from '../components/aprobaciones/ModalRechazoPermiso';
import { CheckCircle2, Clock } from 'lucide-react';

export default function Aprobaciones() {
  const { usuario } = useAuth();
  const [tabActiva, setTabActiva] = useState('pendientes'); // 'pendientes' | 'historial'
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // Modales
  const [solicitudAprobar, setSolicitudAprobar] = useState(null);
  const [solicitudRechazar, setSolicitudRechazar] = useState(null);

  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaAprobaciones(modoOscuro);

  // Notificar al empleado por Push
  const notificarEmpleado = async (empleadoId, titulo, mensaje) => {
    try {
      const { data: subs } = await supabase
        .from('suscripciones_push')
        .select('subscription')
        .eq('usuario_id', empleadoId);

      if (subs && subs.length > 0) {
        subs.forEach(async (item) => {
          try {
            await fetch('/api/notificar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subscription: item.subscription,
                titulo,
                mensaje
              })
            });
          } catch (_) {}
        });
      }
    } catch (_) {}
  };

  // Cargar solicitudes de forma limpia y blindada
  const cargarSolicitudes = useCallback(async () => {
    if (!usuario?.id) return;
    setCargando(true);

    try {
      // Consulta protegida: no busca departamento_id en permisos para no causar error 400
      const { data, error } = await supabase
        .from('permisos')
        .select(`
          *,
          usuarios:usuario_id (
            id,
            numero_empleado,
            nombre_completo,
            area,
            puesto,
            foto_url,
            departamento_id,
            departamentos:departamento_id (id, nombre, clasificacion)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSolicitudes(data || []);
    } catch (err) {
      console.error("Error al cargar aprobaciones:", err);
    } finally {
      setCargando(false);
    }
  }, [usuario?.id]);

  useEffect(() => {
    if (usuario?.id) {
      cargarSolicitudes();
      // Registrar suscripción push silenciosamente
      registrarSuscripcionPush().then(sub => {
        if (sub) {
          supabase.from('suscripciones_push').upsert([{ usuario_id: usuario.id, subscription: sub, endpoint: sub.endpoint }], { onConflict: 'endpoint' });
        }
      });
    }
  }, [usuario?.id, cargarSolicitudes]);

  // AUTORIZAR PERMISO CON DICTAMEN DE PAGO
  const ejecutarAprobacion = async (solicitud, dictamenPago, comentarios) => {
    setProcesando(true);
    try {
      const esJefeDepto = usuario.rol === 'jefe_area' && (solicitud.firma_1_id === usuario.id || solicitud.usuarios?.departamento_id === usuario.departamento_id);
      const esGerente = solicitud.firma_2_id === usuario.id;
      const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh';

      const updates = { pago: dictamenPago };

      if (esJefeDepto) {
        updates.firma_1_estado = 'autorizado';
        // Si el permiso no tenía firma_1_id grabado, le estampa el ID real del jefe que lo aprobó
        if (!solicitud.firma_1_id) updates.firma_1_id = usuario.id;
      }
      if (esGerente) {
        updates.firma_2_estado = 'autorizado';
      }
      if (esRH) {
        updates.firma_3_estado = 'autorizado';
        updates.estado_general = 'autorizado';
        if (!solicitud.firma_3_id) updates.firma_3_id = usuario.id;
      }

      if (comentarios && comentarios.trim()) {
        updates.observaciones = `${solicitud.observaciones || ''} | Res: ${comentarios.trim()}`;
      }

      const { error } = await supabase
        .from('permisos')
        .update(updates)
        .eq('id', solicitud.id);

      if (error) throw error;

      // Notificar al empleado por Web Push
      await notificarEmpleado(
        solicitud.usuario_id,
        '✅ PERMISO AUTORIZADO',
        `Tu solicitud (${solicitud.folio}) fue autorizada con dictamen: "${dictamenPago}".`
      );

      setSolicitudAprobar(null);
      await cargarSolicitudes();
    } catch (err) {
      alert("Error al autorizar: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  // RECHAZAR PERMISO CON MOTIVO OBLIGATORIO
  const ejecutarRechazo = async (solicitud, motivoRechazo) => {
    setProcesando(true);
    try {
      const { error } = await supabase
        .from('permisos')
        .update({
          firma_1_estado: 'rechazado',
          estado_general: 'rechazado',
          observaciones: `${solicitud.observaciones || ''} | RECHAZO: ${motivoRechazo}`
        })
        .eq('id', solicitud.id);

      if (error) throw error;

      // Notificar al empleado por Web Push
      await notificarEmpleado(
        solicitud.usuario_id,
        '❌ PERMISO RECHAZADO',
        `Tu solicitud (${solicitud.folio}) fue rechazada. Motivo: ${motivoRechazo}`
      );

      setSolicitudRechazar(null);
      await cargarSolicitudes();
    } catch (err) {
      alert("Error al rechazar: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  // FILTRADO INTELIGENTE: Qué solicitudes corresponden a este usuario
  const solicitudesDelUsuario = solicitudes.filter(s => {
    // Si es RH, ve absolutamente todo lo que esté en el sistema
    if (usuario?.rol === 'rh_nominas' || usuario?.rol === 'gerente_rh') return true;

    // Si es Jefe de Área, ve los permisos donde sea la firma 1 O los permisos de gente de su mismo departamento
    if (usuario?.rol === 'jefe_area') {
      if (s.firma_1_id === usuario.id) return true;
      if (s.usuarios?.departamento_id && s.usuarios.departamento_id === usuario.departamento_id) return true;
    }

    // Si es Gerente
    if (s.firma_2_id === usuario?.id) return true;

    return false;
  });

  // Separar en Pendientes vs Historial
  const solicitudesPendientes = solicitudesDelUsuario.filter(s => {
    if (s.estado_general === 'rechazado' || s.estado_general === 'autorizado') return false;

    const esJefeDepto = usuario?.rol === 'jefe_area' && (s.firma_1_id === usuario.id || s.usuarios?.departamento_id === usuario.departamento_id);
    const esGerente = s.firma_2_id === usuario?.id;
    const esRH = s.firma_3_id === usuario?.id || usuario?.rol === 'rh_nominas' || usuario?.rol === 'gerente_rh';

    if (esJefeDepto && s.firma_1_estado === 'pendiente') return true;
    if (esGerente && s.firma_2_estado === 'pendiente') return true;
    if (esRH && s.firma_3_estado === 'pendiente') return true;

    return false;
  });

  const solicitudesHistorial = solicitudesDelUsuario.filter(s => !solicitudesPendientes.some(p => p.id === s.id));
  const listadoActual = tabActiva === 'pendientes' ? solicitudesPendientes : solicitudesHistorial;

  return (
    <div className="aprobaciones-container">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

      {/* PESTAÑAS: PENDIENTES VS HISTORIAL */}
      <div className="tabs-aprobacion-bar">
        <button
          onClick={() => setTabActiva('pendientes')}
          className={`tab-btn ${tabActiva === 'pendientes' ? 'active' : ''}`}
        >
          <Clock size={14} />
          <span>Pendientes de mi firma</span>
          {solicitudesPendientes.length > 0 && (
            <span style={{ background: c.accent, color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
              {solicitudesPendientes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTabActiva('historial')}
          className={`tab-btn ${tabActiva === 'historial' ? 'active' : ''}`}
        >
          <CheckCircle2 size={14} />
          <span>Historial de Aprobadas / Rechazadas</span>
        </button>
      </div>

      {/* LISTADO DE SOLICITUDES */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '30px', color: c.textMuted, fontSize: '12px' }}>
          Cargando solicitudes...
        </div>
      ) : listadoActual.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: c.textMuted, fontSize: '13px' }}>
          {tabActiva === 'pendientes' ? 'No tienes solicitudes pendientes de firma.' : 'No hay historial de pases revisados.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {listadoActual.map(solicitud => (
            <TarjetaAprobacion
              key={solicitud.id}
              solicitud={solicitud}
              esPendiente={tabActiva === 'pendientes'}
              onAprobar={(sol) => setSolicitudAprobar(sol)}
              onRechazar={(sol) => setSolicitudRechazar(sol)}
              c={c}
              modoOscuro={modoOscuro}
            />
          ))}
        </div>
      )}

      {/* MODAL DE DICTAMEN DE PAGO (AL APROBAR) */}
      <ModalDictamenAprobar
        solicitud={solicitudAprobar}
        usuarioFirmante={usuario}
        onClose={() => setSolicitudAprobar(null)}
        onConfirmarAprobacion={ejecutarAprobacion}
        procesando={procesando}
        c={c}
        modoOscuro={modoOscuro}
      />

      {/* MODAL DE RECHAZO CON MOTIVO OBLIGATORIO */}
      <ModalRechazoPermiso
        solicitud={solicitudRechazar}
        onClose={() => setSolicitudRechazar(null)}
        onConfirmarRechazo={ejecutarRechazo}
        procesando={procesando}
        c={c}
      />
    </div>
  );
}