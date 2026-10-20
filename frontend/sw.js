// Service worker: keeps the app's own files so it opens even with a weak connection.
// It always tries the network first, so new versions of the app arrive on the next visit.
// Calls to your backend and login service are never touched.
const CACHE = 'dt-shell-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/style.css', 'js/app.js', 'js/api.js', 'js/auth.js', 'js/auth-screens.js', 'js/config.js', 'js/store.js', 'js/ui.js', 'js/today.js', 'js/gym.js', 'js/exercises.js', 'js/progress.js', 'js/admin.js', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
