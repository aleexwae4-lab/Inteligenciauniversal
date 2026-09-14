(()=>{
  const root=document.getElementById('mobileSafeComposer');
  const input=document.getElementById('mobileSafeInput');
  const send=document.getElementById('mobileSafeSend');
  if(!root||!input||!send)return;
  const isMobile=()=>matchMedia('(max-width:899px)').matches;
  const nativeInput=()=>document.getElementById('messageInput');
  const nativeForm=()=>document.getElementById('composer');

  const repair=()=>{
    if(!isMobile())return;
    input.disabled=false;
    input.readOnly=false;
    input.removeAttribute('disabled');
    input.removeAttribute('readonly');
    input.removeAttribute('inert');
    input.setAttribute('inputmode','text');
    input.setAttribute('enterkeyhint','send');
    input.style.pointerEvents='auto';
    input.style.visibility='visible';
    input.style.opacity='1';
    document.documentElement.dataset.mobileSafeComposer='ready';
  };

  const resize=()=>{
    input.style.height='auto';
    input.style.height=`${Math.min(Math.max(input.scrollHeight,44),144)}px`;
  };

  const focusInput=()=>{
    if(!isMobile())return;
    repair();
    try{input.focus({preventScroll:true})}catch{input.focus()}
    document.documentElement.dataset.mobileSafeFocus=document.activeElement===input?'true':'false';
  };

  const syncBusy=()=>{
    const busy=document.documentElement.dataset.aiBusy==='true';
    send.disabled=busy;
    send.setAttribute('aria-busy',String(busy));
  };

  const submit=event=>{
    event.preventDefault();
    repair();
    const text=input.value.trim();
    const target=nativeInput();
    const form=nativeForm();
    if(!text||!target||!form||send.disabled)return;
    target.disabled=false;
    target.readOnly=false;
    target.value=text;
    target.dispatchEvent(new Event('input',{bubbles:true}));
    document.documentElement.dataset.mobileSafeSubmit='sent';
    form.requestSubmit();
    input.value='';
    resize();
  };

  root.addEventListener('submit',submit);
  input.addEventListener('input',()=>{resize();document.documentElement.dataset.mobileSafeTyped=input.value.length?'true':'false'});
  input.addEventListener('focus',()=>{document.documentElement.dataset.mobileSafeFocus='true'});
  input.addEventListener('blur',()=>{document.documentElement.dataset.mobileSafeFocus='false'});
  input.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();root.requestSubmit()}
  });
  root.addEventListener('pointerdown',event=>{
    if(event.target===root||event.target===input)queueMicrotask(focusInput);
  },{passive:true});
  root.addEventListener('touchstart',event=>{
    if(event.target===root||event.target===input)setTimeout(focusInput,0);
  },{passive:true});

  new MutationObserver(syncBusy).observe(document.documentElement,{attributes:true,attributeFilter:['data-ai-busy']});
  window.addEventListener('pageshow',()=>{repair();syncBusy()});
  window.addEventListener('orientationchange',()=>setTimeout(repair,50));
  window.visualViewport?.addEventListener('resize',repair);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)repair()});
  repair();resize();syncBusy();
  window.__waeMobileSafeComposer={version:'mobile-safe-composer/v22',focus:focusInput,repair};
})();
