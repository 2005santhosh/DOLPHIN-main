const CACHE_NAME = 'dolphin-pwa-v2';
const urlsToCache = [
  '/',
  '/login.html',
  '/css/index.css', // Replace with your actual CSS path
  '/js/index.js'  // Replace with your actual JS path
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
    // Only intercept GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If it's an API call or failed, don't cache it
                const url = new URL(event.request.url);
                if (url.pathname.includes('/api/') || response.status !== 200) {
                    return response;
                }

                // Cache EVERYTHING else (Cloudinary, Avatars, Fonts, Local files)
                const responseClone = response.clone();
                caches.open('dolphin-cache-v2').then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // If offline, serve from cache
                return caches.match(event.request);
            })
    );
});