(()=>{
  'use strict';

  const previousFetch=window.fetch.bind(window);
  const EDGE_MARK='/functions/v1/wae-local-voice-demo-v61';
  const SATURATION_RX=/rutas generativas|temporalmente saturadas|respuesta con evidencia recuperada|all_models_unavailable|todos los proveedores configurados fallaron/i;

  function parseJsonBody(init={}){
    try{return typeof init.body==='string'?JSON.parse(init.body):{}}catch{return{}}
  }

  function edgeChatRequest(input,init={}){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw,location.href);
      const body=parseJsonBody(init);
      return {
        matches:url.pathname.includes(EDGE_MARK)&&String(init.method||'GET').toUpperCase()==='POST'&&body?.action==='chat',
        body
      };
    }catch{return{matches:false,body:{}}}
  }

  function renderPayload(body={}){
    return {
      message:String(body.message||''),
      mode:String(body.mode||'general'),
      sessionId:String(body.session_id||body.sessionId||''),
      attachments:Array.isArray(body.attachments)?body.attachments:[],
      web_enabled:body.web_enabled===true,
      provider:'auto',
      preferences:{responseStyle:'premium-rich',voiceNatural:true}
    };
  }

  async function renderChat(body,signal){
    const response=await previousFetch('/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json','x-wae-mobile-runtime':'v34-adaptive-mesh'},
      body:JSON.stringify(renderPayload(body)),
      cache:'no-store',
      signal
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.message||data?.error||`render_chat_${response.status}`);
    const reply=String(data?.reply||data?.response?.content||'').trim();
    if(!reply)throw new Error('render_chat_empty');
    if(SATURATION_RX.test(reply))throw new Error('saturation_fallback_rejected');
    if(body.web_enabled!==true&&String(data?.provider||'')==='web_recovery')throw new Error('unexpected_web_recovery');
    return {...data,success:true,reply,response:data?.response||{content:reply},web_sources:Array.isArray(data?.web_sources)?data.web_sources:[]};
  }

  function jsonResponse(data,status=200){
    return new Response(JSON.stringify(data),{
      status,
      headers:{
        'content-type':'application/json; charset=utf-8',
        'cache-control':'no-store',
        'x-wae-runtime':'mobile-adaptive-mesh-v34'
      }
    });
  }

  function sseResponse(data){
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
        'x-wae-runtime':'mobile-adaptive-mesh-v34'
      }
    });
  }

  function cleanFailure(body,error){
    return jsonResponse({
      error:'adaptive_runtime_unavailable',
      message:'Universal Core no obtuvo una respuesta válida por la ruta principal. La consulta se conservó y puede reintentarse sin convertirla automáticamente en una búsqueda web.',
      recoverable:true,
      provider:'universal_core_adaptive_mesh',
      mode:String(body?.mode||'general'),
      web_sources:[],
      detail:String(error?.message||error||'runtime_unavailable').slice(0,180)
    },503);
  }

  window.fetch=async(input,init={})=>{
    const edge=edgeChatRequest(input,init);
    if(!edge.matches)return previousFetch(input,init);

    const body={...edge.body};
    delete body.routing_variant;
    try{
      const data=await renderChat(body,init.signal);
      return body.stream===true?sseResponse(data):jsonResponse(data);
    }catch(error){
      console.warn('[Universal Core mobile v34] adaptive runtime failed',String(error?.message||error));
      return cleanFailure(body,error);
    }
  };

  document.documentElement.dataset.mobileRuntime='v34-adaptive-mesh';
})();
