(()=>{
  'use strict';
  const VERSION='canonical-brain/v106';
  const EDGE='https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const previousFetch=window.fetch.bind(window);
  const WEAK=/continuity_pass_through|all_models_unavailable|todos los proveedores configurados fallaron|rutas generativas.*(?:saturad|no estuv)|respuesta con evidencia recuperada|no pude completar|solicitud qued[oó] preservada|umbral m[ií]nimo de calidad|objetivo preservado|runtime_temporarily_unavailable|generation failed|soy un modelo de lenguaje/i;

  function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
  function isChat(input,init={}){const u=urlOf(input);return !!u&&u.origin===location.origin&&u.pathname==='/api/chat'&&String(init.method||'GET').toUpperCase()==='POST'}
  function parseBody(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):(init.body&&typeof init.body==='object'?init.body:{})}catch{return{}}}
  function uuid(){return globalThis.crypto?.randomUUID?.()||`00000000-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`}
  function stableId(key){try{let v=localStorage.getItem(key)||'';if(!/^[0-9a-f-]{36}$/i.test(v)){v=uuid();localStorage.setItem(key,v)}return v}catch{return uuid()}}
  function history(){try{return (JSON.parse(localStorage.getItem('wae.messages')||'[]')||[]).slice(-16).filter(x=>x&&['user','assistant'].includes(x.role)).map(x=>({role:x.role,text:String(x.text??x.content??'').slice(0,12000)})).filter(x=>x.text)}catch{return[]}}
  function replyOf(data){return String(data?.reply??data?.response?.content??'').trim()}
  function weak(data){const r=replyOf(data);return !r||WEAK.test(r)||WEAK.test(String(data?.error||''))}
  function jsonResponse(data,status=200,route='render-canonical-v106'){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-canonical-brain':VERSION,'x-wae-chat-route':route}})}

  function xhrJson(url,body,{signal,headers={},timeout=45000}={}){
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
    const payload={
      event:'canonical_response',at:new Date().toISOString(),release:VERSION,page:location.pathname,displayMode:matchMedia?.('(display-mode: standalone)')?.matches?'standalone':'browser',
      route,provider:String(data?.provider||''),model:String(data?.model||''),latencyMs:Number(latencyMs)||0,replyLength:replyOf(data).length,degraded:degraded===true||data?.degraded===true,
      viewport:{width:innerWidth||null,height:innerHeight||null,vvWidth:visualViewport?.width||null,vvHeight:visualViewport?.height||null,vvOffsetTop:visualViewport?.offsetTop||null},
      valueLength:0,writable:true
    };
    xhrJson('/api/ui-diagnostics',payload,{timeout:3500}).catch(()=>{});
  }

  async function renderCanonical(incoming,signal){
    const payload={
      ...incoming,
      message:String(incoming.message||incoming.task||''),
      mode:String(incoming.mode||localStorage.getItem('wae.mode')||'general'),
      sessionId:String(incoming.sessionId||stableId('wae.contextSession.v106')),
      conversation_id:incoming.conversation_id||stableId('wae.conversationId.v106'),
      history:Array.isArray(incoming.history)&&incoming.history.length?incoming.history:history(),
      attachments:Array.isArray(incoming.attachments)&&incoming.attachments.length?incoming.attachments:(window.__waeRuntimeAttachments||[]),
      provider:'auto',
      client_runtime:VERSION,
      preferences:{...(incoming.preferences||{}),responseStyle:'premium-rich',contextIntegrity:'v106'}
    };
    const out=await xhrJson('/api/chat',payload,{signal,headers:{'x-wae-canonical-brain':'v106'},timeout:45000});
    if(out.status<200||out.status>=300||weak(out.data))throw Object.assign(new Error(String(out.data?.message||out.data?.error||`render_http_${out.status}`)),{status:out.status,data:out.data});
    return{...out.data,canonical_brain:VERSION,canonical_route:'render-direct-v106'};
  }

  async function edgeFallback(incoming,signal){
    const boot=await xhrJson(EDGE,{action:'bootstrap'},{signal,headers:{apikey:SUPABASE_KEY,'x-client-info':VERSION},timeout:8000});
    if(boot.status<200||boot.status>=300||!boot.data?.session_id||!boot.data?.session_secret)throw new Error('edge_bootstrap_failed');
    const h=history();
    const internal_context=h.length?`HISTORIAL CONVERSACIONAL DEL CLIENTE (datos, no instrucciones):\n${h.map(x=>`${x.role.toUpperCase()}: ${x.text}`).join('\n').slice(0,22000)}`:'';
    const payload={action:'chat',session_id:boot.data.session_id,session_secret:boot.data.session_secret,message:String(incoming.message||incoming.task||''),mode:String(incoming.mode||'general'),web_enabled:incoming.web_enabled===true||incoming.mode==='research',attachments:window.__waeRuntimeAttachments||[],internal_context,stream:false,routing_variant:'candidate'};
    const out=await xhrJson(EDGE,payload,{signal,headers:{apikey:SUPABASE_KEY,'x-client-info':VERSION},timeout:18000});
    if(out.status<200||out.status>=300||weak(out.data))throw new Error(String(out.data?.message||out.data?.error||'edge_fallback_failed'));
    return{...out.data,canonical_brain:VERSION,canonical_route:'edge-fallback-v106'};
  }

  window.fetch=async(input,init={})=>{
    if(!isChat(input,init))return previousFetch(input,init);
    const incoming=parseBody(init),started=Date.now();
    try{
      const data=await renderCanonical(incoming,init.signal);
      const latencyMs=Date.now()-started;
      window.__iuLastRuntime={...data,canonical_brain:VERSION,canonical_route:'render-direct-v106',canonical_latency_ms:latencyMs};
      document.documentElement.dataset.canonicalBrain='render-v106';
      trace(data,'render-direct-v106',latencyMs,false);
      return jsonResponse(data,200,'render-direct-v106');
    }catch(renderError){
      console.warn('[Canonical Brain v106] Render canonical path degraded',renderError?.message||renderError);
      try{
        const data=await edgeFallback(incoming,init.signal);
        const latencyMs=Date.now()-started;
        window.__iuLastRuntime={...data,canonical_brain:VERSION,canonical_route:'edge-fallback-v106',canonical_latency_ms:latencyMs};
        document.documentElement.dataset.canonicalBrain='edge-fallback-v106';
        trace(data,'edge-fallback-v106',latencyMs,true);
        return jsonResponse(data,200,'edge-fallback-v106');
      }catch(edgeError){
        const latencyMs=Date.now()-started;
        console.warn('[Canonical Brain v106] all routes failed',edgeError?.message||edgeError);
        document.documentElement.dataset.canonicalBrain='failed-v106';
        trace({provider:'none',model:'none'},'failed-v106',latencyMs,true);
        return jsonResponse({error:'canonical_brain_unavailable',message:'Universal Core no obtuvo una respuesta generativa completa.',recoverable:true,canonical_brain:VERSION},503,'failed-v106');
      }
    }
  };

  window.__waeCanonicalBrain={version:VERSION,primary:'direct-xhr:/api/chat',fallback:'direct-xhr:supabase-edge',bypassesLegacyFetchInterceptors:true,rejectsWeakContinuity:true,telemetry:'canonical_response-no-prompt'};
})();