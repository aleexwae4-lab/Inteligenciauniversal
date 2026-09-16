import { createHash } from 'node:crypto';
import { callInternalSupabaseRpc, internalSupabaseTransportState } from './internal-supabase-rpc-v74.js';

export const SCALE_CONTROL_VERSION='universal-runtime-control/v63';
export const SCALE_TARGET_SUBSCRIBERS=20_000;
export const SCALE_ADMISSION_SHARDS=64;
export const DEFAULT_DISTRIBUTED_CONCURRENCY=512;

const SNAPSHOT_TTL_MS=Math.max(5_000,Number(process.env.WAE_ROUTER_PERSISTENT_TTL_MS||30_000));
const BRIDGE_TIMEOUT_MS=Math.max(250,Number(process.env.WAE_RUNTIME_BRIDGE_TIMEOUT_MS||900));
const OBSERVE_TIMEOUT_MS=Math.max(150,Number(process.env.WAE_RUNTIME_OBSERVE_TIMEOUT_MS||450));
const PER_MINUTE=Math.max(1,Number(process.env.WAE_DISTRIBUTED_RATE_PER_MINUTE||30));
const GLOBAL_CONCURRENT=Math.max(64,Number(process.env.WAE_DISTRIBUTED_CHAT_CONCURRENCY_TARGET||DEFAULT_DISTRIBUTED_CONCURRENCY));
const LEASE_SECONDS=Math.min(120,Math.max(15,Number(process.env.WAE_DISTRIBUTED_LEASE_SECONDS||45)));

const snapshotCache=new Map();
const snapshotInflight=new Map();

function text(value,max=240){return String(value??'').slice(0,max)}
function configured(){return internalSupabaseTransportState().configured&&Boolean(process.env.WAE_RUNTIME_BRIDGE_TOKEN)}

export function hashScalePrincipal(value='anonymous'){
  return createHash('sha256').update(String(value||'anonymous')).digest('hex');
}

export function admissionShardForHash(hash=''){
  const normalized=/^[a-f0-9]{64}$/i.test(String(hash))?String(hash).toLowerCase():hashScalePrincipal(hash);
  return Number.parseInt(normalized.slice(0,8),16)%SCALE_ADMISSION_SHARDS;
}

async function callBridge(action,payload={},timeoutMs=BRIDGE_TIMEOUT_MS){
  if(!configured())return{ok:false,unconfigured:true,error:'runtime_bridge_unconfigured'};
  const result=await callInternalSupabaseRpc({
    functionName:'wae_runtime_control_bridge_v63',
    body:{p_action:action,p_payload:payload,p_token:String(process.env.WAE_RUNTIME_BRIDGE_TOKEN)},
    timeoutMs,
    clientInfo:'wae-universal-core-v74-runtime-control'
  });
  if(!result.ok)return{ok:false,error:result.error||'runtime_bridge_unavailable',status:result.status,detail:text(result.detail,120),transportMode:result.mode};
  const data=result.payload;
  if(data&&typeof data==='object')return{...data,transportMode:result.mode};
  return{ok:false,error:'runtime_bridge_invalid_payload',transportMode:result.mode};
}

export function scaleAdmissionNeeded(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  if(body.web_enabled===true||['research','analysis','code','design','executive'].includes(mode))return true;
  if(Array.isArray(body.attachments)&&body.attachments.length)return true;
  const q=String(body.message||body.task||'').trim();
  if(!q)return false;
  if(q.length<=48&&/^(hola|hey|buenas|gracias|ok|vale|perfecto|listo|quien eres|que eres|que puedes hacer)[.!?¿¡ ]*$/i.test(q))return false;
  return true;
}

export async function distributedAdmission({principal='anonymous',session='',tenant='',body={}}={}){
  if(!scaleAdmissionNeeded(body))return{applied:false,allowed:true,mode:'fast_path_bypass'};
  if(!configured())return{applied:false,allowed:true,mode:'local_only',reason:'bridge_unconfigured'};
  const principalHash=hashScalePrincipal(principal);
  const sessionHash=hashScalePrincipal(session||principal);
  const tenantHash=tenant?hashScalePrincipal(tenant):'';
  const shard=admissionShardForHash(principalHash);
  const result=await callBridge('admit',{principalHash,sessionHash,tenantHash,shard,perMinute:PER_MINUTE,globalConcurrent:GLOBAL_CONCURRENT,leaseSeconds:LEASE_SECONDS});
  if(result?.ok===true)return{applied:true,allowed:result.allowed===true,principalHash,sessionHash,tenantHash,shard,...result};
  const failClosed=String(process.env.WAE_DISTRIBUTED_ADMISSION_FAIL_CLOSED||'0')==='1';
  return{applied:true,allowed:!failClosed,degraded:true,mode:'local_fallback',principalHash,sessionHash,tenantHash,shard,reason:result?.error||'bridge_unavailable'};
}

export async function releaseDistributedAdmission(admission){
  if(!admission?.applied||!admission?.leaseId||!admission?.sessionHash)return{ok:true,skipped:true};
  return callBridge('release',{leaseId:admission.leaseId,sessionHash:admission.sessionHash},Math.min(OBSERVE_TIMEOUT_MS,500));
}

export async function loadPersistentRouterSnapshot({capability='general_reasoning',force=false}={}){
  const normalized=text(capability,40).toLowerCase()||'general_reasoning';
  const now=Date.now();
  const cached=snapshotCache.get(normalized);
  if(!force&&cached?.value&&now-cached.at<SNAPSHOT_TTL_MS)return cached.value;
  if(!force&&snapshotInflight.has(normalized))return snapshotInflight.get(normalized);
  const task=(async()=>{
    const result=await callBridge('snapshot',{capability:normalized,limit:40});
    if(result?.ok===true){snapshotCache.set(normalized,{at:Date.now(),value:result});return result}
    return cached?.value||{ok:false,runtime:[],capabilityReputation:[],error:result?.error||'snapshot_unavailable'};
  })().finally(()=>snapshotInflight.delete(normalized));
  snapshotInflight.set(normalized,task);
  return task;
}

export async function persistProviderObservation(observation={}){
  if(!configured())return{ok:false,unconfigured:true};
  const safe={provider:text(observation.provider,100),model:text(observation.model,240),success:observation.success===true,errorClass:text(observation.errorClass,40),latencyMs:Number.isFinite(Number(observation.latencyMs))?Number(observation.latencyMs):undefined,ttftMs:Number.isFinite(Number(observation.ttftMs))?Number(observation.ttftMs):undefined,quality:Number.isFinite(Number(observation.quality))?Number(observation.quality):undefined,evidence:Number.isFinite(Number(observation.evidence))?Number(observation.evidence):undefined,instruction:Number.isFinite(Number(observation.instruction))?Number(observation.instruction):undefined,qualityGrade:text(observation.qualityGrade,20),costMicrounits:Number.isFinite(Number(observation.costMicrounits))?Number(observation.costMicrounits):undefined};
  if(!safe.provider)return{ok:false,error:'provider_required'};
  const result=await callBridge('observe',safe,OBSERVE_TIMEOUT_MS);
  if(result?.ok===true)for(const entry of snapshotCache.values())entry.at=0;
  return result;
}

export async function runtimeControlHealth(){return callBridge('health',{},BRIDGE_TIMEOUT_MS)}

export function scaleControlCapabilities(){
  const localLimit=Math.max(4,Number(process.env.WAE_MAX_CONCURRENT_CHAT||48));
  const transport=internalSupabaseTransportState();
  return{version:SCALE_CONTROL_VERSION,softwareSubscriberTarget:SCALE_TARGET_SUBSCRIBERS,distributedAdmission:true,admissionShards:SCALE_ADMISSION_SHARDS,distributedConcurrencyTarget:GLOBAL_CONCURRENT,localConcurrencyPerInstance:localLimit,estimatedInstancesForConfiguredPeak:Math.ceil(GLOBAL_CONCURRENT/localLimit),persistentProviderReputation:true,hashedPrincipalsOnly:true,storesPromptContent:false,storesResponseContent:false,horizontalScaleReady:true,internalRpcCredentialMode:transport.credentialMode,leastPrivilegeReady:transport.leastPrivilegeReady,currentInfrastructureLoadCertified:false,certificationPolicy:'20k subscriber readiness is software architecture; production peak capacity requires multi-instance infrastructure and load certification'};
}

export function scaleControlSnapshot(){return{...scaleControlCapabilities(),bridgeConfigured:configured(),snapshotTtlMs:SNAPSHOT_TTL_MS,leaseSeconds:LEASE_SECONDS,distributedRatePerMinute:PER_MINUTE,cachedCapabilities:snapshotCache.size,inflightRefreshes:snapshotInflight.size}}

export function __resetScaleControlForTests(){snapshotCache.clear();snapshotInflight.clear()}
