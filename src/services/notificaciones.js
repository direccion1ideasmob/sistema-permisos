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
    
    // Si hay una suscripción vieja atrapada, la destruimos para forzar una limpia
    if (suscripcion) {
      await suscripcion.unsubscribe();
    }

    // Generamos la suscripción nueva forzosamente con la llave correcta
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