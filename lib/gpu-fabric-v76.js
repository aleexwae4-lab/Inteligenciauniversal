export const GPU_FABRIC_VERSION='wae-gpu-fabric/v76';

const circuitState=new Map();
const now=()=>Date.now();
const intEnv=(name,fallback,min,max)=>Math.max(min,Math.min(max,Number.parseInt(process.env[name]||'',10)||fallback));

function clean(value,max=400){return String(value??'').trim().slice(0,max)}
function safeBase(value){
  const raw=clean(value,1200).replace(/\/+$/,'');
  if(!raw)return'';
  try{const url=new URL(raw);return url.protocol==='https:'?url.toString().replace(/\/$/,''):''}catch{return''}
}
function lane(id,baseUrl,apiKey,model,priority=100,headers={}){
  return{id,baseUrl:safeBase(baseUrl),apiKey:clean(apiKey,4000),model:clean(model,500),priority:Number(priority)||100,headers};
}

function presetLanes(){
  return[
    lane('nvidia_nim','https://integrate.api.nvidia.com/v1',process.env.NVIDIA_API_KEY,process.env.NVIDIA_MODEL||process.env.WAE_NVIDIA_MODEL||'openai/gpt-oss-20b',10),
    lane('groq','https://api.groq.com/openai/v1',process.env.GROQ_API_KEY,process.env.GROQ_MODEL||process.env.WAE_GROQ_MODEL||'llama-3.3-70b-versatile',20),
    lane('huggingface_router','https://router.huggingface.co/v1',process.env.HF_TOKEN||process.env.HUGGINGFACE_API_KEY,process.env.HF_MODEL||process.env.HUGGINGFACE_MODEL||'openai/gpt-oss-120b:fastest',30),
    lane('openrouter','https://openrouter.ai/api/v1',process.env.OPENROUTER_API_KEY,process.env.OPENROUTER_MODEL,40,{
      'HTTP-Referer':process.env.PUBLIC_APP_URL||'https://wae-inteligencia-universal.onrender.com',
      'X-Title':'WAE Universal Core GPU Fabric'
    }),
    lane('cerebras',process.env.CEREBRAS_API_BASE,process.env.CEREBRAS_API_KEY,process.env.CEREBRAS_MODEL,50),
    lane('together',process.env.TOGETHER_API_BASE,process.env.TOGETHER_API_KEY,process.env.TOGETHER_MODEL,60),
    lane('fireworks',process.env.FIREWORKS_API_BASE,process.env.FIREWORKS_API_KEY,process.env.FIREWORKS_MODEL,70),
    lane('deepinfra',process.env.DEEPINFRA_API_BASE,process.env.DEEPINFRA_API_KEY,process.env.DEEPINFRA_MODEL,80),
    lane('sambanova',process.env.SAMBANOVA_API_BASE,process.env.SAMBANOVA_API_KEY,process.env.SAMBANOVA_MODEL,90)
  ];
}

function customLanes(){
  const rows=[];
  for(let i=1;i<=8;i++){
    const prefix=`WAE_GPU_LANE_${i}`;
    rows.push(lane(clean(process.env[`${prefix}_ID`],80)||`custom_${i}`,process.env[`${prefix}_BASE_URL`],process.env[`${prefix}_API_KEY`],process.env[`${prefix}_MODEL`],100+i));
  }
  return rows;
}

function configuredLane(row){return Boolean(row?.id&&row?.baseUrl&&row?.apiKey&&row?.model)}
function circuit(row){
  const state=circuitState.get(row.id)||{failures:0,openUntil:0,lastFailure:null,lastSuccess:null};
  return{...state,state:state.openUntil>now()?'OPEN':state.failures>0?'HALF_OPEN':'CLOSED'};
}
function lanePublic(row){
  const c=circuit(row);
  return{id:row.id,model:row.model,baseHost:(()=>{try{return new URL(row.baseUrl).hostname}catch{return''}})(),priority:row.priority,circuit:c.state,failures:c.failures,lastSuccess:c.lastSuccess,lastFailure:c.lastFailure};
}

export function gpuFabricLanes({availableOnly=false}={}){
  const seen=new Set();
  const rows=[...presetLanes(),...customLanes()].filter(configuredLane).filter(row=>{
    const key=`${row.baseUrl}|${row.model}`;
    if(seen.has(key))return false;
    seen.add(key);return true;
  }).sort((a,b)=>a.priority-b.priority);
  return availableOnly?rows.filter(row=>circuit(row).state!=='OPEN'):rows;
}

export function gpuFabricConfigured(){
  if(String(process.env.WAE_GPU_FABRIC_ENABLED||'1')==='0')return false;
  return gpuFabricLanes().length>0;
}

export function gpuFabricSnapshot(){
  const rows=gpuFabricLanes(),available=rows.filter(row=>circuit(row).state!=='OPEN');
  return{
    version:GPU_FABRIC_VERSION,
    enabled:String(process.env.WAE_GPU_FABRIC_ENABLED||'1')!=='0',
    configured:rows.length>0,
    configuredLanes:rows.length,
    availableLanes:available.length,
    strategy:'ranked-failover',
    maxAttempts:intEnv('WAE_GPU_FABRIC_MAX_ATTEMPTS',2,1,6),
    perLaneTimeoutMs:intEnv('WAE_GPU_FABRIC_TIMEOUT_MS',8000,1500,15000),
    capacityClass:'provider-managed-elastic-gpu-fleets',
    physicalGpuOwnership:false,
    verifiedGpuCount:null,
    gpuCountClaimPolicy:'Never claim an exact physical GPU count without provider telemetry or contractual capacity evidence.',
    lanes:rows.map(lanePublic)
  };
}

function messagesFor({system,message,history=[]}){
  const prior=(Array.isArray(history)?history:[]).slice(-10)
    .filter(x=>x&&['user','assistant'].includes(x.role)&&typeof(x.text??x.content)==='string')
    .map(x=>({role:x.role,content:String(x.text??x.content).slice(0,12000)}));
  return[{role:'system',content:String(system||'').slice(0,20000)},...prior,{role:'user',content:String(message||'').slice(0,30000)}];
}

function completionText(data){
  const content=data?.choices?.[0]?.message?.content;
  if(typeof content==='string'&&content.trim())return content.trim();
  if(Array.isArray(content)){
    const text=content.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('\n').trim();
    if(text)return text;
  }
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  return'';
}

function failureClass(error){
  const status=Number(error?.status||0),msg=String(error?.message||'').toLowerCase();
  if(status===401||status===403)return'auth';
  if(status===429||msg.includes('rate limit'))return'rate_limit';
  if(error?.name==='AbortError'||msg.includes('timeout'))return'timeout';
  if(status>=500)return'upstream';
  return'provider';
}
function markFailure(row,error){
  const cls=failureClass(error),prev=circuitState.get(row.id)||{failures:0,openUntil:0,lastFailure:null,lastSuccess:null};
  const failures=prev.failures+1;
  const cooldown=cls==='auth'?15*60_000:cls==='rate_limit'?120_000:failures>=2?45_000:10_000;
  circuitState.set(row.id,{...prev,failures,openUntil:now()+cooldown,lastFailure:new Date().toISOString(),lastFailureClass:cls});
  return cls;
}
function markSuccess(row){
  circuitState.set(row.id,{failures:0,openUntil:0,lastFailure:null,lastFailureClass:null,lastSuccess:new Date().toISOString()});
}

async function invokeLane(row,payload){
  const timeoutMs=intEnv('WAE_GPU_FABRIC_TIMEOUT_MS',8000,1500,15000),controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new Error('gpu_lane_timeout')),timeoutMs);
  const started=now();
  try{
    const response=await fetch(`${row.baseUrl}/chat/completions`,{
      method:'POST',signal:controller.signal,
      headers:{'Authorization':`Bearer ${row.apiKey}`,'Content-Type':'application/json','Accept':'application/json',...row.headers},
      body:JSON.stringify({model:row.model,messages:messagesFor(payload),stream:false,max_tokens:intEnv('WAE_GPU_MAX_OUTPUT_TOKENS',4096,256,16384)})
    });
    const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
    if(!response.ok){const error=new Error(`${response.status}: ${String(data?.error?.message||data?.message||data?.error||data?.raw||'gpu_provider_error').slice(0,400)}`);error.status=response.status;throw error}
    const text=completionText(data);if(!text)throw new Error('gpu_provider_empty_output');
    markSuccess(row);
    return{text,usage:data?.usage||null,responseId:data?.id||null,provider:'gpu_fabric',model:`${row.id}:${row.model}`,gpuLane:row.id,fabricVersion:GPU_FABRIC_VERSION,latencyMs:now()-started};
  }finally{clearTimeout(timer)}
}

export async function generateWithGpuFabric(payload={}){
  if(!gpuFabricConfigured()){const error=new Error('GPU Fabric no tiene carriles configurados');error.code='GPU_FABRIC_UNCONFIGURED';throw error}
  const candidates=gpuFabricLanes({availableOnly:true}),maxAttempts=Math.min(candidates.length,intEnv('WAE_GPU_FABRIC_MAX_ATTEMPTS',2,1,6));
  const failures=[];
  for(const row of candidates.slice(0,maxAttempts)){
    try{return{...await invokeLane(row,payload),failures}}
    catch(error){const cls=markFailure(row,error);failures.push({lane:row.id,model:row.model,class:cls,error:String(error?.message||error).slice(0,300)})}
  }
  const error=new Error('GPU Fabric agotó los carriles disponibles');error.code='GPU_FABRIC_EXHAUSTED';error.failures=failures;throw error;
}

export function __resetGpuFabricForTests(){circuitState.clear()}
