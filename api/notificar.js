import webpush from 'web-push';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido' });
  }

  try {
    // 1. ACEPTAMOS LA VARIABLE urlDestino
    const { subscription, titulo, mensaje, fotoUrl, urlDestino } = req.body || {};

    if (!subscription) {
      return res.status(200).json({ success: false, error: 'La suscripción venía vacía' });
    }

    let subObj = subscription;
    while (typeof subObj === 'string') {
      try { subObj = JSON.parse(subObj); } catch (e) {
        return res.status(200).json({ success: false, error: 'Suscripción string corrupto' });
      }
    }

    if (!subObj || !subObj.endpoint) {
      return res.status(200).json({ success: false, error: 'Suscripción inválida' });
    }

    const limpiarVapid = (k) => k ? k.trim().replace(/^["']|["']$/g, '').replace(/=/g, '').replace(/\s+/g, '') : '';
    
    const rawPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const rawPrivateKey = process.env.VAPID_PRIVATE_KEY;

    const publicKey = limpiarVapid(rawPublicKey);
    const privateKey = limpiarVapid(rawPrivateKey);

    if (!publicKey || !privateKey) {
      return res.status(200).json({ success: false, error: 'Variables VAPID no leídas' });
    }

    webpush.setVapidDetails(
      'mailto:soporte@permisos.com',
      publicKey,
      privateKey
    );

    const domain = 'https://sistema-permisos-blond.vercel.app';
    const iconoFinal = (fotoUrl && fotoUrl.startsWith('http')) ? fotoUrl : `${domain}/LogoVerde-removebg-preview.png`;

    const payload = JSON.stringify({
      title: titulo || 'Mobiliarium Permisos',
      body: mensaje || 'Nueva notificación',
      icon: iconoFinal,
      // 2. INYECTAMOS LA URL DINÁMICA (Si no viene, por defecto lo manda al Home)
      data: { url: urlDestino || '/' } 
    });

    await webpush.sendNotification(subObj, payload);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Fallo interno Push:", err);
    return res.status(200).json({
      success: false,
      error: err.message || String(err)
    });
  }
}