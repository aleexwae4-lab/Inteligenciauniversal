(()=>{
  'use strict';
  const VERSION='mobile-canonical-chat/v80.1-render-primary';
  const EDGE_HOST='pbswcbryxawsmltyromd.supabase.co';
  const EDGE_PATH='/functions/v1/wae-local-voice-demo-v61';
  const nativeFetch=window.fetch.bind(window);
  const WEAK=/continuity_pass_through|all_models_unavailable|todos los proveedores configurados fallaron|rutas generativas.*(?:saturad|no estuv)|respuesta con evidencia recuperada|no pude completar|runtime_temporarily_unavailable|generation failed/i;
  const CANONICAL_BUDGET_MS=28000;
  const fallbackSession=(()=>{
    const token=()=>globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return{session_id:`render-${token()}`,session_secret:`local-${token()}-${token()}`};
  })();

  function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
  function bodyOf(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):(init.body&&typeof init.body==='object'?init.body:{})}catch{return{}}}
  function isEdge(input){const u=urlOf(input);return !!u&&u.hostname===EDGE_HOST&&u.pathname===EDGE_PATH}
  function replyOf(data){return String(data?.reply??data?.response?.content??'').trim()}
  function isWeak(data){const reply=replyOf(data);return !reply||WEAK.test(reply)||WEAK.test(String(data?.error||''))}
  function routeMark(route,data={}){
    document.documentElement.dataset.mobileChatRoute=route;
    window.__iuLastRuntime={
      mobile_canonical:VERSION,
      canonical_route:route,
      provider:String(data?.provider||''),
      model:String(data?.model||''),
      degraded:data?.degraded===true,
      reply_length:replyOf(data).length
    };
  }
  function jsonResponse(data,status=200,route='same-origin-v80.1'){
    return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-mobile-chat':VERSION,'x-wae-chat-route':route}});
  }
  function sseResponse(data,route='same-origin-v80.1'){
    const envelope={...data,mobile_canonical:VERSION,canonical_route:route};
    const body=`event: response.complete\ndata: ${JSON.stringify(envelope)}\n\n`;
    return new Response(body,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-accel-buffering':'no','x-wae-mobile-chat':VERSION,'x-wae-chat-route':route}});
  }
  function sseError(message='render_primary_unavailable'){
    const body=`event: response.error\ndata: ${JSON.stringify({error:message,recoverable:true,mobile_canonical:VERSION})}\n\n`;
    return new Response(body,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-accel-buffering':'no','x-wae-mobile-chat':VERSION,'x-wae-chat-route':'render-primary-failed'}});
  }
  function serverPayload(p={}){return{
    message:String(p.message||p.task||''),
    mode:String(p.mode||'general'),
    sessionId:String(p.session_id||localStorage.getItem('iu.sessionId')||''),
    conversation_id:p.conversation_id||localStorage.getItem('iu.conversationId')||null,
    attachments:Array.isArray(p.attachments)?p.attachments:[],
    web_enabled:p.web_enabled===true||p.mode==='research',
    provider:'auto',
    client_runtime:VERSION,
    prefer_fast_factual:true,
    preferences:{responseStyle:'premium-rich',voiceNatural:true}
  }}

  function linkedSignal(parent,ms){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(new DOMException(`canonical_deadline_${ms}ms`,'TimeoutError')),ms);
    let remove=()=>{};
    if(parent){
      const relay=()=>controller.abort(parent.reason||new DOMException('Aborted','AbortError'));
      if(parent.aborted)relay();
      else{parent.addEventListener('abort',relay,{once:true});remove=()=>parent.removeEventListener('abort',relay)}
    }
    return{signal:controller.signal,cleanup(){clearTimeout(timer);remove()}};
  }

  async function canonicalData(payload,signal){
    const linked=linkedSignal(signal,CANONICAL_BUDGET_MS);
    try{
      const r=await nativeFetch('/api/chat',{
        method:'POST',
        headers:{'content-type':'application/json','accept':'application/json','x-wae-mobile-canonical':'v80.1'},
        body:JSON.stringify(serverPayload(payload)),
        cache:'no-store',
        signal:linked.signal
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok||isWeak(d))throw Object.assign(new Error(String(d?.message||d?.error||`canonical_http_${r.status}`)),{code:'CANONICAL_MOBILE_REJECTED',status:r.status||503,payload:d});
      return{...d,mobile_canonical:VERSION,canonical_route:'same-origin-v80.1'};
    }finally{linked.cleanup()}
  }

  window.fetch=async(input,init={})=>{
    if(!isEdge(input))return nativeFetch(input,init);
    const payload=bodyOf(init);

    if(payload.action==='bootstrap'){
      try{
        const r=await nativeFetch(input,init);
        if(r.ok){const d=await r.clone().json().catch(()=>({}));if(d?.session_id&&d?.session_secret)return r}
      }catch{}
      try{
        localStorage.setItem('iu.sessionId',fallbackSession.session_id);
        localStorage.setItem('iu.sessionSecret',fallbackSession.session_secret);
        localStorage.setItem('iu.sessionOrigin','render');
      }catch{}
      return jsonResponse({...fallbackSession,success:true,degraded:false,bootstrap:'render-local-fallback',edge_session:false,mobile_canonical:VERSION},200,'local-bootstrap');
    }

    if(payload.action!=='chat')return nativeFetch(input,init);

    try{
      const data=await canonicalData(payload,init.signal);
      routeMark('same-origin-v80.1',data);
      return payload.stream===true?sseResponse(data,'same-origin-v80.1'):jsonResponse(data,200,'same-origin-v80.1');
    }catch(canonicalError){
      routeMark('render-primary-failed',{degraded:true});
      console.warn('[Universal Core v80.1] Render canonical route failed; Edge retry suppressed to avoid duplicate long waits',canonicalError?.message||canonicalError);
      const message=String(canonicalError?.message||'render_primary_unavailable').slice(0,180);
      return payload.stream===true
        ?sseError(message)
        :jsonResponse({error:'render_primary_unavailable',message:'Universal Core no recibió una respuesta completa dentro del presupuesto del turno.',recoverable:true,mobile_canonical:VERSION},503,'render-primary-failed');
    }
  };

  window.__waeMobileCanonicalChat={
    version:VERSION,
    primary:'same-origin:/api/chat',
    streaming:'canonical-json-to-sse',
    fallback:'render-local-bootstrap-only',
    rejectsContinuityPassThrough:true,
    bootstrapFailOpenToCanonical:true,
    edgeChatRetry:false,
    canonicalBudgetMs:CANONICAL_BUDGET_MS
  };
  document.documentElement.dataset.mobileCanonicalChat='v80.1-render-primary';
})();
