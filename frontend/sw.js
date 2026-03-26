const CACHE_NAME = 'dolphin-v1';
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

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});