/* MartNepali service worker — installable app + tickets that work offline.
 *
 * Rules, in order:
 *   1. Only same-origin GET requests are touched; everything else goes straight
 *      to the network.
 *   2. The seller hub, admin and every API except media are NEVER cached — no
 *      account data is ever written to the device's cache.
 *   3. Ticket and order pages (/order/…, /ticket/…) are network-first and kept,
 *      so a buyer standing at a door with no signal can still open their QR.
 *   4. Built assets, icons and photos are cache-first (they are content-hashed
 *      or immutable).
 *   5. Any other page is network-first; offline it falls back to its cached
 *      copy, or to /offline.
 */
const VERSION = 'mn-v3'; // v3: the 3D flag icons
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll([OFFLINE_URL, '/icons/icon-192-v2.png', '/icons/icon-512-v2.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const NEVER = [/^\/portal/, /^\/admin/, /^\/api\/(?!media\/)/, /^\/scan/, /^\/demo/];
const KEEP_PAGES = [/^\/order\//, /^\/ticket\//];
const STATIC_ASSETS = [/^\/_next\/static\//, /^\/icons\//, /^\/api\/media\//];

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((r) => r.test(url.pathname))) return;

  if (STATIC_ASSETS.some((r) => r.test(url.pathname))) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (req.mode === 'navigate') {
    const keep = KEEP_PAGES.some((r) => r.test(url.pathname));
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Clone BEFORE handing the response back: once the browser starts
          // reading the body, it can no longer be copied.
          if (keep && res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(PAGES).then((c) => c.put(req, copy)));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE_URL)) || Response.error())
    );
  }
});
