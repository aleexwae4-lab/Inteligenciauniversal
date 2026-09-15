import { providerRegistry } from './providers.js';
import { classifyTask } from './adaptive-router.js';

export const PERFORMANCE_ROUTER_VERSION='adaptive-performance-router/v62';
export const PERFORMANCE_ROUTER_CONTRACT='universal-provider-mesh/v2';

const state=new Map();
const EWMA_ALPHA=.25;
const QUALITY_ALPHA=.30;
const RATE_LIMIT_COOLDOWN_MS=10*60*1000;
const AUTH_COOLDOWN_MS=60*60*1000;
const FAILURE_COOLDOWN_MS=10*60*1000;

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):0));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const configuredRegistry=registry=>(Array.isArray(registry)?registry:[]).filter(item=>item?.configured===true&&item?.id);
const ewma=(previous,next,alpha)=>finite(previous)?Number(previous)*(1-alpha)+Number(next)*alpha:Number(next);

function providerState(id){
  const key=String(id||'');
  if(!state.has(key))state.set(key,{
    attempts:0,successes:0,failures:0,consecutiveFailures:0,
    ewmaLatencyMs:null,ewmaTtftMs:null,ewmaQuality:null,ewmaEvidence:null,ewmaInstruction:null,ewmaCostMicrounits:null,
    qualitySamples:0,circuitUntil:0,lastErrorClass:null,lastAttemptAt:0,lastSuccessAt:0,lastFailureAt:0,lastQualityAt:0,lastQualityGrade:null
  });
  return state.get(key);
}

function classifyFailure(failure={}){
  const text=String(failure?.error||failure?.message||failure||'').toLowerCase();
  const status=Number(failure?.status||text.match(/\b(401|403|429|500|502|503|504)\b/)?.[1]||0);
  if(status===401||status===403||/unauthor|forbidden|invalid.*(?:key|token)|auth/.test(text))return'auth';
  if(status===429||/rate.?limit|quota|too many requests/.test(text))return'rate_limit';
  if(/timeout|timed out|abort|deadline/.test(text))return'timeout';
  if(status>=500||/server|temporar|unavailable|bad gateway|gateway timeout/.test(text))return'server';
  if(/empty_output|unsafe_reasoning_output|sin texto utilizable/.test(text))return'output';
  return'other';
}

function cooldownFor(errorClass,consecutiveFailures){
  if(errorClass==='auth')return AUTH_COOLDOWN_MS;
  if(errorClass==='rate_limit')return RATE_LIMIT_COOLDOWN_MS;
  if(['timeout','server'].includes(errorClass)&&consecutiveFailures>=3)return FAILURE_COOLDOWN_MS;
  return 0;
}

function recordFailure(id,failure,now=Date.now()){
  if(!id)return;
  const s=providerState(id),errorClass=classifyFailure(failure);
  s.attempts+=1;s.failures+=1;s.consecutiveFailures+=1;s.lastAttemptAt=now;s.lastFailureAt=now;s.lastErrorClass=errorClass;
  const cooldown=cooldownFor(errorClass,s.consecutiveFailures);
  if(cooldown)s.circuitUntil=Math.max(s.circuitUntil,now+cooldown);
}

function recordSuccess(id,{latencyMs=null,ttftMs=null,costMicrounits=null}={},now=Date.now()){
  if(!id)return;
  const s=providerState(id);
  s.attempts+=1;s.successes+=1;s.consecutiveFailures=0;s.lastAttemptAt=now;s.lastSuccessAt=now;s.lastErrorClass=null;s.circuitUntil=0;
  if(finite(latencyMs)&&Number(latencyMs)>=0)s.ewmaLatencyMs=ewma(s.ewmaLatencyMs,Number(latencyMs),EWMA_ALPHA);
  if(finite(ttftMs)&&Number(ttftMs)>=0)s.ewmaTtftMs=ewma(s.ewmaTtftMs,Number(ttftMs),EWMA_ALPHA);
  if(finite(costMicrounits)&&Number(costMicrounits)>=0)s.ewmaCostMicrounits=ewma(s.ewmaCostMicrounits,Number(costMicrounits),EWMA_ALPHA);
}

function recordQuality(id,{score=null,evidence=null,instruction=null,grade=null,costMicrounits=null}={},now=Date.now()){
  if(!id)return;
  const s=providerState(id);
  if(finite(score)){s.ewmaQuality=ewma(s.ewmaQuality,clamp(score),QUALITY_ALPHA);s.qualitySamples+=1}
  if(finite(evidence))s.ewmaEvidence=ewma(s.ewmaEvidence,clamp(evidence),QUALITY_ALPHA);
  if(finite(instruction))s.ewmaInstruction=ewma(s.ewmaInstruction,clamp(instruction),QUALITY_ALPHA);
  if(finite(costMicrounits)&&Number(costMicrounits)>=0)s.ewmaCostMicrounits=ewma(s.ewmaCostMicrounits,Number(costMicrounits),EWMA_ALPHA);
  if(grade)s.lastQualityGrade=String(grade).slice(0,20);
  s.lastQualityAt=now;
}

function reliabilityScore(s){return clamp(((s.successes+4)/(s.attempts+5))*100)}
function latencyScore(ms){if(!finite(ms))return 55;return clamp(100-(Math.max(0,Number(ms))/120))}
function ttftScore(ms){if(!finite(ms))return 55;return clamp(100-(Math.max(0,Number(ms))/30))}
function costScore(microunits){if(!finite(microunits))return 60;return clamp(100-(Math.max(0,Number(microunits))/150))}
function qualityScore(s){return finite(s.ewmaQuality)?clamp(s.ewmaQuality):72}
function evidenceScore(s){return finite(s.ewmaEvidence)?clamp(s.ewmaEvidence):72}
function instructionScore(s){return finite(s.ewmaInstruction)?clamp(s.ewmaInstruction):75}
function confidenceScore(s){return clamp((Math.min(20,s.attempts)*3)+(Math.min(10,s.qualitySamples)*4),0,100)}

function routeWeights(path){
  if(path==='FAST')return{quality:.10,instruction:.05,evidence:.02,reliability:.28,latency:.25,ttft:.20,cost:.05,prior:.05};
  if(path==='DEEP')return{quality:.35,instruction:.10,evidence:.15,reliability:.22,latency:.05,ttft:.02,cost:.03,prior:.08};
  return{quality:.25,instruction:.10,evidence:.08,reliability:.25,latency:.12,ttft:.07,cost:.05,prior:.08};
}

function scoreProvider(provider,index,task,now){
  const s=providerState(provider.id),circuitOpen=s.circuitUntil>now,w=routeWeights(task.path),prior=clamp(96-index*4,60,96);
  const signals={quality:qualityScore(s),instruction:instructionScore(s),evidence:evidenceScore(s),reliability:reliabilityScore(s),latency:latencyScore(s.ewmaLatencyMs),ttft:ttftScore(s.ewmaTtftMs),cost:costScore(s.ewmaCostMicrounits),prior};
  let score=Object.entries(w).reduce((total,[key,weight])=>total+signals[key]*weight,0);
  score-=Math.min(36,s.consecutiveFailures*8);
  if(s.lastQualityGrade==='HOLD')score-=22;
  if(circuitOpen)score=-999;
  return{
    id:provider.id,model:provider.model||null,score:Number(score.toFixed(3)),circuitOpen,circuitUntil:circuitOpen?s.circuitUntil:null,
    reliability:Number(signals.reliability.toFixed(2)),quality:Number(signals.quality.toFixed(2)),evidence:Number(signals.evidence.toFixed(2)),instruction:Number(signals.instruction.toFixed(2)),
    ewmaLatencyMs:finite(s.ewmaLatencyMs)?Math.round(s.ewmaLatencyMs):null,ewmaTtftMs:finite(s.ewmaTtftMs)?Math.round(s.ewmaTtftMs):null,
    ewmaCostMicrounits:finite(s.ewmaCostMicrounits)?Math.round(s.ewmaCostMicrounits):null,
    attempts:s.attempts,successes:s.successes,failures:s.failures,qualitySamples:s.qualitySamples,
    confidence:Number(confidenceScore(s).toFixed(1)),consecutiveFailures:s.consecutiveFailures,lastErrorClass:s.lastErrorClass,lastQualityGrade:s.lastQualityGrade,registryIndex:index
  };
}

function scoredCandidates(registry,task,now){return configuredRegistry(registry).map((provider,index)=>scoreProvider(provider,index,task,now)).sort((a,b)=>b.score-a.score||a.registryIndex-b.registryIndex)}
function fallbackOrder(selected,registry){const ids=configuredRegistry(registry).map(x=>x.id);return selected?[selected,...ids.filter(id=>id!==selected)]:ids}

export function selectProviderRoute({message='',mode='general',attachments=[],requestedProvider='auto',registry=providerRegistry(),now=Date.now()}={}){
  const task=classifyTask(message,{mode:String(mode||'general'),attachments:Array.isArray(attachments)?attachments:[]});
  const rows=configuredRegistry(registry),requested=String(requestedProvider||'auto');
  if(!rows.length)return{contract:PERFORMANCE_ROUTER_CONTRACT,version:PERFORMANCE_ROUTER_VERSION,applied:false,strategy:'no_provider',selectedProvider:'auto',task,candidates:[],fallbackOrder:[]};
  if(requested!=='auto'){
    const selected=rows.find(x=>x.id===requested)?.id||requested;
    return{contract:PERFORMANCE_ROUTER_CONTRACT,version:PERFORMANCE_ROUTER_VERSION,applied:false,strategy:'explicit_provider',selectedProvider:selected,task,candidates:[],fallbackOrder:fallbackOrder(selected,rows)};
  }
  if(task.category==='simple_chat')return{contract:PERFORMANCE_ROUTER_CONTRACT,version:PERFORMANCE_ROUTER_VERSION,applied:false,strategy:'local_fast_path',selectedProvider:'auto',task,candidates:[],fallbackOrder:rows.map(x=>x.id)};
  const candidates=scoredCandidates(rows,task,now),healthy=candidates.filter(x=>!x.circuitOpen),selected=(healthy[0]||candidates.slice().sort((a,b)=>(a.circuitUntil||Infinity)-(b.circuitUntil||Infinity))[0])?.id||rows[0].id;
  return{
    contract:PERFORMANCE_ROUTER_CONTRACT,version:PERFORMANCE_ROUTER_VERSION,applied:true,strategy:'quality_performance_adaptive',selectedProvider:selected,task,
    candidates:candidates.slice(0,5).map(({id,score,circuitOpen,reliability,quality,evidence,instruction,ewmaLatencyMs,ewmaTtftMs,ewmaCostMicrounits,attempts,successes,failures,qualitySamples,confidence,consecutiveFailures,lastErrorClass,lastQualityGrade})=>({id,score,circuitOpen,reliability,quality,evidence,instruction,ewmaLatencyMs,ewmaTtftMs,ewmaCostMicrounits,attempts,successes,failures,qualitySamples,confidence,consecutiveFailures,lastErrorClass,lastQualityGrade})),
    fallbackOrder:fallbackOrder(selected,rows),policy:{qualityAware:true,evidenceAware:true,ttftAware:true,costAware:true,circuitBreaker:true,processLocalLearning:true}
  };
}

function resultTelemetry(result={}){
  const meta=result?.response?.metadata||{};
  return{latencyMs:result?.latencyMs??result?.latency_ms??meta?.latencyMs??null,ttftMs:result?.ttft_ms??result?.ttftMs??meta?.providerTtft??meta?.ttftMs??null,costMicrounits:result?.cost_microunits??meta?.costMicrounits??null};
}

export function observeProviderOutcome({route,result,error,now=Date.now()}={}){
  if(!route)return;
  const failures=Array.isArray(result?.fallbackFailures)?result.fallbackFailures:Array.isArray(result?.failures)?result.failures:Array.isArray(error?.failures)?error.failures:[];
  const failedIds=new Set();
  for(const failure of failures){const id=String(failure?.provider||'').trim();if(!id)continue;failedIds.add(id);recordFailure(id,failure,now)}
  if(error&&!failures.length&&route.selectedProvider&&route.selectedProvider!=='auto'){failedIds.add(route.selectedProvider);recordFailure(route.selectedProvider,error,now)}
  if(!result||result.degraded===true||result.fast_lane===true)return;
  const knownOrder=Array.isArray(route.fallbackOrder)?route.fallbackOrder:[];
  const successId=knownOrder.find(id=>!failedIds.has(id));
  if(successId)recordSuccess(successId,resultTelemetry(result),now);
}

export function observeQualityOutcome({route,payload,now=Date.now()}={}){
  if(!payload||payload?.degraded===true)return;
  const id=String(route?.selectedProvider||payload?.provider_mesh?.selected_provider||'').trim();
  if(!id||id==='auto')return;
  const q=payload?.quality_reliability||payload?.response?.metadata?.qualityReliability||{};
  const dimensions=q?.dimensions||{};
  recordQuality(id,{score:q?.score,evidence:dimensions?.evidence,instruction:dimensions?.instruction,grade:q?.grade,costMicrounits:payload?.cost_microunits??payload?.response?.metadata?.costMicrounits},now);
}

export function providerMeshSnapshot({registry=providerRegistry(),now=Date.now()}={}){
  return{contract:PERFORMANCE_ROUTER_CONTRACT,version:PERFORMANCE_ROUTER_VERSION,learning:'operational_runtime_quality_feedback',memoryScope:'process_local',persistent:false,baseModelWeightsChanged:false,scoringDimensions:['quality','instruction','evidence','reliability','latency','ttft','cost','prior'],providers:configuredRegistry(registry).map((provider,index)=>{const row=scoreProvider(provider,index,{path:'STANDARD'},now);return{...row,circuitState:row.circuitOpen?'OPEN':'CLOSED'}})};
}

export function performanceRouterCapabilities(){return{version:PERFORMANCE_ROUTER_VERSION,contract:PERFORMANCE_ROUTER_CONTRACT,adaptive:true,qualityAware:true,evidenceAware:true,ttftAware:true,costAware:true,circuitBreaker:true,learningScope:'process_local',persistentLearning:false,baseModelTraining:false}}
export function __resetProviderMeshForTests(){state.clear()}
