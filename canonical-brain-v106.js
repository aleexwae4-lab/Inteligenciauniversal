(()=>{
  'use strict';
  const VERSION='canonical-brain/v112-server-first';
  // Compatibility contract: canonical-brain/v111-hybrid remains a regression marker only; the active runtime is v112 server-first.
  // Compatibility contract: local-native-cpu-wasm-v111 remains available as an offline fallback through universal-core-local-brain/v2-hybrid.
  if(window.__waeCanonicalBrainV112?.installed)return;

  const EDGE='https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61';
  const EDGE_HOST='pbswcbryxawsmltyromd.supabase.co';
  const EDGE_PATH='/functions/v1/wae-local-voice-demo-v61';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const WEAK=/continuity_pass_through|all_models_unavailable|todos los proveedores configurados fallaron|rutas generativas.*(?:saturad|no estuv)|respuesta con evidencia recuperada|no pude completar|solicitud qued[oó] preservada|umbral m[ií]nimo de calidad|objetivo preservado|runtime_temporarily_unavailable|generation failed|soy un modelo de lenguaje|no existe una ruta generativa|ninguna ruta produjo una respuesta completa/i;
  const CURRENT_OR_HIGH=/\b(hoy|actual|actualmente|reciente|latest|today|current|noticias|news|precio|cotizacion|mercado ahora|esta semana|este mes|medic|salud|diagnost|tratamiento|dosis|legal|jurid|penal|delito|fiscal|tributar|inversion|credito|jurisprudencia|ley vigente|reforma)\b/i;

  const previousFetch=window.fetch.bind(window);
  const clean=(v,max=20000)=>String(v??'').replace(/\u0000/g,'').trim().slice(0,max);
  function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
  function methodOf(init={}){return String(init.method||'GET').toUpperCase()}
  function parseBody(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):(init.body&&typeof init.body==='object'?init.body:{})}catch{return{}}}
  function isChat(input,init={}){const u=urlOf(input);return !!u&&u.origin===location.origin&&['/api/chat','/api/native-brain/chat'].includes(u.pathname)&&methodOf(init)==='POST'}
  function isEdge(input,init={}){const u=urlOf(input);return !!u&&u.hostname===EDGE_HOST&&u.pathname===EDGE_PATH&&methodOf(init)==='POST'}
  function uuid(){return globalThis.crypto?.randomUUID?.()||`00000000-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`}
  function stableId(key){try{let v=localStorage.getItem(key)||'';if(!/^[0-9a-f-]{36}$/i.test(v)){v=uuid();localStorage.setItem(key,v)}return v}catch{return uuid()}}
  function storedHistory(message=''){
    try{
      const items=(JSON.parse(localStorage.getItem('wae.messages')||'[]')||[]).slice(-24)
        .filter(x=>x&&['user','assistant'].includes(x.role))
        .map(x=>({role:x.role,text:clean(x.text??x.content,14000)})).filter(x=>x.text);
      const q=clean(message,14000);
      if(items.length&&items.at(-1)?.role==='user'&&items.at(-1)?.text===q)items.pop();
      return items;
    }catch{return[]}
  }
  function replyOf(data){return clean(data?.reply??data?.response?.content,60000)}
  function weak(data){const r=replyOf(data);return !r||WEAK.test(r)||WEAK.test(String(data?.error||''))||data?.quality?.critical===true}
  function jsonResponse(data,status=200,route='native-v5-server-first'){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-canonical-brain':VERSION,'x-wae-chat-route':route}})}
  function sseResponse(data,route='native-v5-server-first'){
    const envelope={...data,canonical_brain:VERSION,canonical_route:route};
    return new Response(`event: response.complete\ndata: ${JSON.stringify(envelope)}\n\n`,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-accel-buffering':'no','x-wae-canonical-brain':VERSION,'x-wae-chat-route':route}});
  }
  function xhrJson(url,body,{signal,headers={},timeout=18000}={}){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open('POST',url,true);xhr.timeout=timeout;
      xhr.setRequestHeader('content-type','application/json');xhr.setRequestHeader('accept','application/json');
      for(const [k,v] of Object.entries(headers))xhr.setRequestHeader(k,String(v));
      const abort=()=>{try{xhr.abort()}catch{};reject(Object.assign(new Error('request_cancelled'),{code:'REQUEST_CANCELLED'}))};
      if(signal){if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true})}
      const cleanSignal=()=>signal?.removeEventListener?.('abort',abort);
      xhr.onload=()=>{cleanSignal();let data={};try{data=JSON.parse(xhr.responseText||'{}')}catch{data={error:'invalid_json'}}resolve({status:xhr.status,data})};
      xhr.onerror=()=>{cleanSignal();reject(new Error('xhr_network_error'))};
      xhr.ontimeout=()=>{cleanSignal();reject(new Error('xhr_timeout'))};
      xhr.onabort=()=>cleanSignal();
      xhr.send(JSON.stringify(body));
    });
  }
  function canonicalPayload(incoming={}){
    const message=clean(incoming.message||incoming.task,30000);
    const mode=clean(incoming.mode||localStorage.getItem('wae.mode')||'general',40).toLowerCase();
    const sessionId=clean(incoming.sessionId||incoming.session_id||stableId('wae.contextSession.v112'),200);
    const conversationId=clean(incoming.conversation_id||incoming.conversationId||stableId('wae.conversationId.v112'),200);
    return{
      ...incoming,
      message,
      mode,
      sessionId,
      session_id:sessionId,
      conversation_id:conversationId,
      conversationId,
      userKey:clean(incoming.userKey||sessionId,200),
      history:Array.isArray(incoming.history)&&incoming.history.length?incoming.history:storedHistory(message),
      attachments:Array.isArray(incoming.attachments)&&incoming.attachments.length?incoming.attachments:(window.__waeRuntimeAttachments||[]),
      web_enabled:incoming.web_enabled===true||mode==='research',
      provider:'auto',
      client_runtime:VERSION,
      preferences:{...(incoming.preferences||{}),responseStyle:'premium-rich',contextIntegrity:'v112',nativeBrain:true,serverFirst:true}
    };
  }
  function localEligible(payload){return !!payload&&!payload.web_enabled&&payload.mode!=='research'&&!(payload.attachments||[]).length&&!CURRENT_OR_HIGH.test(payload.message||'')}
  async function nativeServer(payload,signal){
    const complex=['research','analysis','code','design','executive'].includes(payload.mode)||payload.web_enabled;
    const out=await xhrJson('/api/native-brain/chat',payload,{signal,headers:{'x-wae-canonical-brain':'v112','x-wae-native-brain':'v5-quality-council'},timeout:complex?30000:18000});
    if(out.status<200||out.status>=300||weak(out.data))throw Object.assign(new Error(String(out.data?.error||`native_http_${out.status}`)),{status:out.status,data:out.data});
    return{...out.data,canonical_brain:VERSION,canonical_route:'native-v5-server-first'};
  }
  async function legacyServer(payload,signal){
    const out=await xhrJson('/api/chat',{...payload,canonical_bypass:true},{signal,headers:{'x-wae-canonical-brain':'v112-legacy-fallback'},timeout:['research','analysis','code','design','executive'].includes(payload.mode)?26000:16000});
    if(out.status<200||out.status>=300||weak(out.data))throw new Error(String(out.data?.error||`legacy_http_${out.status}`));
    return{...out.data,canonical_brain:VERSION,canonical_route:'legacy-server-fallback-v112',degraded:true};
  }
  async function localBrain(payload){
    if(!localEligible(payload))throw new Error('local_not_eligible');
    const brain=window.__waeLocalBrain;
    if(!brain?.isNativeLocal||!brain.status?.().ready)throw new Error('local_not_ready');
    const data=await brain.generate(payload);
    if(weak(data))throw new Error('local_weak');
    return{...data,canonical_brain:VERSION,canonical_route:'local-offline-fallback-v112',degraded:true};
  }
  async function edgeFallback(payload,signal){
    const boot=await xhrJson(EDGE,{action:'bootstrap'},{signal,headers:{apikey:SUPABASE_KEY,'x-client-info':VERSION},timeout:4500});
    if(boot.status<200||boot.status>=300||!boot.data?.session_id||!boot.data?.session_secret)throw new Error('edge_bootstrap_failed');
    const out=await xhrJson(EDGE,{action:'chat',session_id:boot.data.session_id,session_secret:boot.data.session_secret,message:payload.message,mode:payload.mode,web_enabled:payload.web_enabled,attachments:payload.attachments||[],internal_context:'',stream:false,routing_variant:'fallback'},{signal,headers:{apikey:SUPABASE_KEY,'x-client-info':VERSION},timeout:10000});
    if(out.status<200||out.status>=300||weak(out.data))throw new Error('edge_fallback_failed');
    return{...out.data,canonical_brain:VERSION,canonical_route:'edge-fallback-v112',degraded:true};
  }
  function trace(data,route,latencyMs){
    try{xhrJson('/api/ui-diagnostics',{event:'canonical_response',at:new Date().toISOString(),release:VERSION,page:location.pathname,route,provider:String(data?.provider||''),model:String(data?.model||''),latencyMs:Number(latencyMs)||0,replyLength:replyOf(data).length,degraded:data?.degraded===true,qualityScore:Number(data?.quality?.score)||null,valueLength:0,writable:true},{timeout:2500}).catch(()=>{})}catch{}
  }
  async function resolveCanonical(incoming,signal){
    const started=Date.now();
    const payload=canonicalPayload(incoming);
    try{
      const data=await nativeServer(payload,signal);trace(data,'native-v5-server-first',Date.now()-started);return{data,route:'native-v5-server-first'};
    }catch(nativeError){console.warn('[Canonical v112] native v5 degraded',nativeError?.message||nativeError)}
    try{
      const data=await legacyServer(payload,signal);trace(data,'legacy-server-fallback-v112',Date.now()-started);return{data,route:'legacy-server-fallback-v112'};
    }catch(legacyError){console.warn('[Canonical v112] legacy server degraded',legacyError?.message||legacyError)}
    try{
      const data=await localBrain(payload);trace(data,'local-offline-fallback-v112',Date.now()-started);return{data,route:'local-offline-fallback-v112'};
    }catch(localError){console.warn('[Canonical v112] local fallback unavailable',localError?.message||localError)}
    const data=await edgeFallback(payload,signal);trace(data,'edge-fallback-v112',Date.now()-started);return{data,route:'edge-fallback-v112'};
  }

  const canonicalFetch=async(input,init={})=>{
    const incoming=parseBody(init);
    const edgeChat=isEdge(input,init)&&incoming.action==='chat';
    if(!edgeChat&&!isChat(input,init))return previousFetch(input,init);
    if(incoming.canonical_bypass===true)return previousFetch(input,init);
    try{
      const {data,route}=await resolveCanonical(incoming,init.signal);
      window.__iuLastRuntime={...data,canonical_brain:VERSION,canonical_route:route};
      document.documentElement.dataset.canonicalBrain=route;
      return edgeChat&&incoming.stream===true?sseResponse(data,route):jsonResponse(data,200,route);
    }catch(error){
      const text='Universal Core no obtuvo una respuesta suficientemente confiable en este turno. La conversación permanece intacta; vuelve a enviar el mensaje para reintentar.';
      const payload={success:true,reply:text,speech_text:text,response:{content:text,speechText:text,sources:[],metadata:{nativeBrain:'wae-native-brain/v5-quality-council',nativePath:'canonical-v112-terminal'}},provider:'universal_core',model:'canonical-continuity-v112',degraded:true,recoverable:true,canonical_brain:VERSION};
      document.documentElement.dataset.canonicalBrain='failed-v112';
      return edgeChat&&incoming.stream===true?sseResponse(payload,'failed-v112'):jsonResponse(payload,200,'failed-v112');
    }
  };
  canonicalFetch.__waeCanonicalVersion=VERSION;
  window.fetch=canonicalFetch;
  window.__waeCanonicalBrainV112={installed:true,version:VERSION,primary:'xhr:/api/native-brain/chat',nativeBrain:'wae-native-brain/v5-quality-council',fallbacks:['xhr:/api/chat','local-webgpu-or-wasm','supabase-edge'],serverFirst:true,localPrimary:false,contextExplicit:true};
  window.__waeCanonicalBrain=window.__waeCanonicalBrainV112;
  document.documentElement.dataset.canonicalBrainRelease='v112';
})();
