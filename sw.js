const CACHE='rainbow-unicorn-forest-v1';
const FILES=['./','./index.html','./styles.css','./game.js','./manifest.webmanifest','./assets/icon.png','./assets/logo.png','./assets/unicorn.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
