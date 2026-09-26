(()=>{
  'use strict';
  if(window.__WAE_NATIVE_VOICE_INPUT_V1__)return;
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition=null,listening=false,nativeSession=0;
  const androidBridge=()=>{const b=window.WAE_NATIVE_VOICE_INPUT||window.AndroidSpeechRecognizer||window.waeNativeVoiceInput;return b&&typeof b.start==='function'?b:null};
  const supported=!!Recognition||!!androidBridge();
  const input=()=>document.getElementById('messageInput')||document.getElementById('mobileSafeInput');
  const micButtons=()=>[document.getElementById('nativeVoiceInputBtn'),document.getElementById('mobileNativeVoiceInputBtn')].filter(Boolean);
  const sync=()=>{for(const b of micButtons()){b.setAttribute('aria-pressed',String(listening));b.textContent=listening?'■':'🎙';b.title=!supported?'Dictado por voz no compatible en este navegador':(listening?'Detener dictado':'Hablar con Universal Core');b.dataset.state=listening?'listening':'ready'}};
  const setText=t=>{const el=input();if(!el)return;const base=String(el.value||'').trim();el.value=(base?(base+' '):'')+String(t||'').trim();el.dispatchEvent(new Event('input',{bubbles:true}));el.focus()};
  function stop(){nativeSession++;try{androidBridge()?.stop?.()}catch{}try{recognition?.stop()}catch{}listening=false;sync();document.documentElement.dataset.voiceInput='ready'}
  function start(){const bridge=androidBridge();if(bridge){try{nativeSession++;listening=true;sync();document.documentElement.dataset.voiceInput='listening';const id=String(bridge.start('es-MX'));window.__waeNativeVoiceInputComplete=(session,text,error)=>{if(session!==nativeSession)return;if(error){document.documentElement.dataset.voiceInputError=String(error);stop();return}if(text)setText(text);listening=false;sync();document.documentElement.dataset.voiceInput='ready'};return id}catch(e){document.documentElement.dataset.voiceInputError=String(e?.message||e);}}if(!Recognition)return false;const el=input();if(!el)return false;try{recognition=new Recognition();recognition.lang='es-MX';recognition.continuous=false;recognition.interimResults=true;let finalText='';recognition.onstart=()=>{listening=true;sync();document.documentElement.dataset.voiceInput='listening'};recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const text=String(e.results[i][0]?.transcript||'');if(e.results[i].isFinal)finalText+=text+' ';else interim+=text}el.dataset.voiceInterim=interim};recognition.onerror=e=>{document.documentElement.dataset.voiceInputError=String(e?.error||'unknown');stop()};recognition.onend=()=>{if(finalText.trim())setText(finalText);listening=false;sync();document.documentElement.dataset.voiceInput='ready';recognition=null};recognition.start();return true}catch(e){document.documentElement.dataset.voiceInputError=String(e?.message||e);stop();return false}}
  function toggle(){return listening?(stop(),false):start()}
  function addButton(form,id,klass){if(!form||document.getElementById(id))return;const b=document.createElement('button');b.type='button';b.id=id;b.className=klass;b.setAttribute('aria-label','Hablar con Universal Core');b.textContent='🎙';b.addEventListener('click',toggle);form.insertBefore(b,form.firstChild)}
  function install(){addButton(document.querySelector('.composer-actions>div'),'nativeVoiceInputBtn','mini-btn');addButton(document.getElementById('mobileSafeComposer'),'mobileNativeVoiceInputBtn','mini-btn');sync();if(!supported){for(const b of micButtons())b.dataset.unsupported='true'}}
  window.__waeNativeVoiceInput={supported,start,stop,toggle,get listening(){return listening}};
  window.__WAE_NATIVE_VOICE_INPUT_V1__={version:'native-voice-input/v1',native:true,speechRecognition:supported};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
