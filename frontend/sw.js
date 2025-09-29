// Service Worker for Northwestern Mutual Platform
// Handles caching, offline functionality, and performance optimization

const CACHE_NAME = 'nm-platform-v1.0.0';
const STATIC_CACHE = 'nm-static-v1.0.0';
const DYNAMIC_CACHE = 'nm-dynamic-v1.0.0';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/dashboard.html',
    '/css/design-system.css',
    '/css/northwestern-mutual-theme.css',
    '/css/professional-ui-polish.css',
    '/js/state-management-enhanced.js',
    '/js/design-system-components.js',
    '/js/performance-optimizer.js',
    '/js/dashboard-data-manager.js',
    '/api-client.js',
    '/dashboard.js'
];

// API endpoints to cache with network-first strategy
const API_CACHE_PATTERNS = [
    '/api/dashboard/stats',
    '/api/candidates',
    '/api/assessments'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installing...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📦 Caching static files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('✅ Static files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Failed to cache static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE &&
                            cacheName !== DYNAMIC_CACHE &&
                            cacheName !== CACHE_NAME) {
                            console.log('🗑️ Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle all network requests
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleAPIRequest(request));
        return;
    }

    // Handle static files
    if (STATIC_FILES.some(file => url.pathname === file || url.pathname.endsWith(file))) {
        event.respondWith(handleStaticRequest(request));
        return;
    }

    // Handle other requests
    event.respondWith(handleDynamicRequest(request));
});

// Network-first strategy for API requests
async function handleAPIRequest(request) {
    const url = new URL(request.url);

    try {
        // Try network first
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.log('🔄 Network failed, trying cache for:', url.pathname);

        // Fallback to cache
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            console.log('✅ Serving from cache:', url.pathname);
            return cachedResponse;
        }

        // Return offline fallback for dashboard stats
        if (url.pathname === '/api/dashboard/stats') {
            return new Response(JSON.stringify({
                totalCandidates: 0,
                completedAssessments: 0,
                averageScore: 0,
                activeRecruiters: 0,
                offline: true
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Return generic offline response
        return new Response(JSON.stringify({
            error: 'Offline - please check your connection',
            offline: true
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Cache-first strategy for static files
async function handleStaticRequest(request) {
    try {
        // Try cache first
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Fallback to network
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.error('❌ Failed to serve static file:', request.url, error);
        throw error;
    }
}

// Stale-while-revalidate strategy for dynamic content
async function handleDynamicRequest(request) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const cachedResponse = await cache.match(request);

        // Start fetching fresh content in background
        const networkPromise = fetch(request).then((response) => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        }).catch(() => null);

        // Return cached version immediately if available
        if (cachedResponse) {
            return cachedResponse;
        }

        // Wait for network if no cache
        return await networkPromise || new Response('Offline', { status: 503 });
    } catch (error) {
        console.error('❌ Failed to handle dynamic request:', request.url, error);
        return new Response('Error', { status: 500 });
    }
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('🔄 Background sync triggered');
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    // Retry failed API requests when connection is restored
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();

        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response.clone());
                }
            } catch (error) {
                console.log('🔄 Still offline for:', request.url);
            }
        }
    } catch (error) {
        console.error('❌ Background sync failed:', error);
    }
}

// Push notifications (for real-time updates)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/assets/icon-192.png',
        badge: '/assets/badge-72.png',
        data: data.data,
        actions: [
            {
                action: 'view',
                title: 'View Details'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/')
        );
    }
});

// Message handling for cache updates
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CACHE_UPDATE') {
        updateCache(event.data.url);
    }
});

async function updateCache(url) {
    try {
        const cache = await caches.open(DYNAMIC_CACHE);
        const response = await fetch(url);

        if (response.ok) {
            await cache.put(url, response);
            console.log('✅ Cache updated for:', url);
        }
    } catch (error) {
        console.error('❌ Failed to update cache for:', url, error);
    }
}

console.log('✅ Service Worker loaded successfully');