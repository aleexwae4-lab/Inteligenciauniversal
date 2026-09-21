const CACHE='wae-universal-render-premium-v21';
const ASSETS=['./','./index.html','./styles.css','./polish-v2.css','./premium-render-v1.css?v=7','./workspace-premium-v1.css?v=13','./storage-v2.js?v=1','./runtime-client.js?v=17','./app.js?v=12','./polish-v2.js?v=4','./speech-chunks.js?v=9','./premium-render-v1.js?v=9','./settings-premium-v1.js?v=5','./navigation-premium-v1.js?v=8','./workspace-premium-v1.js?v=11','./canvas-builder-v1.js?v=19','./canvas-premium-v2.js?v=19','./manifest.webmanifest','./assets/logo.svg','./assets/logo-v2.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});