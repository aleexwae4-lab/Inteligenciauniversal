import { providerRegistry } from './providers.js';
import { classifyTask } from './adaptive-router.js';

const ROUTER_CONTRACT='universal-provider-mesh/v1';
const state=new Map();
const EWMA_ALPHA=.25;
const RATE_LIMIT_COOLDOWN_MS=10*60*1000;
const AUTH_COOLDOWN_MS=60*60*1000;
const FAILURE_COOLDOWN_MS=10*60*1000;

const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const finite=value=>Number.isFinite(Number(value));
const configuredRegistry=registry=>(Array.isArray(registry)?registry:[]).filter(item=>item?.configured===true&&item?.id);

function providerState(id){
  const key=String(id||'');
  if(!state.has(key))state.set(key,{attempts:0,successes:0,failures:0,consecutiveFailures:0,ewmaLatencyMs:null,circuitUntil:0,lastErrorClass:null,lastAttemptAt:0,lastSuccessAt:0,lastFailureAt:0});
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

function recordSuccess(id,latencyMs,now=Date.now()){
  if(!id)return;
  const s=providerState(id),latency=Number(latencyMs);
  s.attempts+=1;s.successes+=1;s.consecutiveFailures=0;s.lastAttemptAt=now;s.lastSuccessAt=now;s.lastErrorClass=null;s.circuitUntil=0;
  if(Number.isFinite(latency)&&latency>=0)s.ewmaLatencyMs=s.ewmaLatencyMs===null?latency:(EWMA_ALPHA*latency+(1-EWMA_ALPHA)*s.ewmaLatencyMs);
}

function reliabilityScore(s){
  return clamp(((s.successes+4)/(s.attempts+5))*100);
}

function latencyScore(ms){
  if(!finite(ms))return 55;
  const value=Math.max(0,Number(ms));
  return clamp(100-(value/180));
}

function routeWeights(path){
  if(path==='FAST')return{reliability:.42,latency:.38,prior:.20};
  if(path==='DEEP')return{reliability:.48,latency:.10,prior:.42};
  return{reliability:.46,latency:.22,prior:.32};
}

function scoredCandidates(registry,task,now){
  const rows=configuredRegistry(registry),weights=routeWeights(task.path);
  return rows.map((provider,index)=>{
    const s=providerState(provider.id),circuitOpen=s.circuitUntil>now,prior=clamp(96-index*4,60,96),reliability=reliabilityScore(s),latency=latencyScore(s.ewmaLatencyMs);
    let score=reliability*weights.reliability+latency*weights.latency+prior*weights.prior-Math.min(28,s.consecutiveFailures*7);
    if(circuitOpen)score=-999;
    return{id:provider.id,model:provider.model||null,score:Number(score.toFixed(3)),circuitOpen,circuitUntil:circuitOpen?s.circuitUntil:null,reliability:Number(reliability.toFixed(2)),ewmaLatencyMs:finite(s.ewmaLatencyMs)?Math.round(s.ewmaLatencyMs):null,attempts:s.attempts,successes:s.successes,failures:s.failures,consecutiveFailures:s.consecutiveFailures,lastErrorClass:s.lastErrorClass,registryIndex:index};
  }).sort((a,b)=>b.score-a.score||a.registryIndex-b.registryIndex);
}

function fallbackOrder(selected,registry){
  const ids=configuredRegistry(registry).map(x=>x.id);
  return selected?[selected,...ids.filter(id=>id!==selected)]:ids;
}

export function selectProviderRoute({message='',mode='general',attachments=[],requestedProvider='auto',registry=providerRegistry(),now=Date.now()}={}){
  const task=classifyTask(message,{mode:String(mode||'general'),attachments:Array.isArray(attachments)?attachments:[]});
  const rows=configuredRegistry(registry),requested=String(requestedProvider||'auto');
  if(!rows.length)return{contract:ROUTER_CONTRACT,applied:false,strategy:'no_provider',selectedProvider:'auto',task,candidates:[],fallbackOrder:[]};
  if(requested!=='auto'){
    const selected=rows.find(x=>x.id===requested)?.id||requested;
    return{contract:ROUTER_CONTRACT,applied:false,strategy:'explicit_provider',selectedProvider:selected,task,candidates:[],fallbackOrder:fallbackOrder(selected,rows)};
  }
  if(task.category==='simple_chat')return{contract:ROUTER_CONTRACT,applied:false,strategy:'local_fast_path',selectedProvider:'auto',task,candidates:[],fallbackOrder:rows.map(x=>x.id)};

  const candidates=scoredCandidates(rows,task,now),healthy=candidates.filter(x=>!x.circuitOpen),selected=(healthy[0]||candidates.slice().sort((a,b)=>(a.circuitUntil||Infinity)-(b.circuitUntil||Infinity))[0])?.id||rows[0].id;
  return{
    contract:ROUTER_CONTRACT,
    applied:true,
    strategy:'adaptive_provider_mesh',
    selectedProvider:selected,
    task,
    candidates:candidates.slice(0,4).map(({id,score,circuitOpen,reliability,ewmaLatencyMs,attempts,consecutiveFailures,lastErrorClass})=>({id,score,circuitOpen,reliability,ewmaLatencyMs,attempts,consecutiveFailures,lastErrorClass})),
    fallbackOrder:fallbackOrder(selected,rows)
  };
}

export function observeProviderOutcome({route,result,error,now=Date.now()}={}){
  if(!route)return;
  const failures=Array.isArray(result?.fallbackFailures)?result.fallbackFailures:Array.isArray(result?.failures)?result.failures:Array.isArray(error?.failures)?error.failures:[];
  const failedIds=new Set();
  for(const failure of failures){
    const id=String(failure?.provider||'').trim();
    if(!id)continue;
    failedIds.add(id);recordFailure(id,failure,now);
  }
  if(error&&!failures.length&&route.selectedProvider&&route.selectedProvider!=='auto'){
    failedIds.add(route.selectedProvider);recordFailure(route.selectedProvider,error,now);
  }
  if(!result||result.degraded===true||result.fast_lane===true)return;
  const knownOrder=Array.isArray(route.fallbackOrder)?route.fallbackOrder:[];
  const successId=knownOrder.find(id=>!failedIds.has(id));
  if(successId)recordSuccess(successId,result.latencyMs,now);
}

export function providerMeshSnapshot({registry=providerRegistry(),now=Date.now()}={}){
  return{
    contract:ROUTER_CONTRACT,
    learning:'operational_runtime_only',
    baseModelWeightsChanged:false,
    providers:configuredRegistry(registry).map(provider=>{
      const s=providerState(provider.id),circuitOpen=s.circuitUntil>now;
      return{id:provider.id,model:provider.model||null,attempts:s.attempts,successes:s.successes,failures:s.failures,consecutiveFailures:s.consecutiveFailures,reliability:Number(reliabilityScore(s).toFixed(2)),ewmaLatencyMs:finite(s.ewmaLatencyMs)?Math.round(s.ewmaLatencyMs):null,circuitState:circuitOpen?'OPEN':'CLOSED',circuitUntil:circuitOpen?s.circuitUntil:null,lastErrorClass:s.lastErrorClass};
    })
  };
}

export function __resetProviderMeshForTests(){state.clear()}
