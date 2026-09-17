const PREVIOUS_CACHE_CONTRACT='wae-universal-v34-adaptive-mesh';
const CACHE='wae-universal-v35-canonical-v107';
const CORE=['./index.html','./styles.css','./polish-v2.css','./mobile-safe-composer.css','./startup-guard-v23.js','./runtime-client.js','./app.js','./mobile-safe-composer.js','./progressive-boot-v23.js','./mobile-v26.js','./mobile-runtime-v34.js','./mobile-canonical-chat-v80.js','./canonical-brain-v106.js','./manifest.webmanifest','./assets/logo.svg','./assets/logo-v2.svg'];
const OPTIONAL=['./premium-v3.css','./premium-v4.css','./experience-v5.css','./experience-v6.css','./experience-v7.css','./experience-v8.css','./voice-client.js','./premium-v4.js','./streaming-v2.js','./experience-v5.js','./experience-v6.js','./experience-v7.js','./experience-v8.js','./interaction-guard-v21.js','./lib/sse-events.js','./polish-v2.js','./mobile-voice-v27.js','./semantic-ux-v32.js','./learning-client-v29.js'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(CORE.map(asset=>cache.add(new Request(asset,{cache:'reload'}))));
    await Promise.allSettled(OPTIONAL.map(asset=>cache.add(new Request(asset,{cache:'reload'}))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    await Promise.allSettled(windows.map(client=>{
      try{
        const url=new URL(client.url);
        if(url.origin===self.location.origin&&url.searchParams.get('wae_runtime')!=='35'){
          url.searchParams.set('wae_runtime','35');
          return client.navigate(url.href);
        }
      }catch{}
      return null;
    }));
  })());
});

async function networkFirst(request,cacheKey=request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok&&request.method==='GET')await cache.put(cacheKey,response.clone());
    return response;
  }catch{
    return await cache.match(cacheKey,{ignoreSearch:true})||null;
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);
  if(req.method!=='GET'||url.pathname.startsWith('/api/')||url.hostname.endsWith('.supabase.co'))return;
  if(url.origin!==location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        return await fetch(req,{cache:'no-store'});
      }catch{
        const cache=await caches.open(CACHE);
        return await cache.match('./index.html')||new Response('Universal Core temporalmente sin conexión',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const response=await networkFirst(req,req);
    return response||new Response('',{status:504});
  })());
});

void PREVIOUS_CACHE_CONTRACT;