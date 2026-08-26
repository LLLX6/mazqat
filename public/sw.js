const CACHE_NAME = 'mazqat-shell-v0.9.1-1';
const SHELL = ['./demo.html', './app.css', './khadamati-theme.css', './app.js', './auction-engine.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mazqat-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const type = response.headers.get('content-type') || '';
        if (!response.ok || !type.includes('text/html')) throw new Error('Navigation is not usable HTML');
        return response;
      }).catch(() => caches.match('./demo.html')),
    );
    return;
  }

  const isShellAsset = SHELL.some((asset) => url.pathname.endsWith(asset.replace('./', '/')));
  if (isShellAsset) event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
