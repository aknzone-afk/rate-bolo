/* रेट बोलो - service worker
   Kaam do hain:
     1. App phone pe install ho sake (icon home screen pe aaye)
     2. Net na ho to bhi app khule - purane rate ke saath

   SABSE ZAROORI NIYAM: rates.json kabhi cache se pehle nahi diya jata.
   Pehle hamesha net se laate hain; net na chale tabhi purana dikhate hain.
   Warna har ghante ka update phone tak pahunchega hi nahi.
*/

const VERSION = 'rate-bolo-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      // ek file na mile to poora install fail na ho
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// net se lao, aur jo mila use cache mein rakh do
async function networkFirst(req, cacheKey) {
  const cache = await caches.open(VERSION);
  try {
    const fresh = await fetch(req, { cache: 'no-store' });
    if (fresh && fresh.ok) cache.put(cacheKey || req, fresh.clone());
    return fresh;
  } catch (err) {
    const hit = await cache.match(cacheKey || req);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // baaki sab browser sambhale

  // rates.json - hamesha pehle net. Query string (?t=...) hata kar cache karte
  // hain, warna har baar naya key banega aur offline kabhi match hi nahi hoga.
  if (url.pathname.endsWith('/rates.json')) {
    e.respondWith(networkFirst(req, url.origin + url.pathname));
    return;
  }

  // page khud - pehle net, taaki naya version turant mile
  if (req.mode === 'navigate') {
    e.respondWith(
      networkFirst(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // icon waghairah - cache se turant, peeche chupke se naya le aao
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
