const CACHE='coal-law-assistant-v5';
const CORE=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./assets/source-viewer.css?v=20261007-5",
  "./assets/source-viewer.js?v=20261007-5",
  "./assets/vendor/pdf.min.js?v=20261007-5",
  "./assets/vendor/pdf.worker.min.js?v=20261007-5",
  "./assets/vendor/jszip.min.js?v=20261007-5",
  "./data/rules2025.json",
  "./source/2026《防治煤矿冲击地压细则》.pdf",
  "./source/KA 35-2026 底板岩层冲击倾向性分类及指数测定方法.pdf",
  "./source/KA 36-2026 冲击危险性评价的综合指数方法.pdf",
  "./source/KA 37-2026 冲击地压巷道防冲支护方法.pdf",
  "./source/KA 39-2026 冲击地压个体防护要求.pdf",
  "./source/KA 40-2026 煤矿冲击地压解危措施效果检验方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第10部分：煤层钻孔卸压防治方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第11部分：煤层卸压爆破防治方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第12部分：开采保护层防治方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第14部分：顶板水压致裂防治方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第1部分 顶板岩层冲击倾向性分类及指数的测定方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第2部分：煤的冲击倾向性分类及指数的测定方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第3部分：煤岩组合试件冲击倾向性分.pdf",
  "./source/冲击地压测定、监测与防治方法 第4部分：微震监测方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第5部分：地音监测方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第6部分：钻屑监测方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第7部分：采动应力监测方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第8部分：电磁辐射监测方法.pdf",
  "./source/冲击地压测定、监测与防治方法 第9部分：煤层注水防治方法.pdf",
  "./source/煤矿安全规程（2025修订）.pdf",
  "./source/煤矿重大事故隐患判定标准-应急管理部令第21号.pdf",
  "./source/陕西省煤矿冲击地压防治规定（试行）_原文.pdf"
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