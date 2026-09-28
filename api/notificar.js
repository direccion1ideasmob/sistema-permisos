import webpush from 'web-push';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    const { subscription, titulo, mensaje } = req.body || {};

    // 1. Validar presencia de suscripción
    if (!subscription) {
      return res.status(200).json({ success: false, error: 'La suscripción venía vacía (null o undefined)' });
    }

    // Manejo robusto: desenrolla si viene doblemente serializado como string desde la BD
    let subObj = subscription;
    while (typeof subObj === 'string') {
      try {
        subObj = JSON.parse(subObj);
      } catch (e) {
        return res.status(200).json({ success: false, error: 'La suscripción en BD es un string corrupto' });
      }
    }

    if (!subObj || !subObj.endpoint) {
      return res.status(200).json({ success: false, error: 'Suscripción inválida: no tiene la propiedad endpoint' });
    }

    // 2. Validar variables VAPID
    const publicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      return res.status(200).json({ success: false, error: 'Variables VAPID no leídas en el entorno de Vercel' });
    }

    webpush.setVapidDetails(
      'mailto:soporte@permisos.com',
      publicKey,
      privateKey
    );

    // CORREGIDO: Dominio real de tu despliegue en Vercel
    const domain = 'https://sistema-permisos-blond.vercel.app';

    const payload = JSON.stringify({
      title: titulo || 'Mobiliarium Permisos',
      body: mensaje || 'Tienes una nueva notificación.',
      icon: `${domain}/LogoNegro-removebg-preview.png`,
      badge: `${domain}/badge.jpg`,
      data: {
        url: '/aprobaciones'
      }
    });

    // 3. Envío real a Google FCM / Apple
    await webpush.sendNotification(subObj, payload);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Fallo interno Push:", err);
    return res.status(200).json({
      success: false,
      error: err.message || String(err),
      statusCode: err.statusCode || 'DESCONOCIDO'
    });
  }
}