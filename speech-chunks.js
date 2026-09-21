(()=>{
'use strict';
/**
 * Divide TTS into natural utterances without cutting inside a word.
 * Keep long unspaced tokens intact rather than corrupting their pronunciation.
 * Sentences are preferred when an Android/browser TTS engine needs short chunks.
 */
function speechChunks(input,maxLength=280){
  const text=String(input??'').replace(/\s+/gu,' ').trim();
  if(!text)return [];
  const max=Math.max(100,Math.floor(Number(maxLength)||280));
  const tokens=text.match(/\S+/gu)||[];
  const output=[];let current='';
  const flush=()=>{if(current){output.push(current);current=''}};
  for(const word of tokens){
    const next=current?current+' '+word:word;
    if(current&&next.length>max)flush();
    current=current?current+' '+word:word;
    // Prefer natural sentence endings; avoid firing on very short fragments.
    if(current.length>=150&&/[.!?;]["')\]]*$/u.test(word))flush();
  }
  flush();return output;
}

if(typeof window!=='undefined')window.WAESpeechChunks=speechChunks;
})();
