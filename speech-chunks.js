(()=>{
'use strict';
/**
 * WAE Semantic Speech Chunks v10
 * Keeps paragraph/table-row boundaries whenever possible, then falls back to sentence/word splitting.
 * This avoids Android TTS stalls while preserving natural pauses.
 */
function speechChunks(input,maxLength=1350){
  const raw=String(input??'').replace(/\r\n?/gu,'\n').trim();
  if(!raw)return [];
  const max=Math.max(120,Math.floor(Number(maxLength)||1350));
  const paragraphs=raw.split(/\n+/gu).map(v=>v.replace(/[\t ]+/gu,' ').trim()).filter(Boolean);
  const output=[];let current='';
  const flush=()=>{if(current){output.push(current.trim());current=''}};
  const pushPiece=piece=>{
    const p=piece.trim();if(!p)return;
    if(p.length>max){
      const words=p.match(/\S+/gu)||[];let local='';
      for(const word of words){
        const next=local?local+' '+word:word;
        if(local&&next.length>max){if(current)flush();output.push(local);local=word}else local=next;
      }
      if(local){if(current&&current.length+1+local.length<=max)current+=' '+local;else{flush();current=local}}
      return;
    }
    const next=current?current+' '+p:p;
    if(current&&next.length>max)flush();
    current=current?current+' '+p:p;
  };
  for(const paragraph of paragraphs){
    if(paragraph.length<=max){
      if(current&&current.length+1+paragraph.length>max)flush();
      pushPiece(paragraph);
      if(/^(?:Tabla\.|Fila \d+\.|Paso \d+\.|Bloque de código)/iu.test(paragraph))flush();
      continue;
    }
    const sentences=paragraph.match(/[^.!?;]+[.!?;]+|[^.!?;]+$/gu)||[paragraph];
    for(const sentence of sentences){
      pushPiece(sentence);
      if(current.length>=Math.floor(max*.78))flush();
    }
  }
  flush();
  return output;
}
if(typeof window!=='undefined')window.WAESpeechChunks=speechChunks;
if(typeof module!=='undefined'&&module.exports)module.exports={speechChunks};
})();