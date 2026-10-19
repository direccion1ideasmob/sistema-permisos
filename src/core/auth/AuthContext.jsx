import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import { registrarSuscripcionPush } from '../notificaciones/notificacionesService';

const AuthContext = createContext();

// Al cerrar sesión: SOLO borramos el vínculo en Supabase (conservando el permiso del navegador para no pedir campana otra vez)
export const desvincularPushDispositivoActual = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.pushManager) {
        const sub = await reg.pushManager.getSubscription();
        if (sub && sub.endpoint) {
          await supabase
            .from('suscripciones_push')
            .delete()
            .eq('endpoint', sub.endpoint);
        }
      }
    }
  } catch (err) {
    console.warn('Aviso al desvincular notificaciones al cerrar sesión:', err);
  }
};

// Al iniciar sesión o recargar: vincula automáticamente este dispositivo al usuario activo sin tocar la campana
export const sincronizarPushUsuarioActivo = async (usuarioId) => {
  if (!usuarioId) return;
  try {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      'serviceWorker' in navigator
    ) {
      await navigator.serviceWorker.register('/sw.js');
      const sub = await registrarSuscripcionPush();
      if (sub && sub.endpoint) {
        await supabase
          .from('suscripciones_push')
          .delete()
          .eq('endpoint', sub.endpoint);

        await supabase
          .from('suscripciones_push')
          .insert([{
            usuario_id: usuarioId,
            subscription: sub,
            endpoint: sub.endpoint
          }]);
      }
    }
  } catch (err) {
    console.warn('Aviso al sincronizar notificaciones con el usuario activo:', err);
  }
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const sesionGuardada = localStorage.getItem('permisos_sesion');
    if (sesionGuardada) {
      const parsed = JSON.parse(sesionGuardada);
      setUsuario(parsed);
      sincronizarPushUsuarioActivo(parsed.id);
    }
    setCargando(false);
  }, []);

  const iniciarSesion = async (datosUsuario) => {
    localStorage.setItem('permisos_sesion', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
    await sincronizarPushUsuarioActivo(datosUsuario.id);
  };

  const cerrarSesion = async () => {
    await desvincularPushDispositivoActual();
    localStorage.removeItem('permisos_sesion');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, iniciarSesion, cerrarSesion, cargando }}>
      {!cargando && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
