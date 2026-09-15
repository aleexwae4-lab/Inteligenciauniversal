(()=>{
  'use strict';
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance||window.__WAE_SPEECH_LIFECYCLE_V46__)return;
  const downstream=window.speechSynthesis.speak.bind(window.speechSynthesis);
  const clean=value=>String(value||'')
    .replace(/\\times\b/g,' por ').replace(/\\cdot\b/g,' por ')
    .replace(/\\Omega\b/g,' ohmios ').replace(/\\Delta\b/g,' delta ').replace(/\\mu\b/g,' micro ').replace(/\\pi\b/g,' pi ')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,'$1 dividido entre $2')
    .replace(/\\(?:text|mathrm|operatorname)\{([^{}]+)\}/g,'$1')
    .replace(/\\(?:left|right)\b/g,'').replace(/\\[()[\]]/g,'')
    .replace(/\$([^$]+)\$/g,'$1')
    .replace(/```[\s\S]*?```/g,' código omitido ')
    .replace(/https?:\/\/\S+/g,' enlace disponible ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/[#*_`~>|]/g,' ')
    .replace(/[•▪◦●◆◇■□►▶✓✔✦✣⌕⌘▦↻◈▤▧⚙＋➜☰◉]/g,' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,' ')
    .replace(/Ω/g,' ohmios ').replace(/×/g,' por ').replace(/÷/g,' dividido entre ')
    .replace(/\s+/g,' ').trim();

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
