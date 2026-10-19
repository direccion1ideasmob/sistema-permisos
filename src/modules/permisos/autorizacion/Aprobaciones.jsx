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
import { Inbox, Radar, Archive } from 'lucide-react';

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

  const esRH = usuario?.rol === 'rh_nominas' || usuario?.rol === 'gerente_rh' || usuario?.rol === 'superadmin';
  const esGerente = usuario?.rol?.includes('gerente') && !esRH;
  const esMandoArea = usuario?.rol === 'jefe_area' || usuario?.rol === 'encargado';

  const cargarSolicitudes = useCallback(async () => {
    if (!usuario?.id) return;
    setCargando(true);
    try {
      // Si es RH, solo descarga las solicitudes vivas ('en_firmas') porque su historial maestro vive en Control / Historial
      const data = await obtenerSolicitudesAprobacion({ soloEnFirmas: esRH, usuarioId: usuario.id, rol: usuario.rol });
      setSolicitudes(data);
    } catch (err) {
      console.error("Error al cargar aprobaciones:", err);
    } finally {
      setCargando(false);
    }
  }, [usuario?.id, usuario?.rol, esRH]);

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
    if (!window.confirm("⚠️ ATENCIÓN: Estás a punto de saltar una firma pendiente que no ha respondido.\n\nEl pase avanzará a la siguiente etapa. ¿Deseas continuar?")) return;

    setProcesando(true);
    try {
      await forzarSaltoFirmaRH(solicitud);
      alert("✅ Firma saltada exitosamente. El pase ha avanzado.");
      await cargarSolicitudes();
    } catch (error) {
      console.error("Error forzando salto:", error);
      alert("Hubo un error al saltar la firma.");
    } finally {
      setProcesando(false);
    }
  };

  const solicitudesDelUsuario = solicitudes.filter(s => {
    if (esRH) return true;
    if (esMandoArea) return s.firma_1_id === usuario.id;
    if (esGerente) return s.firma_2_id === usuario.id || s.firma_1_id === usuario.id;
    return false;
  });

  const solicitudesPendientes = solicitudesDelUsuario.filter(s => {
    if (['rechazado', 'autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general)) return false;

    const firma1OK = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(s.firma_1_estado);
    const firma2OK = ['autorizado', 'auto_aprobado', 'omitido', 'escalado'].includes(s.firma_2_estado);

    if (s.firma_1_id === usuario.id && s.firma_1_estado === 'pendiente') return true;

    if (esRH) return firma1OK && firma2OK && s.firma_3_estado === 'pendiente';
    if (esGerente) return firma1OK && s.firma_2_estado === 'pendiente' && s.firma_2_id === usuario.id;
    if (esMandoArea) return s.firma_1_estado === 'pendiente' && s.firma_1_id === usuario.id;
    return false;
  });

  const solicitudesTransito = solicitudesDelUsuario.filter(s => {
    if (!esRH) return false;
    if (['rechazado', 'autorizado', 'aprobado', 'completado_caseta'].includes(s.estado_general)) return false;
    if (s.firma_1_id === usuario.id && s.firma_1_estado === 'pendiente') return false;
    return s.firma_1_estado === 'pendiente' || s.firma_2_estado === 'pendiente';
  });

  const solicitudesHistorial = solicitudesDelUsuario.filter(s =>
    ['autorizado', 'rechazado', 'aprobado', 'completado_caseta'].includes(s.estado_general)
  );

  const listadoActual = tabActiva === 'pendientes' ? solicitudesPendientes : solicitudesTransito;

  return (
    <div className="aprobaciones-container">
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>

      {/* BARRA SEGMENTADA: RH SOLO VE BANDEJAS VIVAS (SU HISTORIAL ESTÁ EN CONTROL / HISTORIAL) */}
      <div className="tabs-aprobacion-bar">
        <button
          onClick={() => setTabActiva('pendientes')}
          className={`tab-btn ${tabActiva === 'pendientes' ? 'active' : ''}`}
        >
          <Inbox size={15} />
          <span>{esRH ? 'Por Dictaminar' : 'Por Autorizar'}</span>
          {solicitudesPendientes.length > 0 && (
            <span className="tab-badge" style={{ background: c.accent, color: '#fff' }}>
              {solicitudesPendientes.length}
            </span>
          )}
        </button>

        {esRH && (
          <button
            onClick={() => setTabActiva('transito')}
            className={`tab-btn ${tabActiva === 'transito' ? 'active' : ''}`}
          >
            <Radar size={15} />
            <span>En Tránsito</span>
            {solicitudesTransito.length > 0 && (
              <span className="tab-badge" style={{ background: '#f59e0b', color: '#fff' }}>
                {solicitudesTransito.length}
              </span>
            )}
          </button>
        )}

        {!esRH && (
          <button
            onClick={() => setTabActiva('historial')}
            className={`tab-btn ${tabActiva === 'historial' ? 'active' : ''}`}
          >
            <Archive size={15} />
            <span>Historial de mi Área</span>
          </button>
        )}
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '30px', color: c.textMuted, fontSize: '12px' }}>
          Cargando solicitudes...
        </div>
      ) : (!esRH && tabActiva === 'historial') ? (
        <TablaHistorial solicitudes={solicitudesHistorial} c={c} modoOscuro={modoOscuro} />
      ) : listadoActual.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '44px 20px', color: c.textMuted, fontSize: '13px', background: c.surfaceCard, border: `1px solid ${c.border}`, borderRadius: '12px' }}>
          {tabActiva === 'pendientes' && (esRH ? 'No hay pases pendientes por dictaminar.' : 'No tienes solicitudes pendientes por autorizar.')}
          {tabActiva === 'transito' && 'No hay permisos en tránsito actualmente.'}
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
