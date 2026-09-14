(()=>{
  const VERSION='interaction-v9/v1';
  const $=(s,r=document)=>r.querySelector(s);

  function readMessages(){
    try{const value=JSON.parse(localStorage.getItem('wae.messages')||'[]');return Array.isArray(value)?value:[]}catch{return[]}
  }

  function ensureSendButton(){
    const form=$('#composer'),actions=form?.querySelector('.composer-actions');
    if(!form||!actions)return null;
    let send=actions.querySelector('.send-btn');
    if(!send){send=document.createElement('button');send.type='submit';send.className='send-btn';send.setAttribute('aria-label','Enviar');send.textContent='➜';actions.appendChild(send)}
    send.hidden=false;send.removeAttribute('aria-hidden');send.style.display='grid';
    document.documentElement.dataset.sendReady='true';
    return send;
  }

  function removeRecovery(){document.querySelector('#v9TurnRecovery')?.remove()}

  function showRecovery(){
    removeRecovery();
    const list=readMessages(),last=list.at(-1),root=$('#messages');
    if(!root||!last||last.role!=='user'||$('#typingMessage')||$('#iuStreamPreview'))return;
    const user=[...root.querySelectorAll('.message.user')].at(-1);if(!user)return;
    const box=document.createElement('div');box.id='v9TurnRecovery';box.className='v9-turn-recovery';
    box.innerHTML='<span>La última solicitud quedó pendiente.</span><button type="button">Reintentar respuesta</button>';
    box.querySelector('button')?.addEventListener('click',()=>{
      const input=$('#messageInput'),form=$('#composer');if(!input||!form)return;
      input.value=String(last.text||'');input.dispatchEvent(new Event('input',{bubbles:true}));removeRecovery();form.requestSubmit();
    });
    user.after(box);
  }

  function keepComposerInsideViewport(){
    const form=$('#composer');if(!form)return;
    form.style.maxWidth='calc(100vw - 16px)';form.style.minWidth='0';
    ensureSendButton();
  }

  function init(){
    document.documentElement.dataset.interactionRuntime=VERSION;
    ensureSendButton();keepComposerInsideViewport();
    const form=$('#composer'),messages=$('#messages');
    form?.addEventListener('submit',()=>{removeRecovery();document.documentElement.dataset.chatSubmit='sent';localStorage.setItem('iu.lastSubmitAt',new Date().toISOString())},true);
    if(messages)new MutationObserver(()=>{ensureSendButton();const list=readMessages();if(list.at(-1)?.role==='assistant')removeRecovery()}).observe(messages,{childList:true,subtree:false});
    window.addEventListener('wae:stream-event',event=>{const name=event.detail?.event;if(name==='response.complete')removeRecovery();if(name==='response.error')setTimeout(showRecovery,120)});
    window.visualViewport?.addEventListener('resize',keepComposerInsideViewport,{passive:true});
    window.addEventListener('pageshow',()=>{keepComposerInsideViewport();setTimeout(showRecovery,180)},{passive:true});
    setTimeout(showRecovery,350);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
  window.__waeInteraction={version:VERSION,ensureSendButton,showRecovery};
})();
