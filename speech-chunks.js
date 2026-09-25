(()=>{
'use strict';
/**
 * WAE Semantic Speech Chunks v10.1
 * Splits on semantic/natural boundaries without adding, removing or slicing text.
 * Joining every returned chunk reproduces the normalized input byte-for-byte.
 */
function speechChunks(input,maxLength=1350){
  const raw=String(input??'').replace(/\r\n?/gu,'\n').trim();
  if(!raw)return [];
  const max=Math.max(120,Math.floor(Number(maxLength)||1350));
  if(raw.length<=max)return [raw];
  const output=[];let cursor=0;
  const boundaryIn=(segment,pattern)=>{
    let last=-1,m;pattern.lastIndex=0;
    while((m=pattern.exec(segment))!==null){
      last=m.index+m[0].length;
      if(m[0].length===0)pattern.lastIndex++;
    }
    return last;
  };
  while(cursor<raw.length){
    const remaining=raw.length-cursor;
    if(remaining<=max){output.push(raw.slice(cursor));break}
    const segment=raw.slice(cursor,cursor+max+1);
    const floor=Math.max(1,Math.floor(max*.55));
    let cut=-1;
    // Semantic rows/paragraphs are strongest boundaries.
    const newline=segment.lastIndexOf('\n');
    if(newline>=floor)cut=newline+1;
    // Then prefer completed sentences including their original trailing whitespace.
    if(cut<0){
      const natural=boundaryIn(segment,/[.!?;](?:["')\]]*)\s+/gu);
      if(natural>=floor)cut=natural;
    }
    // Finally split at existing whitespace; never invent one.
    if(cut<0){
      for(let i=Math.min(max,segment.length-1);i>=floor;i--){
        if(/\s/u.test(segment[i])){cut=i+1;break}
      }
    }
    // A token longer than max stays intact rather than being corrupted.
    if(cut<0){
      let next=cursor+max;
      while(next<raw.length&&!/\s/u.test(raw[next]))next++;
      if(next<raw.length)next++;
      cut=Math.max(1,next-cursor);
    }
    const piece=raw.slice(cursor,cursor+cut);
    if(!piece)break;
    output.push(piece);cursor+=cut;
  }
  return output;
}
if(typeof window!=='undefined')window.WAESpeechChunks=speechChunks;
if(typeof module!=='undefined'&&module.exports)module.exports={speechChunks};
})();