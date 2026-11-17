const CACHE="el-shilla-study-v7";
const ASSETS=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./apple-touch-icon.png","./war-maps.js","./war.js","./world.js"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin){
    // مكتبات Firebase والخطوط: كاش أولاً عشان الموقع يفتح أوفلاين
    const ok=(url.hostname==="www.gstatic.com"&&url.pathname.indexOf("/firebasejs/")===0)||url.hostname==="fonts.googleapis.com"||url.hostname==="fonts.gstatic.com";
    if(ok)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>r)));
    return;
  }
  e.respondWith(
    fetch(e.request).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy))}
      return res;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))
  );
});
