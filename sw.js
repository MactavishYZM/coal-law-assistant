const CACHE='coal-law-assistant-v3';
const CORE=[
  './','./index.html','./manifest.webmanifest',
  './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png',
  './assets/source-viewer.css','./assets/source-viewer.js',
  './assets/vendor/pdf.min.js','./assets/vendor/pdf.worker.min.js','./assets/vendor/jszip.min.js',
  './data/rules2025.json'
];
self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(resp=>{
    if(resp && resp.ok){
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
    }
    return resp;
  }).catch(()=>caches.match('./index.html'))));
});