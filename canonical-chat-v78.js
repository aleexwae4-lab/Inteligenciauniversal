(()=>{
  'use strict';
  const previousFetch=window.fetch.bind(window);
  const VERSION='canonical-chat/v78';
  const DIRECT_TIMEOUT_MS=36000;
  const WEAK_REPLY_RX=/continuity_pass_through|all_models_unavailable|todos los proveedores configurados fallaron|rutas generativas.*(?:saturad|no estuv)|respuesta con evidencia recuperada|no pude completar|runtime_temporarily_unavailable|generation failed/i;

  function requestUrl(input){
    try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}
  }

  function isCanonicalChat(input,init={}){
    const url=requestUrl(input);
    return !!url&&url.origin===location.origin&&url.pathname==='/api/chat'&&String(init.method||'GET').toUpperCase()==='POST';
  }

  function parseBody(init={}){
    try{return typeof init.body==='string'?JSON.parse(init.body):(init.body&&typeof init.body==='object'?init.body:{})}catch{return{}}
  }

  function storedHistory(currentMessage=''){
    try{
      const rows=JSON.parse(localStorage.getItem('wae.messages')||'[]');
      if(!Array.isArray(rows))return[];
      const clean=rows.slice(-20).filter(row=>row&&['user','assistant'].includes(row.role)).map(row=>({role:row.role,text:String(row.text??row.content??'').slice(0,12000)})).filter(row=>row.text.trim());
      const last=clean.at(-1);
      if(last?.role==='user'&&last.text.trim()===String(currentMessage||'').trim())clean.pop();
      return clean;
    }catch{return[]}
  }

  function canonicalBody(incoming={}){
    const message=String(incoming.message||incoming.task||'');
    const mode=String(incoming.mode||localStorage.getItem('wae.mode')||'general');
    return {
      ...incoming,
      message,
      mode,
      sessionId:String(incoming.sessionId||incoming.session_id||localStorage.getItem('iu.sessionId')||''),
      conversation_id:incoming.conversation_id||localStorage.getItem('iu.conversationId')||null,
      history:Array.isArray(incoming.history)&&incoming.history.length?incoming.history:storedHistory(message),
      attachments:Array.isArray(incoming.attachments)&&incoming.attachments.length?incoming.attachments:(Array.isArray(window.__waeRuntimeAttachments)?window.__waeRuntimeAttachments:[]),
      web_enabled:incoming.web_enabled===true||mode==='research',
      provider:incoming.provider||'auto',
      client_runtime:VERSION,
      preferences:{responseStyle:'premium-rich',voiceNatural:true,...(incoming.preferences&&typeof incoming.preferences==='object'?incoming.preferences:{})}
    };
  }

  function usableReply(data){
    const reply=String(data?.reply??data?.response?.content??'').trim();
    return !!reply&&!WEAK_REPLY_RX.test(reply)&&!WEAK_REPLY_RX.test(String(data?.error||''));
  }

  function directRequest(body,outerSignal){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      let settled=false;
      const finish=(fn,value)=>{if(settled)return;settled=true;outerSignal?.removeEventListener?.('abort',abort);fn(value)};
      const abort=()=>{try{xhr.abort()}catch{}finish(reject,Object.assign(new Error('canonical_chat_aborted'),{code:'CANONICAL_CHAT_ABORTED'}))};
      if(outerSignal?.aborted)return abort();
      outerSignal?.addEventListener?.('abort',abort,{once:true});
      xhr.open('POST','/api/chat',true);
      xhr.timeout=DIRECT_TIMEOUT_MS;
      xhr.setRequestHeader('content-type','application/json');
      xhr.setRequestHeader('accept','application/json');
      xhr.setRequestHeader('x-wae-client-runtime','v78-canonical-chat');
      xhr.onload=()=>{
        let data={};
        try{data=JSON.parse(xhr.responseText||'{}')}catch{}
        if(xhr.status>=200&&xhr.status<300&&usableReply(data))return finish(resolve,{data,status:xhr.status});
        const error=Object.assign(new Error(String(data?.message||data?.error||`canonical_chat_${xhr.status}`)),{status:xhr.status||503,payload:data,code:'CANONICAL_CHAT_REJECTED'});
        finish(reject,error);
      };
      xhr.onerror=()=>finish(reject,Object.assign(new Error('canonical_chat_network_error'),{status:503,code:'CANONICAL_CHAT_NETWORK'}));
      xhr.ontimeout=()=>finish(reject,Object.assign(new Error('canonical_chat_timeout'),{status:504,code:'CANONICAL_CHAT_TIMEOUT'}));
      xhr.onabort=()=>finish(reject,Object.assign(new Error('canonical_chat_aborted'),{status:499,code:'CANONICAL_CHAT_ABORTED'}));
      xhr.send(JSON.stringify(body));
    });
  }

  function responseFor(data,status=200,route='same-origin-v77'){
    return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-canonical-chat':VERSION,'x-wae-chat-route':route}});
  }

  function markRoute(route,detail={}){
    document.documentElement.dataset.chatRoute=route;
    window.dispatchEvent(new CustomEvent('wae:canonical-chat-route',{detail:{version:VERSION,route,...detail}}));
  }

  window.fetch=async(input,init={})=>{
    if(!isCanonicalChat(input,init))return previousFetch(input,init);
    const incoming=parseBody(init),body=canonicalBody(incoming);
    try{
      const direct=await directRequest(body,init.signal);
      markRoute('same-origin-v77',{fallback:false});
      window.__iuLastRuntime={...direct.data,canonical_chat:VERSION,canonical_route:'same-origin-v77'};
      return responseFor({...direct.data,canonical_chat:VERSION,canonical_route:'same-origin-v77'},direct.status,'same-origin-v77');
    }catch(error){
      if(init.signal?.aborted)throw error;
      console.warn('[Universal Core v78] canonical route degraded; activating continuity',error?.message||error);
      markRoute('continuity-fallback',{fallback:true,reason:String(error?.code||error?.message||'canonical_failure').slice(0,120)});
      const fallback=await previousFetch(input,init);
      if(!fallback.ok)return fallback;
      try{
        const data=await fallback.clone().json();
        if(!usableReply(data))return responseFor({error:'canonical_and_continuity_unavailable',message:'Universal Core no recibió una respuesta válida por ninguna ruta. El turno puede reintentarse sin mostrar una respuesta incompleta.',recoverable:true,canonical_chat:VERSION},503,'continuity-rejected');
      }catch{}
      return fallback;
    }
  };

  window.__waeCanonicalChat={version:VERSION,primary:'same-origin:/api/chat',fallback:'existing-continuity-stack',rejectsContinuityPassThrough:true};
  document.documentElement.dataset.canonicalChat='v78';
})();
