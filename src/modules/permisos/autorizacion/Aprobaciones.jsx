import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import { 
  obtenerSolicitudesAprobacion, 
  aprobarSolicitudPermiso, 
  rechazarSolicitudPermiso, 
  forzarSaltoFirmaRH 
} from '../services/permisosService';

import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../aprobacionesStyles';
import TarjetaAprobacion from './TarjetaAprobacion';
import ModalDictamenAprobar from './ModalDictamenAprobar';
import ModalRechazoPermiso from './ModalRechazoPermiso';
import TablaHistorial from '../historial/TablaHistorial';
import { CheckCircle2, Clock, Radar, FileCheck } from 'lucide-react';

export default function Aprobaciones() {
  const { usuario } = useAuth();
  const [tabActiva, setTabActiva] = useState('pendientes'); 
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [solicitudAprobar, setSolicitudAprobar] = useState(null);
  const [solicitudRechazar, setSolicitudRechazar] = useState(null);

  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaAprobaciones(modoOscuro);

  const cargarSolicitudes = useCallback(async () => {
    if (!usuario?.id) return;
    setCargando(true);
    try {
      const data = await obtenerSolicitudesAprobacion();
      setSolicitudes(data);
    } catch (err) {
      console.error("Error al cargar aprobaciones:", err);
    } finally {
      setCargando(false);
    }
  }, [usuario?.id]);

  useEffect(() => {
    if (usuario?.id) cargarSolicitudes();
  }, [usuario?.id, cargarSolicitudes]);

  const ejecutarAprobacion = async (solicitud, dictamenPago, comentarios) => {
    setProcesando(true);
    try {
      await aprobarSolicitudPermiso({ solicitud, usuario, dictamenPago, comentarios });
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
      await rechazarSolicitudPermiso({ solicitud, usuario, motivoRechazo });
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
      await forzarSaltoFirmaRH(solicitud);
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
    if (esJefeDepto) return s.firma_1_id === usuario.id;
    if (esGerente) return s.firma_2_id === usuario.id;
    return false;
  });

  const solicitudesPendientes = solicitudesDelUsuario.filter(s => {
    if (['rechazado', 'autorizado', 'aprobado'].includes(s.estado_general)) return false;

    const firma1OK = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(s.firma_1_estado);
    const firma2OK = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(s.firma_2_estado);

    if (esRH) return firma1OK && firma2OK && s.firma_3_estado === 'pendiente';
    if (esGerente) return firma1OK && s.firma_2_estado === 'pendiente';
    if (esJefeDepto) return s.firma_1_estado === 'pendiente';
    return false;
  });

  const solicitudesTransito = solicitudesDelUsuario.filter(s => {
    if (!esRH) return false;
    if (['rechazado', 'autorizado', 'aprobado'].includes(s.estado_general)) return false;
    return s.firma_1_estado === 'pendiente' || s.firma_2_estado === 'pendiente';
  });

  const solicitudesHistorial = solicitudesDelUsuario.filter(s => 
    ['autorizado', 'rechazado', 'aprobado'].includes(s.estado_general)
  );

  const listadoActual = tabActiva === 'pendientes' ? solicitudesPendientes : solicitudesTransito;

  return (
    <div className="aprobaciones-container">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

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

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '30px', color: c.textMuted, fontSize: '12px' }}>
          Cargando solicitudes...
        </div>
      ) : tabActiva === 'historial' ? (
        <TablaHistorial solicitudes={solicitudesHistorial} c={c} modoOscuro={modoOscuro} />
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
