import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../api/supabaseClient';
import { registrarSuscripcionPush } from '../notificaciones/notificacionesService';

const AuthContext = createContext();

// Al cerrar sesión: SOLO borramos el vínculo en Supabase
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
    localStorage.removeItem('push_endpoint_sincronizado');
  } catch (err) {
    console.warn('Aviso al desvincular notificaciones al cerrar sesión:', err);
  }
};

// Sincroniza el dispositivo SOLO si no está registrado ya con este mismo usuario y endpoint
export const sincronizarPushUsuarioActivo = async (usuarioId, forzarVerificacionDB = false) => {
  if (!usuarioId) return false;
  try {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted' &&
      'serviceWorker' in navigator
    ) {
      await navigator.serviceWorker.register('/sw.js');
      const sub = await registrarSuscripcionPush();
      if (!sub || !sub.endpoint) return false;

      const endpointActual = sub.endpoint;
      const huellaLocal = `${usuarioId}::${endpointActual}`;

      // 1. Candado rápido en localStorage para no consultar ni escribir en cada F5
      if (!forzarVerificacionDB && localStorage.getItem('push_endpoint_sincronizado') === huellaLocal) {
        return true;
      }

      // 2. Verificar en Supabase si ya existe exactamente este endpoint
      const { data: existentes, error: errSelect } = await supabase
        .from('suscripciones_push')
        .select('id, usuario_id')
        .eq('endpoint', endpointActual);

      if (!errSelect && existentes && existentes.length > 0) {
        const filaPrincipal = existentes[0];

        // Si por alguna razón había duplicados viejos del mismo endpoint, limpiar los sobrantes dejando solo el primero
        if (existentes.length > 1) {
          const idsDuplicados = existentes.slice(1).map(item => item.id);
          await supabase.from('suscripciones_push').delete().in('id', idsDuplicados);
        }

        // Si ya pertenece al mismo usuario, NO reescribimos ni borramos la fila
        if (filaPrincipal.usuario_id === usuarioId) {
          localStorage.setItem('push_endpoint_sincronizado', huellaLocal);
          return true;
        }

        // Si el dispositivo cambió de usuario, solo actualizamos el usuario_id en la misma fila
        const { error: errUpdate } = await supabase
          .from('suscripciones_push')
          .update({ usuario_id: usuarioId, subscription: sub })
          .eq('id', filaPrincipal.id);

        if (!errUpdate) {
          localStorage.setItem('push_endpoint_sincronizado', huellaLocal);
          return true;
        }
      }

      // 3. Solo si NO existe este endpoint en la tabla, lo insertamos por primera vez
      const { error: errInsert } = await supabase
        .from('suscripciones_push')
        .insert([{
          usuario_id: usuarioId,
          subscription: sub,
          endpoint: endpointActual
        }]);

      if (!errInsert) {
        localStorage.setItem('push_endpoint_sincronizado', huellaLocal);
        return true;
      }
    }
    return false;
  } catch (err) {
    console.warn('Aviso al sincronizar notificaciones con el usuario activo:', err);
    return false;
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
      sincronizarPushUsuarioActivo(parsed.id, false);
    }
    setCargando(false);
  }, []);

  const iniciarSesion = async (datosUsuario) => {
    localStorage.setItem('permisos_sesion', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
    await sincronizarPushUsuarioActivo(datosUsuario.id, true);
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