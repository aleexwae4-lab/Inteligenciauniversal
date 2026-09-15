(()=>{
  if(window.__waeSemanticUxV32)return;

  const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const electricalCues=[
    /\belectric(?:idad|o|a|os|as)?\b/,/\bcircuit(?:o|os)?\b/,/\bvolt(?:aje|ajes|io|ios|s)?\b/,
    /\bresist(?:encia|encias|or|ores)\b/,/\bcorriente\b/,/\bamper(?:io|ios|aje|ajes|e|es)?\b/,
    /\bgenerador(?:es)?\b/,/\baislante(?:s)?\b/,/\bfrecuencia(?:s)?\b/,/\bhertz\b/,/\bpotencia\b/,
    /\bohm(?:io|ios|s)?\b/,/\bwatt(?:s|io|ios)?\b/,/\bdiodo(?:s)?\b/,/\bcapacit(?:or|ores|ancia)\b/,
    /\binduct(?:or|ores|ancia)\b/,/\btransistor(?:es)?\b/
  ];
  const chemistryCues=[/\bquimic(?:a|o|as|os)\b/,/\belemento(?:s)?\b/,/\bnumero atomico\b/,/\btabla periodica\b/,/\bhalogeno(?:s)?\b/,/\bmolecula(?:s)?\b/];
  const countMatches=(text,rules)=>rules.reduce((sum,rx)=>sum+(rx.test(text)?1:0),0);
  const normalizeOutgoingIntent=value=>{
    const original=String(value||'').trim();
    if(!original)return{original,text:'',changed:false,domain:null,confidence:0,corrections:[]};
    const lexical=fold(original),electricalScore=countMatches(lexical,electricalCues),chemistryScore=countMatches(lexical,chemistryCues);
    if(electricalScore<2)return{original,text:original,changed:false,domain:null,confidence:0,corrections:[]};
    let text=original;const corrections=[];
    const replace=(rx,to)=>{text=text.replace(rx,match=>{if(fold(match)===fold(to))return match;corrections.push({from:match,to});return to})};
    if(chemistryScore===0)replace(/\b(?:iodo|yodo)\b/gi,'diodo');
    text=text.replace(/\b(un|una|el|los|unos|unas)\s+what\b/gi,(match,article)=>{corrections.push({from:'what',to:'watt'});return `${article} watt`});
    replace(/\b(?:wat|guat)\b/gi,'watt');
    replace(/\bomios\b/gi,'ohmios');replace(/\bomio\b/gi,'ohmio');
    const unique=[];const seen=new Set();for(const item of corrections){const key=`${fold(item.from)}>${fold(item.to)}`;if(!seen.has(key)){seen.add(key);unique.push(item)}}
    return{original,text,changed:text!==original,domain:'electricity',confidence:Number(Math.min(.99,.78+(electricalScore-2)*.045).toFixed(2)),corrections:unique};
  };

  window.__waeSemanticUxV32={version:'semantic-ux/v33-edge-context',normalizeOutgoingIntent};

  const normalizeMath=value=>String(value??'')
    .replace(/\\times\b/g,' × ').replace(/\\cdot\b/g,' · ')
    .replace(/\\Omega\b/g,' Ω ').replace(/\\Delta\b/g,' Δ ').replace(/\\mu\b/g,' μ ').replace(/\\pi\b/g,' π ')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,'$1 ÷ $2')
    .replace(/\\(?:text|mathrm|operatorname)\{([^{}]+)\}/g,'$1')
    .replace(/\\(?:left|right)\b/g,'').replace(/\\[()[\]]/g,'')
    .replace(/\$([^$]+)\$/g,'$1')
    .replace(/[ \t]{2,}/g,' ');

  const cleanSpeech=value=>normalizeMath(value)
    .replace(/```[\s\S]*?```/g,' código omitido ')
    .replace(/https?:\/\/\S+/g,' enlace disponible ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')
    .replace(/[#*_`~>|]/g,' ')
    .replace(/[•▪◦●◆◇■□►▶✓✔✦✣⌕⌘▦↻◈▤▧⚙＋➜☰◉]/g,' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,' ')
    .replace(/Ω/g,' ohmios ')
    .replace(/×/g,' por ')
    .replace(/÷/g,' dividido entre ')
    .replace(/\s+/g,' ').trim();

  function patchFetchIntent(){
    if(window.fetch?.__waeIntentV33)return;
    const nativeFetch=window.fetch.bind(window);
    const patched=async(input,init)=>{
      try{
        const url=typeof input==='string'?input:String(input?.url||'');
        const method=String(init?.method||input?.method||'GET').toUpperCase();
        const relevant=/wae-local-voice-demo-v61|\/api\/(?:chat|fast-chat|orchestrate)(?:\?|$)/.test(url);
        if(method==='POST'&&relevant&&typeof init?.body==='string'){
          const payload=JSON.parse(init.body);
          if(typeof payload?.message==='string'){
            const intent=normalizeOutgoingIntent(payload.message);
            if(intent.changed){
              payload.message=intent.text;
              payload.input_interpretation={normalized:true,domain:intent.domain,confidence:intent.confidence,corrections:intent.corrections,source:'client-context-v33'};
              init={...init,body:JSON.stringify(payload)};
            }
          }
        }
      }catch{}
      return nativeFetch(input,init);
    };
    Object.defineProperty(patched,'__waeIntentV33',{value:true});
    window.fetch=patched;
  }

  function wrapTable(table){
    table.classList.add('rich-table');
    let wrap=table.closest('.rich-table-wrap');
    if(!wrap&&table.parentNode){
      wrap=document.createElement('div');
      wrap.className='rich-table-wrap';
      table.parentNode.insertBefore(wrap,table);
      wrap.appendChild(table);
    }
    return wrap;
  }

  function enhanceTables(root=document){
    const tables=root.querySelectorAll?.('.rich-table,.assistant-body table')||[];
    tables.forEach(table=>{
      const wrap=wrapTable(table);
      const headers=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
      table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,index)=>{
        if(cell.tagName==='TD'&&!cell.dataset.label)cell.dataset.label=headers[index]||`Columna ${index+1}`;
      }));
      wrap?.setAttribute('data-mobile-table','stacked');
    });
  }

  function normalizeRenderedMath(root=document){
    const scope=root.querySelectorAll?root:document;
    scope.querySelectorAll?.('.rich-answer,.assistant-body').forEach(answer=>{
      const walker=document.createTreeWalker(answer,NodeFilter.SHOW_TEXT);
      const nodes=[];let node;
      while((node=walker.nextNode())){
        if(node.parentElement?.closest('pre,code'))continue;
        nodes.push(node);
      }
      for(const textNode of nodes){const next=normalizeMath(textNode.nodeValue);if(next!==textNode.nodeValue)textNode.nodeValue=next}
    });
  }

  const style=document.createElement('style');
  style.id='semanticUxV32Styles';
  style.textContent=`
    .rich-answer,.assistant-body{overflow-wrap:anywhere;word-break:normal}
    .rich-table-wrap{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
    .rich-table{max-width:100%}
    @media(max-width:640px){
      .rich-table-wrap[data-mobile-table="stacked"]{overflow:visible;border:0!important;background:transparent!important}
      .rich-table-wrap[data-mobile-table="stacked"] .rich-table{display:block;width:100%;min-width:0!important;border-collapse:separate;margin:8px 0 14px!important;overflow:visible!important}
      .rich-table-wrap[data-mobile-table="stacked"] thead{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important}
      .rich-table-wrap[data-mobile-table="stacked"] tbody{display:grid;gap:8px;width:100%}
      .rich-table-wrap[data-mobile-table="stacked"] tr{display:block;width:100%;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025);overflow:hidden}
      .rich-table-wrap[data-mobile-table="stacked"] td{display:grid!important;grid-template-columns:minmax(92px,.42fr) minmax(0,1fr);gap:10px;width:100%!important;max-width:100%!important;padding:9px 10px!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.055)!important;white-space:normal!important;overflow-wrap:anywhere!important;text-align:left!important}
      .rich-table-wrap[data-mobile-table="stacked"] td:last-child{border-bottom:0!important}
      .rich-table-wrap[data-mobile-table="stacked"] td::before{content:attr(data-label);font-size:.62rem;font-weight:800;letter-spacing:.02em;color:#7f9188;min-width:0}
    }
  `;
  document.head.appendChild(style);

  const NativeUtterance=window.SpeechSynthesisUtterance;
  if(window.speechSynthesis&&NativeUtterance&&!window.speechSynthesis.__waeSemanticPatched){
    const nativeSpeak=window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak=utterance=>{
      try{
        const source=String(utterance?.text||''),clean=cleanSpeech(source);
        if(clean&&clean!==source){
          const replacement=new NativeUtterance(clean);
          replacement.lang=utterance.lang||'es-MX';replacement.rate=utterance.rate||1;replacement.pitch=utterance.pitch||1;replacement.volume=utterance.volume??1;
          if(utterance.voice)replacement.voice=utterance.voice;
          return nativeSpeak(replacement);
        }
      }catch{}
      return nativeSpeak(utterance);
    };
    window.speechSynthesis.__waeSemanticPatched=true;
  }

  function patchVoiceRuntime(){
    const voice=window.__waeVoice;
    if(!voice||voice.__semanticV32)return;
    const speak=voice.speak?.bind(voice),enqueue=voice.enqueue?.bind(voice);
    if(speak)voice.speak=(text,options)=>speak(cleanSpeech(text),options);
    if(enqueue)voice.enqueue=text=>enqueue(cleanSpeech(text));
    try{Object.defineProperty(voice,'__semanticV32',{value:true,configurable:false})}catch{voice.__semanticV32=true}
  }

  let queued=false;
  const run=()=>{queued=false;patchFetchIntent();patchVoiceRuntime();normalizeRenderedMath(document);enhanceTables(document);document.documentElement.dataset.semanticUx='v33'};
  const schedule=()=>{if(queued)return;queued=true;queueMicrotask(run)};
  const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('wae:voice-state',patchVoiceRuntime);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
