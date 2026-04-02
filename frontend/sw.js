const CACHE_NAME = 'dolphin-pwa-v2';

// Install event - removed hardcoded files to prevent 404 installation failures
self.addEventListener('install', event => {
    // skipWaiting forces the new SW to activate immediately
    self.skipWaiting();
});

// Activate event - cleans up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim(); // Take control of all pages immediatelyy
});

// Fetch event
self.addEventListener('fetch', event => {
    // 1. Only handle GET requests
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // 2. CRITICAL: Ignore external URLs completely (Cloudinary, Avatars, Fonts)
    if (url.origin !== self.location.origin) {
        return; 
    }

    // 3. Handle your own local files
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Don't cache API calls or failed requests
                if (url.pathname.includes('/api/') || response.status !== 200) {
                    return response;
                }

                // Cache successful local responses
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // If offline, try to serve from cache
                return caches.match(event.request).then(cachedResponse => {
                    // Prevent "Failed to convert value to 'Response'" crash
                    return cachedResponse || new Response('Offline', { status: 503 });
                });
            })
    );
});