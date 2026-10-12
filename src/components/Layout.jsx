import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Menu } from 'lucide-react';

// === COMPONENTES MODULARES ===
import Sidebar from './layout/Sidebar';
import ModalSeguridad from './layout/ModalSeguridad';

export default function Layout() {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigate = useNavigate(); // <-- Agregado para poder redirigir al Inicio

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
    // Obtenemos la fecha de hoy en formato local (ej. "12/10/2026")
    const hoy = new Date().toLocaleDateString();
    // Revisamos qué fecha tiene guardada el usuario como su última visita
    const ultimoDiaVisitado = localStorage.getItem('ultimo_dia_visitado');

    // Si no hay registro (primera vez) o si la fecha de hoy es distinta al registro
    if (!ultimoDiaVisitado || ultimoDiaVisitado !== hoy) {
      localStorage.setItem('ultimo_dia_visitado', hoy); // Actualizamos el registro
      navigate('/'); // Lo mandamos al inicio para darle los buenos días
    }
  }, [navigate]); // Solo se ejecuta una vez al cargar el Layout

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
  const esInicio = location.pathname === '/' || location.pathname === '/inicio';

  // === PALETA HIGH CONTRAST (ZINC / GRIS OSCURO) ===
  const tema = {
    bgApp: modoOscuro ? '#18181b' : '#f8fafc',
    sidebarBg: modoOscuro ? '#27272a' : '#ffffff',
    cardBg: modoOscuro ? '#27272a' : '#ffffff',
    border: modoOscuro ? '#3f3f46' : 'rgba(0, 0, 0, 0.08)',
    textPrimary: modoOscuro ? '#f4f4f5' : '#09090b',
    textSecondary: modoOscuro ? '#a1a1aa' : '#71717a',
    inputBg: modoOscuro ? '#18181b' : '#f8fafc',
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
                    opacity: modoOscuro ? 0.16 : 0.22,
                  }} 
                />
              </div>
            )}

            <div style={s.outletLayer}>
              <Outlet />
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
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
    position: 'relative', zIndex: 1, width: '100%'
  }
};