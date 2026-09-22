const CACHE='wae-universal-render-intelligence-v38';
const ASSETS=['./','./index.html','./styles.css','./polish-v2.css','./mode-feedback-v1.css?v=1','./camera-v1.css?v=2','./premium-render-v1.css?v=7','./wae-mobile-tables-v9.css?v=1','./wae-answer-widgets-v1.css?v=1','./workspace-premium-v1.css?v=13','./storage-v2.js?v=1','./runtime-client.js?v=24&industrial=v115&professional=v116&world=v117&chatfix=v118','./universal-tools-v1.js?v=1','./app.js?v=16','./video-scan-v2.js?v=1','./camera-v1.js?v=5','./polish-v2.js?v=5','./speech-chunks.js?v=9','./premium-render-v1.js?v=12','./wae-answer-widgets-v1.js?v=1','./settings-premium-v1.js?v=5','./navigation-premium-v1.js?v=9','./continuity-archive-core-v7.js','./continuity-backup-v7.js?v=2','./continuity-backup-v7.css?v=1','./workspace-premium-v1.js?v=11','./canvas-builder-v1.js?v=19','./canvas-premium-v2.js?v=19','./canvas-render-factory-v1.js?v=1','./factory-projects-render-v2.js?v=5','./factory-projects-render-v2.css?v=2','./factory-zip-v4.js?v=4','./factory-agent-render-v3.js?v=6','./factory-agent-render-v3.css?v=5','./live-workspace-v119.js?v=1','./live-workspace-v119.css?v=1','./manifest.webmanifest','./assets/logo.svg','./assets/logo-v2.svg'];
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