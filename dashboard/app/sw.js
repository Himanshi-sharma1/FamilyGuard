// FamilyGuard Service Worker - Background Operations

const CACHE_NAME = 'familyguard-v2';
const urlsToCache = [
  '/app/',
  '/app/index.html',
  '/app/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache the response
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-location') {
    event.waitUntil(syncLocationData());
  }
  if (event.tag === 'sync-audio') {
    event.waitUntil(syncAudioData());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/app/manifest.json',
    badge: '/app/manifest.json',
    vibrate: [200, 100, 200],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification('FamilyGuard', options)
  );
});

// Sync location data when back online
async function syncLocationData() {
  // Implementation for syncing stored location data
  console.log('Syncing location data...');
}

// Sync audio data when back online
async function syncAudioData() {
  // Implementation for syncing stored audio chunks
  console.log('Syncing audio data...');
}
