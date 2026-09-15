import * as base from './router.ts';
export * from './router.ts';

const PROBE_SYSTEM='Return only OK. No reasoning.';
const PROBE_USER='Responde únicamente OK.';
const LONG_PROBE_SYSTEM='Return exactly three short factual sentences. Do not use headings or lists.';
const LONG_PROBE_USER='Explica en tres frases breves por qué medir el tiempo al primer token mejora la experiencia de una interfaz conversacional.';

function isTransportProbe(msgs:any[],opts:any){
  if(opts?.stream!==true)return false;
  const system=String(msgs?.find((x:any)=>x?.role==='system')?.content||'');
  const user=String([...msgs].reverse().find((x:any)=>x?.role==='user')?.content||'');
  return system.includes(PROBE_SYSTEM)&&user.trim()===PROBE_USER;
}

function progressiveError(deltas:number){
  const e:any=new Error(`stream_not_progressive:${deltas}`);
  e.transportOnly=true;
  e.transportCode='stream_not_progressive';
  return e;
}

export async function invoke(m:any,msgs:any[],opts:any={}){
  if(!isTransportProbe(msgs,opts))return base.invoke(m,msgs,opts);
  let deltas=0;
  const userOnDelta=opts.onDelta;
  const probeMsgs=[{role:'system',content:LONG_PROBE_SYSTEM},{role:'user',content:LONG_PROBE_USER}];
  const result=await base.invoke(m,probeMsgs,{...opts,onDelta:(d:string,t:number)=>{deltas++;userOnDelta?.(d,t)}});
  if(deltas<2)throw progressiveError(deltas);
  return{...result,delta_count:deltas};
}

export function rank(reg:any[],task:any,req:any,variant='candidate'){
  const ranked=base.rank(reg,task,req,variant);
  if(req?.streaming!==true)return ranked;
  return ranked.map((row:any,index:number)=>({row,index})).sort((a:any,b:any)=>{
    const av=a.row?.streaming_verified===true?1:0,bv=b.row?.streaming_verified===true?1:0;
    if(av!==bv)return bv-av;
    const at=Date.parse(String(a.row?.last_stream_success_at||'')),bt=Date.parse(String(b.row?.last_stream_success_at||''));
    const af=Number.isFinite(at)?at:0,bf=Number.isFinite(bt)?bt:0;
    if(af!==bf)return bf-af;
    return a.index-b.index;
  }).map((x:any)=>x.row);
}
