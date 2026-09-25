import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../context/AuthContext';

import { 
  ClipboardList, PenLine, FileBarChart, Users, ShieldCheck, 
  LogOut, Menu, X, Camera, Image as ImageIcon, Sun, Moon 
} from 'lucide-react';

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const location = useLocation();

  const [anchoVentana, setAnchoVentana] = useState(window.innerWidth);
  // Se abre por defecto en pantallas medianas/grandes (>= 1200px)
  const [menuAbierto, setMenuAbierto] = useState(window.innerWidth >= 1200);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [loading, setLoading] = useState(false);

  // MODO: 'oscuro' | 'claro'
  const [modoOscuro, setModoOscuro] = useState(() => {
    const guardado = localStorage.getItem('tema_sistema');
    return guardado ? guardado === 'oscuro' : true;
  });

  const [usuarioLogueado, setUsuarioLogueado] = useState(usuario);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(usuario?.nombre_completo || "");

  useEffect(() => {
    localStorage.setItem('tema_sistema', modoOscuro ? 'oscuro' : 'claro');
  }, [modoOscuro]);

  useEffect(() => {
    const manejarResize = () => setAnchoVentana(window.innerWidth);
    window.addEventListener('resize', manejarResize);
    return () => window.removeEventListener('resize', manejarResize);
  }, []);

  useEffect(() => {
    const consultarDatosActualizados = async () => {
      if (!usuario?.id) return;
      const { data, error } = await supabase
        .from('usuarios')
        .select('nombre_completo, foto_url, rol')
        .eq('id', usuario.id)
        .single();

      if (data && !error) {
        setUsuarioLogueado(prev => ({ ...prev, ...data }));
        const sesionActual = JSON.parse(localStorage.getItem('permisos_sesion') || '{}');
        localStorage.setItem('permisos_sesion', JSON.stringify({ ...sesionActual, ...data }));
      }
    };
    consultarDatosActualizados();
  }, [usuario?.id]);

  const isMobile = anchoVentana < 1000;

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

  // En móvil cierra el menú al navegar; en computadora permanece como lo dejó el usuario
  const cerrarMenuMovil = () => { if (isMobile) setMenuAbierto(false); };

  const rol = usuarioLogueado?.rol || 'empleado';
  const puedeAprobar = ['jefe_area', 'gerente', 'gerente_rh'].includes(rol);
  const esNominas = rol === 'rh_nominas';
  const esCaseta = rol === 'caseta';
  const miFoto = usuarioLogueado?.foto_url || `https://ui-avatars.com/api/?name=${usuarioLogueado?.nombre_completo}&background=16a34a&color=fff&bold=true&size=200`;

  // === PALETA MINIMALISTA ===
  const tema = {
    bgApp: modoOscuro ? '#000000' : '#f8fafc',
    sidebarBg: modoOscuro ? '#09090b' : '#ffffff',
    cardBg: modoOscuro ? '#0c0c0e' : '#ffffff',
    border: modoOscuro ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    textPrimary: modoOscuro ? '#ffffff' : '#09090b',
    textSecondary: modoOscuro ? '#a1a1aa' : '#71717a',
    accent: '#16a34a',
    navActiveBg: modoOscuro ? 'rgba(22, 163, 74, 0.16)' : 'rgba(22, 163, 74, 0.1)',
    navActiveText: modoOscuro ? '#4ade80' : '#15803d',
    navActiveBorder: '#16a34a',
  };

  // MARCA DE AGUA DEL ÁREA DE TRABAJO
  const logoAguaWorkspace = modoOscuro 
    ? "/LogoNegro-removebg-preview.png" 
    : "/LogoVerde-removebg-preview.png";

  return (
    <div style={{ ...s.appBase, backgroundColor: tema.bgApp, color: tema.textPrimary }}>
      
      {/* BOTÓN FLOTANTE UNIVERSAL (MÓVIL Y COMPUTADORA CUANDO EL MENÚ ESTÁ CONTRAÍDO) */}
      {!menuAbierto && (
        <button 
          onClick={() => setMenuAbierto(true)} 
          style={{ ...s.menuOpenBtn, backgroundColor: tema.sidebarBg, color: tema.textPrimary, borderColor: tema.border }}
          title="Desplegar menú"
          aria-label="Desplegar menú"
        >
          <Menu size={18} />
        </button>
      )}

      <div style={s.appContainer}>
        
        {/* SIDEBAR COLAPSABLE (50% EN CELULAR, 260px EN COMPUTADORA) */}
        <aside style={{
          ...s.sidebar,
          width: isMobile ? '50vw' : '260px',
          padding: isMobile ? '16px 12px' : '20px 16px',
          backgroundColor: tema.sidebarBg,
          borderColor: tema.border,
          position: isMobile ? 'fixed' : 'relative',
          // En móvil desliza con transform; en computadora se contrae con marginLeft
          transform: isMobile ? (menuAbierto ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          marginLeft: isMobile ? '0' : (menuAbierto ? '0' : '-260px')
        }}>

          {/* 1. MARCA DE AGUA EN LA BARRA (CENTRO - UN POCO ABAJO) */}
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

          {/* 2. CABECERA CON BOTÓN PARA CONTRAER (DISPONIBLE EN PC Y MÓVIL) */}
          <div style={s.brandHeader}>
            <div style={s.headerActions}>
              <button 
                onClick={() => setModoOscuro(!modoOscuro)} 
                style={{ ...s.btnIcon, borderColor: tema.border, color: tema.textSecondary }}
                title={modoOscuro ? "Modo Claro" : "Modo Oscuro"}
              >
                {modoOscuro ? <Sun size={14} /> : <Moon size={14} />}
              </button>

              {/* BOTÓN PARA CONTRAER LA BARRA (PC Y CELULAR) */}
              <button 
                onClick={() => setMenuAbierto(false)} 
                style={{ ...s.btnIcon, borderColor: tema.border, color: tema.textSecondary }}
                title="Contraer menú"
                aria-label="Contraer menú"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 3. PERFIL */}
          <div style={{ ...s.profileBox, borderColor: tema.border, backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
            <div style={s.avatarWrapper} onClick={() => setShowPhotoOptions(!showPhotoOptions)}>
              <img src={miFoto} alt="Perfil" style={s.avatarImg} />
              <div style={s.avatarEditBadge}><Camera size={11} color="#fff" /></div>
            </div>

            {showPhotoOptions && (
              <div style={{ ...s.popover, backgroundColor: tema.sidebarBg, borderColor: tema.border }}>
                <label style={{ ...s.popBtn, color: tema.textPrimary }}><Camera size={13} /> Tomar foto <input type="file" accept="image/*" capture="environment" hidden onChange={handleUpdateFoto} /></label>
                <label style={{ ...s.popBtn, color: tema.textPrimary }}><ImageIcon size={13} /> Subir archivo <input type="file" accept="image/*" hidden onChange={handleUpdateFoto} /></label>
                <button onClick={() => setShowPhotoOptions(false)} style={s.popBtnCancel}>Cancelar</button>
              </div>
            )}

            <div style={s.profileDetails}>
              {editandoNombre ? (
                <input 
                  style={{ ...s.inputEdit, backgroundColor: modoOscuro ? '#000' : '#fff', color: tema.textPrimary, borderColor: tema.border }} 
                  value={nuevoNombre} 
                  onChange={e => setNuevoNombre(e.target.value)} 
                  autoFocus 
                  onBlur={guardarNombre} 
                  onKeyDown={(e) => e.key === 'Enter' && guardarNombre()} 
                />
              ) : (
                <span style={{ ...s.userName, color: tema.textPrimary }} onClick={() => setEditandoNombre(true)}>
                  {usuarioLogueado?.nombre_completo || 'Usuario'}
                </span>
              )}
              <span style={{ ...s.userRole, color: tema.textSecondary }}>
                {rol.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* 4. NAVEGACIÓN */}
          <nav style={s.nav}>
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
                  to="/kardex" 
                  onClick={cerrarMenuMovil} 
                  style={location.pathname === '/kardex' ? { ...s.navLinkActive, backgroundColor: tema.navActiveBg, color: tema.navActiveText, borderLeft: `3px solid ${tema.navActiveBorder}` } : { ...s.navLink, color: tema.textSecondary }}
                >
                  <FileBarChart size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  <span style={s.navText}>Kardex / Reportes</span>
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

        {/* TELÓN DE FONDO (SOLO EN MÓVIL) */}
        {menuAbierto && isMobile && <div onClick={() => setMenuAbierto(false)} style={s.mobileBackdrop} />}

        {/* CONTENEDOR PRINCIPAL */}
        <main style={s.mainArea}>
          <div style={{
            ...s.contentCard,
            backgroundColor: tema.cardBg,
            borderColor: tema.border,
            boxShadow: modoOscuro ? '0 10px 30px rgba(0,0,0,0.6)' : '0 2px 12px rgba(0,0,0,0.04)'
          }}>

            {/* MARCA DE AGUA DEL ÁREA DE TRABAJO */}
            <div style={s.watermarkInsideCard}>
              <img 
                src={logoAguaWorkspace} 
                alt="Marca de agua central" 
                style={{
                  ...s.watermarkImg,
                  filter: modoOscuro ? 'brightness(0) invert(1)' : 'none',
                  opacity: modoOscuro ? 0.16 : 0.22,
                }} 
              />
            </div>

            {/* CONTENIDO PRINCIPAL */}
            <div style={s.outletLayer}>
              <Outlet />
            </div>

          </div>
        </main>

      </div>
    </div>
  );
}

const s = {
  appBase: { 
    position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', 
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
    letterSpacing: '-0.015em',
    transition: 'background-color 0.2s ease'
  },
  
  appContainer: { 
    position: 'relative', zIndex: 1, display: 'flex', width: '100%', height: '100%', overflow: 'hidden' 
  },
  
  // BOTÓN UNIVERSAL PARA DESPLEGAR (MÓVIL Y ESCRITORIO)
  menuOpenBtn: { 
    position: 'fixed', top: '14px', left: '14px', zIndex: 300, 
    width: '38px', height: '38px', borderRadius: '8px', 
    border: '1px solid', display: 'flex', alignItems: 'center', 
    justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,0,0,0.2)'
  },
  
  sidebar: { 
    zIndex: 300, 
    height: '100dvh', /* Ajuste dinámico para pantallas de celular */
    overflowY: 'auto', /* Permite deslizar si la pantalla es chica */
    paddingBottom: '40px', /* Espacio extra abajo para que nunca se tape */
    display: 'flex', 
    flexDirection: 'column', 
    padding: '20px 20px 30px 20px', 
    transition: 'all 0.3s ease', 
    boxSizing: 'border-box', 
    width: '300px', 
    flexShrink: 0, 
    backdropFilter: 'blur(10px)', 
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: '4px 0 25px rgba(0,0,0,0.1)' 
  },

  // MARCA DE AGUA LATERAL
  sidebarWatermarkContainer: {
    position: 'absolute',
    top: '60%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    pointerEvents: 'none',
    zIndex: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sidebarWatermarkImg: {
    width: '100%',
    maxHeight: '210px',
    objectFit: 'contain',
    userSelect: 'none',
    transition: 'opacity 0.3s ease'
  },
overlay: { 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    width: '100vw', 
    height: '100vh', 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    backdropFilter: 'blur(3px)', 
    zIndex: 200 /* <-- AHORA QUEDA POR DETRÁS DE LA BARRA */
  },
  // CABECERA
  brandHeader: {
    position: 'relative', zIndex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: '12px', marginBottom: '8px'
  },
  headerActions: {
    display: 'flex', alignItems: 'center', gap: '5px'
  },
  btnIcon: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '28px', height: '28px', borderRadius: '7px',
    border: '1px solid', background: 'transparent', cursor: 'pointer'
  },

  // PERFIL
  profileBox: {
    position: 'relative', zIndex: 1,
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 8px', borderRadius: '10px', border: '1px solid',
    marginBottom: '16px'
  },
  avatarWrapper: {
    width: '38px', height: '38px', borderRadius: '50%',
    overflow: 'hidden', position: 'relative', cursor: 'pointer', flexShrink: 0
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, left: 0, width: '100%', height: '13px',
    backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  profileDetails: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  userName: { fontSize: '12.5px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' },
  inputEdit: { fontSize: '11px', padding: '3px 5px', borderRadius: '5px', border: '1px solid', outline: 'none' },
  userRole: { fontSize: '10.5px', textTransform: 'capitalize', marginTop: '1px' },

  popover: { 
    position: 'absolute', top: '55px', left: '6px', 
    borderRadius: '10px', padding: '6px', display: 'flex', 
    flexDirection: 'column', gap: '3px', boxShadow: '0 12px 30px rgba(0,0,0,0.3)', 
    border: '1px solid', zIndex: 400, width: '155px' 
  },
  popBtn: { padding: '7px 8px', fontSize: '11.5px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '6px' },
  popBtnCancel: { padding: '5px', color: '#ef4444', fontSize: '11px', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'center' },

  // NAVEGACIÓN
  nav: { 
    position: 'relative', zIndex: 1,
    flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' 
  },
  navLink: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
    borderRadius: '8px', fontSize: '12.5px', fontWeight: '500', textDecoration: 'none',
    transition: 'all 0.15s ease'
  },
  navLinkActive: {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px',
    borderRadius: '0 8px 8px 0', fontSize: '12.5px', fontWeight: '600', textDecoration: 'none',
    transition: 'all 0.15s ease'
  },
  navText: {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  },
  btnLogout: {
    marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', padding: '10px', borderRadius: '8px', border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444',
    fontSize: '12px', fontWeight: '600', cursor: 'pointer'
  },

  // TELÓN EN MÓVIL
  mobileBackdrop: {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, backdropFilter: 'blur(2px)'
  },

  // ÁREA DE CONTENIDO (SE EXPANDE AL 100% SUAVEMENTE)
  mainArea: { 
    flex: 1, display: 'flex', padding: '14px', boxSizing: 'border-box', 
    overflow: 'hidden', width: '100%', transition: 'all 0.25s ease'
  },
  contentCard: { 
    position: 'relative', flex: 1, width: '100%', height: '100%', 
    borderRadius: '16px', border: '1px solid', padding: '22px', 
    overflowY: 'auto', boxSizing: 'border-box', transition: 'background-color 0.2s ease'
  },

  // MARCA DE AGUA EN EL ÁREA DE TRABAJO
  watermarkInsideCard: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: 0, overflow: 'hidden'
  },
  watermarkImg: {
    width: 'min(70vw, 520px)',
    maxHeight: '60%',
    objectFit: 'contain',
    userSelect: 'none',
    transition: 'all 0.3s ease'
  },

  outletLayer: {
    position: 'relative', zIndex: 1, width: '100%'
  }
};