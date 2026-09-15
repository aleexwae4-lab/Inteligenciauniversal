import { providerRegistry } from './providers.js';
import {
  selectProviderRoute as selectProviderRouteV62,
  observeProviderOutcome as observeProviderOutcomeV62,
  providerMeshSnapshot as providerMeshSnapshotV62,
  __resetProviderMeshForTests as resetV62
} from './provider-mesh-v62.js';
import { loadPersistentRouterSnapshot } from './scale-control-v63.js';

export const PERFORMANCE_ROUTER_VERSION='adaptive-performance-router/v63';
export const PERFORMANCE_ROUTER_CONTRACT='universal-provider-mesh/v3';

let persistent={loadedAt:0,capability:'general_reasoning',runtime:[],capabilityReputation:[],available:false};
const pending=[];
const MAX_PENDING=256;

const clamp=(value,min=-10,max=10)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):0));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const normalizeId=value=>String(value||'').trim().toLowerCase();

function taskCapability(task={}){
  const category=String(task.category||'').toLowerCase();
  if(/legal/.test(category))return'legal_reasoning';
  if(/financ/.test(category))return'finance';
  if(/sales|commercial/.test(category))return'sales';
  if(/strategy|executive/.test(category))return'strategy';
  if(/code|technology|engineering|software/.test(category))return'technology';
  return'general_reasoning';
}

function registryModelMap(registry=providerRegistry()){
  return new Map((Array.isArray(registry)?registry:[]).filter(x=>x?.id).map(x=>[normalizeId(x.id),String(x.model||'')]));
}

function runtimeRow(id,model=''){
  const key=normalizeId(id),modelKey=normalizeId(model);
  const exact=persistent.runtime.find(row=>normalizeId(row.provider)===key&&normalizeId(row.model)===modelKey);
  return exact||persistent.runtime.find(row=>normalizeId(row.provider)===key)||null;
}

function capabilityRow(id,model=''){
  const key=normalizeId(id),modelKey=normalizeId(model);
  const exact=persistent.capabilityReputation.find(row=>normalizeId(row.provider)===key&&normalizeId(row.model)===modelKey);
  return exact||persistent.capabilityReputation.find(row=>normalizeId(row.provider)===key)||null;
}

function persistentAdjustment(id,model,now=Date.now()){
  const runtime=runtimeRow(id,model),capability=capabilityRow(id,model);
  let adjustment=0,confidence=0,persistentCircuitOpen=false;
  if(runtime){
    const attempts=Math.max(0,Number(runtime.attempts||0));
    const successes=Math.max(0,Number(runtime.successes||0));
    const reliability=((successes+4)/(attempts+5))*100;
    const quality=finite(runtime.ewmaQuality)?Number(runtime.ewmaQuality):72;
    const latency=finite(runtime.ewmaLatencyMs)?Math.max(0,100-Number(runtime.ewmaLatencyMs)/120):55;
    const signal=quality*.42+reliability*.38+latency*.20;
    const sampleWeight=Math.min(1,attempts/12);
    adjustment+=clamp(((signal-72)/6)*sampleWeight,-5,5);
    confidence=Math.max(confidence,Math.min(100,attempts*6));
    const until=Date.parse(String(runtime.circuitUntil||''));
    persistentCircuitOpen=Number.isFinite(until)&&until>now;
  }
  if(capability){
    const capAdjustment=Number(capability.adjustment||0);
    const capConfidence=Math.max(0,Math.min(100,Number(capability.confidenceScore||0)));
    adjustment+=clamp(capAdjustment,-5.5,5.5);
    confidence=Math.max(confidence,capConfidence);
  }
  return{adjustment:clamp(adjustment,-9,9),confidence:Number(confidence.toFixed(1)),persistentCircuitOpen,runtime,capability};
}

export async function hydratePersistentProviderReputation({capability='general_reasoning',force=false}={}){
  const snapshot=await loadPersistentRouterSnapshot({capability,force});
  if(snapshot?.ok===true){
    persistent={loadedAt:Date.now(),capability,runtime:Array.isArray(snapshot.runtime)?snapshot.runtime:[],capabilityReputation:Array.isArray(snapshot.capabilityReputation)?snapshot.capabilityReputation:[],available:true};
  }
  return{...persistent,runtime:undefined,capabilityReputation:undefined};
}

export function selectProviderRoute(args={}){
  const base=selectProviderRouteV62(args);
  const models=registryModelMap(args.registry||providerRegistry());
  const capability=taskCapability(base.task);
  if(!base.applied){
    return{...base,contract:PERFORMANCE_ROUTER_CONTRACT,version:PERFORMANCE_ROUTER_VERSION,persistentReputation:{available:persistent.available,capability},policy:{...(base.policy||{}),persistentLearning:true,multiInstanceConsistent:true}};
  }
  const now=Number(args.now||Date.now());
  const candidates=(Array.isArray(base.candidates)?base.candidates:[]).map(row=>{
    const model=models.get(normalizeId(row.id))||'';
    const p=persistentAdjustment(row.id,model,now);
    const score=p.persistentCircuitOpen?-999:Number((Number(row.score||0)+p.adjustment).toFixed(3));
    return{...row,model,baseScore:row.score,score,persistentAdjustment:Number(p.adjustment.toFixed(3)),persistentConfidence:p.confidence,persistentCircuitOpen:p.persistentCircuitOpen};
  }).sort((a,b)=>b.score-a.score);
  const healthy=candidates.filter(x=>!x.circuitOpen&&!x.persistentCircuitOpen);
  const selected=(healthy[0]||candidates[0]);
  const selectedProvider=selected?.id||base.selectedProvider;
  const fallbackOrder=[selectedProvider,...base.fallbackOrder.filter(id=>id!==selectedProvider)];
  return{
    ...base,
    contract:PERFORMANCE_ROUTER_CONTRACT,
    version:PERFORMANCE_ROUTER_VERSION,
    strategy:'persistent_quality_performance_adaptive',
    selectedProvider,
    selectedModel:models.get(normalizeId(selectedProvider))||'',
    candidates,
    fallbackOrder,
    persistentReputation:{available:persistent.available,loadedAt:persistent.loadedAt||null,capability},
    policy:{...(base.policy||{}),persistentLearning:true,processLocalLearning:true,multiInstanceConsistent:true,crossDeployMemory:true}
  };
}

function classifyFailure(failure={}){
  const raw=String(failure?.error||failure?.message||failure||'').toLowerCase();
  const status=Number(failure?.status||raw.match(/\b(401|403|429|500|502|503|504)\b/)?.[1]||0);
  if(status===401||status===403||/unauthor|forbidden|invalid.*(?:key|token)|auth/.test(raw))return'auth';
  if(status===429||/rate.?limit|quota|too many requests/.test(raw))return'rate_limit';
  if(/timeout|timed out|abort|deadline/.test(raw))return'timeout';
  if(status>=500||/server|temporar|unavailable|bad gateway|gateway timeout/.test(raw))return'server';
  if(/empty_output|unsafe_reasoning_output/.test(raw))return'output';
  return'other';
}

function resultTelemetry(result={}){
  const meta=result?.response?.metadata||{};
  return{latencyMs:result?.latencyMs??result?.latency_ms??meta?.latencyMs??null,ttftMs:result?.ttft_ms??result?.ttftMs??meta?.providerTtft??meta?.ttftMs??null,costMicrounits:result?.cost_microunits??meta?.costMicrounits??null};
}

function queue(entry){
  if(!entry?.provider)return;
  if(pending.length>=MAX_PENDING)pending.shift();
  pending.push(entry);
}

export function observeProviderOutcome({route,result,error,now=Date.now()}={}){
  observeProviderOutcomeV62({route,result,error,now});
  if(!route)return;
  const models=registryModelMap();
  const failures=Array.isArray(result?.fallbackFailures)?result.fallbackFailures:Array.isArray(result?.failures)?result.failures:Array.isArray(error?.failures)?error.failures:[];
  const failedIds=new Set();
  for(const failure of failures){
    const id=String(failure?.provider||'').trim();
    if(!id)continue;
    failedIds.add(id);
    queue({provider:id,model:models.get(normalizeId(id))||'',success:false,errorClass:classifyFailure(failure)});
  }
  if(error&&!failures.length&&route.selectedProvider&&route.selectedProvider!=='auto'){
    const id=route.selectedProvider;
    failedIds.add(id);
    queue({provider:id,model:route.selectedModel||models.get(normalizeId(id))||'',success:false,errorClass:classifyFailure(error)});
  }
  if(!result||result.degraded===true||result.fast_lane===true)return;
  const knownOrder=Array.isArray(route.fallbackOrder)?route.fallbackOrder:[];
  const successId=knownOrder.find(id=>!failedIds.has(id));
  if(successId)queue({provider:successId,model:models.get(normalizeId(successId))||'',success:true,...resultTelemetry(result)});
}

export function queueQualityPersistence({route,payload}={}){
  if(!payload||payload.degraded===true)return;
  const provider=String(route?.selectedProvider||payload?.provider_mesh?.selected_provider||'').trim();
  if(!provider||provider==='auto')return;
  const models=registryModelMap();
  const q=payload?.quality_reliability||payload?.response?.metadata?.qualityReliability||{};
  const d=q?.dimensions||{};
  if(!finite(q?.score)&&!finite(d?.evidence)&&!finite(d?.instruction)&&!q?.grade)return;
  queue({provider,model:route?.selectedModel||models.get(normalizeId(provider))||'',success:true,quality:q?.score,evidence:d?.evidence,instruction:d?.instruction,qualityGrade:q?.grade,costMicrounits:payload?.cost_microunits??payload?.response?.metadata?.costMicrounits});
}

export function drainPersistentObservations(limit=12){return pending.splice(0,Math.max(1,Math.min(32,Number(limit)||12)))}

export function providerMeshSnapshot(options={}){
  const base=providerMeshSnapshotV62(options);
  return{...base,contract:PERFORMANCE_ROUTER_CONTRACT,version:PERFORMANCE_ROUTER_VERSION,memoryScope:'process_local_plus_persistent_control_plane',persistent:true,persistentAvailable:persistent.available,persistentLoadedAt:persistent.loadedAt||null,pendingPersistence:pending.length,baseModelWeightsChanged:false};
}

export function performanceRouterCapabilities(){return{version:PERFORMANCE_ROUTER_VERSION,contract:PERFORMANCE_ROUTER_CONTRACT,adaptive:true,qualityAware:true,evidenceAware:true,ttftAware:true,costAware:true,circuitBreaker:true,learningScope:'operational_persistent_plus_process_local',persistentLearning:true,multiInstanceConsistent:true,crossDeployMemory:true,baseModelTraining:false}}

export function __resetProviderMeshForTests(){resetV62();persistent={loadedAt:0,capability:'general_reasoning',runtime:[],capabilityReputation:[],available:false};pending.length=0}
