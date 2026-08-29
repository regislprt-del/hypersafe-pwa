const CACHE='hypersafe-pwa-v5';
const CORE=['./','./index.html','./styles.css','./config.js','./app-core.js','./app-ui.js','./auth-redirect.js','./push-notifications.js','./manual-adjust.js','./reset-control.js','./manifest.webmanifest','./logo.svg','./icons/icon-180.png','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'HyperSafe';
  const options = {
    body: data.body || 'Le niveau a été mis à jour.',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'hypersafe-curve-update',
    renotify: true,
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        client.navigate(url).catch(() => {});
        return client.focus();
      }
    }
    return clients.openWindow ? clients.openWindow(url) : undefined;
  }));
});
