export const RUNTIME_SLO_VERSION='runtime-slo-self-healing/v136';

const providerState=new Map();
const minSamples=Math.max(3,Number(process.env.WAE_SLO_MIN_SAMPLES)||5);
const ttftP95TargetMs=Math.max(1000,Number(process.env.WAE_SLO_TTFT_P95_MS)||8000);
const latencyP95TargetMs=Math.max(5000,Number(process.env.WAE_SLO_LATENCY_P95_MS)||30000);
const minSuccessRate=Math.min(.95,Math.max(.2,Number(process.env.WAE_SLO_MIN_SUCCESS_RATE)||.55));
const maxQualityRejectRate=Math.min(.8,Math.max(.05,Number(process.env.WAE_SLO_MAX_QUALITY_REJECT_RATE)||.35));
const quarantineMs=Math.max(15000,Number(process.env.WAE_SELF_HEAL_QUARANTINE_MS)||90000);
const recoveryGraceMs=Math.max(15000,Number(process.env.WAE_SELF_HEAL_RECOVERY_GRACE_MS)||120000);
const turnLatencyTargetMs=Math.max(3000,Number(process.env.WAE_TURN_SLO_MS)||20000);

function row(id){
  if(!providerState.has(id))providerState.set(id,{
    quarantineUntil:0,probation:false,recoveryGraceUntil:0,
    quarantineCount:0,lastReason:null,lastQuarantinedAt:null,lastRecoveredAt:null
  });
  return providerState.get(id);
}
function rejectRate(metrics={}){
  return Number(metrics.attempts)>0?Number(metrics.qualityRejects||0)/Number(metrics.attempts):0;
}

export function providerSloAssessment(metrics={}){
  const attempts=Number(metrics.attempts)||0;
  if(attempts<minSamples)return{status:'warmup',breached:false,reasons:[],attempts};
  const reasons=[];
  if(Number.isFinite(Number(metrics.successRate))&&Number(metrics.successRate)<minSuccessRate)reasons.push('success_rate');
  if(Number.isFinite(Number(metrics.latencyP95Ms))&&Number(metrics.latencyP95Ms)>latencyP95TargetMs)reasons.push('latency_p95');
  if(Number.isFinite(Number(metrics.ttftP95Ms))&&Number(metrics.ttftP95Ms)>ttftP95TargetMs)reasons.push('ttft_p95');
  if(rejectRate(metrics)>maxQualityRejectRate)reasons.push('quality_reject_rate');
  return{status:reasons.length?'breached':'healthy',breached:reasons.length>0,reasons,attempts};
}

export function selfHealingBeforeAttempt(id,metrics={},now=Date.now()){
  const item=row(id);
  if(item.quarantineUntil>now)return{allowed:false,state:'quarantined',remainingMs:item.quarantineUntil-now,reason:item.lastReason};
  if(item.quarantineUntil&&item.quarantineUntil<=now){
    item.quarantineUntil=0;item.probation=true;
    return{allowed:true,state:'probation',remainingMs:0,reason:item.lastReason};
  }
  if(item.recoveryGraceUntil>now)return{allowed:true,state:'recovery_grace',remainingMs:item.recoveryGraceUntil-now,reason:null};
  const assessment=providerSloAssessment(metrics);
  if(assessment.breached){
    item.quarantineUntil=now+quarantineMs;item.probation=false;item.quarantineCount++;
    item.lastReason=assessment.reasons.join(',');item.lastQuarantinedAt=now;
    return{allowed:false,state:'quarantined',remainingMs:quarantineMs,reason:item.lastReason};
  }
  return{allowed:true,state:assessment.status,remainingMs:0,reason:null};
}

export function selfHealingSuccess(id,now=Date.now()){
  const item=row(id);
  if(item.probation){
    item.probation=false;item.recoveryGraceUntil=now+recoveryGraceMs;item.lastRecoveredAt=now;item.lastReason=null;
    return{state:'recovered',graceMs:recoveryGraceMs};
  }
  return{state:item.recoveryGraceUntil>now?'recovery_grace':'healthy',graceMs:Math.max(0,item.recoveryGraceUntil-now)};
}

export function selfHealingFailure(id,code,now=Date.now()){
  const item=row(id);
  if(item.probation||item.recoveryGraceUntil>now){
    item.probation=false;item.recoveryGraceUntil=0;item.quarantineUntil=now+quarantineMs;
    item.quarantineCount++;item.lastReason=String(code||'provider_failure').slice(0,80);item.lastQuarantinedAt=now;
    return{state:'quarantined',remainingMs:quarantineMs};
  }
  return{state:'observing',remainingMs:0};
}

export function selfHealingSnapshot(providers=[],metrics=[]){
  const now=Date.now();
  return providers.map(provider=>{
    const item=row(provider.id),observed=metrics.find(x=>x.id===provider.id)||{};
    const assessment=providerSloAssessment(observed);
    const state=item.quarantineUntil>now?'quarantined':item.probation?'probation':item.recoveryGraceUntil>now?'recovery_grace':assessment.status;
    return{
      id:provider.id,state,slo:assessment.status,sloReasons:assessment.reasons,
      quarantineCount:item.quarantineCount,
      quarantineRemainingMs:Math.max(0,item.quarantineUntil-now),
      recoveryGraceRemainingMs:Math.max(0,item.recoveryGraceUntil-now),
      lastQuarantinedAt:item.lastQuarantinedAt,lastRecoveredAt:item.lastRecoveredAt
    };
  });
}

export function turnOperationalScore({latencyMs=0,e2e=null,fallbackCount=0}={}){
  let score=100;
  const latency=Math.max(0,Number(latencyMs)||0);
  if(latency>turnLatencyTargetMs)score-=Math.min(25,Math.ceil((latency-turnLatencyTargetMs)/2000)*3);
  const recoveryCount=Math.max(0,Number(e2e?.recoveryCount)||0);
  const failedStageCount=Math.max(0,Number(e2e?.failedStageCount)||0);
  score-=Math.min(24,recoveryCount*6);
  score-=Math.min(36,failedStageCount*18);
  score-=Math.min(20,Math.max(0,Number(fallbackCount)||0)*4);
  score=Math.max(0,Math.min(100,Math.round(score)));
  const grade=score>=90?'excellent':score>=75?'healthy':score>=55?'degraded':'critical';
  const status=failedStageCount?'breached':latency>turnLatencyTargetMs?'breached':recoveryCount||fallbackCount?'recovered':'met';
  return{version:RUNTIME_SLO_VERSION,score,grade,status,latencyMs:latency,targetMs:turnLatencyTargetMs,recoveryCount,failedStageCount,fallbackCount:Number(fallbackCount)||0};
}

export function runtimeSloContract(){
  return{
    version:RUNTIME_SLO_VERSION,
    provider:{
      minSamples,ttftP95TargetMs,latencyP95TargetMs,minSuccessRate,maxQualityRejectRate,
      quarantineMs,recoveryGraceMs
    },
    turn:{latencyTargetMs:turnLatencyTargetMs},
    recovery:'quarantine-probation-grace',
    automatic:true
  };
}
