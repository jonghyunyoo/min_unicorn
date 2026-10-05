const CACHE='rainbow-unicorn-forest-v4';
const FILES=['./','./index.html','./styles.css','./game4.js','./manifest.webmanifest','./assets/icon.png','./assets/logo.png','./assets/unicorn.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin===location.origin&&(u.pathname.endsWith('/game4.js')||u.pathname.endsWith('/index.html')||u.pathname.endsWith('/'))){
    e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(net=>{if(u.origin===location.origin){const copy=net.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}return net})));
});