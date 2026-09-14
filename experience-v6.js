(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const html=document.documentElement;
  let enableVoiceIntent=false,confirmingVoice=false;

  function syncConversation(){
    const hasUser=$$('#messages .message.user').length>0;
    html.classList.toggle('v6-chat-active',hasUser);
    const messages=$('#messages');
    if(messages)messages.querySelectorAll('.message').forEach((m,i)=>m.style.setProperty('--v6-order',String(Math.min(i,8))));
  }

  function syncQuality(){
    const runtime=window.__iuLastRuntime||{};
    const degraded=runtime.degraded===true||runtime.response?.metadata?.degraded===true;
    html.dataset.responseQuality=degraded?'continuity':'premium';
    const last=$$('#messages .message.assistant:not(#typingMessage)').at(-1);
    if(last){
      last.classList.toggle('v6-quality-degraded',degraded);
      if(degraded)last.setAttribute('aria-label','Respuesta en modo de continuidad');
      else last.removeAttribute('aria-label');
    }
  }

  function keepComposerVisible(){
    const composer=$('#composer');
    const input=$('#messageInput');
    if(!composer||!input)return;
    const resize=()=>{
      input.style.height='auto';
      const h=Math.max(42,Math.min(input.scrollHeight,188));
      input.style.height=`${h}px`;
      composer.classList.toggle('v6-tall',h>72);
    };
    input.addEventListener('input',resize,{passive:true});
    input.addEventListener('focus',()=>setTimeout(()=>composer.scrollIntoView({block:'end',behavior:'smooth'}),120));
    window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(()=>composer.scrollIntoView({block:'end'})),{passive:true});
    resize();
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#voiceBtn');
    if(!button)return;
    enableVoiceIntent=window.__waeVoice?.enabled===false;
  },true);

  window.addEventListener('wae:voice-state',event=>{
    const detail=event.detail||{};
    if(detail.state==='disabled'){enableVoiceIntent=false;return}
    if(!enableVoiceIntent||confirmingVoice||detail.enabled!==true||detail.state!=='ready')return;
    enableVoiceIntent=false;
    confirmingVoice=true;
    setTimeout(()=>{
      Promise.resolve(window.__waeVoice?.speak?.('Voz activada.',{force:true})).finally(()=>{confirmingVoice=false});
    },40);
  });

  function init(){
    html.classList.add('v6-gpt-feel');
    syncConversation();syncQuality();keepComposerVisible();
    const messages=$('#messages');
    if(messages)new MutationObserver(()=>{syncConversation();syncQuality()}).observe(messages,{childList:true,subtree:true});
    const runtimeObserver=new MutationObserver(syncQuality);
    runtimeObserver.observe(html,{attributes:true,attributeFilter:['data-ai-busy','data-answer-quality','data-response-quality']});
    window.addEventListener('wae:stream-event',syncQuality);
    window.addEventListener('resize',syncConversation,{passive:true});
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
