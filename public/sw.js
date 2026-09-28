// Este es el archivo sw.js
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};

  const title = payload.title || 'Mobiliarium Permisos';
  
  // Aquí le decimos al sistema que busque tu logo verde usando la dirección web actual
  const logoDeTuApp = `${self.location.origin}/LogoVerde-removebg-preview.png`;

  const options = {
    body: payload.body || 'Tienes una nueva notificación.',
    icon: logoDeTuApp, // Este es el logo que aparecerá en la notificación
    vibrate: [200, 100, 200],
    data: {
      url: (payload.data && payload.data.url) ? payload.data.url : '/aprobaciones'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Esto sirve para que al hacer clic en la notificación se abra tu app
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