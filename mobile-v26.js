(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  const EDGE_MARK='/functions/v1/wae-local-voice-demo-v61';
  const html=document.documentElement;
  html.dataset.mobileRelease='v26.1-cognitive';

  const CURRENT_RX=/\b(hoy|ahora|actual(?:es|idad|izado|izada)?|reciente|últim[oa]s?|latest|today|current|news|noticias|precio|cotización|jurisprudencia|reforma|ley vigente|verifica|fuentes?|evidencia|web)\b/i;
  const RESEARCH_RX=/\b(investiga|investigación|mercado|competidor|benchmark|tendencia|estadística)\b/i;
  const CODE_RX=/```|\b(código|programa(?:r|ción)?|typescript|javascript|python|sql|api|backend|frontend|debug|bug|refactor|github|deploy|supabase|render|vercel)\b/i;
  const DESIGN_RX=/\b(diseñ|ux|ui|interfaz|experiencia|flujo|pantalla|responsive|móvil|branding)\b/i;
  const ANALYSIS_RX=/\b(analiza|análisis|audita|diagnóstico|estrategia|riesgo|finanzas|roi|prioridad|decisión|compara|arquitectura)\b/i;
  const WEAK_RX=/no pude completar|vuelve a intentarlo|no puedo responder|all_models_unavailable|continuity_pass_through|runtime unavailable|generation failed|respuesta no llegó completa/i;

  function normalize(value=''){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function casual(value=''){
    const raw=String(value||'').trim(),q=normalize(raw);
    if(!q&&/[?¿]+/.test(raw))return true;
    return /^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches|hola buenas|como estas|como andas|que tal|quien eres|que eres|que es universal core|que puedes hacer|como puedes ayudarme|ayuda|ayudame|gracias|muchas gracias|ok|okay|vale|perfecto|listo)$/.test(q);
  }
  function parseBody(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):{}}catch{return{}}}
  function edgeRequest(input,init={}){
    try{
      const raw=typeof input==='string'?input:input?.url,url=new URL(raw,location.href),body=parseBody(init);
      return {matches:url.pathname.includes(EDGE_MARK)&&String(init.method||'GET').toUpperCase()==='POST',body,url};
    }catch{return{matches:false,body:{},url:null}}
  }
  function infer(body={}){
    const message=String(body.message||''),requested=String(body.mode||'general').toLowerCase();
    let mode=['research','code','analysis','design','executive'].includes(requested)?requested:'general';
    if(mode==='general'){
      if(RESEARCH_RX.test(message)||CURRENT_RX.test(message))mode='research';
      else if(CODE_RX.test(message))mode='code';
      else if(DESIGN_RX.test(message))mode='design';
      else if(ANALYSIS_RX.test(message))mode='analysis';
    }
    return{mode,webEnabled:body.web_enabled===true||mode==='research'||CURRENT_RX.test(message)||RESEARCH_RX.test(message)};
  }
  function smartBody(body={}){
    if(body?.action!=='chat')return body;
    const route=infer(body);
    return{...body,mode:route.mode,web_enabled:route.webEnabled,routing_variant:body.routing_variant||'candidate'};
  }
  function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-runtime':'universal-core-mobile-cognitive-v26.1'}})}
  async function renderFallback(body,signal){
    const route=infer(body);
    const r=await nativeFetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:String(body.message||''),mode:route.mode,sessionId:String(body.session_id||''),attachments:Array.isArray(body.attachments)?body.attachments:[],preferences:{responseStyle:'premium-rich',voiceNatural:true}}),cache:'no-store',signal});
    const data=await r.json().catch(()=>({}));
    if(r.ok&&typeof data.reply==='string'&&data.reply.trim())return jsonResponse({...data,success:true,conversation_id:body.conversation_id||data.conversation_id||null});
    return null;
  }

  window.fetch=async(input,init={})=>{
    const edge=edgeRequest(input,init);
    if(!edge.matches)return nativeFetch(input,init);
    const body=edge.body;
    if(body?.action!=='chat')return nativeFetch(input,init);

    if(casual(body?.message)){
      try{const fallback=await renderFallback(body,init.signal);if(fallback)return fallback}catch{}
    }

    const enhanced=smartBody(body);
    let response;
    try{response=await nativeFetch(input,{...init,body:JSON.stringify(enhanced)})}catch(error){throw error}
    if(body.stream===true||!response.ok)return response;

    try{
      const data=await response.clone().json();
      const reply=String(data?.reply||data?.response?.content||'');
      if(!reply.trim()||WEAK_RX.test(reply)){
        const fallback=await renderFallback(enhanced,init.signal);
        if(fallback)return fallback;
      }
    }catch{}
    return response;
  };

  const coreState=()=>document.getElementById('coreState');
  function setCoreState(state){
    const el=coreState();html.dataset.coreState=state;
    if(el)el.textContent=state==='recovering'?'recuperando':'operativo';
  }
  function enhanceError(body){
    if(!body||body.dataset.v26Enhanced==='1')return;
    body.dataset.v26Enhanced='1';
    body.innerHTML='<strong>La respuesta no llegó completa.</strong><span>Tu conversación sigue disponible. Universal Core puede reintentar por una ruta redundante sin perder el contexto visible.</span>';
    const turn=body.closest('.turn.assistant'),retry=turn?.querySelector('.actions button[aria-label="Regenerar"]');
    if(retry){retry.setAttribute('aria-label','Reintentar');retry.title='Reintentar'}
    setCoreState('recovering');
  }
  function inspect(){
    const all=[...document.querySelectorAll('.turn.assistant')];
    for(const turn of all){const body=turn.querySelector('.assistant-body.error-text');if(body)enhanceError(body)}
    const latest=all.at(-1),latestBody=latest?.querySelector('.assistant-body');
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
