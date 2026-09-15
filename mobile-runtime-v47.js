(()=>{
  'use strict';
  if(window.__WAE_MOBILE_RUNTIME_V47__)return;

  const previousFetch=window.fetch.bind(window);
  const EDGE_MARK='/functions/v1/wae-local-voice-demo-v61';
  const SATURATION_RX=/rutas generativas|temporalmente saturadas|respuesta con evidencia recuperada|all_models_unavailable|todos los proveedores configurados fallaron/i;
  const RECENT_TTL_MS=45000;
  const CLIENT_BUDGETS=Object.freeze({general:24000,analysis:30000,code:30000,design:30000,executive:30000,research:36000});
  const LEGACY_RUNTIME_MARKER='v47-long-session-backpressure';
  void LEGACY_RUNTIME_MARKER;
  const recent=new Map();
  const inflight=new Map();
  let activeTurn=null;

  function parseJsonBody(init={}){
    try{return typeof init.body==='string'?JSON.parse(init.body):{}}catch{return{}}
  }

  function requestUrl(input){
    try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}
  }

  function edgeChatRequest(input,init={}){
    const url=requestUrl(input),body=parseJsonBody(init);
    return {matches:!!url&&url.pathname.includes(EDGE_MARK)&&String(init.method||'GET').toUpperCase()==='POST'&&body?.action==='chat',body};
  }

  function directChatRequest(input,init={}){
    const url=requestUrl(input),body=parseJsonBody(init);
    return {matches:!!url&&url.origin===location.origin&&url.pathname==='/api/chat'&&String(init.method||'GET').toUpperCase()==='POST',body};
  }

  function safeHistory(value){
    return (Array.isArray(value)?value:[]).slice(-20).filter(x=>x&&['user','assistant'].includes(x.role)).map(x=>({role:x.role,text:String(x.text??x.content??'').slice(0,12000)}));
  }

  function renderPayload(body={}){
    return {
      message:String(body.message||''),
      mode:String(body.mode||'general'),
      sessionId:String(body.session_id||body.sessionId||''),
      history:safeHistory(body.history),
      attachments:Array.isArray(body.attachments)?body.attachments:[],
      web_enabled:body.web_enabled===true,
      provider:'auto',
      council_mode:false,
      clientTurnId:String(body.client_turn_id||body.clientTurnId||''),
      preferences:{responseStyle:'premium-rich',voiceNatural:true,longSession:true,...(body.preferences&&typeof body.preferences==='object'?body.preferences:{})}
    };
  }

  function hash(value){
    let h=2166136261;
    for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}
    return (h>>>0).toString(36);
  }

  function turnKey(body={}){
    const attachments=(Array.isArray(body.attachments)?body.attachments:[]).map(a=>`${String(a?.name||'').slice(0,80)}:${String(a?.text||'').length}`).join('|');
    const history=safeHistory(body.history).slice(-4).map(x=>`${x.role}:${x.text.slice(0,160)}`).join('|');
    const material=[String(body.message||''),String(body.mode||'general'),body.web_enabled===true?'1':'0',attachments,history].join('\u241f');
    return hash(material);
  }

  function turnBudget(body={}){
    if(body.web_enabled===true)return CLIENT_BUDGETS.research;
    const mode=String(body.mode||'general').toLowerCase();
    return CLIENT_BUDGETS[mode]||CLIENT_BUDGETS.general;
  }

  function cleanupRecent(){
    const now=Date.now();
    for(const [key,row] of recent)if(now-row.at>RECENT_TTL_MS)recent.delete(key);
  }

  function cached(key){
    cleanupRecent();
    return recent.get(key)||null;
  }

  function linkSignal(parent,ms){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(new DOMException(`mobile_turn_deadline_${ms}ms`,'TimeoutError')),ms);
    let remove=()=>{};
    if(parent){
      const relay=()=>controller.abort(parent.reason||new DOMException('Aborted','AbortError'));
      if(parent.aborted)relay();
      else{parent.addEventListener('abort',relay,{once:true});remove=()=>parent.removeEventListener('abort',relay)}
    }
    return {controller,signal:controller.signal,cleanup(){clearTimeout(timer);remove()}};
  }

  async function renderChat(body,signal){
    const payload=renderPayload(body);
    const budget=turnBudget(payload);
    const linked=linkSignal(signal,budget);
    try{
      const response=await previousFetch('/api/chat',{
        method:'POST',
        headers:{
          'content-type':'application/json',
          'x-wae-mobile-runtime':'v64-response-lifecycle',
          'x-wae-mobile-attempt':'1',
          'x-wae-client-turn':String(payload.clientTurnId||'').slice(0,80)
        },
        body:JSON.stringify(payload),
        cache:'no-store',
        signal:linked.signal
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        const error=new Error(data?.message||data?.error||`render_chat_${response.status}`);
        error.status=response.status;
        error.payload=data;
        throw error;
      }
      const reply=String(data?.reply||data?.response?.content||'').trim();
      if(!reply)throw new Error('render_chat_empty');
      if(SATURATION_RX.test(reply))throw new Error('saturation_fallback_rejected');
      if(body.web_enabled!==true&&String(data?.provider||'')==='web_recovery')throw new Error('unexpected_web_recovery');
      return {...data,success:true,reply,response:data?.response||{content:reply},web_sources:Array.isArray(data?.web_sources)?data.web_sources:[]};
    }finally{linked.cleanup()}
  }

  function jsonResponse(data,status=200,extra={}){
    return new Response(JSON.stringify(data),{
      status,
      headers:{
        'content-type':'application/json; charset=utf-8',
        'cache-control':'no-store',
        'x-wae-runtime':'mobile-lifecycle-v64',
        ...extra
      }
    });
  }

  function sseResponse(data,extra={}){
    const reply=String(data?.reply||data?.response?.content||'');
    const payload=[
      'event: content.delta',
      `data: ${JSON.stringify({text:reply})}`,
      '',
      'event: response.complete',
      `data: ${JSON.stringify(data)}`,
      '',
      ''
    ].join('\n');
    return new Response(payload,{
      status:200,
      headers:{
        'content-type':'text/event-stream; charset=utf-8',
        'cache-control':'no-store',
        'x-wae-runtime':'mobile-lifecycle-v64',
        ...extra
      }
    });
  }

  function cleanFailure(body,error){
    const payload=error?.payload&&typeof error.payload==='object'?error.payload:{
      error:'adaptive_runtime_unavailable',
      message:'Universal Core no recibió una respuesta terminal dentro de la ventana del cliente. El turno queda reintentable y ningún fallo transitorio se guardará como respuesta definitiva.',
      recoverable:true,
      provider:'universal_core_long_session',
      mode:String(body?.mode||'general'),
      web_sources:[],
      detail:String(error?.message||error||'runtime_unavailable').slice(0,180)
    };
    const status=Number(error?.status)||503;
    return {payload:{...payload,recoverable:payload?.recoverable!==false},status};
  }

  async function executeEdgeTurn(body,signal){
    const key=turnKey(body),hit=cached(key);
    if(hit)return body.stream===true?sseResponse(hit.data,{'x-wae-dedupe':'recent-success'}):jsonResponse(hit.data,200,{'x-wae-dedupe':'recent-success'});

    if(inflight.has(key)){
      const result=await inflight.get(key);
      if(result.ok)return body.stream===true?sseResponse(result.data,{'x-wae-dedupe':'inflight'}):jsonResponse(result.data,200,{'x-wae-dedupe':'inflight'});
      return jsonResponse(result.data,result.status,{'x-wae-dedupe':'inflight-transient'});
    }

    if(activeTurn&&activeTurn.key!==key&&!activeTurn.controller.signal.aborted){
      activeTurn.controller.abort(new DOMException('Superseded by newer turn','AbortError'));
    }
    const budget=turnBudget(body);
    const active=linkSignal(signal,budget+1500);
    const executionBody={...body,clientTurnId:body.clientTurnId||body.client_turn_id||`mobile-${key}`};
    activeTurn={key,controller:active.controller};

    const task=(async()=>{
      try{
        const data=await renderChat(executionBody,active.signal);
        const result={ok:true,data,status:200};
        recent.set(key,{...result,at:Date.now()});
        return result;
      }catch(error){
        const failure=cleanFailure(body,error);
        return {ok:false,data:failure.payload,status:failure.status};
      }finally{
        active.cleanup();
        inflight.delete(key);
        if(activeTurn?.key===key)activeTurn=null;
      }
    })();

    inflight.set(key,task);
    const result=await task;
    if(result.ok)return body.stream===true?sseResponse(result.data):jsonResponse(result.data);
    return jsonResponse(result.data,result.status,{'x-wae-retryable':'true'});
  }

  window.fetch=async(input,init={})=>{
    const edge=edgeChatRequest(input,init);
    if(edge.matches){
      const body={...edge.body};
      delete body.routing_variant;
      return executeEdgeTurn(body,init.signal);
    }

    const direct=directChatRequest(input,init);
    if(direct.matches){
      const key=turnKey(direct.body),hit=cached(key);
      if(hit)return jsonResponse(hit.data,200,{'x-wae-dedupe':'direct-success-replay'});
      if(inflight.has(key)){
        const result=await inflight.get(key);
        return result.ok?jsonResponse(result.data,200,{'x-wae-dedupe':'direct-inflight'}):jsonResponse(result.data,result.status,{'x-wae-dedupe':'direct-inflight-transient'});
      }
    }

    return previousFetch(input,init);
  };

  window.__WAE_MOBILE_RUNTIME_V47__={version:'64.0.0',singleAttempt:true,dedupeMs:RECENT_TTL_MS,backpressure:true,history:true,successOnlyCache:true,recoverableFailuresRetryable:true,clientBudgets:CLIENT_BUDGETS,compatibility:'v47-long-session-backpressure'};
  document.documentElement.dataset.mobileRuntime='v64-response-lifecycle';
})();
