/* WATCHFIRE :: optional service worker
   Additive only. WATCHFIRE runs from file:// with this file absent, which is the
   normal case, because a service worker cannot be registered from a file:// page.
   Drop this next to watchfire.html only if you serve the folder over http.
   License: GPL-3.0 */
const CACHE = 'watchfire-v1.5.0';
const ASSETS = ['./', './watchfire.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
