// Service Worker para notificaciones Push de la PWA
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};

  const title = payload.title || 'Mobiliarium Permisos';
  
  const options = {
    body: payload.body || 'Tienes una nueva notificación.',
    icon: payload.icon || `${self.location.origin}/LogoVerde-removebg-preview.png`, // Recibe dinámicamente la foto o el logo
    vibrate: [200, 100, 200],
    data: {
      url: (payload.data && payload.data.url) ? payload.data.url : '/aprobaciones'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      if (windowClients.length > 0) {
        const client = windowClients[0];
        client.navigate(urlToOpen);
        return client.focus();
      }
      return clients.openWindow(urlToOpen);
    })
  );
});