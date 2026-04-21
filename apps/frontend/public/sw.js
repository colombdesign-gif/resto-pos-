/**
 * RestoPOS Service Worker — Offline Desteği
 * 
 * Strateji:
 * - Statik kaynaklar (JS, CSS): Cache First
 * - API istekleri: Network First → Cache Fallback
 * - Sayfa navigasyonu: Network First → Offline sayfası
 */

const CACHE_NAME = 'restopos-v1';
const OFFLINE_URL = '/offline';

// Cache'lenecek statik kaynaklar
const STATIC_CACHE = [
  '/',
  '/offline',
  '/pos/tables',
  '/pos/kitchen',
  '/manifest.json',
];

// API endpoint pattern
const API_PATTERN = /\/api\//;
const STATIC_PATTERN = /\.(js|css|woff2?|png|jpg|jpeg|svg|ico)$/;

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Statik kaynaklar cache\'leniyor...');
      return cache.addAll(STATIC_CACHE).catch((err) => {
        console.warn('[SW] Bazı kaynaklar cache\'lenemedi:', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Chrome ext / farklı origin → atla
  if (!url.protocol.startsWith('http')) return;

  // ─── FETCH INTERCEPTION ─────────────────────────────────────
  // FIX: API ve Socket.io trafiğini SW kontrolünden çıkar (Gerçek zamanlı bağlantı için)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return; // Tarayıcı standart network katmanını kullansın
  }

  // Statik dosyalar: Cache First
  if (STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Sayfa navigasyonu: Network First → Offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL) || caches.match('/')
      )
    );
    return;
  }
});

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────

async function networkFirst(request) {
  try {
    const response = await fetch(request.clone());
    // GET ve başarılı ise cache'le
    if (request.method === 'GET' && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // API offline yanıtı
    return new Response(
      JSON.stringify({ error: 'Çevrimdışı — bağlantı bekleniyor', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}

// ─── PUSH BİLDİRİMLERİ ───────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'RestoPOS', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'restopos',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});

// ─── BACKGROUND SYNC ─────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  const db = await openDB();
  const pending = await db.getAll('pendingOrders');
  for (const order of pending) {
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${order.token}` },
        body: JSON.stringify(order.data),
      });
      await db.delete('pendingOrders', order.id);
      console.log('[SW] Bekleyen sipariş senkronize edildi:', order.id);
    } catch (err) {
      console.warn('[SW] Sipariş sync başarısız:', err);
    }
  }
}

// IndexedDB yardımcı (offline sipariş kuyruğu)
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('restopos-offline', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pendingOrders')) {
        db.createObjectStore('pendingOrders', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      resolve({
        getAll: (store) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readonly');
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => res(req.result);
          req.onerror = rej;
        }),
        delete: (store, id) => new Promise((res, rej) => {
          const tx = db.transaction(store, 'readwrite');
          const req = tx.objectStore(store).delete(id);
          req.onsuccess = () => res(undefined);
          req.onerror = rej;
        }),
      });
    };
    req.onerror = reject;
  });
}
