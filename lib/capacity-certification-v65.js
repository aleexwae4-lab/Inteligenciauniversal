import { createHash } from 'node:crypto';

export const CAPACITY_CERTIFICATION_VERSION='capacity-certification/v65';
export const CAPACITY_POLICY_VERSION='capacity-slo/v1';
export const CAPACITY_TARGET_SUBSCRIBERS=20_000;
export const CAPACITY_TARGET_CONCURRENCY=512;

export const CAPACITY_STAGES=Object.freeze([
  Object.freeze({id:'canary',order:1,minConcurrency:4,minRequests:40,minDurationSeconds:20,minSuccessRate:0.99,maxErrorRate:0.01,maxP95Ms:12_000,maxP99Ms:24_000}),
  Object.freeze({id:'standard',order:2,minConcurrency:16,minRequests:200,minDurationSeconds:45,minSuccessRate:0.99,maxErrorRate:0.01,maxP95Ms:15_000,maxP99Ms:30_000}),
  Object.freeze({id:'scale',order:3,minConcurrency:64,minRequests:1_000,minDurationSeconds:90,minSuccessRate:0.995,maxErrorRate:0.005,maxP95Ms:18_000,maxP99Ms:32_000}),
  Object.freeze({id:'peak',order:4,minConcurrency:512,minRequests:5_000,minDurationSeconds:180,minSuccessRate:0.995,maxErrorRate:0.005,maxP95Ms:18_000,maxP99Ms:32_000})
]);

const STAGE_MAP=new Map(CAPACITY_STAGES.map(stage=>[stage.id,stage]));
const BRIDGE_TIMEOUT_MS=Math.max(300,Number(process.env.WAE_CAPACITY_BRIDGE_TIMEOUT_MS||900));

function num(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback}
function clamp01(value){return Math.max(0,Math.min(1,num(value,0)))}
function text(value,max=120){return String(value??'').slice(0,max)}
function bridgeConfigured(){return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_PUBLISHABLE_KEY&&process.env.WAE_RUNTIME_BRIDGE_TOKEN)}
function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
function sha256(value){return createHash('sha256').update(String(value)).digest('hex')}

export function architectureEvidenceForPrincipals({subscriberSamples=20_000,shardCounts=[]}={}){
  const counts=Array.isArray(shardCounts)?shardCounts.map(v=>Math.max(0,Math.trunc(num(v,0)))):[];
  return {
    subscriberSamples:Math.max(0,Math.trunc(num(subscriberSamples,0))),
    admissionShards:counts.length,
    allShardsUsed:counts.length===64&&counts.every(v=>v>0),
    minShard:counts.length?Math.min(...counts):0,
    maxShard:counts.length?Math.max(...counts):0,
    totalAssigned:counts.reduce((sum,v)=>sum+v,0)
  };
}

export function evaluateArchitectureEvidence(input={}){
  const evidence={
    subscriberSamples:Math.max(0,Math.trunc(num(input.subscriberSamples,0))),
    admissionShards:Math.max(0,Math.trunc(num(input.admissionShards,0))),
    allShardsUsed:input.allShardsUsed===true,
    minShard:Math.max(0,Math.trunc(num(input.minShard,0))),
    maxShard:Math.max(0,Math.trunc(num(input.maxShard,0))),
    totalAssigned:Math.max(0,Math.trunc(num(input.totalAssigned,input.subscriberSamples)))
  };
  const checks={
    subscriberTarget:evidence.subscriberSamples>=CAPACITY_TARGET_SUBSCRIBERS,
    shardCount:evidence.admissionShards===64,
    allShardsUsed:evidence.allShardsUsed,
    balancedFloor:evidence.minShard>=230,
    balancedCeiling:evidence.maxShard<400,
    assignmentIntegrity:evidence.totalAssigned===evidence.subscriberSamples
  };
  return{pass:Object.values(checks).every(Boolean),checks,evidence};
}

export function evaluateCapacityStage(input={}){
  const id=text(input.id||input.stage,24).toLowerCase();
  const policy=STAGE_MAP.get(id);
  if(!policy)return{id,pass:false,error:'unknown_capacity_stage'};
  const measured={
    concurrency:Math.max(0,Math.trunc(num(input.concurrency,0))),
    requests:Math.max(0,Math.trunc(num(input.requests,0))),
    durationSeconds:Math.max(0,num(input.durationSeconds,0)),
    successRate:clamp01(input.successRate),
    errorRate:clamp01(input.errorRate),
    p95Ms:Math.max(0,num(input.p95Ms,0)),
    p99Ms:Math.max(0,num(input.p99Ms,0)),
    lifecycleFalseFailureRate:clamp01(input.lifecycleFalseFailureRate),
    overloadReplayViolations:Math.max(0,Math.trunc(num(input.overloadReplayViolations,0))),
    unexpected5xx:Math.max(0,Math.trunc(num(input.unexpected5xx,0)))
  };
  const checks={
    concurrency:measured.concurrency>=policy.minConcurrency,
    requests:measured.requests>=policy.minRequests,
    duration:measured.durationSeconds>=policy.minDurationSeconds,
    successRate:measured.successRate>=policy.minSuccessRate,
    errorRate:measured.errorRate<=policy.maxErrorRate,
    p95:measured.p95Ms>0&&measured.p95Ms<=policy.maxP95Ms,
    p99:measured.p99Ms>0&&measured.p99Ms<=policy.maxP99Ms,
    lifecycleIntegrity:measured.lifecycleFalseFailureRate===0,
    overloadSafety:measured.overloadReplayViolations===0,
    unexpected5xx:measured.unexpected5xx===0
  };
  return{id,order:policy.order,pass:Object.values(checks).every(Boolean),policy,measured,checks};
}

export function capacityEvidenceFingerprint(evidence={}){
  const sanitized={
    architecture:evidence.architecture||{},
    stages:(Array.isArray(evidence.stages)?evidence.stages:[]).map(row=>({
      id:text(row.id||row.stage,24).toLowerCase(),
      concurrency:num(row.concurrency),requests:num(row.requests),durationSeconds:num(row.durationSeconds),
      successRate:num(row.successRate),errorRate:num(row.errorRate),p95Ms:num(row.p95Ms),p99Ms:num(row.p99Ms),
      lifecycleFalseFailureRate:num(row.lifecycleFalseFailureRate),overloadReplayViolations:num(row.overloadReplayViolations),unexpected5xx:num(row.unexpected5xx)
    })),
    environment:text(evidence.environment||'unknown',40),
    commit:text(evidence.commit||'',64)
  };
  return sha256(JSON.stringify(stable(sanitized)));
}

export function certifyCapacityEvidence(evidence={},options={}){
  const architecture=evaluateArchitectureEvidence(evidence.architecture||{});
  const rows=(Array.isArray(evidence.stages)?evidence.stages:[]).map(evaluateCapacityStage);
  const byId=new Map(rows.map(row=>[row.id,row]));
  let highest='none';
  let sequential=true;
  for(const stage of CAPACITY_STAGES){
    const result=byId.get(stage.id);
    if(!result?.pass){sequential=false;break}
    highest=stage.id;
  }
  const peakThresholdsPass=architecture.pass&&sequential&&highest==='peak';
  const trusted=options.trusted===true;
  const certificationVerdict=peakThresholdsPass&&trusted?'PRODUCTION_PEAK_CERTIFIED':'NOT_CERTIFIED';
  const technicalVerdict=!architecture.pass?'ARCHITECTURE_EVIDENCE_FAILED':peakThresholdsPass?'PEAK_THRESHOLDS_PASS':highest==='none'?'ARCHITECTURE_READY_NOT_LOAD_CERTIFIED':`PARTIAL_${highest.toUpperCase()}_PASS`;
  return{
    version:CAPACITY_CERTIFICATION_VERSION,
    policyVersion:CAPACITY_POLICY_VERSION,
    subscriberTarget:CAPACITY_TARGET_SUBSCRIBERS,
    concurrencyTarget:CAPACITY_TARGET_CONCURRENCY,
    architecture,
    stages:rows,
    highestPassedStage:highest,
    allRequiredStagesPass:peakThresholdsPass,
    trusted,
    technicalVerdict,
    certificationVerdict,
    currentInfrastructureLoadCertified:peakThresholdsPass&&trusted,
    claimEligible:peakThresholdsPass&&trusted,
    evidenceHash:capacityEvidenceFingerprint(evidence),
    claimPolicy:'20k subscribers describes the software target; production capacity is certified only after all staged load gates pass with trusted evidence'
  };
}

export function capacityAutopilotDecision(metrics={}){
  const active=Math.max(0,num(metrics.active,0));
  const target=Math.max(1,num(metrics.target,CAPACITY_TARGET_CONCURRENCY));
  const utilization=Math.max(0,active/target);
  const p95Ms=Math.max(0,num(metrics.p95Ms,0));
  const errorRate=clamp01(metrics.errorRate);
  let mode='NORMAL';
  if(utilization>=0.95||errorRate>=0.08)mode='SHED';
  else if(utilization>=0.82||p95Ms>=18_000||errorRate>=0.04)mode='DEGRADE';
  else if(utilization>=0.65||p95Ms>=12_000||errorRate>=0.02)mode='THROTTLE';
  const policy={
    NORMAL:{allowNewExpensiveWork:true,maxSpecialists:3,retryAfterSeconds:0},
    THROTTLE:{allowNewExpensiveWork:true,maxSpecialists:2,retryAfterSeconds:1},
    DEGRADE:{allowNewExpensiveWork:true,maxSpecialists:1,retryAfterSeconds:2},
    SHED:{allowNewExpensiveWork:false,maxSpecialists:1,retryAfterSeconds:3}
  }[mode];
  return{version:CAPACITY_CERTIFICATION_VERSION,mode,utilization:Number(utilization.toFixed(4)),active,target,p95Ms,errorRate,...policy};
}

async function callCapacityBridge(action,payload={}){
  if(!bridgeConfigured())return{ok:false,unconfigured:true,error:'capacity_bridge_unconfigured'};
  const base=String(process.env.SUPABASE_URL).replace(/\/$/,'');
  try{
    const response=await fetch(`${base}/rest/v1/rpc/wae_capacity_control_bridge_v65`,{
      method:'POST',
      headers:{'content-type':'application/json',apikey:String(process.env.SUPABASE_PUBLISHABLE_KEY),'x-client-info':'wae-universal-core-v65'},
      body:JSON.stringify({p_action:action,p_payload:payload,p_token:String(process.env.WAE_RUNTIME_BRIDGE_TOKEN)}),
      signal:AbortSignal.timeout(BRIDGE_TIMEOUT_MS)
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok)return{ok:false,error:'capacity_bridge_rejected',status:response.status};
    return data&&typeof data==='object'?data:{ok:false,error:'capacity_bridge_invalid_payload'};
  }catch(error){return{ok:false,error:'capacity_bridge_unavailable',detail:text(error?.message,120)}}
}

export async function latestTrustedCapacityCertification(){return callCapacityBridge('latest',{})}

export async function recordTrustedCapacityCertification(result={}){
  if(result?.claimEligible!==true||result?.certificationVerdict!=='PRODUCTION_PEAK_CERTIFIED')return{ok:false,error:'capacity_certification_not_eligible'};
  const peak=(Array.isArray(result.stages)?result.stages:[]).find(row=>row.id==='peak');
  return callCapacityBridge('record',{
    version:CAPACITY_CERTIFICATION_VERSION,policyVersion:CAPACITY_POLICY_VERSION,evidenceHash:text(result.evidenceHash,64),
    verdict:result.certificationVerdict,concurrency:peak?.measured?.concurrency,requests:peak?.measured?.requests,
    successRate:peak?.measured?.successRate,errorRate:peak?.measured?.errorRate,p95Ms:peak?.measured?.p95Ms,p99Ms:peak?.measured?.p99Ms,
    lifecycleFalseFailureRate:peak?.measured?.lifecycleFalseFailureRate,overloadReplayViolations:peak?.measured?.overloadReplayViolations,
    allStagesPass:result.allRequiredStagesPass===true
  });
}

export function capacityCertificationCapabilities(){return{
  version:CAPACITY_CERTIFICATION_VERSION,
  policyVersion:CAPACITY_POLICY_VERSION,
  subscriberTarget:CAPACITY_TARGET_SUBSCRIBERS,
  concurrencyTarget:CAPACITY_TARGET_CONCURRENCY,
  stagedCertification:true,
  trustedEvidenceRequired:true,
  currentInfrastructureLoadCertified:false,
  storesPromptContent:false,
  storesResponseContent:false,
  stages:CAPACITY_STAGES,
  autopilotModes:['NORMAL','THROTTLE','DEGRADE','SHED']
}}
