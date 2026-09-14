(()=>{
  const VERSION='interaction-guard/v21';
  const $=(s,r=document)=>r.querySelector(s);

  function ensureStyles(){
    if($('#iuInteractionGuardStyles'))return;
    const style=document.createElement('style');
    style.id='iuInteractionGuardStyles';
    style.textContent=`
      .chat-layout{position:relative!important;z-index:0!important}
      #composer{position:relative!important;z-index:300!important;pointer-events:auto!important;isolation:isolate!important}
      #composer,#composer *{touch-action:manipulation}
      #messageInput{position:relative!important;z-index:301!important;pointer-events:auto!important;touch-action:manipulation!important;user-select:text!important;-webkit-user-select:text!important;caret-color:auto!important}
      #drawer:not(.open),#workspace:not(.open),#scrim:not(.visible),.v7-panel:not(.open){pointer-events:none!important;visibility:hidden!important}
      #drawer.open,#workspace.open,#scrim.visible,.v7-panel.open{visibility:visible!important}
    `;
    document.head.appendChild(style);
  }

  function repairInput(){
    ensureStyles();
    const input=$('#messageInput'),composer=$('#composer');
    if(!input||!composer)return false;
    input.disabled=false;
    input.readOnly=false;
    input.removeAttribute('disabled');
    input.removeAttribute('readonly');
    input.removeAttribute('inert');
    input.removeAttribute('aria-disabled');
    input.tabIndex=0;
    composer.removeAttribute('inert');
    composer.removeAttribute('aria-disabled');
    document.documentElement.dataset.interactionGuard=VERSION;
    return true;
  }

  function focusFromGesture(event){
    const input=$('#messageInput'),composer=$('#composer');
    if(!input||!composer)return;
    const target=event.target;
    if(target===input||(composer.contains(target)&&!target.closest('button'))){
      repairInput();
      try{input.focus({preventScroll:true})}catch{input.focus()}
    }
  }

  function boot(){
    if(!repairInput())return;
    const input=$('#messageInput'),composer=$('#composer');
    input.addEventListener('focus',()=>document.documentElement.dataset.inputFocus='true');
    input.addEventListener('blur',()=>document.documentElement.dataset.inputFocus='false');
    input.addEventListener('input',()=>document.documentElement.dataset.inputWritable='true');
    composer.addEventListener('submit',()=>document.documentElement.dataset.inputSubmit='true',true);
    window.visualViewport?.addEventListener('resize',repairInput,{passive:true});
    window.addEventListener('pageshow',repairInput,{passive:true});
    new MutationObserver(repairInput).observe(composer,{attributes:true,subtree:true,attributeFilter:['disabled','readonly','inert','aria-disabled','class','style']});
  }

  document.addEventListener('pointerdown',focusFromGesture,true);
  document.addEventListener('touchstart',focusFromGesture,{capture:true,passive:true});
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
  window.__waeInteractionGuard={version:VERSION,repair:repairInput};
})();
