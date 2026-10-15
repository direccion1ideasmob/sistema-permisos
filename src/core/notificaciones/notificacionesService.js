// La LLAVE NUEVA que generamos y pusimos en Vercel
const PUBLIC_VAPID_KEY = 'BNThRogYfbR6B2Pmy7cKGHLZDAfMMkgWoCPzBREZjJzkSxa4BGpnmVQ2zRQLGCRI5iLoNoAWhkDToDIpFbmRNu4';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registrarSuscripcionPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Este navegador no soporta notificaciones Push.');
    return null;
  }

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      console.log('El usuario no aceptó las notificaciones.');
      return null;
    }

    const registro = await navigator.serviceWorker.ready;

    let suscripcion = await registro.pushManager.getSubscription();
    
    // CORRECCIÓN VITAL: Si ya hay una suscripción, la reciclamos. 
    // ¡NO LA DESTRUIMOS! Así conservamos la misma huella (endpoint).
    if (suscripcion) {
      return suscripcion.toJSON();
    }

    // Si no existía ninguna, generamos la suscripción nueva con la llave
    suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    });

    return suscripcion.toJSON();
  } catch (error) {
    console.error('Error al registrar la suscripción Push:', error);
    return null;
  }
}
// === FUNCIÓN UNIVERSAL PARA ENVIAR PUSH A UNO O VARIOS USUARIOS ===
export const enviarNotificacionPushUsuarios = async (usuariosIds, { titulo, mensaje, urlDestino = '/inicio', fotoUrl = null }) => {
  const ids = (Array.isArray(usuariosIds) ? usuariosIds : [usuariosIds]).filter(Boolean);
  if (ids.length === 0) return;

  try {
    const { data: subs } = await supabase
      .from('suscripciones_push')
      .select('subscription')
      .in('usuario_id', ids);

    if (!subs || subs.length === 0) return;

    const envios = subs.map(async (item) => {
      let subLimpia = item.subscription;
      if (typeof subLimpia === 'string') {
        try { subLimpia = JSON.parse(subLimpia); } catch (_) {}
      }
      const res = await fetch('/api/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subLimpia, titulo, mensaje, fotoUrl, urlDestino })
      });
      return res.json();
    });

    await Promise.allSettled(envios);
  } catch (err) {
    console.error("Error enviando notificaciones push:", err);
  }
};
