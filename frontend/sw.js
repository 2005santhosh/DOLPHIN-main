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
    // IGNORE external requests (CDNs, APIs, Fonts)
    // Let the browser handle them normally using their own cache
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin && !url.pathname.startsWith('/api/')) {
        return; 
    }

    // ONLY cache your own local files (HTML, CSS, local JS)
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(fetchResponse => {
                    return caches.open('dolphin-cache-v1').then(cache => {
                        // Don't cache API calls
                        if (!event.request.url.includes('/api/')) {
                            cache.put(event.request, fetchResponse.clone());
                        }
                        return fetchResponse;
                    });
                });
            })
            .catch(() => {
                // Fallback if offline
                return caches.match('/offline.html');
            })
    );
});