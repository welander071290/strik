// Offline-først: svar straks fra cachen og hent den nyeste udgave i baggrunden (stale-while-revalidate).
const CACHE = 'strik-v6';
const FILES = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function notifyUpdate() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(c => c.postMessage({ type: 'update-ready' }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate';

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const oldCopy = cached && cached.clone();

    const update = fetch(req, { cache: 'no-cache' }).then(async res => {
      if (res.ok && res.type === 'basic') {
        if (oldCopy && isPage) {
          const [a, b] = await Promise.all([oldCopy.text(), res.clone().text()]);
          if (a !== b) { await cache.put(req, res.clone()); await notifyUpdate(); return res; }
        }
        await cache.put(req, res.clone());
      }
      return res;
    });

    if (cached) {
      e.waitUntil(update.catch(() => {}));
      return cached;
    }
    // Ikke i cachen endnu: hent fra netværket; offline falder sider tilbage til appen
    return update.catch(async err => (isPage && await cache.match('./index.html')) || Promise.reject(err));
  })());
});
