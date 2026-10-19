import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { useAuth } from '../auth/AuthContext';
import { Menu } from 'lucide-react';

import Sidebar from './Sidebar';
import ModalSeguridad from './ModalSeguridad';

export default function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [anchoVentana, setAnchoVentana] = useState(window.innerWidth);
  const [menuAbierto, setMenuAbierto] = useState(window.innerWidth >= 1200);

  const [modoOscuro, setModoOscuro] = useState(() => {
    const guardado = localStorage.getItem('tema_sistema');
    return guardado ? guardado === 'oscuro' : true;
  });

  const [usuarioLogueado, setUsuarioLogueado] = useState(usuario);
  const [modalSeguridad, setModalSeguridad] = useState(false);

  useEffect(() => {
    localStorage.setItem('tema_sistema', modoOscuro ? 'oscuro' : 'claro');
  }, [modoOscuro]);

  useEffect(() => {
    const manejarResize = () => setAnchoVentana(window.innerWidth);
    window.addEventListener('resize', manejarResize);
    return () => window.removeEventListener('resize', manejarResize);
  }, []);

  // === LÓGICA DE REINICIO DIARIO ===
  useEffect(() => {
    const hoy = new Date().toLocaleDateString();
    const ultimoDiaVisitado = localStorage.getItem('ultimo_dia_visitado');

    if (!ultimoDiaVisitado || ultimoDiaVisitado !== hoy) {
      localStorage.setItem('ultimo_dia_visitado', hoy);
      navigate('/');
    }
  }, [navigate]);

  // === GUARDIÁN DE SESIÓN Y PIN EN TIEMPO REAL ===
  // Si el PIN cambia en la base de datos o el usuario es dado de baja, expulsa a este dispositivo
  const verificarIntegridadSesion = useCallback(async () => {
    if (!usuario?.id) return;

    const { data, error } = await supabase
      .from('usuarios')
      .select('nombre_completo, foto_url, rol, pin, activo, departamento_id, area, puesto')
      .eq('id', usuario.id)
      .single();

    if (error || !data) return;

    const sesionLocal = JSON.parse(localStorage.getItem('permisos_sesion') || '{}');

    // 1. Si el empleado fue dado de baja en el sistema -> Expulsar
    if (data.activo === false) {
      alert('Tu cuenta ha sido desactivada por Recursos Humanos.');
      cerrarSesion();
      return;
    }

    // 2. Si el dispositivo tenía un PIN guardado y ya no coincide con el PIN actual en Supabase -> Expulsar
    if (sesionLocal.pin && data.pin && String(sesionLocal.pin).trim() !== String(data.pin).trim()) {
      alert('🔒 Sesión finalizada: El PIN de seguridad fue modificado desde otro dispositivo o por Recursos Humanos.');
      cerrarSesion();
      return;
    }

    // 3. Sincronizar datos actualizados (y sellar el pin actual si no estaba en el objeto local)
    const datosSincronizados = { ...sesionLocal, ...data, pin: data.pin };
    setUsuarioLogueado(prev => ({ ...prev, ...data }));
    localStorage.setItem('permisos_sesion', JSON.stringify(datosSincronizados));
  }, [usuario?.id, cerrarSesion]);

  useEffect(() => {
    verificarIntegridadSesion();
    // Verificar también cada 20 segundos por si cambian el PIN mientras la pantalla está quieta
    const intervalo = setInterval(verificarIntegridadSesion, 20000);
    return () => clearInterval(intervalo);
  }, [location.pathname, verificarIntegridadSesion]);

  const isMobile = anchoVentana < 1000;
  const esInicio = location.pathname === '/' || location.pathname === '/inicio';

  // === PALETA GRIS CARBÓN PURO UNIFICADA ===
  const tema = {
    bgApp: modoOscuro ? '#171717' : '#fafafa',
    sidebarBg: modoOscuro ? '#262626' : '#ffffff',
    cardBg: modoOscuro ? '#262626' : '#ffffff',
    border: modoOscuro ? '#404040' : '#e5e5e5',
    textPrimary: modoOscuro ? '#ffffff' : '#171717',
    textSecondary: modoOscuro ? '#a3a3a3' : '#737373',
    inputBg: modoOscuro ? '#171717' : '#fafafa',
    accent: '#16a34a',
    navActiveBg: modoOscuro ? 'rgba(22, 163, 74, 0.16)' : 'rgba(22, 163, 74, 0.1)',
    navActiveText: modoOscuro ? '#4ade80' : '#15803d',
    navActiveBorder: '#16a34a',
  };

  const logoAguaWorkspace = modoOscuro 
    ? "/LogoNegro-removebg-preview.png" 
    : "/LogoVerde-removebg-preview.png";

  return (
    <div style={{ ...s.appBase, backgroundColor: tema.bgApp, color: tema.textPrimary }}>
      
      {!menuAbierto && (
        <button 
          onClick={() => setMenuAbierto(true)} 
          style={{ 
            ...s.menuOpenBtn, 
            backgroundColor: tema.sidebarBg, 
            color: tema.textPrimary, 
            border: `1.5px solid ${tema.border}` 
          }}
          title="Desplegar menú"
          aria-label="Desplegar menú"
        >
          <Menu size={18} />
        </button>
      )}

      <div style={s.appContainer}>
        
        <Sidebar 
          usuarioLogueado={usuarioLogueado}
          setUsuarioLogueado={setUsuarioLogueado}
          isMobile={isMobile}
          menuAbierto={menuAbierto}
          setMenuAbierto={setMenuAbierto}
          modoOscuro={modoOscuro}
          setModoOscuro={setModoOscuro}
          tema={tema}
          onOpenSeguridad={() => setModalSeguridad(true)}
        />

        {menuAbierto && isMobile && <div onClick={() => setMenuAbierto(false)} style={s.mobileBackdrop} />}

        <main style={s.mainArea}>
          <div style={{
            ...s.contentCard,
            backgroundColor: tema.cardBg,
            border: `1.5px solid ${tema.border}`,
            boxShadow: modoOscuro ? '0 10px 30px rgba(0,0,0,0.6)' : '0 2px 12px rgba(0,0,0,0.04)'
          }}>

            {!esInicio && (
              <div style={s.watermarkInsideCard}>
                <img 
                  src={logoAguaWorkspace} 
                  alt="Marca de agua central" 
                  style={{
                    ...s.watermarkImg,
                    filter: modoOscuro ? 'brightness(0) invert(1)' : 'none',
                    opacity: modoOscuro ? 0.14 : 0.20,
                  }} 
                />
              </div>
            )}

            <div style={s.outletLayer}>
              <div style={{ flex: 1 }}>
                <Outlet />
              </div>

              <footer style={{
                marginTop: "36px",
                paddingTop: "16px",
                paddingBottom: (window.innerWidth < 768) ? "24px" : "10px",
                borderTop: `1px solid ${tema.border}`,
                display: "flex",
                flexDirection: (window.innerWidth < 768) ? "column" : "row",
                justifyContent: (window.innerWidth < 768) ? "center" : "space-between",
                alignItems: "center",
                textAlign: "center",
                gap: (window.innerWidth < 768) ? "6px" : "12px",
                fontFamily: "'Inter', Georgia, serif",
                fontSize: (window.innerWidth < 768) ? "8.5px" : "9.5px",
                fontWeight: "600",
                color: tema.textSecondary,
                letterSpacing: (window.innerWidth < 768) ? "0.14em" : "0.22em",
                lineHeight: "1.5",
                textTransform: "uppercase",
                opacity: 0.8,
                userSelect: "none"
              }}>
                <span>RH CONTROL &amp; MANAGEMENT SYSTEM V1.0 &nbsp;•&nbsp; © 2026</span>
                <span>POWERED BY <strong style={{ color: tema.textPrimary, fontWeight: "800" }}>ING. ALEJANDRO VALENZO</strong></span>
              </footer>
            </div>

          </div>
        </main>

      </div>

      {modalSeguridad && (
        <ModalSeguridad 
          onClose={() => setModalSeguridad(false)}
          usuarioLogueado={usuarioLogueado}
          tema={tema}
          modoOscuro={modoOscuro}
        />
      )}

    </div>
  );
}

const s = {
  appBase: { 
    position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', 
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    letterSpacing: '-0.015em',
    transition: 'background-color 0.2s ease'
  },
  appContainer: { 
    position: 'relative', zIndex: 1, display: 'flex', width: '100%', height: '100%', overflow: 'hidden' 
  },
  menuOpenBtn: { 
    position: 'fixed', top: '14px', left: '14px', zIndex: 300, 
    width: '38px', height: '38px', borderRadius: '8px', 
    display: 'flex', alignItems: 'center', 
    justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 12px rgba(0,0,0,0.2)'
  },
  mobileBackdrop: {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, backdropFilter: 'blur(2px)'
  },
  mainArea: { 
    flex: 1, display: 'flex', padding: '14px', boxSizing: 'border-box', 
    overflow: 'hidden', width: '100%', transition: 'all 0.25s ease'
  },
  contentCard: { 
    position: 'relative', flex: 1, width: '100%', height: '100%', 
    borderRadius: '16px', padding: '22px', 
    overflowY: 'auto', boxSizing: 'border-box', transition: 'background-color 0.2s ease'
  },
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
    position: 'relative', zIndex: 1, width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
  }
};
