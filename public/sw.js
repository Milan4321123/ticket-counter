/* MartNepali service worker — installable app + tickets that work offline.
 *
 * Rules, in order:
 *   1. Only same-origin GET requests are touched; everything else goes straight
 *      to the network. (One exception, rule 6: a sign-out POST is watched, never
 *      answered.)
 *   2. Nothing carrying a person's data is ever written to the device's cache:
 *      order pages (/order/…?token=), customer cards (/c/…), subscriptions,
 *      the buyer account, the basket, the seller hub, admin, the door scanner
 *      and every API except media are never touched by this worker.
 *   3. Ticket pages (/ticket/<code>) — and ONLY those — are network-first and
 *      kept, because showing the QR at a door with no signal is the feature.
 *      Each copy is stamped with the time it was stored and is deleted once it
 *      is older than TICKET_TTL_DAYS (checked on activate, on every store, and
 *      before a copy is ever served).
 *   4. Built assets, icons and photos are cache-first (they are content-hashed
 *      or immutable, and carry nobody's data).
 *   5. Any other page is network-only; offline it shows /offline.
 *   6. Signing out — buyer, seller or admin — deletes every kept page. The
 *      pages themselves also post 'mn:forget-personal' (components/AppInstall).
 */
const VERSION = 'mn-v4'; // v4: order pages are no longer kept; ticket copies expire
const STATIC = `${VERSION}-static`;
const TICKETS = `${VERSION}-tickets`;
const OFFLINE_URL = '/offline';
/** Response header this worker adds to a stored ticket: when it was stored, ms. */
const STORED_AT = 'x-mn-stored-at';
const TICKET_TTL_DAYS = 60;
const TICKET_TTL_MS = TICKET_TTL_DAYS * 24 * 60 * 60 * 1000;

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
      // Every cache of an older version goes — including v3's page cache, which
      // held order pages (buyer name, email, QR) with no expiry.
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(pruneTickets)
      .then(() => self.clients.claim())
  );
});

const PERSONAL = [
  /^\/order\//,
  /^\/c\//,
  /^\/account(\/|$)/,
  /^\/subscription\//,
  /^\/basket(\/|$)/,
  /^\/portal/,
  /^\/admin/,
  /^\/scan/,
  /^\/demo/,
  /^\/api\/(?!media\/)/,
];
const TICKET_PAGE = /^\/ticket\/[^/]+\/?$/;
const STATIC_ASSETS = [/^\/_next\/static\//, /^\/icons\//, /^\/api\/media\//];
const SIGN_OUT = [/^\/api\/account\/logout$/, /^\/api\/portal\/logout$/, /^\/api\/admin\/logout$/];

function isFresh(res) {
  const at = Number(res.headers.get(STORED_AT));
  return Number.isFinite(at) && at > 0 && Date.now() - at < TICKET_TTL_MS;
}

/** Delete every kept ticket older than the TTL (or without a stamp). */
async function pruneTickets() {
  const cache = await caches.open(TICKETS);
  const keys = await cache.keys();
  await Promise.all(
    keys.map(async (key) => {
      const res = await cache.match(key, { ignoreVary: true });
      if (!res || !isFresh(res)) await cache.delete(key, { ignoreVary: true });
    })
  );
}

/** Keep a copy of a ticket page, stamped with when it was stored. */
async function storeTicket(url, res) {
  const headers = new Headers(res.headers);
  headers.set(STORED_AT, String(Date.now()));
  const body = await res.blob();
  const cache = await caches.open(TICKETS);
  await cache.put(url, new Response(body, { status: res.status, statusText: res.statusText, headers }));
  await pruneTickets();
}

/** A kept ticket page that is still within its TTL, or null (and an expired one is deleted). */
async function keptTicket(url) {
  const cache = await caches.open(TICKETS);
  const hit = await cache.match(url, { ignoreVary: true });
  if (!hit) return null;
  if (isFresh(hit)) return hit;
  await cache.delete(url, { ignoreVary: true });
  return null;
}

/** Sign-out: everything but the static assets goes. */
async function forgetPersonal() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k !== STATIC).map((k) => caches.delete(k)));
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'mn:forget-personal') event.waitUntil(forgetPersonal());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // A sign-out is never answered here — the network handles it as usual — but
  // it is the moment the kept pages must go, however the sign-out was sent
  // (a plain form post or a fetch).
  if (req.method === 'POST' && SIGN_OUT.some((r) => r.test(url.pathname))) {
    event.waitUntil(forgetPersonal());
    return;
  }

  if (req.method !== 'GET') return;
  if (PERSONAL.some((r) => r.test(url.pathname))) return;

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
    const ticket = TICKET_PAGE.test(url.pathname);
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Clone BEFORE handing the response back: once the browser starts
          // reading the body, it can no longer be copied.
          if (ticket && res.ok && !res.redirected) {
            const copy = res.clone();
            event.waitUntil(storeTicket(url.href, copy));
          }
          return res;
        })
        .catch(async () => (ticket && (await keptTicket(url.href))) || (await caches.match(OFFLINE_URL)) || Response.error())
    );
  }
});
