const CACHE='wae-universal-v23-progressive-boot';
const CORE=['./','./index.html','./styles.css','./polish-v2.css','./mobile-safe-composer.css','./startup-guard-v23.js','./runtime-client.js','./app.js','./mobile-safe-composer.js','./progressive-boot-v23.js','./manifest.webmanifest','./assets/logo.svg','./assets/logo-v2.svg'];
const OPTIONAL=['./premium-v3.css','./premium-v4.css','./experience-v5.css','./experience-v6.css','./experience-v7.css','./experience-v8.css','./voice-client.js','./premium-v4.js','./streaming-v2.js','./experience-v5.js','./experience-v6.js','./experience-v7.js','./experience-v8.js','./interaction-guard-v21.js','./lib/sse-events.js','./polish-v2.js'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.allSettled(OPTIONAL.map(asset=>cache.add(asset)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function refresh(cache,request,key=request){
  try{
    const response=await fetch(request,{cache:'no-cache'});
    if(response.ok)await cache.put(key,response.clone());
    return response;
  }catch{return null}
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);
  if(req.method!=='GET'||url.pathname.startsWith('/api/')||url.hostname.endsWith('.supabase.co'))return;
  if(url.origin!==location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match('./index.html');
      const network=refresh(cache,req,'./index.html');
      if(cached){event.waitUntil(network);return cached}
      return await network||new Response('Universal Core temporalmente sin conexión',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
    })());
    return;
  }

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(req,{ignoreSearch:true});
    const network=refresh(cache,req);
    if(cached){event.waitUntil(network);return cached}
    return await network||new Response('',{status:504});
  })());
});
