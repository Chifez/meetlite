const CACHE_NAME = 'meetlite-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip service worker for API requests (especially uploads)
  // This allows Axios to handle progress tracking
  if (
    requestUrl.pathname.startsWith('/api/') ||
    requestUrl.port === '5001' || // room-service
    requestUrl.port === '5000' || // auth-service
    requestUrl.port === '5003' || // signaling-service
    event.request.method !== 'GET' // Skip all non-GET requests (POST, PUT, DELETE)
  ) {
    // Let the request go directly to the network without SW intervention
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'You have a new meeting reminder!',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: 'explore',
        title: 'Join Meeting',
        icon: '/android-chrome-192x192.png',
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/android-chrome-192x192.png',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification('MeetLite', options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(clients.openWindow('/dashboard'));
  }
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Sync any pending meeting data when back online
  try {
    const pendingData = await getPendingData();
    for (const data of pendingData) {
      await syncToServer(data);
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function getPendingData() {
  // Get data from IndexedDB that needs to be synced
  return [];
}

async function syncToServer(data) {
  // Sync data to server when back online
  return fetch('/api/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}
