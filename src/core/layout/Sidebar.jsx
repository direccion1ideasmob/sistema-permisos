import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../auth/AuthContext';
import { registrarSuscripcionPush } from '../notificaciones/notificacionesService';
import ModalGuiaRapidaRH from '../../modules/permisos/historial/ModalGuiaRapidaRH';

import { 
  DoorOpen, PenLine, FileBarChart, Users,
  LogOut, X, Camera, Image as ImageIcon, Sun, Moon,
  Settings, FilePlus, Bell, Clock, ClipboardList, BookOpen
} from 'lucide-react';

export default function Sidebar({
  usuarioLogueado, 
  setUsuarioLogueado, 
  isMobile, 
  menuAbierto, 
  setMenuAbierto, 
  modoOscuro, 
  setModoOscuro, 
  tema, 
  onOpenSeguridad
}) {
  const { cerrarSesion } = useAuth();
  const location = useLocation();
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(usuarioLogueado?.nombre_completo || "");
  const [loading, setLoading] = useState(false);
  const [suscribiendo, setSuscribiendo] = useState(false);
  const [mostrarGuiaSistema, setMostrarGuiaSistema] = useState(false);

  const handleUpdateFoto = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo || !usuarioLogueado?.id) return;
    
    setLoading(true);
    
    try {
      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true };
      const archivoComprimido = await imageCompression(archivo, options);
      const fileName = `perfil_${usuarioLogueado.id}.jpg`;
      
      const { error: uploadError } = await supabase.storage.from('fotos_usuarios').upload(fileName, archivoComprimido, { contentType: archivoComprimido.type, upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: link } = supabase.storage.from('fotos_usuarios').getPublicUrl(fileName);
      const urlFinal = `${link.publicUrl}?t=${new Date().getTime()}`;
      
      await supabase.from('usuarios').update({ foto_url: urlFinal }).eq('id', usuarioLogueado.id);
      setUsuarioLogueado({ ...usuarioLogueado, foto_url: urlFinal });
      
      const sesionActual = JSON.parse(localStorage.getItem('permisos_sesion') || '{}');
      sesionActual.foto_url = urlFinal;
      localStorage.setItem('permisos_sesion', JSON.stringify(sesionActual));
      setShowPhotoModal(false);
    } catch (err) {
      alert("Error al subir foto: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const guardarNombre = async () => {
    if (!nuevoNombre.trim() || nuevoNombre === usuarioLogueado.nombre_completo) {
      setEditandoNombre(false);
      return;
    }
    setLoading(true);
    await supabase.from('usuarios').update({ nombre_completo: nuevoNombre }).eq('id', usuarioLogueado.id);
    setUsuarioLogueado({ ...usuarioLogueado, nombre_completo: nuevoNombre });
    setEditandoNombre(false);
    setLoading(false);
  };

  const activarAlertas = async () => {
    if (suscribiendo) return;
    setSuscribiendo(true);
    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }

      const sub = await registrarSuscripcionPush();
      if (!sub) {
        alert("No se otorgaron permisos de notificación en este navegador.");
        setSuscribiendo(false);
        return;
      }

      const endpointActual = sub.endpoint;

      await supabase
        .from('suscripciones_push')
        .delete()
        .eq('endpoint', endpointActual);

      const { error } = await supabase
        .from('suscripciones_push')
        .insert([{ 
          usuario_id: usuarioLogueado.id, 
          subscription: sub,
          endpoint: endpointActual
        }]);

      if (error) throw error;
      alert("✅ Alertas push activadas correctamente en este dispositivo.");
    } catch (error) {
      console.error("Error al guardar suscripción:", error);
      alert("Hubo un error al activar las alertas: " + (error.message || ''));
    } finally {
      setSuscribiendo(false);
    }
  };

  const cerrarMenuMovil = () => {
    if (isMobile) setMenuAbierto(false);
  };

  const rol = usuarioLogueado?.rol || 'empleado';
  const puedeAprobar = ['encargado', 'jefe_area', 'gerente_produccion', 'gerente_admin', 'gerente_rh', 'rh_nominas', 'superadmin'].includes(rol);
  const esNominas = ['rh_nominas', 'gerente_rh', 'superadmin'].includes(rol);
  const esCaseta = rol === 'caseta';
  const miFoto = usuarioLogueado?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioLogueado?.nombre_completo || 'Usuario')}&background=16a34a&color=fff&bold=true&size=400`;

  const puedeEditarNombre = ['superadmin', 'gerente_rh', 'rh_nominas'].includes(rol);

  return (
    <>
      <aside style={{
        ...s.sidebar,
        width: isMobile ? '76vw' : '280px',
        maxWidth: isMobile ? '295px' : '280px',
        padding: isMobile ? '16px 14px' : '18px 16px',
        backgroundColor: tema.sidebarBg,
        borderRight: `1.5px solid ${tema.border}`,
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        transform: isMobile ? (menuAbierto ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        marginLeft: isMobile ? '0' : (menuAbierto ? '0' : '-280px'),
        boxShadow: modoOscuro ? 'none' : '4px 0 25px rgba(0,0,0,0.05)'
      }}>

        {/* 1. MARCA DE AGUA EN LA BARRA */}
        <div style={s.sidebarWatermarkContainer}>
          <img 
            src="/LogoVerde-removebg-preview.png" 
            alt="Marca de agua lateral" 
            style={{
              ...s.sidebarWatermarkImg,
              opacity: modoOscuro ? 0.22 : 0.28
            }} 
          />
        </div>

        {/* 2. CABECERA CON BOTONES GLOBALES */}
        <div style={s.brandHeader}>
          <div style={s.headerActions}>
            <button 
              onClick={() => setModoOscuro(!modoOscuro)} 
              style={{ ...s.btnIcon, border: `1.5px solid ${tema.border}`, color: tema.textSecondary }}
              title={modoOscuro ? "Modo Claro" : "Modo Oscuro"}
            >
              {modoOscuro ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button 
              onClick={activarAlertas} 
              disabled={suscribiendo}
              style={{ 
                ...s.btnIcon, 
                border: `1.5px solid ${tema.border}`, 
                color: suscribiendo ? '#16a34a' : tema.textSecondary,
                cursor: suscribiendo ? 'wait' : 'pointer'
              }}
              title="Activar Notificaciones Push en este dispositivo"
            >
              <Bell size={16} className={suscribiendo ? "animate-pulse" : ""} />
            </button>

            <button 
              onClick={() => setMenuAbierto(false)} 
              style={{ ...s.btnIcon, border: `1.5px solid ${tema.border}`, color: tema.textSecondary }}
              title="Contraer menú"
              aria-label="Contraer menú"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* 3. PERFIL VERTICAL CENTRADO (FOTO GRANDE + NOMBRE ABAJO) */}
        <div style={{
          ...s.profileBox,
          border: `1.5px solid ${tema.border}`,
          backgroundColor: modoOscuro ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
        }}>
          <div
            style={s.avatarWrapper}
            onClick={() => setShowPhotoModal(true)}
            title="Ver o cambiar foto de perfil"
          >
            <img src={miFoto} alt="Perfil" style={s.avatarImg} />
            <div style={s.avatarEditBadge}>
              <Camera size={13} color="#fff" />
            </div>
          </div>

          <div style={s.profileDetails}>
            {editandoNombre ? (
              <input 
                style={{
                  ...s.inputEdit,
                  backgroundColor: modoOscuro ? '#000' : '#fff',
                  color: tema.textPrimary,
                  border: `1.5px solid ${tema.border}`
                }} 
                value={nuevoNombre} 
                onChange={e => setNuevoNombre(e.target.value)} 
                autoFocus 
                onBlur={guardarNombre} 
                onKeyDown={(e) => e.key === 'Enter' && guardarNombre()} 
              />
            ) : (
              <span 
                style={{ 
                  ...s.userName, 
                  color: tema.textPrimary, 
                  cursor: puedeEditarNombre ? 'pointer' : 'default' 
                }} 
                onClick={() => puedeEditarNombre && setEditandoNombre(true)}
                title={puedeEditarNombre ? "Clic para editar nombre" : (usuarioLogueado?.nombre_completo || '')}
              >
                {usuarioLogueado?.nombre_completo || 'Usuario'}
              </span>
            )}
            
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ ...s.userRole, color: tema.textSecondary }}>
                {rol.replace(/_/g, ' ')}
              </span>
              
              <button 
                onClick={onOpenSeguridad}
                style={{
                  background: 'transparent',
                  border: `1px solid ${tema.border}`,
                  borderRadius: '6px',
                  color: tema.textSecondary,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 5px',
                  transition: 'color 0.2s'
                }}
                title="Seguridad y PIN"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 4. NAVEGACIÓN CON FUENTE E ÍCONOS MÁS GRANDES */}
        <nav style={s.nav}>
          {!esCaseta && (
            <Link 
              to="/solicitar" 
              onClick={cerrarMenuMovil} 
              style={location.pathname === '/solicitar' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `4px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
            >
              <FilePlus size={21} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={s.navText}>Solicitar Pase</span>
            </Link>
          )}

          {!esCaseta && (
            <Link 
              to="/mis-permisos" 
              onClick={cerrarMenuMovil} 
              style={location.pathname === '/mis-permisos' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `4px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
            >
              <DoorOpen size={21} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={s.navText}>Mis Permisos</span>
            </Link>
          )}

          {puedeAprobar && (
            <Link 
              to="/aprobaciones" 
              onClick={cerrarMenuMovil} 
              style={location.pathname === '/aprobaciones' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `4px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
            >
              <PenLine size={21} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={s.navText}>Aprobaciones</span>
            </Link>
          )}

          {esNominas && (
            <>
              <Link 
                to="/control-historial" 
                onClick={cerrarMenuMovil} 
                style={location.pathname === '/control-historial' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `4px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
              >
                <FileBarChart size={21} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={s.navText}>Control / Historial</span>
              </Link>
              <Link 
                to="/directorio" 
                onClick={cerrarMenuMovil} 
                style={location.pathname === '/directorio' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `4px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
              >
                <Users size={21} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={s.navText}>Directorio RH</span>
              </Link>
            </>
          )}

          {esCaseta && (
            <>
              <Link 
                to="/caseta/asistencia" 
                onClick={cerrarMenuMovil} 
                style={location.pathname === '/caseta' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `4px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
              >
                <ClipboardList size={21} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={s.navText}>Asistencia</span>
              </Link>
              <Link 
                to="/caseta" 
                onClick={cerrarMenuMovil} 
                style={location.pathname === '/caseta/asistencia' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `4px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
              >
                <DoorOpen size={21} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span style={s.navText}>Actividad</span>
              </Link>
              
            </>
          )}
        </nav>

        {/* 5. GUÍA DISCRETA (SOLO RH / GERENCIA RH) + BOTÓN CERRAR SESIÓN ABAJO */}
        <div style={s.logoutContainer}>
          {esNominas && (
            <button
              type="button"
              onClick={() => {
                cerrarMenuMovil();
                setMostrarGuiaSistema(true);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '7px',
                padding: '8px 10px',
                marginBottom: '8px',
                borderRadius: '8px',
                border: `1px solid ${tema.border}`,
                backgroundColor: 'transparent',
                color: tema.textSecondary,
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                opacity: 0.85
              }}
            >
              <BookOpen size={14} style={{ flexShrink: 0 }} />
              <span style={s.navText}>Guía del Sistema</span>
            </button>
          )}
          <button onClick={() => window.confirm("¿Deseas cerrar sesión?") && cerrarSesion()} style={s.btnLogout}>
            <LogOut size={18} strokeWidth={2.2} style={{ flexShrink: 0 }} />
            <span style={s.navText}>Cerrar Sesión</span>
          </button>
        </div>

      </aside>

      {mostrarGuiaSistema && (
        <ModalGuiaRapidaRH
          modoOscuro={modoOscuro}
          onClose={() => setMostrarGuiaSistema(false)}
        />
      )}

      {/* VISOR MODAL DE FOTO DE PERFIL EN GRANDE */}
      {showPhotoModal && (
        <div style={s.modalOverlay} onClick={() => setShowPhotoModal(false)}>
          <div
            style={{
              ...s.modalCard,
              backgroundColor: modoOscuro ? '#18181b' : '#ffffff',
              border: `1.5px solid ${tema.border}`
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: tema.textPrimary }}>
                  {usuarioLogueado?.nombre_completo || 'Colaborador'}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: tema.textSecondary, textTransform: 'uppercase' }}>
                  {usuarioLogueado?.puesto || rol.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                onClick={() => setShowPhotoModal(false)}
                style={{ ...s.btnCloseModal, border: `1px solid ${tema.border}`, color: tema.textSecondary }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={s.photoPreviewWrap}>
              <img src={miFoto} alt="Foto de perfil" style={s.photoPreviewLarge} />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#16a34a', padding: '8px' }}>
                Actualizando fotografía...
              </div>
            ) : (
              <div style={s.modalActions}>
                <label style={{ ...s.actionBtnPrimary, backgroundColor: '#16a34a', color: '#fff' }}>
                  <Camera size={15} />
                  <span>Tomar foto</span>
                  <input type="file" accept="image/*" capture="environment" hidden onChange={handleUpdateFoto} />
                </label>

                <label style={{ ...s.actionBtnSecondary, border: `1.5px solid ${tema.border}`, color: tema.textPrimary }}>
                  <ImageIcon size={15} />
                  <span>Elegir imagen</span>
                  <input type="file" accept="image/*" hidden onChange={handleUpdateFoto} />
                </label>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const s = {
  sidebar: { 
    zIndex: 300, 
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden', 
    display: 'flex', 
    flexDirection: 'column', 
    transition: 'all 0.3s ease', 
    boxSizing: 'border-box', 
    flexShrink: 0, 
    backdropFilter: 'blur(10px)', 
    WebkitBackdropFilter: 'blur(10px)'
  },
  sidebarWatermarkContainer: {
    position: 'absolute', top: '64%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '85%', pointerEvents: 'none', zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  sidebarWatermarkImg: {
    width: '100%', maxHeight: '190px', objectFit: 'contain', userSelect: 'none', transition: 'opacity 0.3s ease'
  },
  brandHeader: {
    position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: '8px', marginBottom: '4px', flexShrink: 0
  },
  headerActions: {
    display: 'flex', alignItems: 'center', gap: '6px'
  },
  btnIcon: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', 
    borderRadius: '8px', background: 'transparent', cursor: 'pointer'
  },
  profileBox: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '10px',
    padding: '18px 12px 14px 12px',
    borderRadius: '14px',
    marginBottom: '18px',
    flexShrink: 0
  },
  avatarWrapper: {
    width: '86px',
    height: '86px',
    borderRadius: '50%',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'pointer',
    flexShrink: 0,
    border: '2.5px solid #16a34a',
    boxShadow: '0 6px 16px rgba(22, 163, 74, 0.18)'
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, left: 0, width: '100%', height: '22px',
    backgroundColor: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  profileDetails: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    minWidth: 0
  },
  userName: {
    fontSize: '15.5px',
    fontWeight: '800',
    lineHeight: '1.25',
    textAlign: 'center',
    wordBreak: 'break-word',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  inputEdit: {
    width: '100%',
    fontSize: '14px',
    padding: '5px 8px',
    borderRadius: '6px',
    outline: 'none',
    textAlign: 'center',
    fontWeight: '700'
  },
  userRole: {
    fontSize: '13px',
    textTransform: 'capitalize',
    fontWeight: '600'
  },
  nav: { 
    position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' 
  },
  navLink: {
    display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 14px',
    borderRadius: '10px', fontSize: '16px', fontWeight: '600', textDecoration: 'none', transition: 'all 0.15s ease'
  },
  navLinkActive: {
    display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 14px',
    borderRadius: '0 10px 10px 0', fontSize: '16px', fontWeight: '800', textDecoration: 'none', transition: 'all 0.15s ease'
  },
  navText: {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  logoutContainer: {
    position: 'relative', zIndex: 2, paddingTop: '12px', marginTop: 'auto', flexShrink: 0
  },
  btnLogout: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '9px', padding: '13px 14px', borderRadius: '10px', border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '15px', fontWeight: '800', cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)',
    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
  },
  modalCard: {
    width: '100%', maxWidth: '340px', borderRadius: '18px', padding: '20px',
    display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)'
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px'
  },
  btnCloseModal: {
    width: '32px', height: '32px', borderRadius: '50%', background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
  },
  photoPreviewWrap: {
    width: '220px', height: '220px', margin: '0 auto', borderRadius: '50%', overflow: 'hidden',
    border: '3px solid #16a34a', boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
  },
  photoPreviewLarge: {
    width: '100%', height: '100%', objectFit: 'cover'
  },
  modalActions: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'
  },
  actionBtnPrimary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: '10px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer'
  },
  actionBtnSecondary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    padding: '10px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', background: 'transparent'
  }
};
