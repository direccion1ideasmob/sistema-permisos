import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { registrarSuscripcionPush } from '../services/notificaciones';

import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../components/aprobaciones/aprobacionesStyles';
import TarjetaAprobacion from '../components/aprobaciones/TarjetaAprobacion';
import ModalDictamenAprobar from '../components/aprobaciones/ModalDictamenAprobar';
import ModalRechazoPermiso from '../components/aprobaciones/ModalRechazoPermiso';
import { CheckCircle2, Clock, Bell } from 'lucide-react';

export default function Aprobaciones() {
  const { usuario } = useAuth();
  const [tabActiva, setTabActiva] = useState('pendientes'); // 'pendientes' | 'historial'
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // Modales
  const [solicitudAprobar, setSolicitudAprobar] = useState(null);
  const [solicitudRechazar, setSolicitudRechazar] = useState(null);

  const [dispositivoVinculado, setDispositivoVinculado] = useState(false);

  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaAprobaciones(modoOscuro);

  // Vinculación manual táctil (Obligatoria para que Chrome móvil no bloquee el aviso)
  const vincularDispositivoManual = async () => {
    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }

      const sub = await registrarSuscripcionPush();
      
      if (!sub) {
        alert("No se otorgaron permisos de notificación en el navegador.");
        return;
      }

      // 2. USAMOS UPSERT: Si el dispositivo es nuevo, lo guarda. 
      // Si el dispositivo ya existía (mismo endpoint), solo lo actualiza sin duplicarlo.
      const { error } = await supabase
        .from('suscripciones_push')
        .upsert(
          { 
            usuario_id: usuario.id, 
            subscription: sub, 
            endpoint: sub.endpoint 
          }, 
          { onConflict: 'endpoint' } // <- Este es el truco gracias a tu tabla
        );

      if (error) throw error;

      // El botón desaparece inmediatamente de la pantalla
      setDispositivoVinculado(true);
      alert("✅ ¡Teléfono vinculado con éxito! Las alertas ya sonarán aquí.");
    } catch (err) {
      alert("Error al vincular: " + err.message);
    }
  };

  // Notificar al empleado por Push a su celular
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
                mensaje,
                urlDestino: '/mis-permisos' // <-- LA PIEZA CLAVE
              })
            });
          } catch (_) {}
        });
      }
    } catch (_) {}
  };

  // Cargar solicitudes relacionadas con este usuario firmante
  const cargarSolicitudes = useCallback(async () => {
    if (!usuario?.id) return;
    setCargando(true);

    try {
      // Consulta blindada: pide departamento a través de usuarios para no causar error 400
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
    }
  }, [usuario?.id, cargarSolicitudes]);

  // AUTORIZAR PERMISO CON DICTAMEN DE PAGO (EFECTO DOMINÓ)
  const ejecutarAprobacion = async (solicitud, dictamenPago, comentarios) => {
    setProcesando(true);
    try {
      const esJefeDepto = usuario.rol === 'jefe_area' && (solicitud.firma_1_id === usuario.id || solicitud.usuarios?.departamento_id === usuario.departamento_id);
      const esGerente = solicitud.firma_2_id === usuario.id;
      const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh';

      const updates = { pago: dictamenPago };
      let siguientesEnFirmar = []; // Array de IDs a los que notificar

      if (esJefeDepto) {
        updates.firma_1_estado = 'autorizado';
        if (!solicitud.firma_1_id) updates.firma_1_id = usuario.id;
        
        // EFECTO DOMINÓ 1: Jefe aprueba -> Notifica al Gerente
        if (solicitud.firma_2_id) siguientesEnFirmar.push(solicitud.firma_2_id);
      }
      if (esGerente) {
        updates.firma_2_estado = 'autorizado';
        
        // EFECTO DOMINÓ 2: Gerente aprueba -> Notifica a Recursos Humanos
        if (solicitud.firma_3_id) {
            siguientesEnFirmar.push(solicitud.firma_3_id);
        } else {
            // Si por alguna razón no tiene firma_3_id asignado, buscamos a los de RH genéricos
            const { data: rhUsers } = await supabase
                .from('usuarios')
                .select('id')
                .in('rol', ['gerente_rh', 'rh_nominas']);
            if (rhUsers) {
                siguientesEnFirmar = [...siguientesEnFirmar, ...rhUsers.map(u => u.id)];
            }
        }
      }
      if (esRH) {
        updates.firma_3_estado = 'autorizado';
        updates.estado_general = 'autorizado';
        if (!solicitud.firma_3_id) updates.firma_3_id = usuario.id;
        // RH es el último eslabón, no notifica a nadie más hacia arriba.
      }

      if (comentarios && comentarios.trim()) {
        updates.observaciones = `${solicitud.observaciones || ''} | Res: ${comentarios.trim()}`;
      }

      const { error } = await supabase
        .from('permisos')
        .update(updates)
        .eq('id', solicitud.id);

      if (error) throw error;

      // 1. Notificar al Empleado (SOLO SI ES EL DICTAMEN FINAL DE RH)
      if (esRH) {
        const tipoPase = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
        await notificarEmpleado(
          solicitud.usuario_id,
          `✅ ${tipoPase} Autorizado`,
          `Dictamen: ${dictamenPago}`
        );
      }

      // 2. Disparar notificaciones en cadena al siguiente jefe (Efecto Dominó)
      if (siguientesEnFirmar.length > 0) {
        try {
            const { data: subs } = await supabase
                .from('suscripciones_push')
                .select('subscription')
                .in('usuario_id', siguientesEnFirmar);

            if (subs && subs.length > 0) {
                const nombreSolicitante = solicitud.usuarios?.nombre_completo || 'Un colaborador';
                const fotoSolicitante = solicitud.usuarios?.foto_url || null;

                // --- LÓGICA DE TEXTO LIMPIO ESTILO WHATSAPP ---
                const asuntoRaw = solicitud.asunto_motivo || '';
                const matchMotivo = asuntoRaw.match(/\[(.*?)\]\s*(.*)/);
                const naturalezaClean = matchMotivo ? matchMotivo[1] : '';
                const motivoLimpio = matchMotivo ? matchMotivo[2] : asuntoRaw;
                const tipoClean = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);

                const tituloNotifDomino = solicitud.tipo_permiso === 'vacaciones' ? 'Vacaciones' : `${tipoClean} (${naturalezaClean})`;
                const mensajeNotifDomino = `${nombreSolicitante}: "${motivoLimpio}"`;
                // ----------------------------------------------

                const envios = subs.map(async (item) => {
                    let subLimpia = item.subscription;
                    if (typeof subLimpia === 'string') {
                        try { subLimpia = JSON.parse(subLimpia); } catch (_) {}
                    }
                    const res = await fetch('/api/notificar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            subscription: subLimpia,
                            titulo: tituloNotifDomino,
                            mensaje: mensajeNotifDomino, 
                            fotoUrl: fotoSolicitante,
                            urlDestino: '/aprobaciones'
                        })
                    });
                    return res.json();
                });
                await Promise.allSettled(envios);
            }
        } catch (errPush) {
            console.error("Error lanzando notificaciones en cadena:", errPush);
        }
      }

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
      const esJefeDepto = usuario.rol === 'jefe_area' && (solicitud.firma_1_id === usuario.id || solicitud.usuarios?.departamento_id === usuario.departamento_id);
      const esGerente = solicitud.firma_2_id === usuario.id;
      const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh';

      const updates = {
        estado_general: 'rechazado',
        observaciones: `${solicitud.observaciones || ''} | RECHAZO: ${motivoRechazo}`
      };

      // Identificamos quién está rechazando para marcar SU firma específica como rechazada
      if (esRH && solicitud.firma_3_estado === 'pendiente') {
        updates.firma_3_estado = 'rechazado';
        if (!solicitud.firma_3_id) updates.firma_3_id = usuario.id;
      } else if (esGerente && solicitud.firma_2_estado === 'pendiente') {
        updates.firma_2_estado = 'rechazado';
      } else if (esJefeDepto && solicitud.firma_1_estado === 'pendiente') {
        updates.firma_1_estado = 'rechazado';
        if (!solicitud.firma_1_id) updates.firma_1_id = usuario.id;
      } else {
        // Fallback por seguridad
        updates.firma_1_estado = 'rechazado';
      }

      const { error } = await supabase
        .from('permisos')
        .update(updates)
        .eq('id', solicitud.id);

      if (error) throw error;

      // --- NOTIFICACIÓN DE RECHAZO AL EMPLEADO ---
      const tipoPaseR = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
      await notificarEmpleado(
        solicitud.usuario_id,
        `❌ ${tipoPaseR} Rechazado`,
        `Motivo: ${motivoRechazo}`
      );

      setSolicitudRechazar(null);
      await cargarSolicitudes();
    } catch (err) {
      alert("Error al rechazar: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  // Filtrado de solicitudes para este usuario
  const solicitudesDelUsuario = solicitudes.filter(s => {
    if (usuario?.rol === 'rh_nominas' || usuario?.rol === 'gerente_rh') return true;

    if (usuario?.rol === 'jefe_area') {
      if (s.firma_1_id === usuario.id) return true;
      if (s.usuarios?.departamento_id && s.usuarios.departamento_id === usuario.departamento_id) return true;
    }

    if (s.firma_2_id === usuario?.id) return true;

    return false;
  });

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

      {/* BOTÓN DE ACTIVACIÓN: Aparecerá siempre que el celular no tenga el permiso concedido */}
      {!dispositivoVinculado && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            onClick={vincularDispositivoManual}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '20px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid #f59e0b',
              color: '#f59e0b', fontSize: '11px', fontWeight: '800', cursor: 'pointer'
            }}
          >
            <Bell size={12} /> Activar notificaciones en este celular
          </button>
        </div>
      )}

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