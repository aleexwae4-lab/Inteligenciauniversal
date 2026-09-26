(()=>{
  'use strict';
  if(window.__WAE_VOICE_INTELLIGENCE_V1__)return;
  const root=()=>document.documentElement;
  const norm=value=>String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim().replace(/[¡!¿?.,;:]+/g,' ').replace(/\\s+/g,' ');
  const patterns=[['stop',['detente','deten la voz','para la voz','para','callate','silencio','cancela la voz','cancela']],['resume',['continua','sigue','reanuda','puedes continuar','continua hablando']],['wait',['espera','un momento','esperame','dame un momento','pausa']],['confirm',['si','correcto','hazlo','adelante','confirmo','confirmado']],['reject',['no','cambia eso','corrige eso','no asi','rechazo']]];
  let waitingUntil=0,lastIntent='';
  const setState=(state,label)=>{root().dataset.voiceConversationState=state;root().dataset.voiceConversationLabel=label;document.dispatchEvent(new CustomEvent('wae:voice-intelligence',{detail:{state,label}}))};
  const emit=(intent,text)=>document.dispatchEvent(new CustomEvent('wae:voice-intent',{detail:{intent,text,at:Date.now()}}));
  const exactIntent=text=>{const n=norm(text);if(!n||n.length>64)return null;for(const [intent,list] of patterns)if(list.some(p=>n===p||n.startsWith(p+' ')))return intent;return null};
  const setWaiting=(ms=4500)=>{waitingUntil=Date.now()+ms;setState('paused','Pausado');emit('wait','')};
  const clearWaiting=()=>{waitingUntil=0;setState('listening','Escuchando')};
  const handle=text=>{const clean=String(text||'').trim(),intent=exactIntent(clean);if(!intent)return false;lastIntent=intent;emit(intent,clean);const v=window.__waeVoice,n=window.__waeNativeVoiceInput;
    if(intent==='stop'){try{n?.stop?.()}catch{};if(n?.continuous)try{n.toggleContinuous?.()}catch{};try{v?.stop?.()}catch{};waitingUntil=0;setState('ready','Listo');return true}
    if(intent==='wait'){try{n?.stop?.()}catch{};try{v?.pause?.()}catch{};setWaiting();return true}
    if(intent==='resume'){waitingUntil=0;if(n?.continuous===false)try{n.toggleContinuous?.()}catch{};try{v?.resume?.()}catch{};setState('listening','Escuchando');setTimeout(()=>document.dispatchEvent(new CustomEvent('wae:voice-intelligence-clear')),0);return true}
    if(intent==='confirm'||intent==='reject'){setState('processing',intent==='confirm'?'Confirmando':'Corrigiendo');return false}
    return false;
  };
  const allowedToListen=()=>waitingUntil<=Date.now()&&!root().dataset.aiBusy&&root().dataset.voicePlaying!=='true';
  document.addEventListener('wae:voice-intelligence-clear',clearWaiting);
  document.addEventListener('wae:voice-state',e=>{const s=e.detail?.state||root().dataset.voiceState;if(s==='playing')setState('speaking','Hablando');else if(s==='ready'&&waitingUntil<=Date.now())setState('ready','Listo');else if(s==='paused')setState('paused','Pausado');else if(s==='error')setState('ready','Listo')});
  window.__waeVoiceIntelligence={version:'voice-intelligence/v1.1',classify:exactIntent,handle,emit,allowedToListen,get state(){return root().dataset.voiceConversationState||'ready'},get lastIntent(){return lastIntent},get waiting(){return waitingUntil>Date.now()}};
  root().dataset.voiceConversationState='ready';root().dataset.voiceConversationLabel='Listo';window.__WAE_VOICE_INTELLIGENCE_V1__=true;
})();
