(()=>{
  'use strict';
  const VERSION='mobile-canonical-chat/v79';
  const EDGE_HOST='pbswcbryxawsmltyromd.supabase.co';
  const EDGE_PATH='/functions/v1/wae-local-voice-demo-v61';
  const nativeFetch=window.fetch.bind(window);
  const WEAK=/continuity_pass_through|all_models_unavailable|todos los proveedores configurados fallaron|rutas generativas.*(?:saturad|no estuv)|respuesta con evidencia recuperada|no pude completar|runtime_temporarily_unavailable|generation failed/i;
  const fallbackSession=(()=>{
    const uuid=()=>globalThis.crypto?.randomUUID?.()||`00000000-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`;
    return{session_id:uuid(),session_secret:`local-${uuid()}-${uuid()}`};
  })();

  function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
  function bodyOf(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):(init.body&&typeof init.body==='object'?init.body:{})}catch{return{}}}
  function isEdge(input){const u=urlOf(input);return !!u&&u.hostname===EDGE_HOST&&u.pathname===EDGE_PATH}
  function isWeak(data){const reply=String(data?.reply??data?.response?.content??'').trim();return !reply||WEAK.test(reply)||WEAK.test(String(data?.error||''))}
  function jsonResponse(data,status=200,route='mobile-v79'){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-mobile-chat':VERSION,'x-wae-chat-route':route}})}
  function serverPayload(p={}){return{
    message:String(p.message||p.task||''),
    mode:String(p.mode||'general'),
    sessionId:String(p.session_id||localStorage.getItem('iu.sessionId')||''),
    conversation_id:p.conversation_id||localStorage.getItem('iu.conversationId')||null,
    attachments:Array.isArray(p.attachments)?p.attachments:[],
    web_enabled:p.web_enabled===true||p.mode==='research',
    provider:'auto',
    client_runtime:VERSION,
    preferences:{responseStyle:'premium-rich',voiceNatural:true}
  }}

  async function canonicalChat(payload,signal){
    const r=await nativeFetch('/api/chat',{method:'POST',headers:{'content-type':'application/json','accept':'application/json','x-wae-mobile-canonical':'v79'},body:JSON.stringify(serverPayload(payload)),cache:'no-store',signal});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||isWeak(d))throw Object.assign(new Error(String(d?.message||d?.error||`canonical_http_${r.status}`)),{code:'CANONICAL_MOBILE_REJECTED',status:r.status||503,payload:d});
    return jsonResponse({...d,mobile_canonical:VERSION,canonical_route:'same-origin-v77'},r.status,'same-origin-v77');
  }

  async function edgeFallback(input,init,payload){
    try{
      const r=await nativeFetch(input,init);
      if(!r.ok)return r;
      const d=await r.clone().json().catch(()=>null);
      if(d&&isWeak(d))return jsonResponse({error:'mobile_routes_unavailable',message:'Universal Core no recibió una respuesta completa por ninguna ruta.',recoverable:true,mobile_canonical:VERSION},503,'edge-rejected');
      return r;
    }catch(error){
      return jsonResponse({error:'mobile_routes_unavailable',message:String(error?.message||'mobile_transport_failure'),recoverable:true,mobile_canonical:VERSION},503,'edge-failed');
    }
  }

  window.fetch=async(input,init={})=>{
    if(!isEdge(input))return nativeFetch(input,init);
    const payload=bodyOf(init);

    if(payload.action==='bootstrap'){
      try{
        const r=await nativeFetch(input,init);
        if(r.ok){const d=await r.clone().json().catch(()=>({}));if(d?.session_id&&d?.session_secret)return r}
      }catch{}
      return jsonResponse({...fallbackSession,success:true,degraded:true,bootstrap:'local-canonical-fallback',mobile_canonical:VERSION},200,'local-bootstrap');
    }

    if(payload.action!=='chat')return nativeFetch(input,init);

    if(payload.stream===true){
      return jsonResponse({error:'stream_deferred_to_canonical',mobile_canonical:VERSION},503,'canonical-nonstream-first');
    }

    try{
      const response=await canonicalChat(payload,init.signal);
      document.documentElement.dataset.mobileChatRoute='same-origin-v77';
      window.__iuLastRuntime={mobile_canonical:VERSION,canonical_route:'same-origin-v77'};
      return response;
    }catch(error){
      document.documentElement.dataset.mobileChatRoute='edge-fallback';
      console.warn('[Universal Core v79] canonical mobile route degraded; trying edge fallback',error?.message||error);
      return edgeFallback(input,init,payload);
    }
  };

  window.__waeMobileCanonicalChat={version:VERSION,primary:'same-origin:/api/chat',fallback:'edge',rejectsContinuityPassThrough:true,bootstrapFailOpenToCanonical:true};
  document.documentElement.dataset.mobileCanonicalChat='v79';
})();
