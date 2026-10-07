const CACHE_NAME = "e-ride-v2";
const APP_SHELL = ["./", "./customer.html", "./driver.html", "./admin.html"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if(event.request.method!=="GET") return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      const cache=await caches.open(CACHE_NAME);
      cache.put(event.request,response.clone());
      return response;
    }catch(e){
      return caches.match(event.request).then(r=>r||caches.match("./customer.html"));
    }
  })());
});

self.addEventListener("push", event => {
  let data={};
  try{data=event.data?event.data.json():{};}catch(e){data={body:event.data?.text?.()||"New E RIDE update"};}
  const title=data.title||"E RIDE";
  const options={body:data.body||"You have a new update.",icon:data.icon||"./icon-192.png",badge:data.badge||"./icon-192.png",data:data.data||{},vibrate:[200,100,200]};
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    for(const c of list){ if("focus" in c) return c.focus(); }
    if(clients.openWindow) return clients.openWindow("./");
  }));
});
