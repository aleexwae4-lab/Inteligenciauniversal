(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  const EDGE_MARK='/functions/v1/wae-local-voice-demo-v61';
  const html=document.documentElement;
  html.dataset.mobileRelease='v26';

  function normalize(value=''){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function casual(value=''){
    const raw=String(value||'').trim(),q=normalize(raw);
    if(!q&&/[?¿]+/.test(raw))return true;
    return /^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches|hola buenas|como estas|como andas|que tal|quien eres|que eres|que es universal core|que puedes hacer|como puedes ayudarme|ayuda|ayudame|gracias|muchas gracias|ok|okay|vale|perfecto|listo)$/.test(q);
  }
  function isEdgeChat(input,init={}){
    try{
      const raw=typeof input==='string'?input:input?.url;
      const url=new URL(raw,location.href);
      if(!url.pathname.includes(EDGE_MARK))return false;
      if(String(init.method||'GET').toUpperCase()!=='POST')return false;
      const body=typeof init.body==='string'?JSON.parse(init.body):{};
      return body?.action==='chat'&&casual(body?.message);
    }catch{return false}
  }
  function edgeBody(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):{}}catch{return{}}}
  function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-runtime':'universal-core-mobile-fast-v26'}})}

  window.fetch=async(input,init={})=>{
    if(!isEdgeChat(input,init))return nativeFetch(input,init);
    const body=edgeBody(init);
    try{
      const r=await nativeFetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:String(body.message||''),mode:String(body.mode||'general'),sessionId:String(body.session_id||''),attachments:Array.isArray(body.attachments)?body.attachments:[],preferences:{responseStyle:'premium-rich',voiceNatural:true}}),cache:'no-store',signal:init.signal});
      const data=await r.json().catch(()=>({}));
      if(r.ok&&typeof data.reply==='string'&&data.reply.trim())return jsonResponse({...data,success:true,conversation_id:body.conversation_id||data.conversation_id||null});
    }catch{}
    return nativeFetch(input,init);
  };

  const coreState=()=>document.getElementById('coreState');
  function setCoreState(state){
    const el=coreState();
    html.dataset.coreState=state;
    if(el)el.textContent=state==='recovering'?'recuperando':'operativo';
  }
  function enhanceError(body){
    if(!body||body.dataset.v26Enhanced==='1')return;
    body.dataset.v26Enhanced='1';
    body.innerHTML='<strong>La respuesta no llegó completa.</strong><span>Tu conversación sigue disponible. Usa Reintentar para volver a generar sin perder el contexto.</span>';
    const turn=body.closest('.turn.assistant');
    const retry=turn?.querySelector('.actions button[aria-label="Regenerar"]');
    if(retry){retry.setAttribute('aria-label','Reintentar');retry.title='Reintentar'}
    setCoreState('recovering');
  }
  function inspect(){
    const all=[...document.querySelectorAll('.turn.assistant')];
    for(const turn of all){
      const body=turn.querySelector('.assistant-body.error-text');
      if(body)enhanceError(body);
    }
    const latest=all.at(-1);
    const latestBody=latest?.querySelector('.assistant-body');
    if(latestBody&&!latestBody.classList.contains('error-text')&&!latestBody.querySelector('.typing')&&latestBody.textContent.trim())setCoreState('operational');
  }
  function init(){
    setCoreState('operational');
    const messages=document.getElementById('messages');
    if(messages)new MutationObserver(inspect).observe(messages,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    inspect();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
