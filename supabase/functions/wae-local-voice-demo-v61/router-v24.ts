import * as base from './router.ts';
export * from './router.ts';

const PROBE_SYSTEM='Return only OK. No reasoning.';
const PROBE_USER='Responde únicamente OK.';
const LONG_PROBE_SYSTEM='Return exactly three short factual sentences. Do not use headings or lists.';
const LONG_PROBE_USER='Explica en tres frases breves por qué medir el tiempo al primer token mejora la experiencia de una interfaz conversacional.';
const RESCUE_PROVIDER='wae_deterministic_rescue';
const SENSITIVE_RX=/\b(curp|rfc|nss|pasaporte|credencial|ine|domicilio|direcci[oó]n personal|tel[eé]fono|correo personal|email personal|expediente|carpeta de investigaci[oó]n|historia cl[ií]nica|paciente|nombre completo|contrase[nñ]a|password|api[_ -]?key|token|secreto|secret|confidencial|privado|datos personales|personal data|medical record|case file)\b/i;

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

function attachmentLooksSensitive(attachments:any[]=[]){
  return (Array.isArray(attachments)?attachments:[]).slice(0,5).some((item:any)=>{
    if(item?.sensitive===true||item?.private===true)return true;
    const material=`${String(item?.name||'').slice(0,300)}\n${String(item?.text??item?.content??'').slice(0,120000)}`;
    return SENSITIVE_RX.test(material);
  });
}

// A file is evidence, not automatically sensitive data. The previous router marked every
// attachment as sensitive, which excluded governed external generative models and pushed
// ordinary document analysis into the deterministic rescue path. Preserve fail-closed
// handling only when the user text or the actual attachment evidence indicates sensitivity.
export function classifyTask(q:string,mode='general',attachments:any[]=[]){
  const task=base.classifyTask(q,mode,attachments);
  const sensitiveData=SENSITIVE_RX.test(String(q||''))||attachmentLooksSensitive(attachments);
  return {...task,sensitiveData};
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

function debt(row:any){const n=Number(row?.consecutive_failures||row?.failure_debt||0);return Number.isFinite(n)?n:0}
function isHighDebtHalfOpen(row:any){return String(row?.circuit_state||'').toUpperCase()==='HALF_OPEN'&&debt(row)>=5}

export function rank(reg:any[],task:any,req:any,variant='candidate'){
  let ranked=base.rank(reg,task,req,variant);

  if(req?.streaming===true){
    ranked=ranked.map((row:any,index:number)=>({row,index})).sort((a:any,b:any)=>{
      const av=a.row?.streaming_verified===true?1:0,bv=b.row?.streaming_verified===true?1:0;
      if(av!==bv)return bv-av;
      const at=Date.parse(String(a.row?.last_stream_success_at||'')),bt=Date.parse(String(b.row?.last_stream_success_at||''));
      const af=Number.isFinite(at)?at:0,bf=Number.isFinite(bt)?bt:0;
      if(af!==bf)return bf-af;
      return a.index-b.index;
    }).map((x:any)=>x.row);
  }

  // Deterministic rescue is a continuity mechanism, not a premium generative answer.
  // Try every reasonable generative route before it. Providers with a heavily indebted
  // HALF_OPEN circuit stay behind rescue so repeated rate-limit/server failures do not
  // inflate latency or make the product feel disconnected.
  const rescue=ranked.filter((row:any)=>row?.provider===RESCUE_PROVIDER);
  const primary=ranked.filter((row:any)=>row?.provider!==RESCUE_PROVIDER);
  const reasonable=primary.filter((row:any)=>!isHighDebtHalfOpen(row));
  const probation=primary.filter((row:any)=>isHighDebtHalfOpen(row));
  return [...reasonable,...rescue,...probation];
}
