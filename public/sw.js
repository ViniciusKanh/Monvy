const CACHE = 'monvy-v1';
const SHELL = ['/', '/index.html', '/favicon.svg', '/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return; // nunca cachear API
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res;
  }).catch(() => cached)));
});
