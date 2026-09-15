(()=>{
  'use strict';
  const LEGACY='wae.autoVoice';
  const desired=()=>localStorage.getItem(LEGACY)!=='false';
  function engine(){return window.__waeVoice||null}
  function sync(detail={}){
    const v=engine(),enabled=detail.enabled??v?.enabled??desired(),state=detail.state||document.documentElement.dataset.voiceState||(enabled?'ready':'disabled');
    for(const id of ['voiceBtn','mobileSafeVoice']){const b=document.getElementById(id);if(!b)continue;b.setAttribute('aria-pressed',String(!!enabled));b.dataset.voiceState=state;b.title=enabled?(state==='playing'?'Universal Core está hablando. Toca para desactivar.':'Voz automática activa. Toca para desactivar.'):'Activar respuestas por voz';if(id==='mobileSafeVoice')b.textContent=state==='playing'?'■':'♪'}
  }
  async function applyDesired(){const v=engine();if(!v)return false;await v.unlock?.();await v.setEnabled?.(desired());sync({enabled:v.enabled,state:v.enabled?'ready':'disabled'});return true}
  function install(){
    const legacySpeak=window.speakAnswer;
    if(typeof legacySpeak==='function')window.speakAnswer=(text)=>{if(window.__iuSuppressNextAutoSpeech===true){window.__iuSuppressNextAutoSpeech=false;return false}return legacySpeak(text)};
    const native=document.getElementById('voiceBtn');
    if(native){native.setAttribute('aria-pressed',String(desired()));native.addEventListener('click',()=>{queueMicrotask(async()=>{const v=engine();if(!v)return;await v.unlock?.();await v.setEnabled?.(desired());sync({enabled:v.enabled})})})}
    const form=document.getElementById('mobileSafeComposer'),send=document.getElementById('mobileSafeSend');
    if(form&&send&&!document.getElementById('mobileSafeVoice')){const b=document.createElement('button');b.type='button';b.id='mobileSafeVoice';b.setAttribute('aria-label','Voz automática');b.textContent='♪';b.style.cssText='flex:0 0 42px;width:42px;height:42px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:#11161a;color:#79e8a4;font:700 18px/1 system-ui;pointer-events:auto;touch-action:manipulation';b.addEventListener('click',async()=>{if(native){native.click();return}const v=engine();if(!v)return;await v.unlock?.();const next=await v.toggle?.();localStorage.setItem(LEGACY,String(next));sync({enabled:next})});form.insertBefore(b,send)}
    window.addEventListener('wae:voice-state',e=>sync(e.detail||{}));
    const unlock=()=>engine()?.unlock?.();document.addEventListener('pointerdown',unlock,{capture:true,once:true});document.addEventListener('keydown',unlock,{capture:true,once:true});
    let tries=0;const ready=()=>{if(engine())return applyDesired();if(++tries<20)setTimeout(ready,120)};ready();sync();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();