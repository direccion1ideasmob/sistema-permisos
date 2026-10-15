import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../auth/AuthContext';
import { registrarSuscripcionPush } from '../notificaciones/notificacionesService'; // <-- Importado aquí

import { 
  ClipboardList, PenLine, FileBarChart, Users, ShieldCheck, 
  LogOut, X, Camera, Image as ImageIcon, Sun, Moon,
  Settings, FilePlus, Bell
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
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(usuarioLogueado?.nombre_completo || "");
  const [loading, setLoading] = useState(false);
  
  // Estado para la campanita
  const [suscribiendo, setSuscribiendo] = useState(false);

  const handleUpdateFoto = async (e) => {
    const archivo = e.target.files[0];
    if (!archivo || !usuarioLogueado?.id) return;
    
    setLoading(true);
    setShowPhotoOptions(false);
    
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

  // === LÓGICA DE SUSCRIPCIÓN GLOBAL (Doble Clic) ===
  const activarAlertas = async () => {
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

      // 1. Limpieza absoluta en Supabase para evitar clones de este aparato
      await supabase
        .from('suscripciones_push')
        .delete()
        .eq('subscription->>endpoint', endpointActual);

     // 2. Inserción limpia
      const { error } = await supabase
        .from('suscripciones_push')
        .insert([{ 
          usuario_id: usuarioLogueado.id, 
          subscription: sub,
          endpoint: endpointActual // <--- ESTA ES LA LÍNEA QUE ME TRAGUÉ
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

  const cerrarMenuMovil = () => { if (isMobile) setMenuAbierto(false); };

  const rol = usuarioLogueado?.rol || 'empleado';
  const puedeAprobar = ['jefe_area', 'gerente_produccion', 'gerente_admin', 'gerente_rh', 'rh_nominas', 'superadmin'].includes(rol);
  const esNominas = ['rh_nominas', 'gerente_rh', 'superadmin'].includes(rol);
  const esCaseta = rol === 'caseta';
  const miFoto = usuarioLogueado?.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(usuarioLogueado?.nombre_completo || 'Usuario')}&background=16a34a&color=fff&bold=true&size=200`;

  const puedeEditarNombre = ['superadmin', 'gerente_rh', 'rh_nominas'].includes(rol);

  return (
    <aside style={{
      ...s.sidebar,
      width: isMobile ? '50vw' : '260px',
      padding: isMobile ? '16px 12px' : '20px 16px',
      backgroundColor: tema.sidebarBg,
      borderRight: `1.5px solid ${tema.border}`,
      position: isMobile ? 'fixed' : 'relative',
      transform: isMobile ? (menuAbierto ? 'translateX(0)' : 'translateX(-100%)') : 'none',
      marginLeft: isMobile ? '0' : (menuAbierto ? '0' : '-260px'),
      boxShadow: modoOscuro ? 'none' : '4px 0 25px rgba(0,0,0,0.05)'
    }}>

      {/* 1. MARCA DE AGUA EN LA BARRA */}
      <div style={s.sidebarWatermarkContainer}>
        <img 
          src="/LogoVerde-removebg-preview.png" 
          alt="Marca de agua lateral" 
          style={{
            ...s.sidebarWatermarkImg,
            opacity: modoOscuro ? 0.26 : 0.32
          }} 
        />
      </div>

      {/* 2. CABECERA CON BOTONES GLOBALES */}
      <div style={s.brandHeader}>
        <div style={s.headerActions}>
          
          {/* Botón Tema Oscuro */}
          <button 
            onClick={() => setModoOscuro(!modoOscuro)} 
            style={{ ...s.btnIcon, border: `1.5px solid ${tema.border}`, color: tema.textSecondary }}
            title={modoOscuro ? "Modo Claro" : "Modo Oscuro"}
          >
            {modoOscuro ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Botón Global de Notificaciones (DOBLE CLIC) */}
          <button 
            onDoubleClick={activarAlertas} 
            disabled={suscribiendo}
            style={{ 
              ...s.btnIcon, 
              border: `1.5px solid ${tema.border}`, 
              color: suscribiendo ? '#16a34a' : tema.textSecondary,
              cursor: suscribiendo ? 'wait' : 'pointer'
            }}
            title="Doble clic para activar Notificaciones Push en este dispositivo"
          >
            <Bell size={14} className={suscribiendo ? "animate-pulse" : ""} />
          </button>

          {/* Botón Cerrar Menú Móvil */}
          <button 
            onClick={() => setMenuAbierto(false)} 
            style={{ ...s.btnIcon, border: `1.5px solid ${tema.border}`, color: tema.textSecondary }}
            title="Contraer menú"
            aria-label="Contraer menú"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 3. PERFIL */}
      <div style={{ ...s.profileBox, border: `1.5px solid ${tema.border}`, backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
        <div style={s.avatarWrapper} onClick={() => setShowPhotoOptions(!showPhotoOptions)}>
          <img src={miFoto} alt="Perfil" style={s.avatarImg} />
          <div style={s.avatarEditBadge}><Camera size={11} color="#fff" /></div>
        </div>

        {showPhotoOptions && (
          <div style={{ ...s.popover, backgroundColor: tema.sidebarBg, border: `1.5px solid ${tema.border}` }}>
            <label style={{ ...s.popBtn, color: tema.textPrimary }}>
              <Camera size={13} /> Tomar foto 
              <input type="file" accept="image/*" capture="environment" hidden onChange={handleUpdateFoto} />
            </label>
            <label style={{ ...s.popBtn, color: tema.textPrimary }}>
              <ImageIcon size={13} /> Subir archivo 
              <input type="file" accept="image/*" hidden onChange={handleUpdateFoto} />
            </label>
            <button onClick={() => setShowPhotoOptions(false)} style={s.popBtnCancel}>Cancelar</button>
          </div>
        )}

        <div style={s.profileDetails}>
          {editandoNombre ? (
            <input 
              style={{ ...s.inputEdit, backgroundColor: modoOscuro ? '#000' : '#fff', color: tema.textPrimary, border: `1.5px solid ${tema.border}` }} 
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
              title={puedeEditarNombre ? "Clic para editar nombre" : ""}
            >
              {usuarioLogueado?.nombre_completo || 'Usuario'}
            </span>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...s.userRole, color: tema.textSecondary }}>
              {rol.replace(/_/g, ' ')}
            </span>
            
            {/* BOTÓN DE ENGRANAJE (SEGURIDAD) */}
            <button 
              onClick={onOpenSeguridad}
              style={{ background: 'transparent', border: 'none', color: tema.textSecondary, cursor: 'pointer', display: 'flex', padding: '2px', transition: 'color 0.2s' }}
              title="Seguridad y PIN"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. NAVEGACIÓN */}
      <nav style={s.nav}>
        {!esCaseta && (
          <Link 
            to="/solicitar" 
            onClick={cerrarMenuMovil} 
            style={location.pathname === '/solicitar' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `3px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
          >
            <FilePlus size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={s.navText}>Solicitar Pase</span>
          </Link>
        )}

        {!esCaseta && (
          <Link 
            to="/mis-permisos" 
            onClick={cerrarMenuMovil} 
            style={location.pathname === '/mis-permisos' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `3px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
          >
            <ClipboardList size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={s.navText}>Mis Permisos</span>
          </Link>
        )}

        {puedeAprobar && (
          <Link 
            to="/aprobaciones" 
            onClick={cerrarMenuMovil} 
            style={location.pathname === '/aprobaciones' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `3px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
          >
            <PenLine size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={s.navText}>Aprobaciones</span>
          </Link>
        )}

        {esNominas && (
          <>
            <Link 
              to="/control-historial" 
              onClick={cerrarMenuMovil} 
              style={location.pathname === '/control-historial' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `3px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
            >
              <FileBarChart size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={s.navText}>Control / Historial</span>
            </Link>
            <Link 
              to="/directorio" 
              onClick={cerrarMenuMovil} 
              style={location.pathname === '/directorio' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `3px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
            >
              <Users size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              <span style={s.navText}>Directorio RH</span>
            </Link>
          </>
        )}

        {esCaseta && (
          <Link 
            to="/caseta" 
            onClick={cerrarMenuMovil} 
            style={location.pathname === '/caseta' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `3px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
          >
            <ShieldCheck size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span style={s.navText}>Control Caseta</span>
          </Link>
        )}

        <button onClick={() => window.confirm("¿Deseas cerrar sesión?") && cerrarSesion()} style={s.btnLogout}>
          <LogOut size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <span style={s.navText}>Cerrar Sesión</span>
        </button>
      </nav>

    </aside>
  );
}

const s = {
  sidebar: { 
    zIndex: 300, 
    height: '100dvh', 
    overflowY: 'auto', 
    paddingBottom: '40px', 
    display: 'flex', 
    flexDirection: 'column', 
    transition: 'all 0.3s ease', 
    boxSizing: 'border-box', 
    flexShrink: 0, 
    backdropFilter: 'blur(10px)', 
    WebkitBackdropFilter: 'blur(10px)'
  },
  sidebarWatermarkContainer: {
    position: 'absolute', top: '60%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '90%', pointerEvents: 'none', zIndex: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  sidebarWatermarkImg: {
    width: '100%', maxHeight: '210px', objectFit: 'contain', userSelect: 'none', transition: 'opacity 0.3s ease'
  },
  brandHeader: {
    position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: '12px', marginBottom: '8px'
  },
  headerActions: {
    display: 'flex', alignItems: 'center', gap: '5px'
  },
  btnIcon: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', 
    borderRadius: '7px', background: 'transparent', cursor: 'pointer'
  },
  profileBox: {
    position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 8px', borderRadius: '10px', marginBottom: '16px'
  },
  avatarWrapper: {
    width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', position: 'relative', cursor: 'pointer', flexShrink: 0
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, left: 0, width: '100%', height: '13px',
    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  profileDetails: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  userName: { fontSize: '12.5px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  inputEdit: { fontSize: '11px', padding: '3px 5px', borderRadius: '5px', outline: 'none' },
  userRole: { fontSize: '10.5px', textTransform: 'capitalize', marginTop: '1px' },
  popover: { 
    position: 'absolute', top: '55px', left: '6px', borderRadius: '10px', padding: '6px', 
    display: 'flex', flexDirection: 'column', gap: '3px', boxShadow: '0 12px 30px rgba(0,0,0,0.3)', zIndex: 400, width: '155px' 
  },
  popBtn: { padding: '7px 8px', fontSize: '11.5px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px' },
  popBtnCancel: { padding: '5px', color: '#ef4444', fontSize: '11px', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'center' },
  nav: { 
    position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' 
  },
  navLink: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
    borderRadius: '8px', fontSize: '12.5px', fontWeight: '500', textDecoration: 'none', transition: 'all 0.15s ease'
  },
  navLinkActive: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
    borderRadius: '0 8px 8px 0', fontSize: '12.5px', fontWeight: '600', textDecoration: 'none', transition: 'all 0.15s ease'
  },
  navText: {
    overflow: 'hidden',  textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  btnLogout: {
    marginTop: 'auto', display: 'flex', alignItems : 'center', justifyContent: 'center',
    gap: '6px', padding: '10px', borderRadius: '8px', border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
  }
};