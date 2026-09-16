(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window);
  const EDGE_MARK='/functions/v1/wae-local-voice-demo-v61';
  const html=document.documentElement;
  const RESPONSE_LIFECYCLE_VERSION='mobile-response-lifecycle/v97';
  html.dataset.mobileRelease='v31-relevance-guard';
  html.dataset.mobileResponseLifecycle='v97';

  const CURRENT_RX=/\b(hoy|ahora|actual(?:es|idad|izado|izada)?|reciente|últim[oa]s?|latest|today|current|news|noticias|precio|cotización|jurisprudencia|reforma|ley vigente|verifica|fuentes?|evidencia|web)\b/i;
  const RESEARCH_RX=/\b(investiga|investigación|mercado|competidor|benchmark|tendencia|estadística)\b/i;
  const CODE_RX=/```|\b(código|programa(?:r|ción)?|typescript|javascript|python|sql|api|backend|frontend|debug|bug|refactor|github|deploy|supabase|render|vercel)\b/i;
  const DESIGN_RX=/\b(diseñ|ux|ui|interfaz|experiencia|flujo|pantalla|responsive|móvil|branding)\b/i;
  const ANALYSIS_RX=/\b(analiza|análisis|audita|diagnóstico|estrategia|riesgo|finanzas|roi|prioridad|decisión|compara|arquitectura)\b/i;
  const WEAK_RX=/no pude completar|vuelve a intentarlo|no puedo responder|all_models_unavailable|continuity_pass_through|runtime unavailable|generation failed|respuesta no llegó completa/i;
  const RECOVERY_RX=/respuesta con evidencia recuperada|rutas generativas est[aá]n temporalmente saturadas/i;
  const META_RX=/\b(que tan inteligente eres|eres inteligente|que puedes hacer|quien eres|que eres|que es universal core|como funcionas|cuales son tus capacidades)\b/i;
  const EXACT_RX=/\b(responde|devuelve)\s+(exactamente|solamente|solo|s[oó]lo)\b|\bsolo json\b|\bs[oó]lo json\b|\bsin explicaciones\b/i;

  function normalize(value=''){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function casual(value=''){
    const raw=String(value||'').trim(),q=normalize(raw);
    if(!q&&/[?¿]+/.test(raw))return true;
    if(META_RX.test(q))return true;
    if(/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches)(?:\s+(como estas|como te sientes|como andas|que tal))?$/.test(q))return true;
    return /^(como estas|como te sientes|como andas|que tal|quien eres|que eres|que tan inteligente eres|que es universal core|que puedes hacer|como puedes ayudarme|ayuda|ayudame|gracias|muchas gracias|ok|okay|vale|perfecto|listo)$/.test(q);
  }
  function protocolPrompt(value=''){
    const raw=String(value||'').trim();
    return casual(raw)||EXACT_RX.test(raw);
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
    const route=infer(body),next={...body,mode:route.mode,web_enabled:route.webEnabled};
    delete next.routing_variant;
    return next;
  }
  function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-runtime':'universal-core-mobile-relevance-guard-v31'}})}
  async function renderFallback(body,signal){
    const route=infer(body);
    const r=await nativeFetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:String(body.message||''),mode:route.mode,sessionId:String(body.session_id||body.sessionId||''),attachments:Array.isArray(body.attachments)?body.attachments:[],disableTools:protocolPrompt(body.message),preferences:{responseStyle:'premium-rich',voiceNatural:true}}),cache:'no-store',signal});
    const data=await r.json().catch(()=>({}));
    if(r.ok&&typeof data.reply==='string'&&data.reply.trim())return jsonResponse({...data,success:true,conversation_id:body.conversation_id||data.conversation_id||null});
    return null;
  }
  function shouldRejectEdgeReply(data,body){
    const route=infer(body),reply=String(data?.reply||data?.response?.content||'');
    const provider=String(data?.provider||data?.response?.metadata?.provider||'');
    const quality=data?.quality||data?.response?.metadata?.quality||{};
    const reasons=Array.isArray(quality?.reasons)?quality.reasons:[];
    if(!reply.trim()||WEAK_RX.test(reply))return true;
    if(protocolPrompt(body?.message)&&provider==='web_recovery')return true;
    if(!route.webEnabled&&provider==='web_recovery')return true;
    if(!route.webEnabled&&RECOVERY_RX.test(reply))return true;
    if(quality?.critical===true||reasons.includes('low_relevance'))return true;
    return false;
  }
  function blockedRecovery(body){
    return jsonResponse({
      error:'irrelevant_recovery_blocked',
      message:'Universal Core bloqueó una recuperación no relacionada con tu consulta. Reintenta la respuesta; no se mostrará evidencia ajena como si fuera una respuesta válida.',
      recoverable:true,
      provider:'universal_core_relevance_guard',
      web_sources:[],
      mode:infer(body).mode
    },503);
  }

  window.fetch=async(input,init={})=>{
    const edge=edgeRequest(input,init);
    if(!edge.matches)return nativeFetch(input,init);
    const body=edge.body;
    if(body?.action!=='chat')return nativeFetch(input,init);

    if(protocolPrompt(body?.message)){
      try{const fallback=await renderFallback(body,init.signal);if(fallback)return fallback}catch{}
    }

    const enhanced=smartBody(body);
    let response;
    try{response=await nativeFetch(input,{...init,body:JSON.stringify(enhanced)})}catch(error){throw error}
    if(body.stream===true||!response.ok)return response;

    try{
      const data=await response.clone().json();
      if(shouldRejectEdgeReply(data,enhanced)){
        try{
          const fallback=await renderFallback(enhanced,init.signal);
          if(fallback)return fallback;
        }catch{}
        return blockedRecovery(enhanced);
      }
    }catch{}
    return response;
  };

  const coreState=()=>document.getElementById('coreState');
  function setCoreState(state){
    const el=coreState();html.dataset.coreState=state;
    if(el)el.textContent=state==='recovering'?'recuperando':'operativo';
  }
  function completedAssistant(turn){
    if(!turn)return false;
    const body=turn.querySelector('.assistant-body'),actions=turn.querySelector('.actions');
    return !!body&&!body.classList.contains('error-text')&&!body.querySelector('.typing')&&!!body.textContent.trim()&&!!actions&&!actions.classList.contains('hidden');
  }
  function latestTurnSegment(){
    const root=document.getElementById('messages');
    if(!root)return{root:null,turns:[]};
    const children=[...root.children];
    let lastUser=-1;
    for(let i=children.length-1;i>=0;i--){if(children[i].matches?.('.turn.user')){lastUser=i;break}}
    if(lastUser<0)return{root,turns:[]};
    return{root,turns:children.slice(lastUser+1).filter(node=>node.matches?.('.turn.assistant'))};
  }
  function settleVisibleComposer(){
    const liveSend=document.getElementById('send'),liveInput=document.getElementById('input');
    if(liveSend){liveSend.classList.remove('stop');liveSend.textContent='↑';liveSend.setAttribute('aria-label','Enviar');liveSend.disabled=!String(liveInput?.value||'').trim()}
    setCoreState('operational');
    html.dataset.mobileResponseLifecycleState='settled';
  }
  function reconcileCompletedTurn(){
    const {root,turns}=latestTurnSegment();
    if(!root||!turns.length)return false;
    const completed=turns.filter(completedAssistant);
    if(!completed.length)return false;
    const winner=completed.at(-1);
    let removed=0;
    for(const turn of turns){
      if(turn!==winner&&turn.querySelector('.typing')){turn.remove();removed++}
    }
    settleVisibleComposer();
    requestAnimationFrame(()=>{try{winner.scrollIntoView({block:'end',behavior:'auto'});root.scrollTop=root.scrollHeight}catch{}});
    if(removed)window.dispatchEvent(new CustomEvent('wae:mobile-orphan-typing-cleared',{detail:{version:RESPONSE_LIFECYCLE_VERSION,removed}}));
    return true;
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
    reconcileCompletedTurn();
    const latest=[...document.querySelectorAll('.turn.assistant')].at(-1),latestBody=latest?.querySelector('.assistant-body');
    if(latestBody&&!latestBody.classList.contains('error-text')&&!latestBody.querySelector('.typing')&&latestBody.textContent.trim())setCoreState('operational');
  }
  function init(){
    setCoreState('operational');
    const messages=document.getElementById('messages');
    if(messages)new MutationObserver(()=>queueMicrotask(inspect)).observe(messages,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('wae:voice-state',()=>queueMicrotask(inspect));
    window.addEventListener('pageshow',()=>queueMicrotask(inspect));
    inspect();
  }
  window.__WAE_MOBILE_RESPONSE_LIFECYCLE_V97__={version:RESPONSE_LIFECYCLE_VERSION,reconcile:reconcileCompletedTurn,completedAssistant};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
