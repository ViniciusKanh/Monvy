const CACHE = 'monvy-v2';
const SHELL = ['/', '/index.html', '/favicon.svg', '/icon.svg', '/manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return; // ignora chrome-extension etc
  if (url.pathname.startsWith('/api/')) return; // nunca cachear API
  if (request.mode === 'navigate') { e.respondWith(fetch(request).catch(() => caches.match('/index.html'))); return; }
  e.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((res) => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy).catch(() => {})); }
    return res;
  }).catch(() => cached)));
});
