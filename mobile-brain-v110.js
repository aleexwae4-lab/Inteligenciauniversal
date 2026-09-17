(()=>{
  'use strict';
  if(window.__WAE_INTERFACE_BRAIN_V112__)return;

  const priorFetch=window.fetch.bind(window);
  const VERSION='interface-brain/v112-server-first';
  const EDGE_MARK='/functions/v1/wae-local-voice-demo-v61';
  const WEAK=/continuity_pass_through|all_models_unavailable|todos los proveedores configurados fallaron|no pude completar|solicitud qued[oó] preservada|runtime_temporarily_unavailable|generation failed|ninguna ruta produjo una respuesta completa/i;
  const clean=(v,max=20000)=>String(v??'').replace(/\u0000/g,'').trim().slice(0,max);
  function uuid(){return crypto?.randomUUID?.()||`00000000-0000-4000-8000-${Math.random().toString(16).slice(2,14).padEnd(12,'0')}`}
  function stableId(key){try{let v=localStorage.getItem(key)||'';if(!/^[0-9a-f-]{36}$/i.test(v)){v=uuid();localStorage.setItem(key,v)}return v}catch{return uuid()}}
  function parseBody(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):(init.body&&typeof init.body==='object'?init.body:{})}catch{return{}}}
  function urlOf(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch{return null}}
  function requestKind(input,init={}){
    const u=urlOf(input),method=String(init.method||'GET').toUpperCase();
    if(!u||method!=='POST')return'other';
    if(u.origin===location.origin&&u.pathname==='/api/chat')return'chat';
    if(u.origin===location.origin&&u.pathname==='/api/native-brain/chat')return'native';
    const body=parseBody(init);
    if(u.pathname.includes(EDGE_MARK)&&body?.action==='chat')return'edge';
    return'other';
  }
  function history(message=''){
    try{
      const list=(JSON.parse(localStorage.getItem('wae.messages')||'[]')||[]).slice(-24)
        .filter(x=>x&&['user','assistant'].includes(x.role))
        .map(x=>({role:x.role,text:clean(x.text??x.content,14000)})).filter(x=>x.text);
      const q=clean(message,14000);
      if(list.length&&list.at(-1)?.role==='user'&&list.at(-1)?.text===q)list.pop();
      return list;
    }catch{return[]}
  }
  function normalizedMode(body={}){
    const mode=String(body.mode||localStorage.getItem('wae.mode')||'general').toLowerCase();
    return ['general','research','analysis','code','design','executive'].includes(mode)?mode:'general';
  }
  function payloadFor(body={}){
    const message=clean(body.message||body.task,30000);
    const mode=normalizedMode(body);
    const sessionId=clean(body.sessionId||body.session_id||stableId('wae.contextSession.v112'),200);
    const conversationId=clean(body.conversation_id||body.conversationId||stableId('wae.conversationId.v112'),200);
    return{
      ...body,
      message,
      mode,
      sessionId,
      session_id:sessionId,
      conversation_id:conversationId,
      conversationId,
      userKey:clean(body.userKey||sessionId,200),
      history:Array.isArray(body.history)&&body.history.length?body.history:history(message),
      attachments:Array.isArray(body.attachments)&&body.attachments.length?body.attachments:(window.__waeRuntimeAttachments||[]),
      web_enabled:body.web_enabled===true||mode==='research',
      provider:'auto',
      client_runtime:VERSION,
      preferences:{...(body.preferences||{}),responseStyle:'premium-rich',voiceNatural:true,contextIntegrity:'v112',serverFirst:true}
    };
  }
  function xhrNative(payload,signal){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open('POST','/api/native-brain/chat',true);
      xhr.timeout=['research','analysis','code','design','executive'].includes(payload.mode)?30000:18000;
      xhr.setRequestHeader('content-type','application/json');
      xhr.setRequestHeader('accept','application/json');
      xhr.setRequestHeader('x-wae-interface-brain',VERSION);
      const abort=()=>{try{xhr.abort()}catch{};reject(Object.assign(new Error('request_cancelled'),{name:'AbortError'}))};
      if(signal){if(signal.aborted)return abort();signal.addEventListener('abort',abort,{once:true})}
      const done=()=>signal?.removeEventListener?.('abort',abort);
      xhr.onload=()=>{done();let data={};try{data=JSON.parse(xhr.responseText||'{}')}catch{data={}};const reply=clean(data?.reply||data?.response?.content,60000);if(xhr.status>=200&&xhr.status<300&&reply&&!WEAK.test(reply)&&!data?.quality?.critical){resolve(data)}else reject(Object.assign(new Error(data?.error||`native_http_${xhr.status}`),{data,status:xhr.status}))};
      xhr.onerror=()=>{done();reject(new Error('native_network_error'))};
      xhr.ontimeout=()=>{done();reject(new Error('native_timeout'))};
      xhr.onabort=()=>done();
      xhr.send(JSON.stringify(payload));
    });
  }
  function asResponse(data){
    const conversationId=data?.conversation_id||data?.conversationId||data?.response?.metadata?.conversationId||null;
    if(conversationId)try{localStorage.setItem('wae.conversationId.v112',String(conversationId))}catch{}
    const out={...data,success:true,conversation_id:conversationId||data?.conversation_id||null,interface_brain:VERSION};
    return new Response(JSON.stringify(out),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-interface-brain':VERSION,'x-wae-native-brain':'wae-native-brain/v5-quality-council'}});
  }
  function bypassInit(init={},body={}){
    return{...init,body:JSON.stringify({...body,canonical_bypass:true,interface_bypass:true})};
  }

  window.fetch=async(input,init={})=>{
    const kind=requestKind(input,init);
    if(kind==='other')return priorFetch(input,init);
    const body=parseBody(init);
    if(body.interface_bypass===true)return priorFetch(input,init);
    const source=kind==='edge'?{...body,message:body.message||'',mode:body.mode||'general',attachments:body.attachments||[],web_enabled:body.web_enabled===true}:body;
    const payload=payloadFor(source);
    if(!payload.message)return priorFetch(input,init);
    try{
      const data=await xhrNative(payload,init.signal);
      document.documentElement.dataset.interfaceBrain='native-v5-server-first';
      window.__iuLastRuntime={...data,interface_brain:VERSION,interface_route:'native-v5-server-first'};
      return asResponse(data);
    }catch(error){
      if(String(error?.name||'').toLowerCase()==='aborterror')throw error;
      console.warn('[Interface Brain v112] native v5 degraded; activating fallback',error?.message||error);
      document.documentElement.dataset.interfaceBrain='fallback';
      if(kind==='edge')return priorFetch(input,bypassInit(init,body));
      return priorFetch(input,bypassInit(init,body));
    }
  };

  window.__WAE_INTERFACE_BRAIN_V112__={version:VERSION,primary:'xhr:/api/native-brain/chat',nativeBrain:'wae-native-brain/v5-quality-council',contextExplicit:true,serverFirst:true,localPrimary:false,fallback:'original governed route'};
  window.__WAE_MOBILE_BRAIN_V110__=window.__WAE_INTERFACE_BRAIN_V112__;
  document.documentElement.dataset.mobileBrain='v112';
  window.dispatchEvent(new CustomEvent('wae:mobile-brain-ready',{detail:{version:VERSION,primary:'/api/native-brain/chat'}}));
})();
