// This service worker kills any existing corrupted PWA workers
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => 
      Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    ).then(() => self.registration.unregister())
  );
});