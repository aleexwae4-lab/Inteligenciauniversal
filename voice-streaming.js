(()=>{
  let queue=[],running=false,generation=0,suppressUntil=0,legacySuppressUntil=0,patched=false;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const originalSpeech=window.speechSynthesis?.speak?.bind(window.speechSynthesis);
  if(window.speechSynthesis&&originalSpeech){try{window.speechSynthesis.speak=function(utterance){if(Date.now()<legacySuppressUntil)return;return originalSpeech(utterance)}}catch{}}
  function getVoice(){return window.__waeVoice||null}
  async function process(myGen){if(running)return;running=true;try{while(myGen===generation){const item=queue.shift();if(!item)break;const voice=getVoice();if(!voice){await sleep(80);queue.unshift(item);continue}await window.__waeVoiceStream._speak(item);if(myGen!==generation)break}}finally{running=false;if(queue.length&&myGen===generation)queueMicrotask(()=>process(myGen))}}
  function installPatch(){const voice=getVoice();if(!voice||patched)return false;patched=true;const original=voice.speak.bind(voice);window.__waeVoiceStream._speak=(text)=>original(text,{force:true});voice.speak=(text,opts={})=>{if(!opts.force&&Date.now()<suppressUntil)return Promise.resolve(false);return original(text,opts)};return true}
  function start(){generation++;queue=[];running=false;suppressUntil=Date.now()+120000;legacySuppressUntil=Date.now()+120000;installPatch();try{getVoice()?.stop?.()}catch{}}
  function enqueue(text){text=String(text||'').trim();if(!text)return;queue.push(text);installPatch();process(generation)}
  function complete(){suppressUntil=Date.now()+2600;legacySuppressUntil=Date.now()+2600;process(generation)}
  function stop(){generation++;queue=[];running=false;suppressUntil=Date.now()+1200;legacySuppressUntil=Date.now()+1200;try{getVoice()?.stop?.()}catch{}}
  window.__waeVoiceStream={start,enqueue,complete,stop,_speak:async()=>false};
  let tries=0;const timer=setInterval(()=>{tries++;if(installPatch()||tries>100)clearInterval(timer)},50);
})();
