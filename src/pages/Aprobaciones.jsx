import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import { registrarSuscripcionPush } from '../services/notificaciones';

import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../components/aprobaciones/aprobacionesStyles';
import TarjetaAprobacion from '../components/aprobaciones/TarjetaAprobacion';
import ModalDictamenAprobar from '../components/aprobaciones/ModalDictamenAprobar';
import ModalRechazoPermiso from '../components/aprobaciones/ModalRechazoPermiso';
import TablaHistorial from '../components/aprobaciones/TablaHistorial';
import { CheckCircle2, Clock, Bell, Radar, FileCheck } from 'lucide-react';

export default function Aprobaciones() {
  const { usuario } = useAuth();
  const [tabActiva, setTabActiva] = useState('pendientes'); 
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [solicitudAprobar, setSolicitudAprobar] = useState(null);
  const [solicitudRechazar, setSolicitudRechazar] = useState(null);
  const [dispositivoVinculado, setDispositivoVinculado] = useState(false);

  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaAprobaciones(modoOscuro);

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

      const { error } = await supabase
        .from('suscripciones_push')
        .upsert(
          { usuario_id: usuario.id, subscription: sub, endpoint: sub.endpoint }, 
          { onConflict: 'endpoint' }
        );

      if (error) throw error;
      setDispositivoVinculado(true);
      alert("✅ ¡Teléfono vinculado con éxito!");
    } catch (err) {
      alert("Error al vincular: " + err.message);
    }
  };

  // FUNCION CORREGIDA: Parsea correctamente la suscripción del empleado para cerrar el círculo
  const notificarEmpleado = async (empleadoId, titulo, mensaje, ruta = '/mis-permisos') => {
    try {
      const { data: subs } = await supabase.from('suscripciones_push').select('subscription').eq('usuario_id', empleadoId);
      if (subs && subs.length > 0) {
        subs.forEach(async (item) => {
          try {
            let subLimpia = item.subscription;
            if (typeof subLimpia === 'string') {
              try { subLimpia = JSON.parse(subLimpia); } catch (_) {}
            }
            await fetch('/api/notificar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription: subLimpia, titulo, mensaje, urlDestino: ruta })
            });
          } catch (_) {}
        });
      }
    } catch (_) {}
  };

  const cargarSolicitudes = useCallback(async () => {
    if (!usuario?.id) return;
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('permisos')
        .select(`
          *,
          usuarios:usuario_id (
            id, numero_empleado, nombre_completo, area, puesto, foto_url, departamento_id,
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
    if (usuario?.id) cargarSolicitudes();
  }, [usuario?.id, cargarSolicitudes]);

  const generarFolioOficial = async (prefijoLetra, anio2Digitos) => {
    const patron = `${prefijoLetra}-${anio2Digitos}-%`;
    const { data } = await supabase
      .from('permisos')
      .select('folio')
      .ilike('folio', patron)
      .order('created_at', { ascending: false })
      .limit(1);

    let consecutivo = 1;
    if (data && data.length > 0 && data[0].folio) {
      const partes = data[0].folio.split('-');
      if (partes.length === 3) {
        const num = parseInt(partes[2], 10);
        if (!isNaN(num)) consecutivo = num + 1;
      }
    }
    return `${prefijoLetra}-${anio2Digitos}-${String(consecutivo).padStart(4, '0')}`;
  };

  const ejecutarAprobacion = async (solicitud, dictamenPago, comentarios) => {
    setProcesando(true);
    try {
      const esJefeDepto = usuario.rol === 'jefe_area' && (solicitud.firma_1_id === usuario.id || solicitud.usuarios?.departamento_id === usuario.departamento_id);
      const esGerente = solicitud.firma_2_id === usuario.id;
      const esRH = solicitud.firma_3_id === usuario.id || usuario.rol === 'rh_nominas' || usuario.rol === 'gerente_rh';

      const updates = { pago: dictamenPago };
      let siguientesEnFirmar = []; 
      let nuevoFolioGenerado = null;

      if (esJefeDepto) {
        updates.firma_1_estado = 'autorizado';
        if (!solicitud.firma_1_id) updates.firma_1_id = usuario.id;
        if (solicitud.firma_2_id) siguientesEnFirmar.push(solicitud.firma_2_id);
      }
      
      // LOGICA CORREGIDA: Al firmar Gerente, notifica a TODOS los roles de RH (gerente_rh y rh_nominas)
      if (esGerente) {
        updates.firma_2_estado = 'autorizado';
        
        const { data: rhUsers } = await supabase
          .from('usuarios')
          .select('id')
          .in('rol', ['gerente_rh', 'rh_nominas']);
          
        if (rhUsers && rhUsers.length > 0) {
          siguientesEnFirmar = [...siguientesEnFirmar, ...rhUsers.map(u => u.id)];
        }
        if (solicitud.firma_3_id && !siguientesEnFirmar.includes(solicitud.firma_3_id)) {
          siguientesEnFirmar.push(solicitud.firma_3_id);
        }
      }
      
      if (esRH) {
        updates.firma_3_estado = 'autorizado';
        updates.estado_general = 'autorizado';
        if (!solicitud.firma_3_id) updates.firma_3_id = usuario.id;

        const clasificacionDepto = (solicitud.usuarios?.departamentos?.clasificacion || 'produccion').toLowerCase();
        let letra = 'P';
        if (clasificacionDepto.includes('admin')) letra = 'A';
        else if (clasificacionDepto.includes('obra')) letra = 'O';
        
        const anio = new Date().getFullYear().toString().slice(-2);
        nuevoFolioGenerado = await generarFolioOficial(letra, anio);
        updates.folio = nuevoFolioGenerado;
      }

      if (comentarios && comentarios.trim()) {
        updates.observaciones = `${solicitud.observaciones || ''} | Res: ${comentarios.trim()}`;
      }

      const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
      if (error) throw error;

      // CIERRA EL CIRCULO: Notifica al trabajador de la autorización final
      if (esRH) {
        const tipoPase = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
        await notificarEmpleado(
          solicitud.usuario_id,
          `✅ ${tipoPase} Autorizado`,
          `Folio Oficial: ${nuevoFolioGenerado}\nDictamen: ${dictamenPago}`
        );
      }

      // PASO CADENA: Notifica a los siguientes aprobadores (ej. Gerente a todo RH)
      if (siguientesEnFirmar.length > 0) {
        try {
            const { data: subs } = await supabase.from('suscripciones_push').select('subscription').in('usuario_id', siguientesEnFirmar);
            if (subs && subs.length > 0) {
                const nombreSolicitante = solicitud.usuarios?.nombre_completo || 'Un colaborador';
                const fotoSolicitante = solicitud.usuarios?.foto_url || null;
                const asuntoRaw = solicitud.asunto_motivo || '';
                const matchMotivo = asuntoRaw.match(/\[(.*?)\]\s*(.*)/);
                const naturalezaClean = matchMotivo ? matchMotivo[1] : '';
                const motivoLimpio = matchMotivo ? matchMotivo[2] : asuntoRaw;
                const tipoClean = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
                const tituloNotifDomino = solicitud.tipo_permiso === 'vacaciones' ? 'Vacaciones' : `${tipoClean} (${naturalezaClean})`;
                const mensajeNotifDomino = `${nombreSolicitante}: "${motivoLimpio}"`;

                const envios = subs.map(async (item) => {
                    let subLimpia = item.subscription;
                    if (typeof subLimpia === 'string') {
                        try { subLimpia = JSON.parse(subLimpia); } catch (_) {}
                    }
                    const res = await fetch('/api/notificar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subscription: subLimpia, titulo: tituloNotifDomino, mensaje: mensajeNotifDomino, fotoUrl: fotoSolicitante, urlDestino: '/aprobaciones' })
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

      if (esRH && solicitud.firma_3_estado === 'pendiente') {
        updates.firma_3_estado = 'rechazado';
        if (!solicitud.firma_3_id) updates.firma_3_id = usuario.id;
      } else if (esGerente && solicitud.firma_2_estado === 'pendiente') {
        updates.firma_2_estado = 'rechazado';
      } else if (esJefeDepto && solicitud.firma_1_estado === 'pendiente') {
        updates.firma_1_estado = 'rechazado';
        if (!solicitud.firma_1_id) updates.firma_1_id = usuario.id;
      } else {
        updates.firma_1_estado = 'rechazado';
      }

      const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
      if (error) throw error;

      const tipoPaseR = solicitud.tipo_permiso.charAt(0).toUpperCase() + solicitud.tipo_permiso.slice(1);
      await notificarEmpleado(solicitud.usuario_id, `❌ ${tipoPaseR} Rechazado`, `Motivo: ${motivoRechazo}`);

      setSolicitudRechazar(null);
      await cargarSolicitudes();
    } catch (err) {
      alert("Error al rechazar: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const ejecutarForzarFirma = async (solicitud) => {
    if (!window.confirm("⚠️ ATENCIÓN: Estás a punto de forzar el salto de una autoridad que no ha respondido.\n\nEl pase avanzará a la siguiente etapa. ¿Deseas continuar?")) return;
    
    setProcesando(true);
    try {
      let updates = {};
      let siguienteFirmanteId = null;

      if (solicitud.firma_1_estado === 'pendiente') {
        updates = { firma_1_estado: 'escalado', observaciones: `${solicitud.observaciones || ''} | 🛡️ RH forzó salto de Jefe.` };
        siguienteFirmanteId = solicitud.firma_2_id;
      } else if (solicitud.firma_2_estado === 'pendiente') {
        updates = { firma_2_estado: 'escalado', observaciones: `${solicitud.observaciones || ''} | 🛡️ RH forzó salto de Gerencia.` };
        siguienteFirmanteId = solicitud.firma_3_id;
      }

      const { error } = await supabase.from('permisos').update(updates).eq('id', solicitud.id);
      if (error) throw error;

      if (siguienteFirmanteId) {
        await notificarEmpleado(siguienteFirmanteId, "🚨 Pase Escalado por RH", `El pase de ${solicitud.usuarios?.nombre_completo} requiere tu atención urgente.`, "/aprobaciones");
      }

      alert("✅ Autoridad saltada exitosamente. El pase ha avanzado.");
      await cargarSolicitudes();
    } catch (error) {
      console.error("Error forzando salto:", error);
      alert("Hubo un error al forzar la firma.");
    } finally {
      setProcesando(false);
    }
  };

  const esRH = usuario?.rol === 'rh_nominas' || usuario?.rol === 'gerente_rh';
  const esGerente = usuario?.rol.includes('gerente') && !esRH;
  const esJefeDepto = usuario?.rol === 'jefe_area';

  const solicitudesDelUsuario = solicitudes.filter(s => {
    if (esRH) return true;
    if (esJefeDepto) {
      if (s.firma_1_id === usuario.id) return true;
      if (s.usuarios?.departamento_id && s.usuarios.departamento_id === usuario.departamento_id) return true;
    }
    if (s.firma_2_id === usuario?.id) return true;
    return false;
  });

  const solicitudesPendientes = solicitudesDelUsuario.filter(s => {
    if (s.estado_general === 'rechazado' || s.estado_general === 'autorizado') return false;

    if (esRH) {
      const firma1OK = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(s.firma_1_estado);
      const firma2OK = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(s.firma_2_estado);
      return firma1OK && firma2OK && s.firma_3_estado === 'pendiente';
    }

    if (esJefeDepto && s.firma_1_estado === 'pendiente') return true;
    if (esGerente && s.firma_2_estado === 'pendiente' && ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(s.firma_1_estado)) return true;
    return false;
  });

  const solicitudesTransito = solicitudesDelUsuario.filter(s => {
    if (!esRH) return false;
    if (s.estado_general === 'rechazado' || s.estado_general === 'autorizado') return false;
    if (s.firma_1_estado === 'pendiente' || s.firma_2_estado === 'pendiente') return true;
    return false;
  });

  const solicitudesHistorial = solicitudesDelUsuario.filter(s => 
    s.estado_general === 'autorizado' || s.estado_general === 'rechazado'
  );

  let listadoActual = [];
  if (tabActiva === 'pendientes') listadoActual = solicitudesPendientes;
  else if (tabActiva === 'transito') listadoActual = solicitudesTransito;

  return (
    <div className="aprobaciones-container">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

      {!dispositivoVinculado && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            onClick={vincularDispositivoManual}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)', border: '1px solid #f59e0b', color: '#f59e0b', fontSize: '11px', fontWeight: '800', cursor: 'pointer'
            }}
          >
            <Bell size={12} /> Activar notificaciones en este celular
          </button>
        </div>
      )}

      {/* PESTAÑAS DINÁMICAS */}
      <div className="tabs-aprobacion-bar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '5px' }}>
        <button
          onClick={() => setTabActiva('pendientes')}
          className={`tab-btn ${tabActiva === 'pendientes' ? 'active' : ''}`}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          {esRH ? <FileCheck size={14} /> : <Clock size={14} />}
          <span>{esRH ? 'Listos para Dictamen' : 'Pendientes de mi firma'}</span>
          {solicitudesPendientes.length > 0 && (
            <span style={{ background: c.accent, color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
              {solicitudesPendientes.length}
            </span>
          )}
        </button>

        {esRH && (
          <button
            onClick={() => setTabActiva('transito')}
            className={`tab-btn ${tabActiva === 'transito' ? 'active' : ''}`}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <Radar size={14} />
            <span>Radar / En Tránsito</span>
            {solicitudesTransito.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px' }}>
                {solicitudesTransito.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setTabActiva('historial')}
          className={`tab-btn ${tabActiva === 'historial' ? 'active' : ''}`}
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          <CheckCircle2 size={14} />
          <span>Historial General</span>
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      {cargando ? (
        <div style={{ textAlign: 'center', padding: '30px', color: c.textMuted, fontSize: '12px' }}>
          Cargando solicitudes...
        </div>
      ) : tabActiva === 'historial' ? (
        <TablaHistorial 
          solicitudes={solicitudesHistorial} 
          c={c} 
          modoOscuro={modoOscuro} 
        />
      ) : listadoActual.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: c.textMuted, fontSize: '13px' }}>
          {tabActiva === 'pendientes' && (esRH ? 'No hay pases listos para dictamen final.' : 'No tienes solicitudes pendientes de firma.')}
          {tabActiva === 'transito' && 'No hay permisos atorados en la cadena de firmas.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {listadoActual.map(solicitud => (
            <TarjetaAprobacion
              key={solicitud.id}
              solicitud={solicitud}
              esPendiente={true}
              onAprobar={(sol) => setSolicitudAprobar(sol)}
              onRechazar={(sol) => setSolicitudRechazar(sol)}
              onForzarFirma={ejecutarForzarFirma}
              usuarioActual={usuario}
              c={c}
              modoOscuro={modoOscuro}
            />
          ))}
        </div>
      )}

      {/* MODALES */}
      <ModalDictamenAprobar
        solicitud={solicitudAprobar}
        usuarioFirmante={usuario}
        onClose={() => setSolicitudAprobar(null)}
        onConfirmarAprobacion={ejecutarAprobacion}
        procesando={procesando}
        c={c}
        modoOscuro={modoOscuro}
      />

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