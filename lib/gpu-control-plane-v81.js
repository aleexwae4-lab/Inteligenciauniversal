import {createHmac} from 'node:crypto';
import {
  generateWithGpuFabric,
  gpuFabricConfigured,
  gpuFabricSnapshot as gpuFabricSnapshotV77,
  classifyGpuTask,
  __seedGpuLaneStatsForTests,
  GPU_FABRIC_VERSION as GPU_FABRIC_V77,
  GPU_SCHEDULER_VERSION as GPU_SCHEDULER_V77,
} from './gpu-fabric-v77.js';
import {callInternalSupabaseRpc,internalSupabaseTransportState} from './internal-supabase-rpc-v74.js';

export const GPU_CONTROL_PLANE_VERSION='wae-gpu-control-plane/v81';
export const GPU_SCHEDULER_VERSION='wae-gpu-scheduler/v81';
export const GPU_METRICS_VERSION='gpu-metrics/v79';

const scopeState=new Map();
const snapshotCache=new Map();
const now=()=>Date.now();
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const intEnv=(name,fallback,min,max)=>{const parsed=Number.parseInt(process.env[name]||'',10);return Math.max(min,Math.min(max,Number.isFinite(parsed)?parsed:fallback))};

function scopeRaw(payload={}){return clean(payload.tenantId||payload.tenant_id||payload.organizationId||payload.organization_id||payload.sessionId||payload.session_id||payload.userId||payload.user_id||'global')}
function hashKey(){return String(process.env.WAE_GPU_SCOPE_HASH_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'wae-gpu-v81-domain-separator')}
export function gpuScopeHash(payload={}){return createHmac('sha256',hashKey()).update(`scope|${scopeRaw(payload)}`).digest('hex').slice(0,32)}
function scopeRuntime(payload={}){const key=gpuScopeHash(payload);if(!scopeState.has(key))scopeState.set(key,{active:0,lastUsedAt:null});return{key,state:scopeState.get(key)}}
function persistentReady(){return internalSupabaseTransportState().leastPrivilegeReady}

async function loadSnapshot(payload={}){
  const scope=gpuScopeHash(payload),cached=snapshotCache.get(scope),ttl=intEnv('WAE_GPU_METRICS_CACHE_MS',60000,5000,300000);
  if(cached&&now()-cached.loadedAt<ttl)return cached.data;
  if(!persistentReady()){const data={ok:false,rows:[],daily_relative_cost_units:0};snapshotCache.set(scope,{loadedAt:now(),data});return data;}
  const response=await callInternalSupabaseRpc({functionName:'wae_gpu_metrics_snapshot_v79',body:{p_scope_hash:scope},timeoutMs:intEnv('WAE_GPU_METRICS_READ_TIMEOUT_MS',700,250,2500),clientInfo:'wae-gpu-control-plane-v81'});
  const data=response.ok&&response.payload?.ok===true?response.payload:{ok:false,rows:[],daily_relative_cost_units:0};snapshotCache.set(scope,{loadedAt:now(),data});return data;
}

function currentTaskRow(snapshot,laneId,task){const rows=Array.isArray(snapshot?.rows)?snapshot.rows:[];return rows.filter(row=>row?.lane_id===laneId&&row?.task_class===task).sort((a,b)=>String(b?.window_date||'').localeCompare(String(a?.window_date||'')))[0]||null}
function seedPersistentLearning(payload,snapshot){const task=classifyGpuTask(payload),fabric=gpuFabricSnapshotV77();for(const lane of Array.isArray(fabric?.lanes)?fabric.lanes:[]){const row=currentTaskRow(snapshot,lane.id,task);if(!row)continue;__seedGpuLaneStatsForTests(lane.id,{attempts:Number(row.attempts)||0,successes:Number(row.successes)||0,failures:Number(row.failures)||0,ewmaLatencyMs:row.latency_ewma_ms==null?null:Number(row.latency_ewma_ms),ewmaResponseStartMs:row.response_start_ewma_ms==null?null:Number(row.response_start_ewma_ms)});}}
function relativeBudget(snapshot){const used=Math.max(0,Number(snapshot?.daily_relative_cost_units)||0),limit=Math.max(0,Number(process.env.WAE_GPU_DAILY_RELATIVE_BUDGET)||0);return{used,limit,pressure:limit>0?Number(Math.min(5,used/limit).toFixed(4)):0,limited:limit>0&&used>=limit,units:'relative_usage_units_not_currency'}}
function relativeCost(result={}){const usage=result.usage||{},tokens=Number(usage.total_tokens??usage.totalTokens??0);return Number.isFinite(tokens)&&tokens>0?Math.round(tokens):0}
function failureClass(error){const text=String(error?.code||error?.message||'').toLowerCase();if(text.includes('rate')||text.includes('429')||text.includes('quota'))return'rate_limit';if(text.includes('timeout')||text.includes('timed out'))return'timeout';if(text.includes('401')||text.includes('403')||text.includes('auth'))return'auth';if(text.includes('saturat')||text.includes('busy'))return'saturated';return'upstream'}

function record(payload,{laneId,success,failure=null,latencyMs=null,responseStartMs=null,costUnits=0,hedged=false,winner=false,saturated=false}){
  if(!persistentReady()||!laneId)return;
  const scope=gpuScopeHash(payload),task=classifyGpuTask(payload);
  callInternalSupabaseRpc({functionName:'wae_gpu_metrics_record_v79',body:{p_scope_hash:scope,p_lane_id:clean(laneId,120).toLowerCase().replace(/[^a-z0-9_.:-]/g,'_'),p_task_class:task,p_success:success,p_failure_class:failure,p_latency_ms:latencyMs==null?null:Math.max(0,Math.round(latencyMs)),p_response_start_ms:responseStartMs==null?null:Math.max(0,Math.round(responseStartMs)),p_relative_cost_units:Math.max(0,Math.round(costUnits||0)),p_hedged:hedged,p_winner:winner,p_saturated:saturated},timeoutMs:intEnv('WAE_GPU_METRICS_WRITE_TIMEOUT_MS',700,250,2500),clientInfo:'wae-gpu-control-plane-v81'}).catch(()=>{});
  snapshotCache.delete(scope);
}

function acquireScope(payload){const {key,state}=scopeRuntime(payload),perScope=intEnv('WAE_GPU_SCOPE_MAX_CONCURRENCY',3,1,32),globalLimit=intEnv('WAE_GPU_GLOBAL_MAX_CONCURRENCY',12,1,128),globalActive=[...scopeState.values()].reduce((sum,x)=>sum+Number(x.active||0),0);if(state.active>=perScope){const error=new Error('gpu_scope_concurrency_limit');error.code='GPU_SCOPE_BUSY';throw error}if(globalActive>=globalLimit){const error=new Error('gpu_global_concurrency_limit');error.code='GPU_GLOBAL_BUSY';throw error}state.active+=1;state.lastUsedAt=new Date().toISOString();return()=>{const current=scopeState.get(key);if(current)current.active=Math.max(0,current.active-1)}}

export async function generateWithGpuControlPlane(payload={}){
  if(!gpuFabricConfigured()){const error=new Error('GPU Fabric no tiene carriles configurados');error.code='GPU_FABRIC_UNCONFIGURED';throw error}
  const snapshot=await loadSnapshot(payload);seedPersistentLearning(payload,snapshot);const budget=relativeBudget(snapshot),task=classifyGpuTask(payload);
  if(budget.limited&&!['analysis','code','executive'].includes(task)){const error=new Error('gpu_scope_relative_budget_exceeded');error.code='GPU_SCOPE_BUDGET_EXCEEDED';error.budget=budget;throw error}
  const release=acquireScope(payload);
  try{
    const result=await generateWithGpuFabric(payload),mode=String(result?.scheduler?.mode||''),hedged=mode.includes('hedg');
    record(payload,{laneId:result?.gpuLane,success:true,latencyMs:result?.latencyMs,responseStartMs:result?.responseStartMs,costUnits:relativeCost(result),hedged,winner:true});
    return{...result,fabricVersion:GPU_CONTROL_PLANE_VERSION,schedulerVersion:GPU_SCHEDULER_VERSION,controlPlane:{version:GPU_CONTROL_PLANE_VERSION,metricsVersion:GPU_METRICS_VERSION,persistentLearning:persistentReady(),scopeHashing:'hmac-sha256',budget,task,underlay:{fabric:GPU_FABRIC_V77,scheduler:GPU_SCHEDULER_V77}}};
  }catch(error){const lane=error?.failures?.[0]?.lane||null,cls=failureClass(error);if(lane)record(payload,{laneId:lane,success:false,failure:cls,saturated:cls==='saturated'});throw error;
  }finally{release()}
}

export async function gpuControlPlaneSnapshot(payload={}){
  const snapshot=await loadSnapshot(payload).catch(()=>({ok:false,rows:[],daily_relative_cost_units:0})),base=gpuFabricSnapshotV77(),budget=relativeBudget(snapshot),{state}=scopeRuntime(payload);
  return{version:GPU_CONTROL_PLANE_VERSION,schedulerVersion:GPU_SCHEDULER_VERSION,metricsVersion:GPU_METRICS_VERSION,configured:gpuFabricConfigured(),strategy:'persistent-scope-learning+adaptive-v77-underlay+budget-and-concurrency-guard',configuredLanes:Number(base.configuredLanes||0),availableLanes:Number(base.availableLanes||0),scope:{hashed:'hmac-sha256',active:Number(state.active||0),maxConcurrency:intEnv('WAE_GPU_SCOPE_MAX_CONCURRENCY',3,1,32)},globalMaxConcurrency:intEnv('WAE_GPU_GLOBAL_MAX_CONCURRENCY',12,1,128),persistentTelemetry:{configured:internalSupabaseTransportState().configured,leastPrivilegeReady:persistentReady(),contentStored:false,promptsStored:false,responsesStored:false,attachmentsStored:false,rawScopeIdentifiersStored:false},budget:{configured:budget.limit>0,pressure:budget.pressure,units:budget.units},capacityClass:base.capacityClass||'provider-managed-elastic-gpu-fleets',physicalGpuOwnership:false,verifiedGpuCount:null,gpuCountClaimPolicy:'Never claim an exact physical GPU count without provider telemetry or contractual capacity evidence.',underlay:{fabric:GPU_FABRIC_V77,scheduler:GPU_SCHEDULER_V77}};
}

export function __resetGpuControlPlaneForTests(){scopeState.clear();snapshotCache.clear()}
export function __seedGpuPersistentSnapshotForTests(payload,data){snapshotCache.set(gpuScopeHash(payload),{loadedAt:now(),data:{ok:true,rows:Array.isArray(data?.rows)?data.rows:[],daily_relative_cost_units:Number(data?.daily_relative_cost_units)||0}})}
