(()=>{
  'use strict';
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance||window.__WAE_SPEECH_LIFECYCLE_V46__)return;
  const downstream=window.speechSynthesis.speak.bind(window.speechSynthesis);
  const clean=value=>String(value||'');

  window.speechSynthesis.speak=utterance=>{
    try{
      if(utterance&&typeof utterance.text==='string'){
        const next=clean(utterance.text);
        if(next)utterance.text=next;
      }
    }catch{}
    return downstream(utterance);
  };
  window.__WAE_SPEECH_LIFECYCLE_V46__={version:'46.0.0',callbacksPreserved:true};
})();
