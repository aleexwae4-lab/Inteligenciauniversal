(()=>{
'use strict';
/**
 * WAE Semantic Speech Chunks v10.2
 * Semantic meaning is prepared upstream; this layer only guarantees Android-safe,
 * word-safe utterances with normalized reconstruction and natural punctuation cuts.
 */
function speechChunks(input,maxLength=1350){
  const text=String(input??'').replace(/\s+/gu,' ').trim();
  if(!text)return [];
  const max=Math.max(120,Math.floor(Number(maxLength)||1350));
  if(text.length<=max)return [text];
  const words=text.match(/\S+/gu)||[];
  const output=[];let current='';
  const flush=()=>{if(current){output.push(current);current=''}};
  for(const word of words){
    const next=current?current+' '+word:word;
    if(current&&next.length>max)flush();
    current=current?current+' '+word:word;
    // Prefer a completed sentence once the utterance is already substantial.
    if(current.length>=Math.floor(max*.78)&&/[.!?;]["')\]]*$/u.test(word))flush();
  }
  flush();
  return output;
}
if(typeof window!=='undefined')window.WAESpeechChunks=speechChunks;
if(typeof module!=='undefined'&&module.exports)module.exports={speechChunks};
})();