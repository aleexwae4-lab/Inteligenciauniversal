(()=>{
  'use strict';
  if(window.__WAE_MOBILE_VOICE_V46__)return;

  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const VOICE_ENDPOINT=`${SUPABASE_URL}/functions/v1/wae-natural-voice-v60`;
  const KEY='wae.autoVoice',SID='iu.sessionId',SECRET='iu.sessionSecret',VOICE_KEY='iu.voiceName';
  const CLOUD_BUDGET_MS=1100;
  const CLOUD_BACKOFF_MS=60000;
  const UUID_RX=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const preference=localStorage.getItem(KEY)!=='false';
  try{window.__waeMobileVoice?.setEnabled?.(false)}catch{}

  let enabled=preference;
  let voice=localStorage.getItem(VOICE_KEY)||'Kore';
  let run=0,speaking=false,currentSource=null,currentAudio=null,context=null,lastEngine='idle',cloudBackoffUntil=0;
  const spoken=new WeakMap();

  try{localStorage.setItem(KEY,String(enabled))}catch{}

  const synth=()=>window.speechSynthesis;
  const browserSupported=()=>('speechSynthesis'in window)&&('SpeechSynthesisUtterance'in window);
  const clean=raw=>String(raw||'').normalize('NFKC').replace(/\r\n?/g,'\n').replace(/```[\s\S]*?```/g,' ').replace(/~~~[\s\S]*?~~~/g,' ').replace(/^\s*[-*_#=]{2,}\s*$/gm,' ').replace(/!\[[^\]]*\]\([^)]*\)/g,' ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\[(?:W|M|MEM)\d+\]/gi,' ').replace(/https?:\/\/\S+|www\.\S+/gi,' ').replace(/<[^>]+>/g,' ').replace(/(^|\n)\s{0,3}#{1,6}\s*/g,'$1').replace(/(^|\n)\s*(?:[-+*•▪◦●○■□◆◇►▶]|\d+[.)])\s+/gu,'$1').replace(/\x60[^\x60\n]+\x60/g,' código ').replace(/\*\*|__|~~|[*_~\x60#@]/g,' ').replace(/[→⇒➜➝➞➡⟶⟹↦↪•▪◦●○■□◆◇►▶]/gu,', ').replace(/\|+/g,', ').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,' ').replace(/[\[\]{}<>]/g,' ').replace(/[“”„‟"«»]/g,' ').replace(/Ω/g,' ohmios ').replace(/×/g,' por ').replace(/÷/g,' dividido entre ').replace(/\b(\d+(?:[.,]\d+)?)\s*%/g,'$1 por ciento').replace(/(^|[\s(])-(\d+(?:[.,]\d+)?)/g,'$1menos $2').replace(/[-‐‑‒–—―]+/g,' ').replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])\.([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g,'$1 $2').replace(/(\d)\.(\d)/g,'$1§DEC§$2').replace(/[.!?;:]+/g,'\n').replace(/§DEC§/g,'.').replace(/[ \t]+/g,' ').replace(/\s*,\s*/g,', ').replace(/,+/g,',').replace(/,\s*(?=\n|$)/g,'').replace(/\s*\n+\s*/g,'\n').replace(/\n{2,}/g,'\n').trim();

  function bestVoice(){
    if(!browserSupported())return null;
    const voices=synth().getVoices()||[];
    const score=v=>{const lang=String(v.lang||'').replace('_','-').toLowerCase(),name=String(v.name||'').toLowerCase();let n=0;if(lang==='es-mx')n+=100;else if(lang.startsWith('es-419'))n+=90;else if(lang.startsWith('es-us'))n+=80;else if(lang.startsWith('es'))n+=70;if(/google|microsoft|natural|premium|enhanced|neural/.test(name))n+=20;if(v.localService)n+=2;return n};
    return voices.filter(v=>/^es/i.test(v.lang||'')).sort((a,b)=>score(b)-score(a))[0]||voices[0]||null;
  }

  function getContext(){if(context)return context;const AC=window.AudioContext||window.webkitAudioContext;if(AC)context=new AC({latencyHint:'interactive'});return context}
  async function unlock(){try{const c=getContext();if(c?.state==='suspended')await c.resume();if(browserSupported())void synth().getVoices();return true}catch{return false}}

  function diag(event,error=''){try{fetch('/api/ui-diagnostics',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,at:new Date().toISOString(),release:'mobile-voice-v46',page:location.pathname,displayMode:matchMedia('(display-mode: standalone)').matches?'standalone':'browser',viewport:{width:innerWidth,height:innerHeight},activeElement:'',target:'',topAtPoint:'',valueLength:0,writable:true,error:String(error||'').slice(0,220)}),keepalive:true}).catch(()=>{})}catch{}}
  function emit(state,engine=lastEngine,error=null){lastEngine=engine||lastEngine;document.documentElement.dataset.voiceEnabled=String(enabled);document.documentElement.dataset.voiceState=state;document.documentElement.dataset.voiceEngine=lastEngine;window.dispatchEvent(new CustomEvent('wae:voice-state',{detail:{enabled,state,engine:lastEngine,error}}));syncUI(state)}
  function syncUI(state){const label=document.getElementById('voiceState'),quick=document.getElementById('voiceQuick');if(label)label.textContent=!enabled?'Desactivada':state==='playing'?'Hablando':'Activada';if(quick){quick.setAttribute('aria-pressed',String(enabled));quick.title=enabled?(state==='playing'?'Universal Core está hablando':'Voz automática activa'):'Activar voz automática';quick.style.color=enabled?'#79e8a4':'#aab2bd';quick.style.background=enabled?'#1b2924':'transparent';quick.textContent=state==='playing'?'■':'♪'}}

  function stop(){run++;speaking=false;try{currentSource?.stop()}catch{}currentSource=null;if(currentAudio){try{currentAudio.pause();currentAudio.src=''}catch{}currentAudio=null}if(browserSupported())try{synth().cancel()}catch{}emit(enabled?'ready':'disabled','idle')}
  async function setEnabled(value){enabled=!!value;try{localStorage.setItem(KEY,String(enabled))}catch{}if(!enabled)stop();else{await unlock();emit('ready','idle')}return enabled}
  function toggle(){return setEnabled(!enabled)}

  async function fetchCloud(text,myRun){
    if(Date.now()<cloudBackoffUntil)throw new Error('cloud_backoff');
    const sid=localStorage.getItem(SID)||'',secret=localStorage.getItem(SECRET)||'';
    if(!UUID_RX.test(sid)||secret.length<40)throw new Error('voice_session_not_cloud_eligible');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(new DOMException('voice_deadline','TimeoutError')),CLOUD_BUDGET_MS);
    try{
      const r=await fetch(VOICE_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-universal-mobile-voice/46'},body:JSON.stringify({action:'speak',session_id:sid,session_secret:secret,text,voice}),cache:'no-store',signal:controller.signal});
      if(myRun!==run)throw new Error('voice_cancelled');
      if(!r.ok)throw new Error(`voice_${r.status}`);
      return await r.arrayBuffer();
    }finally{clearTimeout(timer)}
  }

  async function playBuffer(buffer,myRun){
    const c=getContext();
    if(c){if(c.state==='suspended')await c.resume();const decoded=await c.decodeAudioData(buffer.slice(0));if(myRun!==run)return false;await new Promise((resolve,reject)=>{const src=c.createBufferSource();currentSource=src;src.buffer=decoded;src.connect(c.destination);src.onended=()=>{if(currentSource===src)currentSource=null;resolve()};try{src.start()}catch(e){reject(e)}});return true}
    const url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));await new Promise((resolve,reject)=>{const a=new Audio(url);currentAudio=a;a.onended=()=>{URL.revokeObjectURL(url);if(currentAudio===a)currentAudio=null;resolve()};a.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('audio_playback_failed'))};a.play().catch(reject)});return true;
  }

  function browserSpeak(text,myRun){
    return new Promise(resolve=>{
      if(!enabled||!browserSupported()||myRun!==run)return resolve(false);
      const t=clean(text);if(!t)return resolve(false);
      const u=new SpeechSynthesisUtterance(t);u.lang='es-MX';u.rate=1;u.pitch=1;u.volume=1;const v=bestVoice();if(v)u.voice=v;
      let settled=false;const done=value=>{if(settled)return;settled=true;resolve(value)};
      u.onstart=()=>{emit('playing','browser');diag('voice_start','browser')};
      u.onend=()=>{diag('voice_end','browser');done(true)};
      u.onerror=()=>done(false);
      try{synth().speak(u)}catch{return done(false)}
      setTimeout(()=>{if(!settled&&myRun===run){try{synth().cancel()}catch{}done(false)}},Math.max(12000,Math.min(90000,t.length*95)));
    });
  }

  async function speakOne(text,myRun){
    if(!enabled||myRun!==run)return false;
    const t=clean(text);if(!t)return false;
    diag('voice_request',`chars:${t.length}`);
    try{
      const audio=await fetchCloud(t,myRun);
      if(myRun!==run)return false;
      emit('playing','cloud');diag('voice_start','cloud');
      await playBuffer(audio,myRun);diag('voice_end','cloud');return true;
    }catch(e){
      const reason=String(e?.name||e?.message||e);
      if(reason!=='voice_cancelled')cloudBackoffUntil=Date.now()+CLOUD_BACKOFF_MS;
      emit('fallback','browser',reason);diag('voice_fallback',reason);
      return browserSpeak(t,myRun);
    }
  }

  async function speakFinal(text){
    if(!enabled)return false;
    stop();
    const myRun=run;
    speaking=true;
    await unlock();
    const ok=await speakOne(text,myRun);
    if(myRun===run){speaking=false;emit('ready',lastEngine)}
    return ok;
  }

  function scan(){
    if(!enabled)return;
    const root=document.getElementById('messages');if(!root)return;
    for(const turn of root.querySelectorAll('.turn.assistant')){
      const actions=turn.querySelector('.actions'),body=turn.querySelector('.assistant-body');
      if(!actions||!body||actions.classList.contains('hidden')||body.classList.contains('error-text'))continue;
      const text=clean(body.textContent||'');if(!text)continue;
      if(spoken.get(turn)===text)continue;
      spoken.set(turn,text);
      void speakFinal(text);
    }
  }

  function install(){
    const toggleBtn=document.getElementById('voiceToggle'),mic=document.getElementById('mic'),form=document.getElementById('composer');
    if(toggleBtn){toggleBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();void toggle()},{capture:true});toggleBtn.setAttribute('aria-pressed',String(enabled))}
    if(mic?.parentElement&&!document.getElementById('voiceQuick')){const b=document.createElement('button');b.type='button';b.className='round';b.id='voiceQuick';b.textContent='♪';b.setAttribute('aria-label','Voz automática');b.addEventListener('click',()=>void toggle());mic.parentElement.insertBefore(b,mic)}
    form?.addEventListener('submit',()=>{if(speaking)stop()},{capture:true});
    const root=document.getElementById('messages');if(root)new MutationObserver(()=>queueMicrotask(scan)).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    const prime=()=>void unlock();document.addEventListener('pointerdown',prime,{capture:true,once:true});document.addEventListener('keydown',prime,{capture:true,once:true});
    if(browserSupported())synth().addEventListener?.('voiceschanged',()=>syncUI(document.documentElement.dataset.voiceState||'ready'));
    void setEnabled(enabled);scan();
  }

  window.__waeMobileVoice={toggle,setEnabled,speak:speakFinal,stop,unlock,setVoice(name){voice=String(name||'Kore');try{localStorage.setItem(VOICE_KEY,voice)}catch{}return voice},get enabled(){return enabled},get engine(){return lastEngine},version:'v46-deadline-first'};
  window.__WAE_MOBILE_VOICE_V46__={version:'46.0.0',cloudBudgetMs:CLOUD_BUDGET_MS,browserFallback:true};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
