const VERSION='coal-law-precision-search-20261018-v3';
const ESSENTIAL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./assets/search-engine.js?v=20261018-search-v3','./assets/corrected-app.js?v=20261018-search-v3','./assets/corrected-text.css?v=20261018-search-v3'];
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>c.addAll(ESSENTIAL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  const isHTML=e.request.mode==='navigate';
  if(isHTML){e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{if(r.ok){const copy=r.clone();caches.open(VERSION).then(c=>c.put('./index.html',copy));}return r}).catch(()=>caches.match('./index.html')));return;}
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(VERSION).then(c=>c.put(e.request,copy));}return r})));
});
