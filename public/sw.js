// Service Worker para notificaciones Push de la PWA
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const baseUrl = self.location.origin;

  const title = payload.title || 'Mobiliarium Permisos';
  
  const options = {
    body: payload.body || 'Tienes una nueva notificación.',
    icon: payload.icon || `${baseUrl}/LogoVerde-removebg-preview.png`,
    // Quitamos el badge.jpg para que Android no ponga el cuadro blanco
    vibrate: [200, 100, 200],
    data: {
      // AQUÍ ESTABA EL ERROR: Ahora lee la URL dinámica (ej. /aprobaciones) o usa la raíz de respaldo
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
      // Si la app ya está abierta en el fondo, la enfoca y cambia a la pestaña correcta
      if (windowClients.length > 0) {
        const client = windowClients[0];
        client.navigate(urlToOpen);
        return client.focus();
      }
      // Si la app estaba cerrada por completo, abre una ventana nueva en esa ruta
      return clients.openWindow(urlToOpen);
    })
  );
});