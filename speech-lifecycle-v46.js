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
    .replace(/~~~[\s\S]*?~~~/g,' código omitido ')
    .replace(/^\s*[-*_#=]{2,}\s*$/gm,' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi,' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g,'$1')
    .replace(/(^|\n)\s*(?:[-+*•▪◦●○■□◆◇►▶]|\d+[.)])\s+/gu,'$1')
    .replace(/\x60[^\x60\n]+\x60/g,' código ')
    .replace(/[#*_\x60~>|@]/g,' ')
    .replace(/[•▪◦●◆◇■□►▶✓✔✦✣⌕⌘▦↻◈▤▧⚙＋➜☰◉→⇒➝➞➡⟶⟹↦↪]/gu,' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,' ')
    .replace(/Ω/g,' ohmios ').replace(/×/g,' por ').replace(/÷/g,' dividido entre ')
    .replace(/(^|[\s(])-(\d+(?:[.,]\d+)?)/g,'$1menos $2')
    .replace(/[-‐‑‒–—―]+/g,' ')
    .replace(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])\.([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/g,'$1 $2')
    .replace(/(\d)\.(\d)/g,'$1§DEC§$2')
    .replace(/[.!?;:]+/g,'\n')
    .replace(/§DEC§/g,'.')
    .replace(/[ \t]+/g,' ')
    .replace(/\s*\n+\s*/g,'\n')
    .replace(/\n{2,}/g,'\n').trim();

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
