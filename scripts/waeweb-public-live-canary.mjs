// Nonblocking public-only live probe during Render release builds.
// No user sessions, private credentials, web reader or premium APIs are used.
import {searchWaewebPublic,waewebPublicConfigured} from '../lib/waeweb-public-v126.js';
if(!waewebPublicConfigured()){
 console.log('[WAEWEB Public Canary] SKIP public adapter disabled; no LIVE connection claimed');
 process.exit(0);
}
try{
 const response=await searchWaewebPublic('inteligencia artificial',{timeoutMs:7500});
 const hits=response.results.length;
 const safeSources=response.sources.map(x=>x.replace(/[^a-zA-Z0-9 .·_-]/g,'').slice(0,32)).slice(0,10);
 if(hits){
  console.log('[WAEWEB Public Canary] PASS_PUBLIC_SEARCH '+JSON.stringify({
   transport:response.transport,sourceCount:safeSources.length,
   resultCount:hits,status:response.status,generalIndex:response.generalIndex
  }));
 }else{
  console.warn('[WAEWEB Public Canary] WARN_ZERO_RESULTS '+JSON.stringify({
   transport:response.transport,sourceCount:safeSources.length,
   status:response.status,generalIndex:response.generalIndex
  }));
 }
}catch(error){
 console.warn('[WAEWEB Public Canary] WARN_NOT_VERIFIED '+String(error?.code||'public_unavailable').slice(0,90));
}
// Never fail a previously working chat deployment on an external free service.
