export function createSSEParser(onEvent){
  if(typeof onEvent!=='function')throw new TypeError('onEvent must be a function');
  let buffer='';
  let event='message';
  let data=[];

  const dispatch=()=>{
    if(!data.length){event='message';return;}
    const raw=data.join('\n');
    let payload=raw;
    try{payload=JSON.parse(raw)}catch{}
    onEvent({event,data:payload,raw});
    event='message';
    data=[];
  };

  const line=input=>{
    const value=input.endsWith('\r')?input.slice(0,-1):input;
    if(value===''){dispatch();return;}
    if(value.startsWith(':'))return;
    const idx=value.indexOf(':');
    const field=idx<0?value:value.slice(0,idx);
    let body=idx<0?'':value.slice(idx+1);
    if(body.startsWith(' '))body=body.slice(1);
    if(field==='event')event=body||'message';
    else if(field==='data')data.push(body);
  };

  return {
    push(chunk){
      buffer+=String(chunk??'');
      let idx;
      while((idx=buffer.indexOf('\n'))>=0){
        line(buffer.slice(0,idx));
        buffer=buffer.slice(idx+1);
      }
    },
    end(){
      if(buffer){line(buffer);buffer='';}
      dispatch();
    }
  };
}

export function streamingCanaryEligible({sessionId='',verifiedModels=0,canaryPct=25,override=''}={}){
  if(Number(verifiedModels)<1)return false;
  if(override==='off')return false;
  if(override==='on')return true;
  const id=String(sessionId||'');
  if(!id)return false;
  let h=2166136261;
  for(let i=0;i<id.length;i++){h^=id.charCodeAt(i);h=Math.imul(h,16777619);}
  const bucket=Math.abs(h)%100;
  return bucket<Math.max(0,Math.min(100,Number(canaryPct)||0));
}
