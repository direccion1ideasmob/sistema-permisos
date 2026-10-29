import { compararPorApellidoPaterno } from '../../../core/utils/ordenNombre';
import ControlHoraCorteRH from './ControlHoraCorteRH';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../core/auth/AuthContext';
import {
  obtenerSolicitudesAprobacion,
  aprobarSolicitudPermiso,
  rechazarSolicitudPermiso,
  forzarSaltoFirmaRH,
  enviarRecordatorioPermisosRezagados
} from '../services/permisosService';

import { obtenerTemaAprobaciones, generarEstilosAprobaciones } from '../aprobacionesStyles';
import TarjetaAprobacion from './TarjetaAprobacion';
import ModalDictamenAprobar from './ModalDictamenAprobar';
import ModalRechazoPermiso from './ModalRechazoPermiso';
import TablaHistorial from '../historial/TablaHistorial';
import ModalPapeletaPDF from '../historial/ModalPapeletaPDF';
import { Inbox, Radar, Archive } from 'lucide-react';

export default function Aprobaciones() {
  const { usuario } = useAuth();
  const [tabActiva, setTabActiva] = useState('pendientes');
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);

  const [solicitudAprobar, setSolicitudAprobar] = useState(null);
  const [solicitudRechazar, setSolicitudRechazar] = useState(null);
  const [papeletaSeleccionada, setPapeletaSeleccionada] = useState(null);

  const [modoOscuro] = useState(() => localStorage.getItem('tema_sistema') === 'oscuro');
  const c = obtenerTemaAprobaciones(modoOscuro);

  const esRH = usuario?.rol === 'rh_nominas' || usuario?.rol === 'gerente_rh' || usuario?.rol === 'superadmin';
  const esGerente = usuario?.rol?.includes('gerente') && !esRH;
  const esMandoArea = usuario?.rol === 'jefe_area' || usuario?.rol === 'encargado';

  const cargarSolicitudes = useCallback(async () => {
    if (!usuario?.id) return;
    setCargando(true);
    try {
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
    if (s.usuario_id === usuario.id) return false;
    if (['rechazado', 'autorizado', 'aprobado', 'completado_caseta', 'cancelado'].includes(s.estado_general)) return false;

    const firma1OK = ['autorizado', 'aprobado', 'auto_aprobado', 'omitido', 'no_aplica', 'escalado'].includes(s.firma_1_estado);
    const firma2OK = ['autorizado', 'aprobado', 'auto_aprobado', 'omitido', 'no_aplica', 'escalado'].includes(s.firma_2_estado);

    if (s.firma_1_id === usuario.id && s.firma_1_estado === 'pendiente') return true;

    if (esRH) return firma1OK && firma2OK && s.firma_3_estado === 'pendiente';
    if (esGerente) return firma1OK && s.firma_2_estado === 'pendiente' && s.firma_2_id === usuario.id;
    if (esMandoArea) return s.firma_1_estado === 'pendiente' && s.firma_1_id === usuario.id;
    return false;
  });

  const solicitudesTransito = solicitudesDelUsuario.filter(s => {
    if (!esRH || s.usuario_id === usuario.id) return false;
    if (['rechazado', 'autorizado', 'aprobado', 'completado_caseta', 'cancelado'].includes(s.estado_general)) return false;
    if (s.firma_1_id === usuario.id && s.firma_1_estado === 'pendiente') return false;
    return s.firma_1_estado === 'pendiente' || s.firma_2_estado === 'pendiente';
  });

  const solicitudesHistorial = solicitudesDelUsuario.filter(s =>
    ['autorizado', 'rechazado', 'aprobado', 'completado_caseta', 'cancelado'].includes(s.estado_general)
  );

  const listadoActual = (tabActiva === 'pendientes' ? solicitudesPendientes : solicitudesTransito)
    .slice()
    .sort((a, b) => compararPorApellidoPaterno(a.usuarios?.nombre_completo, b.usuarios?.nombre_completo));

  const hoyIso = (() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  })();
  const permisosRezagados = [...solicitudesPendientes, ...solicitudesTransito].filter(s => s.fecha_permiso < hoyIso);

  const handleRecordarRezagados = async () => {
    if (permisosRezagados.length === 0) return;
    setProcesando(true);
    try {
      const n = await enviarRecordatorioPermisosRezagados(permisosRezagados);
      alert(`🔔 Se enviaron ${n} recordatorio(s) push a los responsables de firmar los permisos rezagados.`);
    } catch (e) {
      alert('Error al enviar recordatorios: ' + e.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="aprobaciones-container aprob-main-wrap" style={{ maxWidth: tabActiva === 'historial' ? '100%' : '1060px', margin: '0 auto' }}>
      <style>{generarEstilosAprobaciones(c, modoOscuro)}</style>
      <style>{`
        .aprob-main-wrap {
          padding: 20px 24px;
          box-sizing: border-box;
          width: 100%;
        }
        .aprob-tabs-bar {
          height: 46px;
          margin-bottom: 16px;
          box-sizing: border-box;
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }
        .aprob-tab-btn {
          font-size: 14.5px !important;
          height: 100% !important;
          padding: 0 14px !important;
          gap: 8px !important;
          min-width: 0 !important;
        }
        .aprob-txt-mobile {
          display: none;
        }
        @media (max-width: 768px) {
          .aprob-main-wrap {
            padding: 44px 8px 24px 8px;
            gap: 12px;
          }
          .aprob-tabs-bar {
            height: 40px;
            margin-bottom: 6px;
            padding: 3px !important;
            border-radius: 10px !important;
          }
          .aprob-tab-btn {
            font-size: 12.5px !important;
            padding: 0 6px !important;
            gap: 5px !important;
            border-radius: 7px !important;
          }
          .aprob-tab-btn svg {
            width: 15px;
            height: 15px;
            flex-shrink: 0;
          }
          .aprob-txt-desktop {
            display: none;
          }
          .aprob-txt-mobile {
            display: inline;
          }
        }
      `}</style>

      {/* BARRA SEGMENTADA SIMÉTRICA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '6px', flexWrap: 'nowrap' }}>
        <span style={{ fontSize: '14px', fontWeight: '900', color: c.text, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {esRH ? 'Autorizaciones RH' : 'Autorizaciones'}
        </span>
        <ControlHoraCorteRH usuario={usuario} c={c} />
      </div>
      <div className="tabs-aprobacion-bar aprob-tabs-bar">
        <button
          onClick={() => setTabActiva('pendientes')}
          className={`tab-btn aprob-tab-btn ${tabActiva === 'pendientes' ? 'active' : ''}`}
        >
          <Inbox size={17} />
          <span>{esRH ? 'Por Dictaminar' : 'Por Autorizar'}</span>
          {solicitudesPendientes.length > 0 && (
            <span className="tab-badge" style={{ background: c.accent, color: '#fff', fontSize: '11.5px', padding: '1px 7px' }}>
              {solicitudesPendientes.length}
            </span>
          )}
        </button>

        {esRH && (
          <button
            onClick={() => setTabActiva('transito')}
            className={`tab-btn aprob-tab-btn ${tabActiva === 'transito' ? 'active' : ''}`}
          >
            <Radar size={17} />
            <span>En Tránsito</span>
            {solicitudesTransito.length > 0 && (
              <span className="tab-badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '11.5px', padding: '1px 7px' }}>
                {solicitudesTransito.length}
              </span>
            )}
          </button>
        )}

        {!esRH && (
          <button
            onClick={() => setTabActiva('historial')}
            className={`tab-btn aprob-tab-btn ${tabActiva === 'historial' ? 'active' : ''}`}
          >
            <Archive size={17} />
            <span className="aprob-txt-desktop">Historial de mi Área</span>
            <span className="aprob-txt-mobile">Historial</span>
          </button>
        )}
      </div>

      {tabActiva !== 'historial' && permisosRezagados.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1.5px solid #f59e0b',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#d97706' }}>
            ⏰ Hay {permisosRezagados.length} permiso(s) de días anteriores que siguen sin firmarse.
          </span>
          <button
            type="button"
            onClick={handleRecordarRezagados}
            disabled={procesando}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              background: '#d97706',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            🔔 Enviar Recordatorio Push
          </button>
        </div>
      )}

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '40px', color: c.textMuted, fontSize: '14px', fontWeight: '600' }}>
          Cargando solicitudes...
        </div>
      ) : (!esRH && tabActiva === 'historial') ? (
        <TablaHistorial solicitudes={solicitudesHistorial} c={c} modoOscuro={modoOscuro} onSeleccionarPapeleta={(p) => setPapeletaSeleccionada(p)} />
      ) : listadoActual.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '44px 20px', color: c.textMuted, fontSize: '14.5px', fontWeight: '600',
          background: c.surfaceCard, border: `1.5px solid ${c.border}`, borderRadius: '14px'
        }}>
          {tabActiva === 'pendientes' && (esRH ? 'No hay pases pendientes por dictaminar.' : 'No tienes solicitudes pendientes por autorizar.')}
          {tabActiva === 'transito' && 'No hay permisos en tránsito actualmente.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
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

      {papeletaSeleccionada && (
        <ModalPapeletaPDF
          permiso={papeletaSeleccionada}
          onClose={() => setPapeletaSeleccionada(null)}
        />
      )}

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
