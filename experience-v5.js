(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const html=document.documentElement;
  const voiceBtn=()=>$('#voiceBtn');
  const hint=()=>$('.v2-composer-hint');
  let lastAssistantCount=0;

  function loadV6(){
    if(!document.querySelector('link[data-wae-v6]')){const css=document.createElement('link');css.rel='stylesheet';css.href='./experience-v6.css';css.dataset.waeV6='true';document.head.appendChild(css)}
    if(!document.querySelector('script[data-wae-v6]')){const js=document.createElement('script');js.src='./experience-v6.js';js.defer=true;js.dataset.waeV6='true';document.head.appendChild(js)}
  }

  function ensureStatus(){
    const h=hint();if(!h)return null;
    let status=h.querySelector('.v5-live-status');
    if(!status){status=document.createElement('span');status.className='v5-live-status';status.innerHTML='<i></i><b>voz lista</b>';h.prepend(status)}
    return status;
  }
  function voiceLabel(state,engine){
    if(state==='playing')return engine==='browser'?'hablando · dispositivo':'hablando · natural';
    if(state==='starting')return'preparando voz';
    if(state==='fallback')return'voz · dispositivo';
    if(state==='error')return'voz no disponible';
    if(state==='disabled')return'voz desactivada';
    return engine==='browser'?'voz · dispositivo':'voz lista';
  }
  function syncVoice(detail={}){
    const btn=voiceBtn(),diag=window.__waeVoice?.diagnostics||{},enabled=detail.enabled??diag.enabled??window.__waeVoice?.enabled??true,state=detail.state||diag.state||html.dataset.voiceState||(enabled?'ready':'disabled'),engine=detail.engine||diag.engine||html.dataset.voiceEngine||'idle';
    const voiceName=diag.voice||detail.voice||window.__waeVoice?.voice||'voz del sistema';
    const voiceCount=Number(detail.voiceCount??diag.voiceCount??0);
    if(btn){btn.setAttribute('aria-pressed',String(!!enabled));btn.dataset.voiceState=state;const base=enabled?'Voz activa · '+voiceLabel(state,engine)+'. Toca para desactivar.':'Toca para activar respuestas por voz';btn.title=voiceCount?base+' '+voiceName+' · '+voiceCount+' voces disponibles.':base;btn.setAttribute('aria-label',voiceCount?base+' '+voiceName+', '+voiceCount+' voces disponibles.':base);btn.textContent=state==='playing'?'■':'♩'}
    const status=ensureStatus();if(status){status.dataset.state=state;status.querySelector('b').textContent=voiceLabel(state,engine);status.title=voiceCount?voiceName+' · '+voiceCount+' voces disponibles'+(diag.lastLatencyMs?' · '+diag.lastLatencyMs+' ms':''):''}
  }
  window.addEventListener('wae:voice-state',e=>syncVoice(e.detail||{}));

  function syncRuntime(){
    const busy=html.dataset.aiBusy==='true',runtime=window.__iuLastRuntime||{},degraded=runtime.degraded===true||runtime.response?.metadata?.degraded===true;
    html.dataset.answerQuality=degraded?'degraded':'premium';
    const status=ensureStatus();
    if(status&&busy){status.dataset.runtime='busy';status.querySelector('b').textContent='Universal Core procesando'}
    else if(status&&html.dataset.voiceState!=='playing')syncVoice({});
    const assistants=$$('#messages .message.assistant:not(#typingMessage)');
    if(assistants.length){const last=assistants.at(-1);last?.classList.toggle('v5-degraded',degraded);if(degraded&&!last.querySelector('.v5-degraded-badge')){const badge=document.createElement('div');badge.className='v5-degraded-badge';badge.textContent='Modo continuidad · respuesta determinista';last.appendChild(badge)}}
  }

  function animateMessages(){
    const assistants=$$('#messages .message');
    assistants.forEach((el,i)=>{if(!el.dataset.v5Animated){el.dataset.v5Animated='true';el.style.setProperty('--v5-order',String(Math.min(i,6)))}});
    const userCount=$$('#messages .message.user').length;
    html.classList.toggle('v5-chat-active',userCount>0);
    if(assistants.length!==lastAssistantCount){lastAssistantCount=assistants.length;requestAnimationFrame(()=>$('.chat-layout')?.scrollTo({top:$('.chat-layout').scrollHeight,behavior:'smooth'}));syncRuntime()}
  }

  function composerDynamics(){
    const input=$('#messageInput'),composer=$('#composer');if(!input||!composer)return;
    const resize=()=>{input.style.height='auto';const h=Math.max(42,Math.min(input.scrollHeight,190));input.style.height=`${h}px`;composer.classList.toggle('v5-expanded',h>64)};
    input.addEventListener('input',resize,{passive:true});
    input.addEventListener('focus',()=>{composer.classList.add('v5-focus');setTimeout(()=>composer.scrollIntoView({block:'end',behavior:'smooth'}),180)});
    input.addEventListener('blur',()=>composer.classList.remove('v5-focus'));
    $('#composer')?.addEventListener('submit',()=>setTimeout(resize,0));
    resize();
  }

  function enhanceRuntime(){
    const bar=$('.runtime-bar');if(!bar)return;
    bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');
    const ro=new MutationObserver(syncRuntime);ro.observe(html,{attributes:true,attributeFilter:['data-ai-busy','data-voice-state','data-voice-engine']});
  }

  function init(){
    html.classList.add('v5-experience');
    loadV6();
    syncVoice({enabled:window.__waeVoice?.enabled??localStorage.getItem('iu.voiceEnabled')!=='false'});
    composerDynamics();enhanceRuntime();animateMessages();
    const messages=$('#messages');if(messages)new MutationObserver(()=>{animateMessages();syncRuntime()}).observe(messages,{childList:true,subtree:true});
    window.addEventListener('resize',()=>requestAnimationFrame(animateMessages),{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(animateMessages,150),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncVoice({})});
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
