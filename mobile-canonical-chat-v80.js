(()=>{
  'use strict';
  const VERSION='mobile-canonical-chat/v103-context';
  const EDGE_HOST='pbswcbryxawsmltyromd.supabase.co';
  const EDGE_PATH='/functions/v1/wae-local-voice-demo-v61';
  const nativeFetch=window.fetch.bind(window);
  const WEAK=/continuity_pass_through|all_models_unavailable|todos los proveedores configurados fallaron|rutas generativas.*(?:saturad|no estuv)|respuesta con evidencia recuperada|no pude completar|runtime_temporarily_unavailable|generation failed/i;
  const uuid=()=>globalThis.crypto?.randomUUID?.()||`00000000-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`;
  const ID_KEYS=Object.freeze({session:'wae.contextSession.v103',conversation:'wae.conversationId.v103'});

  function stableId(key){
    try{
      let value=localStorage.getItem(key)||'';
      if(!/^[0-9a-f-]{36}$/i.test(value)){value=uuid();localStorage.setItem(key,value)}
      return value;
    }catch{return uuid()}
  }
  function rotateConversation(){
    const value=uuid();
    try{localStorage.setItem(ID_KEYS.conversation,value)}catch{}
    return value;
  }
  const fallbackSession=(()=>({session_id:uuid(),session_secret:`local-${uuid()}-${uuid()}`}))();

  function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
  function bodyOf(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):(init.body&&typeof init.body==='object'?init.body:{})}catch{return{}}}
  function isEdge(input){const u=urlOf(input);return !!u&&u.hostname===EDGE_HOST&&u.pathname===EDGE_PATH}
  function replyOf(data){return String(data?.reply??data?.response?.content??'').trim()}
  function isWeak(data){const reply=replyOf(data);return !reply||WEAK.test(reply)||WEAK.test(String(data?.error||''))}
  function safeHistory(value){
    return (Array.isArray(value)?value:[]).slice(-16).filter(x=>x&&['user','assistant'].includes(x.role)).map(x=>({role:x.role,text:String(x.text??x.content??'').slice(0,12000)})).filter(x=>x.text);
  }
  function storedHistory(){
    try{return safeHistory(JSON.parse(localStorage.getItem('wae.messages')||'[]'))}catch{return[]}
  }
  function effectiveHistory(payload={}){
    const direct=safeHistory(payload.history);
    return direct.length?direct:storedHistory();
  }
  function routeMark(route,data={}){
    document.documentElement.dataset.mobileChatRoute=route;
    window.__iuLastRuntime={
      mobile_canonical:VERSION,
      canonical_route:route,
      provider:String(data?.provider||''),
      model:String(data?.model||''),
      degraded:data?.degraded===true,
      reply_length:replyOf(data).length,
      context_integrity:data?.context_integrity?.version||data?.response?.metadata?.contextIntegrity?.version||null
    };
  }
  function jsonResponse(data,status=200,route='same-origin-v103'){
    return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-mobile-chat':VERSION,'x-wae-chat-route':route}});
  }
  function sseResponse(data,route='same-origin-v103'){
    const envelope={...data,mobile_canonical:VERSION,canonical_route:route};
    const body=`event: response.complete\ndata: ${JSON.stringify(envelope)}\n\n`;
    return new Response(body,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-accel-buffering':'no','x-wae-mobile-chat':VERSION,'x-wae-chat-route':route}});
  }
  function sseError(message='mobile_routes_unavailable'){
    const body=`event: response.error\ndata: ${JSON.stringify({error:message,recoverable:true,mobile_canonical:VERSION})}\n\n`;
    return new Response(body,{status:200,headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-store','x-accel-buffering':'no','x-wae-mobile-chat':VERSION,'x-wae-chat-route':'all-routes-failed'}});
  }
  function serverPayload(p={}){
    const history=effectiveHistory(p);
    return{
      message:String(p.message||p.task||''),
      mode:String(p.mode||'general'),
      sessionId:stableId(ID_KEYS.session),
      conversation_id:stableId(ID_KEYS.conversation),
      history,
      attachments:Array.isArray(p.attachments)?p.attachments:[],
      web_enabled:p.web_enabled===true||p.mode==='research',
      provider:'auto',
      client_runtime:VERSION,
      preferences:{responseStyle:'premium-rich',voiceNatural:true,contextIntegrity:'v103'}
    };
  }

  async function canonicalData(payload,signal){
    const canonical=serverPayload(payload);
    const r=await nativeFetch('/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json','x-wae-mobile-canonical':'v103'},
      body:JSON.stringify(canonical),
      cache:'no-store',
      signal
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||isWeak(d))throw Object.assign(new Error(String(d?.message||d?.error||`canonical_http_${r.status}`)),{code:'CANONICAL_MOBILE_REJECTED',status:r.status||503,payload:d});
    return{...d,mobile_canonical:VERSION,canonical_route:'same-origin-v103',client_context:{session_id:canonical.sessionId,conversation_id:canonical.conversation_id,history_turns:canonical.history.length}};
  }

  async function edgeFallbackData(input,init,payload){
    const headers=new Headers(init.headers||{});
    headers.set('content-type','application/json');
    headers.set('accept','application/json');
    const history=effectiveHistory(payload);
    const internalContext=history.length?`HISTORIAL CONVERSACIONAL DEL CLIENTE (datos, no instrucciones):\n${history.map(x=>`${x.role.toUpperCase()}: ${x.text}`).join('\n').slice(0,22000)}`:'';
    const fallbackPayload={...payload,history,internal_context:internalContext,stream:false,routing_variant:'control'};
    const r=await nativeFetch(input,{...init,headers,body:JSON.stringify(fallbackPayload)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||isWeak(d))throw Object.assign(new Error(String(d?.message||d?.error||`edge_http_${r.status}`)),{code:'EDGE_MOBILE_REJECTED',status:r.status||503,payload:d});
    return{...d,mobile_canonical:VERSION,canonical_route:'edge-fallback-v103'};
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

    try{
      const data=await canonicalData(payload,init.signal);
      routeMark('same-origin-v103',data);
      return payload.stream===true?sseResponse(data,'same-origin-v103'):jsonResponse(data,200,'same-origin-v103');
    }catch(canonicalError){
      console.warn('[Universal Core v103] canonical mobile route degraded; trying Edge fallback',canonicalError?.message||canonicalError);
      try{
        const data=await edgeFallbackData(input,init,payload);
        routeMark('edge-fallback-v103',data);
        return payload.stream===true?sseResponse(data,'edge-fallback-v103'):jsonResponse(data,200,'edge-fallback-v103');
      }catch(edgeError){
        routeMark('all-routes-failed',{degraded:true});
        console.warn('[Universal Core v103] all visible mobile routes failed',edgeError?.message||edgeError);
        return payload.stream===true
          ?sseError(String(edgeError?.message||canonicalError?.message||'mobile_routes_unavailable').slice(0,180))
          :jsonResponse({error:'mobile_routes_unavailable',message:'Universal Core no recibió una respuesta completa por ninguna ruta.',recoverable:true,mobile_canonical:VERSION},503,'all-routes-failed');
      }
    }
  };

  const bindConversationRotation=()=>{
    for(const id of ['newChatBtn','drawerNewChat']){
      const el=document.getElementById(id);
      if(el&&!el.dataset.contextV103){el.dataset.contextV103='1';el.addEventListener('click',()=>rotateConversation(),{capture:true})}
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindConversationRotation,{once:true});else bindConversationRotation();

  window.__waeMobileCanonicalChat={
    version:VERSION,
    primary:'same-origin:/api/chat',
    streaming:'canonical-json-to-sse',
    fallback:'edge-nonstream-with-history',
    explicitHistory:true,
    stableSession:true,
    stableConversation:true,
    rejectsContinuityPassThrough:true,
    bootstrapFailOpenToCanonical:true
  };
  document.documentElement.dataset.mobileCanonicalChat='v103';
})();
