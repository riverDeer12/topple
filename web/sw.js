// Service worker: lets the game open and play without internet.
// Game files: network first (so updates arrive at once), the cached copy when offline or
// when the network is too slow. Fonts: cached copy first. The API is never cached.
const CACHE = 'topple-v1';
const FILES = [
  './', 'index.html', 'igra.html', 'theme.css', 'config.js', 'core.js', 'gen.js', 'gen-worker.js',
  'levels.js', 'puzzles.js', 'audio.js', 'i18n.js', 'content.js', 'manifest.webmanifest',
  'favicon.ico', 'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'privatnost.html', 'uvjeti.html', 'kontakt.html',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (FONTS.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;
  e.respondWith((async () => {
    const net = fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    });
    net.catch(() => {});
    try {
      const r = await Promise.race([net, new Promise(ok => setTimeout(ok, 4000, 'slow'))]);
      if (r !== 'slow') return r;
    } catch (err) { /* offline: use the cached copy */ }
    const hit = (await caches.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await caches.match('igra.html') : null);
    return hit || net; // nothing cached yet: keep waiting for the network
  })());
});

// Daily reminder (see server/push.js): show the notification, open the game when tapped.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Topple', {
    body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'daily', data: { url: d.url || 'igra.html' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'igra.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.includes('igra.html'));
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
