(()=>{
  'use strict';
  const VERSION='canonical-brain/v110-local-native';
  const FACTORY_KEY='__waeCanonicalBrainFactoryV110';

  if(window[FACTORY_KEY]){
    window[FACTORY_KEY].install();
    return;
  }

  const EDGE='https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61';
  const EDGE_HOST='pbswcbryxawsmltyromd.supabase.co';
  const EDGE_PATH='/functions/v1/wae-local-voice-demo-v61';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const WEAK=/continuity_pass_through|all_models_unavailable|todos los proveedores configurados fallaron|rutas generativas.*(?:saturad|no estuv)|respuesta con evidencia recuperada|no pude completar|solicitud qued[oó] preservada|umbral m[ií]nimo de calidad|objetivo preservado|runtime_temporarily_unavailable|generation failed|soy un modelo de lenguaje|no existe una ruta generativa/i;
  const CURRENT_OR_HIGH=/\b(hoy|actual|actualmente|reciente|latest|today|current|noticias|news|precio|cotizacion|mercado ahora|esta semana|este mes|medic|salud|diagnost|tratamiento|dosis|legal|jurid|penal|delito|fiscal|tributar|inversion|credito|jurisprudencia|ley vigente|reforma)\b/i;

  function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
  function methodOf(init={}){return String(init.method||'GET').toUpperCase()}
  function isChat(input,init={}){const u=urlOf(input);return !!u&&u.origin===location.origin&&u.pathname==='/api/chat'&&methodOf(init)==='POST'}
  function isNative(input,init={}){const u=urlOf(input);return !!u&&u.origin===location.origin&&u.pathname==='/api/native-brain/chat'&&methodOf(init)==='POST'}
  function isEdge(input,init={}){const u=urlOf(input);return !!u&&u.hostname===EDGE_HOST&&u.pathname===EDGE_PATH&&methodOf(init)==='POST'}
  function parseBody(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):(init.body&&typeof init.body==='object'?init.body:{})}catch{return{}}}
  function uuid(){return globalThis.crypto?.randomUUID?.()||`00000000-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`}
  function stableId(key){try{let v=localStorage.getItem(key)||'';if(!/^[0-9a-f-]{36}$/i.test(v)){v=uuid();localStorage.setItem(key,v)}return v}catch{return uuid()}}
  function storedHistory(){try{return (JSON.parse(localStorage.getItem('wae.messages')||'[]')||[]).slice(-16).filter(x=>x&&['user','assistant'].includes(x.role)).map(x=>({role:x.role,text:String(x.text??x.content??'').slice(0,12000)})).filter(x=>x.text)}catch{return[]}}
  function replyOf(data){return String(data?.reply??data?.response?.content??'').trim()}
  function weak(data){const r=replyOf(data);return !r||WEAK.test(r)||WEAK.test(String(data?.error||''))}
  function jsonResponse(data,status=200,route='native-brain-v110'){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-canonical-brain':VERSION,'x-wae-chat-route':route}})}
  function sseResponse(data,route='native-brain-v110'){
    const envelope={...data,canonical_brain:VERSION,canonical_route:route};
    return new Response(`event: response.complete\ndata: ${JSON.stringify(envelope)}\n\n`,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-accel-buffering':'no','x-wae-canonical-brain':VERSION,'x-wae-chat-route':route}});
  }

  function xhrJson(url,body,{signal,headers={},timeout=16000}={}){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open('POST',url,true);xhr.timeout=timeout;
      xhr.setRequestHeader('content-type','application/json');xhr.setRequestHeader('accept','application/json');
      for(const [k,v] of Object.entries(headers))xhr.setRequestHeader(k,String(v));
      const abort=()=>{try{xhr.abort()}catch{};reject(Object.assign(new Error('request_cancelled'),{code:'REQUEST_CANCELLED'}))};
      if(signal){if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true})}
      const clean=()=>signal?.removeEventListener?.('abort',abort);
      xhr.onload=()=>{clean();let data={};try{data=JSON.parse(xhr.responseText||'{}')}catch{data={error:'invalid_json',raw:String(xhr.responseText||'').slice(0,500)}}resolve({status:xhr.status,data})};
      xhr.onerror=()=>{clean();reject(new Error('xhr_network_error'))};
      xhr.ontimeout=()=>{clean();reject(new Error('xhr_timeout'))};
      xhr.onabort=()=>clean();
      xhr.send(JSON.stringify(body));
    });
  }

  function trace(data,route,latencyMs,degraded=false){
    const payload={event:'canonical_response',at:new Date().toISOString(),release:VERSION,page:location.pathname,displayMode:matchMedia?.('(display-mode: standalone)')?.matches?'standalone':'browser',route,provider:String(data?.provider||''),model:String(data?.model||''),latencyMs:Number(latencyMs)||0,replyLength:replyOf(data).length,degraded:degraded===true||data?.degraded===true,viewport:{width:innerWidth||null,height:innerHeight||null,vvWidth:visualViewport?.width||null,vvHeight:visualViewport?.height||null,vvOffsetTop:visualViewport?.offsetTop||null},valueLength:0,writable:true};
    xhrJson('/api/ui-diagnostics',payload,{timeout:3500}).catch(()=>{});
  }

  function canonicalPayload(incoming={}){
    return{
      message:String(incoming.message||incoming.task||''),
      mode:String(incoming.mode||localStorage.getItem('wae.mode')||'general'),
      sessionId:String(incoming.sessionId||stableId('wae.contextSession.v110')),
      conversation_id:incoming.conversation_id||stableId('wae.conversationId.v110'),
      history:Array.isArray(incoming.history)&&incoming.history.length?incoming.history:storedHistory(),
      attachments:Array.isArray(incoming.attachments)&&incoming.attachments.length?incoming.attachments:(window.__waeRuntimeAttachments||[]),
      web_enabled:incoming.web_enabled===true||incoming.mode==='research',
      provider:'auto',
      client_runtime:VERSION,
      preferences:{...(incoming.preferences||{}),responseStyle:'premium-rich',contextIntegrity:'v110',nativeBrain:true,localNativeBrain:true}
    };
  }

  function localEligible(payload){
    if(!payload||payload.web_enabled===true||payload.mode==='research')return false;
    if(Array.isArray(payload.attachments)&&payload.attachments.length)return false;
    return !CURRENT_OR_HIGH.test(String(payload.message||''));
  }

  async function localBrain(incoming){
    const payload=canonicalPayload(incoming);
    const brain=window.__waeLocalBrain;
    if(!brain?.isNativeLocal)throw new Error('local_brain_missing');
    const status=brain.status?.()||{};
    if(!status.ready){void brain.init?.();throw Object.assign(new Error(status.state==='loading'?'local_brain_loading':'local_brain_not_ready'),{localStatus:status})}
    const data=await brain.generate(payload);
    if(weak(data))throw new Error('local_brain_weak');
    return{...data,canonical_brain:VERSION,canonical_route:'local-native-webgpu-v110'};
  }

  async function nativeBrain(incoming,signal){
    const payload=canonicalPayload(incoming);
    const research=payload.mode==='research'||payload.web_enabled===true;
    const out=await xhrJson('/api/native-brain/chat',payload,{signal,headers:{'x-wae-canonical-brain':'v110','x-wae-native-brain':'v3'},timeout:research?24000:14000});
    if(out.status<200||out.status>=300||weak(out.data))throw Object.assign(new Error(String(out.data?.message||out.data?.error||`native_http_${out.status}`)),{status:out.status,data:out.data});
    return{...out.data,canonical_brain:VERSION,canonical_route:'native-brain-v3-v110'};
  }

  async function legacyFallback(incoming,signal){
    const payload=canonicalPayload(incoming);
    const out=await xhrJson('/api/chat',payload,{signal,headers:{'x-wae-canonical-brain':'v110-fallback'},timeout:payload.mode==='research'?24000:10000});
    if(out.status<200||out.status>=300||weak(out.data))throw new Error(String(out.data?.message||out.data?.error||`legacy_http_${out.status}`));
    return{...out.data,canonical_brain:VERSION,canonical_route:'legacy-fallback-v110',degraded:true};
  }

  async function edgeFallback(incoming,signal){
    const boot=await xhrJson(EDGE,{action:'bootstrap'},{signal,headers:{apikey:SUPABASE_KEY,'x-client-info':VERSION},timeout:4500});
    if(boot.status<200||boot.status>=300||!boot.data?.session_id||!boot.data?.session_secret)throw new Error('edge_bootstrap_failed');
    const payload={action:'chat',session_id:boot.data.session_id,session_secret:boot.data.session_secret,message:String(incoming.message||incoming.task||''),mode:String(incoming.mode||'general'),web_enabled:incoming.web_enabled===true||incoming.mode==='research',attachments:Array.isArray(incoming.attachments)?incoming.attachments:(window.__waeRuntimeAttachments||[]),internal_context:'',stream:false,routing_variant:'candidate'};
    const out=await xhrJson(EDGE,payload,{signal,headers:{apikey:SUPABASE_KEY,'x-client-info':VERSION},timeout:10000});
    if(out.status<200||out.status>=300||weak(out.data))throw new Error(String(out.data?.message||out.data?.error||'edge_fallback_failed'));
    return{...out.data,canonical_brain:VERSION,canonical_route:'edge-fallback-v110',degraded:true};
  }

  async function resolveCanonical(incoming,signal){
    const started=Date.now();
    const payload=canonicalPayload(incoming);
    const localReady=Boolean(window.__waeLocalBrain?.status?.().ready);

    if(localReady&&localEligible(payload)){
      try{
        const data=await localBrain(payload);
        const latencyMs=Date.now()-started;trace(data,'local-native-webgpu-v110',latencyMs,false);return{data,route:'local-native-webgpu-v110',latencyMs};
      }catch(localError){console.warn('[Canonical Brain v110] local native lane degraded',localError?.message||localError)}
    }

    try{
      const data=await nativeBrain(payload,signal);
      const latencyMs=Date.now()-started;trace(data,'native-brain-v3-v110',latencyMs,false);return{data,route:'native-brain-v3-v110',latencyMs};
    }catch(nativeError){
      console.warn('[Canonical Brain v110] server native brain degraded',nativeError?.message||nativeError);
      if(localEligible(payload)){
        try{
          const data=await localBrain(payload);
          const latencyMs=Date.now()-started;trace(data,'local-native-rescue-v110',latencyMs,false);return{data,route:'local-native-rescue-v110',latencyMs};
        }catch(localError){console.warn('[Canonical Brain v110] local rescue unavailable',localError?.message||localError)}
      }
      try{
        const data=await legacyFallback(payload,signal);
        const latencyMs=Date.now()-started;trace(data,'legacy-fallback-v110',latencyMs,true);return{data,route:'legacy-fallback-v110',latencyMs};
      }catch(legacyError){
        console.warn('[Canonical Brain v110] legacy fallback degraded',legacyError?.message||legacyError);
        const data=await edgeFallback(payload,signal);
        const latencyMs=Date.now()-started;trace(data,'edge-fallback-v110',latencyMs,true);return{data,route:'edge-fallback-v110',latencyMs};
      }
    }
  }

  function install(){
    if(window.fetch?.__waeCanonicalVersion===VERSION){
      window.__waeCanonicalBrain={...(window.__waeCanonicalBrain||{}),version:VERSION,reinstalled:false};
      return;
    }
    const previousFetch=window.fetch.bind(window);
    const canonicalFetch=async(input,init={})=>{
      const incoming=parseBody(init);
      const edgeChat=isEdge(input,init)&&incoming.action==='chat';
      const sameOriginChat=isChat(input,init)||isNative(input,init);
      if(!edgeChat&&!sameOriginChat)return previousFetch(input,init);
      try{
        const {data,route,latencyMs}=await resolveCanonical(incoming,init.signal);
        window.__iuLastRuntime={...data,canonical_brain:VERSION,canonical_route:route,canonical_latency_ms:latencyMs};
        document.documentElement.dataset.canonicalBrain=route;
        return edgeChat&&incoming.stream===true?sseResponse(data,route):jsonResponse(data,200,route);
      }catch(error){
        const route='failed-v110';
        console.warn('[Canonical Brain v110] all routes failed',error?.message||error);
        document.documentElement.dataset.canonicalBrain=route;
        trace({provider:'none',model:'none'},route,0,true);
        const localStatus=window.__waeLocalBrain?.status?.()||null;
        const payload={error:'canonical_brain_unavailable',message:localStatus?.state==='loading'?`El cerebro local se está instalando (${Math.round(Number(localStatus.progress||0)*100)}%).`:'Universal Core no obtuvo una respuesta completa.',recoverable:true,canonical_brain:VERSION,local_brain:localStatus};
        if(edgeChat&&incoming.stream===true)return new Response(`event: response.error\ndata: ${JSON.stringify(payload)}\n\n`,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-wae-canonical-brain':VERSION,'x-wae-chat-route':route}});
        return jsonResponse(payload,503,route);
      }
    };
    canonicalFetch.__waeCanonicalVersion=VERSION;
    window.fetch=canonicalFetch;
    window.__waeCanonicalBrain={version:VERSION,primary:'adaptive-local-webgpu-or-native-v3',fallbacks:['local-webgpu','xhr:/api/native-brain/chat','xhr:/api/chat','xhr:supabase-edge'],interceptsEdgeChat:true,nativeBrain:'wae-native-brain/v3-edge-first',localBrain:'universal-core-local-brain/v1',bypassesLegacyFetchInterceptors:true,rejectsWeakContinuity:true,telemetry:'canonical_response-no-prompt',reinstalled:true};
  }

  window[FACTORY_KEY]={version:VERSION,install};
  install();
})();
