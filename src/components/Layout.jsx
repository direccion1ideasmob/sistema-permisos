import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import imageCompression from 'browser-image-compression';
import { useAuth } from '../context/AuthContext';

import { ClipboardList, PenLine, FileBarChart, Users, ShieldCheck, LogOut, Menu, X, Camera, Image as ImageIcon, Palette } from 'lucide-react';

import LOGO_NEGRO_BARRA from "../assets/LogoNegro.png";

import fondo1 from '../assets/fondo1.jpg';
import fondo2 from '../assets/fondo2.jpg';
import fondo3 from '../assets/fondo3.jpg';
import fondo4 from '../assets/fondo4.jpg';

const fondos = [fondo1, fondo2, fondo3, fondo4];

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const location = useLocation();

  const [anchoVentana, setAnchoVentana] = useState(window.innerWidth);
  const [menuAbierto, setMenuAbierto] = useState(window.innerWidth >= 1440);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // ESTADO DEL CARRUSEL DE FONDOS
  const [bgIndex, setBgIndex] = useState(0);

  const [usuarioLogueado, setUsuarioLogueado] = useState(usuario);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState(usuario?.nombre_completo || "");

  const [colorTema, setColorTema] = useState(() => usuario?.color_tema || localStorage.getItem('tema_app') || '#0ea5e9');

  // AHORA CAMBIAN CADA 6 SEGUNDOS (Mucho más rápido)
  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % fondos.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('tema_app', colorTema);
    document.documentElement.style.setProperty('--color-tema', colorTema);
  }, [colorTema]);

  useEffect(() => {
    if (usuarioLogueado?.color_tema && usuarioLogueado.color_tema !== colorTema) {
      setColorTema(usuarioLogueado.color_tema);
    }
  }, [usuarioLogueado?.color_tema]);

  useEffect(() => {
    const manejarResize = () => setAnchoVentana(window.innerWidth);
    window.addEventListener('resize', manejarResize);
    return () => window.removeEventListener('resize', manejarResize);
  }, []);

  useEffect(() => {
    const consultarDatosActualizados = async () => {
      if (!usuario?.id) return;
      const { data, error } = await supabase.from('usuarios').select('nombre_completo, foto_url, color_tema, rol').eq('id', usuario.id).single();
      if (data && !error) {
        setUsuarioLogueado(prev => ({ ...prev, ...data }));
        if (data.color_tema) setColorTema(data.color_tema);
        const sesionActual = JSON.parse(localStorage.getItem('permisos_sesion') || '{}');
        localStorage.setItem('permisos_sesion', JSON.stringify({ ...sesionActual, ...data }));
      }
    };
    consultarDatosActualizados();
  }, [usuario?.id]);

  const cambiarColorTema = async (nuevoColor) => {
    setColorTema(nuevoColor);
    if (usuarioLogueado?.id) {
      setUsuarioLogueado(prev => ({ ...prev, color_tema: nuevoColor }));
      await supabase.from('usuarios').update({ color_tema: nuevoColor }).eq('id', usuarioLogueado.id);
      const sesionActual = JSON.parse(localStorage.getItem('permisos_sesion') || '{}');
      sesionActual.color_tema = nuevoColor;
      localStorage.setItem('permisos_sesion', JSON.stringify(sesionActual));
    }
  };

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

  const cerrarMenuMovil = () => { if (isMobile) setMenuAbierto(false); };

  const rol = usuarioLogueado?.rol || 'empleado';
  const puedeAprobar = ['jefe_area', 'gerente', 'gerente_rh'].includes(rol);
  const esNominas = rol === 'rh_nominas';
  const esCaseta = rol === 'caseta';
  const miFoto = usuarioLogueado?.foto_url || `https://ui-avatars.com/api/?name=${usuarioLogueado?.nombre_completo}&background=fff&color=000&bold=true&size=200`;

  return (
    <div style={s.appBase}>
      
      {/* 1. LIENZO GIGANTE: FONDOS INDUSTRIALES ROTATIVOS */}
      <div style={s.fondoGlobal}>
        {fondos.map((img, index) => (
          <img
            key={index}
            src={img}
            alt="Fondo Planta"
            style={{
              ...s.imagenFondo,
              opacity: bgIndex === index ? 1 : 0
            }}
          />
        ))}
        {/* Capa negra ligerísima para que las letras blancas no se pierdan */}
        <div style={s.overlayGradiente}></div>
      </div>

      {/* 2. CAPA DE LA APLICACIÓN FLOTANTE */}
      <div style={s.appContainer}>
        
        <button onClick={() => setMenuAbierto(!menuAbierto)} style={{ ...s.menuBtn, backgroundColor: colorTema }}>
          {menuAbierto ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* SIDEBAR MÁS TRANSPARENTE */}
        <aside style={{
          ...s.sidebar,
          // Transparencia al 50% con el color del usuario, permite ver la imagen de fondo mucho mejor
          backgroundColor: `color-mix(in srgb, ${colorTema} 50%, rgba(0,0,0,0.1))`,
          position: isMobile ? 'fixed' : 'relative',
          transform: isMobile ? (menuAbierto ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          marginLeft: isMobile ? '0' : (menuAbierto ? '0' : '-300px')
        }}>

          <div style={s.profileTop}>
            <div style={s.selectorTema}>
              <label style={s.labelSelector} title="Cambiar color de la interfaz">
                <Palette size={18} strokeWidth={1.5} color="rgba(255,255,255,0.7)" />
                <input type="color" value={colorTema} onChange={(e) => cambiarColorTema(e.target.value)} style={s.inputColorOculto} />
              </label>
            </div>

            <div style={s.avatarBig} onClick={() => setShowPhotoOptions(!showPhotoOptions)}>
              <img src={miFoto} alt="Perfil" style={s.imgFull} />
              <div style={s.avatarOverlay}>{loading ? '...' : <Camera size={16} />}</div>
            </div>

            {showPhotoOptions && (
              <div style={s.popover}>
                <label style={s.popBtn}><Camera size={16} /> Tomar foto <input type="file" accept="image/*" capture="environment" hidden onChange={handleUpdateFoto} /></label>
                <label style={s.popBtn}><ImageIcon size={16} /> Subir archivo <input type="file" accept="image/*" hidden onChange={handleUpdateFoto} /></label>
                <button onClick={() => setShowPhotoOptions(false)} style={s.popBtnCancel}>Cancelar</button>
              </div>
            )}

            <div style={s.profileInfo}>
              {editandoNombre ? (
                <input style={s.inputEdit} value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} autoFocus onBlur={guardarNombre} onKeyDown={(e) => e.key === 'Enter' && guardarNombre()} />
              ) : (
                <span style={s.userName} onClick={() => setEditandoNombre(true)}>{usuarioLogueado?.nombre_completo}</span>
              )}
              <span style={s.userLabel}>{rol.replace('_', ' ')}</span>
            </div>
          </div>

          <nav style={s.nav}>
            {!esCaseta && (
              <Link to="/mis-permisos" onClick={cerrarMenuMovil} style={location.pathname === '/mis-permisos' ? s.btnNavActive : s.btnNav}>
                <ClipboardList size={18} strokeWidth={1.5} /> Mis Permisos
              </Link>
            )}

            {puedeAprobar && (
              <Link to="/aprobaciones" onClick={cerrarMenuMovil} style={location.pathname === '/aprobaciones' ? s.btnNavActive : s.btnNav}>
                <PenLine size={18} strokeWidth={1.5} /> Aprobaciones
              </Link>
            )}

            {esNominas && (
              <>
                <Link to="/kardex" onClick={cerrarMenuMovil} style={location.pathname === '/kardex' ? s.btnNavActive : s.btnNav}>
                  <FileBarChart size={18} strokeWidth={1.5} /> Kardex / Reportes
                </Link>
                <Link to="/directorio" onClick={cerrarMenuMovil} style={location.pathname === '/directorio' ? s.btnNavActive : s.btnNav}>
                  <Users size={18} strokeWidth={1.5} /> Directorio RH
                </Link>
              </>
            )}

            {esCaseta && (
              <Link to="/caseta" onClick={cerrarMenuMovil} style={location.pathname === '/caseta' ? s.btnNavActive : s.btnNav}>
                <ShieldCheck size={18} strokeWidth={1.5} /> Control Caseta
              </Link>
            )}
            
            <button onClick={() => window.confirm("¿Cerrar sesión?") && cerrarSesion()} style={s.btnLogout}>
              <LogOut size={18} strokeWidth={1.5} /> Cerrar Sesión
            </button>
          </nav>

          <div style={s.footerArea}>
            {/* TU LOGO RESTAURADO EXACTAMENTE COMO LO TENÍAS */}
            <img src={LOGO_NEGRO_BARRA} alt="Logo" style={s.imgLogoFooter} />
          </div>
        </aside>

        {menuAbierto && isMobile && <div onClick={() => setMenuAbierto(false)} style={s.overlay} />}

        {/* CONTENEDOR PRINCIPAL: PANEL CENTRAL MUY TRANSPARENTE */}
        <main style={s.mainArea}>
          <div style={s.glassCard}>
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
}

const s = {
  // --- ROOT DE LA APP ---
  appBase: { 
    position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#000' 
  },
  
  // --- FONDOS INDUSTRIALES ROTATIVOS ---
  // --- FONDOS INDUSTRIALES ROTATIVOS ---
  fondoGlobal: { 
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 
  },
  imagenFondo: { 
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
    objectFit: 'cover', 
    transition: 'opacity 1s ease-in-out',
    
    /* === AGREGA ESTA LÍNEA PARA VOLVERLAS GRISES Y OSCURAS === */
    filter: 'grayscale(5%) brightness(0.85) contrast(0.95)'
  },
  overlayGradiente: { 
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
    /* Capa oscura ligera para emparejar la transición */
    background: 'rgba(0, 0, 0, 0.35)', 
  },

  // --- CONTENEDOR FLOTANTE ---
  appContainer: { 
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
    display: 'flex', zIndex: 1, fontFamily: '"Inter", system-ui, sans-serif'
  },
  
  menuBtn: { position: 'fixed', top: '20px', left: '20px', zIndex: 200, color: '#fff', padding: '10px', borderRadius: '8px', cursor: 'pointer', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
  
  // --- SIDEBAR TRANSPARENTE ---
  sidebar: { 
    zIndex: 150, height: '100vh', color: '#FFF', display: 'flex', flexDirection: 'column', 
    padding: '60px 24px 20px 24px', transition: '0.3s ease', boxSizing: 'border-box', 
    width: '300px', flexShrink: 0, 
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', // Desenfoque más suave para que la foto se note más
    borderRight: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '4px 0 20px rgba(0,0,0,0.15)' 
  },
  
  overlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 140 },
  
  profileTop: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '40px', paddingBottom: '25px', position: 'relative' },
  selectorTema: { position: 'absolute', top: '-40px', right: '-10px' },
  labelSelector: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', border: '1px solid rgba(255,255,255,0.3)' },
  inputColorOculto: { opacity: 0, width: 0, height: 0, position: 'absolute', cursor: 'pointer' },

  avatarBig: { width: '115px', height: '115px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.9)', overflow: 'hidden', marginBottom: '18px', position: 'relative', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' },
  avatarOverlay: { position: 'absolute', bottom: 0, width: '100%', height: '30%', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' },
  imgFull: { width: '100%', height: '100%', objectFit: 'cover' },
  
  popover: { position: 'absolute', top: '120px', backgroundColor: '#FFF', borderRadius: '12px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 12px 30px rgba(0,0,0,0.2)', zIndex: 300, width: '190px' },
  popBtn: { padding: '10px 12px', color: '#3f3f46', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '6px', transition: '0.2s' },
  popBtnCancel: { padding: '10px', color: '#ef4444', fontSize: '13px', fontWeight: '600', border: 'none', background: 'none', cursor: 'pointer', marginTop: '4px' },
  
  profileInfo: { display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' },
  userName: { fontSize: '16px', fontWeight: '600', cursor: 'pointer', color: '#fff', letterSpacing: '-0.3px', textShadow: '0 1px 3px rgba(0,0,0,0.4)' },
  inputEdit: { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', textAlign: 'center', padding: '6px', borderRadius: '6px', fontSize: '15px', outline: 'none', width: '90%', margin: '0 auto' },
  userLabel: { fontSize: '12px', color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize', fontWeight: '500' },
  
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  btnNav: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', color: 'rgba(255,255,255,0.8)', borderRadius: '12px', fontSize: '14px', fontWeight: '500', textDecoration: 'none', transition: 'all 0.2s', boxSizing: 'border-box' },
  btnNavActive: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFF', borderRadius: '12px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', transition: 'all 0.2s', boxSizing: 'border-box', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' },
  
  btnLogout: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', marginTop: 'auto', backgroundColor: 'rgba(0,0,0,0.2)', color: '#fca5a5', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: '0.2s' },
  
  // RESTAURACIÓN EXACTA DE TU LOGO
  footerArea: { marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '10px' }, 
  imgLogoFooter: { 
    width: '130px', 
    opacity: 0.3, 
    pointerEvents: 'none',
    mixBlendMode: 'screen' 
  },

  // --- ÁREA CENTRAL DE TRABAJO ---
  mainArea: { 
    flex: 1, display: 'flex', padding: '24px', boxSizing: 'border-box', overflow: 'hidden'
  },
  
  // --- TARJETA MUCHO MÁS TRANSPARENTE ---
  glassCard: { 
    flex: 1, width: '100%', height: '100%',
    // Blanco al 65% (antes estaba en 92%). Deja pasar casi por completo el color de la foto
    backgroundColor: 'rgba(255, 255, 255, 0.55)', 
    backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', // Menos borroso
    borderRadius: '24px', 
    border: '1px solid rgba(255, 255, 255, 0.4)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.1)',
    padding: '30px', overflowY: 'auto', boxSizing: 'border-box'
  }
};