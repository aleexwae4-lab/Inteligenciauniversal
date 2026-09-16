export const GPU_FABRIC_VERSION='wae-gpu-fabric/v77-adaptive-scheduler';
export const GPU_SCHEDULER_VERSION='wae-gpu-scheduler/v77';

const circuitState=new Map();
const telemetryState=new Map();
const now=()=>Date.now();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const intEnv=(name,fallback,min,max)=>clamp(Number.parseInt(process.env[name]||'',10)||fallback,min,max);
const numEnv=(name,fallback,min,max)=>clamp(Number.parseFloat(process.env[name]||'')||fallback,min,max);

function clean(value,max=400){return String(value??'').trim().slice(0,max)}
function safeBase(value){
  const raw=clean(value,1200).replace(/\/+$/,'');
  if(!raw)return'';
  try{const url=new URL(raw);return url.protocol==='https:'?url.toString().replace(/\/$/,''):''}catch{return''}
}
function specialties(value){
  const rows=clean(value,500).toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
  return rows.length?[...new Set(rows)]:['general'];
}
function lane(id,baseUrl,apiKey,model,priority=100,headers={},options={}){
  return{
    id,baseUrl:safeBase(baseUrl),apiKey:clean(apiKey,4000),model:clean(model,500),priority:Number(priority)||100,headers,
    costWeight:clamp(Number(options.costWeight)||1,0.05,10),qualityHint:clamp(Number(options.qualityHint)||0.65,0,1),
    specialties:specialties(options.specialties||'general')
  };
}
function presetOptions(name){
  const key=String(name).toUpperCase();
  return{
    costWeight:numEnv(`WAE_GPU_${key}_COST_WEIGHT`,1,0.05,10),
    qualityHint:numEnv(`WAE_GPU_${key}_QUALITY_HINT`,0.65,0,1),
    specialties:process.env[`WAE_GPU_${key}_SPECIALTIES`]||'general'
  };
}
function presetLanes(){
  return[
    lane('nvidia_nim','https://integrate.api.nvidia.com/v1',process.env.NVIDIA_API_KEY,process.env.NVIDIA_MODEL||process.env.WAE_NVIDIA_MODEL||'openai/gpt-oss-20b',10,{},presetOptions('nvidia_nim')),
    lane('groq','https://api.groq.com/openai/v1',process.env.GROQ_API_KEY,process.env.GROQ_MODEL||process.env.WAE_GROQ_MODEL||'llama-3.3-70b-versatile',20,{},presetOptions('groq')),
    lane('huggingface_router','https://router.huggingface.co/v1',process.env.HF_TOKEN||process.env.HUGGINGFACE_API_KEY,process.env.HF_MODEL||process.env.HUGGINGFACE_MODEL||'openai/gpt-oss-120b:fastest',30,{},presetOptions('huggingface_router')),
    lane('openrouter','https://openrouter.ai/api/v1',process.env.OPENROUTER_API_KEY,process.env.OPENROUTER_MODEL,40,{
      'HTTP-Referer':process.env.PUBLIC_APP_URL||'https://wae-inteligencia-universal.onrender.com','X-Title':'WAE Universal Core GPU Fabric'
    },presetOptions('openrouter')),
    lane('cerebras',process.env.CEREBRAS_API_BASE,process.env.CEREBRAS_API_KEY,process.env.CEREBRAS_MODEL,50,{},presetOptions('cerebras')),
    lane('together',process.env.TOGETHER_API_BASE,process.env.TOGETHER_API_KEY,process.env.TOGETHER_MODEL,60,{},presetOptions('together')),
    lane('fireworks',process.env.FIREWORKS_API_BASE,process.env.FIREWORKS_API_KEY,process.env.FIREWORKS_MODEL,70,{},presetOptions('fireworks')),
    lane('deepinfra',process.env.DEEPINFRA_API_BASE,process.env.DEEPINFRA_API_KEY,process.env.DEEPINFRA_MODEL,80,{},presetOptions('deepinfra')),
    lane('sambanova',process.env.SAMBANOVA_API_BASE,process.env.SAMBANOVA_API_KEY,process.env.SAMBANOVA_MODEL,90,{},presetOptions('sambanova'))
  ];
}
function customLanes(){
  const rows=[];
  for(let i=1;i<=8;i++){
    const prefix=`WAE_GPU_LANE_${i}`;
    rows.push(lane(clean(process.env[`${prefix}_ID`],80)||`custom_${i}`,process.env[`${prefix}_BASE_URL`],process.env[`${prefix}_API_KEY`],process.env[`${prefix}_MODEL`],Number(process.env[`${prefix}_PRIORITY`])||100+i,{},
      {costWeight:process.env[`${prefix}_COST_WEIGHT`]||1,qualityHint:process.env[`${prefix}_QUALITY_HINT`]||0.65,specialties:process.env[`${prefix}_SPECIALTIES`]||'general'}));
  }
  return rows;
}
function configuredLane(row){return Boolean(row?.id&&row?.baseUrl&&row?.apiKey&&row?.model)}
function circuit(row){
  const state=circuitState.get(row.id)||{failures:0,openUntil:0,lastFailure:null,lastSuccess:null,lastFailureClass:null};
  return{...state,state:state.openUntil>now()?'OPEN':state.failures>0?'HALF_OPEN':'CLOSED'};
}
function telemetry(row){
  return telemetryState.get(row.id)||{attempts:0,successes:0,failures:0,ewmaLatencyMs:null,ewmaResponseStartMs:null,lastLatencyMs:null,lastResponseStartMs:null,lastObservedAt:null};
}
function publicTelemetry(row){
  const t=telemetry(row);return{attempts:t.attempts,successes:t.successes,failures:t.failures,successRate:t.attempts?Number((t.successes/t.attempts).toFixed(4)):null,ewmaLatencyMs:t.ewmaLatencyMs===null?null:Math.round(t.ewmaLatencyMs),ewmaResponseStartMs:t.ewmaResponseStartMs===null?null:Math.round(t.ewmaResponseStartMs),lastObservedAt:t.lastObservedAt};
}
function lanePublic(row){
  const c=circuit(row);
  return{id:row.id,model:row.model,baseHost:(()=>{try{return new URL(row.baseUrl).hostname}catch{return''}})(),priority:row.priority,costWeight:row.costWeight,qualityHint:row.qualityHint,specialties:row.specialties,circuit:c.state,failures:c.failures,lastSuccess:c.lastSuccess,lastFailure:c.lastFailure,lastFailureClass:c.lastFailureClass,telemetry:publicTelemetry(row)};
}
export function gpuFabricLanes({availableOnly=false}={}){
  const seen=new Set();
  const rows=[...presetLanes(),...customLanes()].filter(configuredLane).filter(row=>{const key=`${row.baseUrl}|${row.model}`;if(seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>a.priority-b.priority);
  return availableOnly?rows.filter(row=>circuit(row).state!=='OPEN'):rows;
}
export function gpuFabricConfigured(){return String(process.env.WAE_GPU_FABRIC_ENABLED||'1')!=='0'&&gpuFabricLanes().length>0}

function normalizeText(value){return clean(value,30000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
export function classifyGpuTask(payload={}){
  const mode=clean(payload.mode||payload.agent||'',40).toLowerCase(),q=normalizeText(payload.message||payload.task||'');
  if(mode==='code'||/\b(code|codigo|typescript|javascript|python|sql|api|backend|frontend|bug|debug|github)\b/.test(q))return'code';
  if(mode==='executive'||/\b(ceo|cfo|estrategia|strategy|negocio|business|roi|operaciones|monetiza|escala)\b/.test(q))return'executive';
  if(mode==='analysis'||/\b(analiza|analysis|compara|compare|arquitectura|riesgo|diagnostica|audita|razona|reason)\b/.test(q))return'analysis';
  if(mode==='design'||/\b(diseno|design|ux|ui|interfaz|visual)\b/.test(q))return'design';
  return'general';
}
function taskAffinity(row,task){return row.specialties.includes('*')||row.specialties.includes(task)||row.specialties.includes('general')?1:0}
function successRate(row){const t=telemetry(row);return t.attempts?t.successes/t.attempts:0.86}
function latencyEstimate(row){const t=telemetry(row);return Number(t.ewmaLatencyMs)||intEnv('WAE_GPU_COLD_LATENCY_MS',4500,500,15000)}
function responseStartEstimate(row){const t=telemetry(row);return Number(t.ewmaResponseStartMs)||Math.min(latencyEstimate(row),intEnv('WAE_GPU_COLD_RESPONSE_START_MS',1200,100,8000))}
export function scoreGpuLane(row,payload={}){
  const task=classifyGpuTask(payload),c=circuit(row),reliability=successRate(row),latency=latencyEstimate(row),start=responseStartEstimate(row);
  const weights={reliability:numEnv('WAE_GPU_WEIGHT_RELIABILITY',4,0,20),latency:numEnv('WAE_GPU_WEIGHT_LATENCY',1,0,10),responseStart:numEnv('WAE_GPU_WEIGHT_RESPONSE_START',1.25,0,10),cost:numEnv('WAE_GPU_WEIGHT_COST',0.7,0,10),quality:numEnv('WAE_GPU_WEIGHT_QUALITY',1.5,0,10),affinity:numEnv('WAE_GPU_WEIGHT_AFFINITY',2,0,10),priority:numEnv('WAE_GPU_WEIGHT_PRIORITY',0.15,0,5)};
  const score=(1-reliability)*weights.reliability+(latency/5000)*weights.latency+(start/2000)*weights.responseStart+row.costWeight*weights.cost+(1-row.qualityHint)*weights.quality+(taskAffinity(row,task)?0:weights.affinity)+(row.priority/100)*weights.priority+(c.state==='HALF_OPEN'?1.5:0);
  return{task,score:Number(score.toFixed(4)),reliability:Number(reliability.toFixed(4)),latencyEstimateMs:Math.round(latency),responseStartEstimateMs:Math.round(start),costWeight:row.costWeight,qualityHint:row.qualityHint,affinity:taskAffinity(row,task)===1,circuit:c.state};
}
export function rankGpuLanes(payload={}){return gpuFabricLanes({availableOnly:true}).map(row=>({row,decision:scoreGpuLane(row,payload)})).sort((a,b)=>a.decision.score-b.decision.score||a.row.priority-b.row.priority)}

export function gpuFabricSnapshot(){
  const rows=gpuFabricLanes(),available=rows.filter(row=>circuit(row).state!=='OPEN');
  return{version:GPU_FABRIC_VERSION,schedulerVersion:GPU_SCHEDULER_VERSION,enabled:String(process.env.WAE_GPU_FABRIC_ENABLED||'1')!=='0',configured:rows.length>0,configuredLanes:rows.length,availableLanes:available.length,strategy:'adaptive-utility-scheduler+delayed-hedging',maxAttempts:intEnv('WAE_GPU_FABRIC_MAX_ATTEMPTS',2,1,6),perLaneTimeoutMs:intEnv('WAE_GPU_FABRIC_TIMEOUT_MS',8000,1500,15000),hedgingEnabled:String(process.env.WAE_GPU_HEDGING_ENABLED||'1')!=='0',hedgeDelayMs:intEnv('WAE_GPU_HEDGE_DELAY_MS',900,100,5000),capacityClass:'provider-managed-elastic-gpu-fleets',physicalGpuOwnership:false,verifiedGpuCount:null,gpuCountClaimPolicy:'Never claim an exact physical GPU count without provider telemetry or contractual capacity evidence.',costPolicy:'Relative configurable routing weights only; no dollar price is inferred when provider billing telemetry is absent.',latencyPolicy:'responseStartMs measures HTTP response-start latency; it is not claimed as token TTFT unless streaming telemetry proves token timing.',lanes:rows.map(lanePublic)};
}

function messagesFor({system,message,history=[]}){const prior=(Array.isArray(history)?history:[]).slice(-10).filter(x=>x&&['user','assistant'].includes(x.role)&&typeof(x.text??x.content)==='string').map(x=>({role:x.role,content:String(x.text??x.content).slice(0,12000)}));return[{role:'system',content:String(system||'').slice(0,20000)},...prior,{role:'user',content:String(message||'').slice(0,30000)}]}
function completionText(data){const content=data?.choices?.[0]?.message?.content;if(typeof content==='string'&&content.trim())return content.trim();if(Array.isArray(content)){const text=content.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('\n').trim();if(text)return text}if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();return''}
function failureClass(error){const status=Number(error?.status||0),msg=String(error?.message||'').toLowerCase();if(status===401||status===403)return'auth';if(status===429||msg.includes('rate limit'))return'rate_limit';if(error?.name==='AbortError'||msg.includes('timeout'))return'timeout';if(status>=500)return'upstream';return'provider'}
function observe(row,{success,latencyMs=null,responseStartMs=null}){const prev=telemetry(row),alpha=numEnv('WAE_GPU_EWMA_ALPHA',0.28,0.05,1),ewma=(oldValue,value)=>oldValue===null||oldValue===undefined?value:(alpha*value+(1-alpha)*oldValue);telemetryState.set(row.id,{attempts:prev.attempts+1,successes:prev.successes+(success?1:0),failures:prev.failures+(success?0:1),ewmaLatencyMs:latencyMs===null?prev.ewmaLatencyMs:ewma(prev.ewmaLatencyMs,latencyMs),ewmaResponseStartMs:responseStartMs===null?prev.ewmaResponseStartMs:ewma(prev.ewmaResponseStartMs,responseStartMs),lastLatencyMs:latencyMs,lastResponseStartMs:responseStartMs,lastObservedAt:new Date().toISOString()})}
function markFailure(row,error,metrics={}){const cls=failureClass(error),prev=circuitState.get(row.id)||{failures:0,openUntil:0,lastFailure:null,lastSuccess:null},failures=prev.failures+1,cooldown=cls==='auth'?15*60_000:cls==='rate_limit'?120_000:failures>=2?45_000:10_000;circuitState.set(row.id,{...prev,failures,openUntil:now()+cooldown,lastFailure:new Date().toISOString(),lastFailureClass:cls});observe(row,{success:false,...metrics});return cls}
function markSuccess(row,metrics){circuitState.set(row.id,{failures:0,openUntil:0,lastFailure:null,lastFailureClass:null,lastSuccess:new Date().toISOString()});observe(row,{success:true,...metrics})}

function linkedAbort(external,timeoutMs){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new DOMException('gpu_lane_timeout','TimeoutError')),timeoutMs);let remove=()=>{};if(external){const relay=()=>controller.abort(external.reason||new DOMException('gpu_lane_cancelled','AbortError'));if(external.aborted)relay();else{external.addEventListener('abort',relay,{once:true});remove=()=>external.removeEventListener('abort',relay)}}return{signal:controller.signal,cleanup(){clearTimeout(timer);remove()}}}
async function invokeLane(row,payload,externalSignal){
  const timeoutMs=intEnv('WAE_GPU_FABRIC_TIMEOUT_MS',8000,1500,15000),linked=linkedAbort(externalSignal,timeoutMs),started=now();let responseStartMs=null;
  try{
    const response=await fetch(`${row.baseUrl}/chat/completions`,{method:'POST',signal:linked.signal,headers:{'Authorization':`Bearer ${row.apiKey}`,'Content-Type':'application/json','Accept':'application/json',...row.headers},body:JSON.stringify({model:row.model,messages:messagesFor(payload),stream:false,max_tokens:intEnv('WAE_GPU_MAX_OUTPUT_TOKENS',4096,256,16384)})});
    responseStartMs=now()-started;const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
    if(!response.ok){const error=new Error(`${response.status}: ${String(data?.error?.message||data?.message||data?.error||data?.raw||'gpu_provider_error').slice(0,400)}`);error.status=response.status;error.metrics={latencyMs:now()-started,responseStartMs};throw error}
    const text=completionText(data);if(!text){const error=new Error('gpu_provider_empty_output');error.metrics={latencyMs:now()-started,responseStartMs};throw error}
    const latencyMs=now()-started;markSuccess(row,{latencyMs,responseStartMs});return{text,usage:data?.usage||null,responseId:data?.id||null,provider:'gpu_fabric',model:`${row.id}:${row.model}`,gpuLane:row.id,fabricVersion:GPU_FABRIC_VERSION,schedulerVersion:GPU_SCHEDULER_VERSION,latencyMs,responseStartMs};
  }finally{linked.cleanup()}
}
async function attempted(row,payload,controller,failures){try{return{ok:true,result:await invokeLane(row,payload,controller.signal),row}}catch(error){if(controller.signal.aborted&&String(error?.name||'')==='AbortError')return{ok:false,cancelled:true,row};const cls=markFailure(row,error,error?.metrics||{});failures.push({lane:row.id,model:row.model,class:cls,error:String(error?.message||error).slice(0,300)});return{ok:false,error,row}}}
function complexTask(payload){return['analysis','executive','code'].includes(classifyGpuTask(payload))}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function hedgedTopTwo(ranked,payload,failures){
  const first=ranked[0].row,second=ranked[1].row,c1=new AbortController(),c2=new AbortController(),p1=attempted(first,payload,c1,failures),delay=intEnv('WAE_GPU_HEDGE_DELAY_MS',900,100,5000);
  const early=await Promise.race([p1,sleep(delay).then(()=>null)]);if(early?.ok)return{...early.result,scheduler:{mode:'single-fast-completion',task:classifyGpuTask(payload),ranked:ranked.slice(0,2).map(x=>({lane:x.row.id,score:x.decision.score}))}};
  if(early&&!early.ok){const next=await attempted(second,payload,c2,failures);if(next.ok)return{...next.result,scheduler:{mode:'failover-after-primary-error',task:classifyGpuTask(payload),ranked:ranked.slice(0,2).map(x=>({lane:x.row.id,score:x.decision.score}))}};return null}
  const p2=attempted(second,payload,c2,failures),winner=await Promise.race([p1.then(x=>x.ok?{slot:1,...x}:null),p2.then(x=>x.ok?{slot:2,...x}:null)].map(async p=>{const value=await p;if(value)return value;throw new Error('lane_failed')})).catch(()=>null);
  if(winner?.ok){if(winner.slot===1)c2.abort();else c1.abort();return{...winner.result,scheduler:{mode:'delayed-hedged',task:classifyGpuTask(payload),hedgeDelayMs:delay,winner:winner.row.id,ranked:ranked.slice(0,2).map(x=>({lane:x.row.id,score:x.decision.score}))}};
  const remaining=await Promise.all([p1,p2]);const success=remaining.find(x=>x?.ok);return success?{...success.result,scheduler:{mode:'delayed-hedged',task:classifyGpuTask(payload),winner:success.row.id,ranked:ranked.slice(0,2).map(x=>({lane:x.row.id,score:x.decision.score}))}}:null;
}

export async function generateWithGpuFabric(payload={}){
  if(!gpuFabricConfigured()){const error=new Error('GPU Fabric no tiene carriles configurados');error.code='GPU_FABRIC_UNCONFIGURED';throw error}
  const ranked=rankGpuLanes(payload),maxAttempts=Math.min(ranked.length,intEnv('WAE_GPU_FABRIC_MAX_ATTEMPTS',2,1,6)),failures=[];
  const useHedge=String(process.env.WAE_GPU_HEDGING_ENABLED||'1')!=='0'&&complexTask(payload)&&maxAttempts>=2;
  let used=0;
  if(useHedge){const result=await hedgedTopTwo(ranked.slice(0,maxAttempts),payload,failures);used=2;if(result)return{...result,failures}}
  for(const candidate of ranked.slice(used,maxAttempts)){const controller=new AbortController(),attempt=await attempted(candidate.row,payload,controller,failures);if(attempt.ok)return{...attempt.result,failures,scheduler:{mode:'adaptive-sequential',task:classifyGpuTask(payload),winner:candidate.row.id,ranked:ranked.slice(0,maxAttempts).map(x=>({lane:x.row.id,score:x.decision.score}))}}}
  const error=new Error('GPU Fabric agotó los carriles disponibles');error.code='GPU_FABRIC_EXHAUSTED';error.failures=failures;throw error;
}

export function __seedGpuLaneStatsForTests(id,stats={}){telemetryState.set(id,{attempts:Number(stats.attempts)||0,successes:Number(stats.successes)||0,failures:Number(stats.failures)||0,ewmaLatencyMs:stats.ewmaLatencyMs??null,ewmaResponseStartMs:stats.ewmaResponseStartMs??null,lastLatencyMs:null,lastResponseStartMs:null,lastObservedAt:new Date().toISOString()})}
export function __resetGpuFabricForTests(){circuitState.clear();telemetryState.clear()}
