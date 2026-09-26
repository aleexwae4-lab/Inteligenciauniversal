(()=>{
  'use strict';
  if(window.__WAE_NATIVE_VOICE_INPUT_V1__)return;
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const supported=!!Recognition;
  let recognition=null,listening=false;
  const input=()=>document.getElementById('messageInput')||document.getElementById('mobileSafeInput');
  const micButton=()=>document.getElementById('nativeVoiceInputBtn');
  const sync=()=>{const b=micButton();if(!b)return;b.setAttribute('aria-pressed',String(listening));b.textContent=listening?'■':'🎙';b.title=!supported?'Dictado por voz no compatible en este navegador':(listening?'Detener dictado':'Hablar con Universal Core');b.dataset.state=listening?'listening':'ready'};
  const setText=t=>{const el=input();if(!el)return;const base=String(el.value||'').trim();el.value=(base?(base+' '):'')+String(t||'').trim();el.dispatchEvent(new Event('input',{bubbles:true}));el.focus()};
  function stop(){try{recognition?.stop()}catch{}listening=false;sync()}
  function start(){if(!supported)return false;const el=input();if(!el)return false;try{recognition=new Recognition();recognition.lang='es-MX';recognition.continuous=false;recognition.interimResults=true;let finalText='';recognition.onstart=()=>{listening=true;sync();document.documentElement.dataset.voiceInput='listening'};recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const text=String(e.results[i][0]?.transcript||'');if(e.results[i].isFinal)finalText+=text+' ';else interim+=text}el.dataset.voiceInterim=interim};recognition.onerror=e=>{document.documentElement.dataset.voiceInputError=String(e?.error||'unknown');stop()};recognition.onend=()=>{if(finalText.trim())setText(finalText);listening=false;sync();document.documentElement.dataset.voiceInput='ready';recognition=null};recognition.start();return true}catch(e){document.documentElement.dataset.voiceInputError=String(e?.message||e);stop();return false}}
  function toggle(){return listening?(stop(),false):start()}
  function addButton(form,id,klass){if(!form||document.getElementById(id))return;const b=document.createElement('button');b.type='button';b.id=id;b.className=klass;b.setAttribute('aria-label','Hablar con Universal Core');b.textContent='🎙';b.addEventListener('click',toggle);form.insertBefore(b,form.firstChild)}
  function install(){addButton(document.querySelector('.composer-actions>div'),'nativeVoiceInputBtn','mini-btn');addButton(document.getElementById('mobileSafeComposer'),'mobileNativeVoiceInputBtn','mini-btn');sync();if(!supported){const b=micButton();if(b)b.dataset.unsupported='true'}}
  window.__waeNativeVoiceInput={supported,start,stop,toggle,get listening(){return listening}};
  window.__WAE_NATIVE_VOICE_INPUT_V1__={version:'native-voice-input/v1',native:true,speechRecognition:supported};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
