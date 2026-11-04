// Подключается в service worker (workbox importScripts): клик по уведомлению
// открывает Pingo на нужной странице.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'pingo:navigate', url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
