// Service Worker para notificaciones Push de la PWA
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};

  const title = payload.title || 'Mobiliarium Permisos';
  
  // Apuntamos al logo principal para el cuadro grande
  const iconoPrincipal = `${self.location.origin}/LogoVerde-removebg-preview.png`;
  
  // Apuntamos al nuevo archivo badge.png que acabas de colocar en public para eliminar la campana
  const iconoBadge = `${self.location.origin}/badge.png`;

  const options = {
    body: payload.body || 'Tienes una nueva notificación.',
    icon: iconoPrincipal, // Logo grande a la derecha
    badge: iconoBadge,    // Insignia pequeña arriba a la izquierda (adiós a la campana)
    vibrate: [200, 100, 200],
    data: {
      url: (payload.data && payload.data.url) ? payload.data.url : '/aprobaciones'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Registrar clic en la notificación para abrir la app en la ruta correcta
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