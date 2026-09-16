export const EVAL_TRAINING_LOOP_V95='eval-training-loop/v95';
export const VERIFIED_ARENA_V93='verified-gpt-arena/v93';
export const REQUIRED_VERIFIED_CASES=64;

const clean=(value,max=200)=>String(value??'').trim().slice(0,max);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const asArray=value=>Array.isArray(value)?value:[];

function severityFromTags(tags=[]){
  const text=asArray(tags).join(' ').toLowerCase();
  if(/safety:|internal_leak|forbidden|prompt[_ -]?injection/.test(text))return'critical';
  if(/assertion:|requirement:|factual|citation|evidence/.test(text))return'high';
  if(/latency|cost|repetition|quality/.test(text))return'medium';
  return'low';
}

function remediationLane(tags=[]){
  const text=asArray(tags).join(' ').toLowerCase();
  if(/safety:|internal_leak|forbidden|prompt[_ -]?injection/.test(text))return'security_factuality_gate';
  if(/citation|evidence|source|research/.test(text))return'retrieval_grounding';
  if(/assertion:|requirement:|format|json|instruction/.test(text))return'instruction_contract';
  if(/latency|timeout|cost/.test(text))return'routing_latency';
  return'response_quality';
}

export function verifiedTrainingReadinessV95(certification={}){
  const base=certification?.baseCertification&&typeof certification.baseCertification==='object'?certification.baseCertification:{};
  const gates=certification?.gates&&typeof certification.gates==='object'?certification.gates:{};
  const evaluated=Math.max(0,Math.trunc(finite(certification?.evaluatedCases)));
  const versionOk=clean(certification?.version,80)===VERIFIED_ARENA_V93;
  const schemaOk=clean(certification?.schema,120)==='verified-paired-benchmark-certification/v1';
  const complete=evaluated===REQUIRED_VERIFIED_CASES;
  const provenance=gates.provenance===true;
  const baseComplete=base?.evaluatedCases===REQUIRED_VERIFIED_CASES&&base?.gates?.fullPairedSuite===true&&asArray(base?.invalid).length===0;
  return{
    version:EVAL_TRAINING_LOOP_V95,
    ready:Boolean(versionOk&&schemaOk&&complete&&provenance&&baseComplete),
    versionOk,schemaOk,complete,provenance,baseComplete,evaluatedCases:evaluated,
    baseModelWeightsChanged:false,
    rawCompetitorAnswersPersisted:false
  };
}

export function buildRegressionCurriculumV95({certification={},entries=[]}={}){
  const readiness=verifiedTrainingReadinessV95(certification);
  if(!readiness.ready)return{version:EVAL_TRAINING_LOOP_V95,ready:false,reason:'verified_64_case_certification_required',items:[],readiness};
  const entryMap=new Map(asArray(entries).map(entry=>[clean(entry?.caseId,120),clean(entry?.promptHash,128)]));
  const regressions=asArray(certification?.baseCertification?.regressions);
  const items=regressions.map(reg=>{
    const caseId=clean(reg?.caseId,120);
    const failureTags=asArray(reg?.failureTags||reg?.requiredRegression).map(tag=>clean(tag,180)).filter(Boolean).slice(0,24);
    return{
      caseId,
      promptHash:entryMap.get(caseId)||null,
      failureTags,
      severity:severityFromTags(failureTags),
      remediationLane:remediationLane(failureTags),
      targetScore:Number.isFinite(Number(reg?.targetScore))?Number(reg.targetScore):null,
      referenceScore:Number.isFinite(Number(reg?.referenceScore))?Number(reg.referenceScore):null,
      persistRawPrompt:false,
      persistRawAnswers:false
    };
  }).filter(item=>item.caseId&&item.promptHash);
  const counts=items.reduce((acc,item)=>{acc[item.severity]=(acc[item.severity]||0)+1;acc.total++;return acc},{total:0,critical:0,high:0,medium:0,low:0});
  return{
    version:EVAL_TRAINING_LOOP_V95,
    ready:true,
    mode:'benchmark_loss_to_regression_curriculum',
    items,
    counts,
    promotionBlocked:counts.critical>0||counts.high>0,
    privacy:{rawPromptPersisted:false,rawAnswersPersisted:false,chainOfThoughtPersisted:false},
    readiness
  };
}

export function promotionDecisionV95({baseline={},candidate={},curriculum={},qualityGate=true,factualityGate=true,securityGate=true}={}){
  const baselineP95=Math.max(0,finite(baseline?.p95_ms));
  const candidateP95=Math.max(0,finite(candidate?.p95_ms,Infinity));
  const baselineError=Math.max(0,finite(baseline?.error_rate));
  const candidateError=Math.max(0,finite(candidate?.error_rate,Infinity));
  const baselineQuality=Math.max(0,finite(baseline?.quality_score));
  const candidateQuality=Math.max(0,finite(candidate?.quality_score));
  const enoughLatencyEvidence=Math.max(0,Math.trunc(finite(candidate?.samples)))>=20&&baselineP95>0&&Number.isFinite(candidateP95);
  const latencyGate=enoughLatencyEvidence&&candidateP95<=baselineP95*.95;
  const errorGate=Number.isFinite(candidateError)&&candidateError<=baselineError;
  const qualityNonRegression=candidateQuality>=baselineQuality;
  const regressionGate=curriculum?.ready===true&&Number(curriculum?.counts?.critical||0)===0&&Number(curriculum?.counts?.high||0)===0;
  const gates={latencyGate,errorGate,qualityNonRegression,qualityGate:qualityGate===true,factualityGate:factualityGate===true,securityGate:securityGate===true,regressionGate};
  const promote=Object.values(gates).every(Boolean);
  return{
    version:EVAL_TRAINING_LOOP_V95,
    promote,
    state:promote?'PROMOTE':'HOLD',
    gates,
    measured:{baselineP95,candidateP95,p95ImprovementPct:baselineP95>0?Number((((baselineP95-candidateP95)/baselineP95)*100).toFixed(2)):null,baselineError,candidateError,baselineQuality,candidateQuality,candidateSamples:Math.max(0,Math.trunc(finite(candidate?.samples)))},
    policy:{minimumSamples:20,minimumP95ImprovementPct:5,errorRateMustNotIncrease:true,qualityMustNotRegress:true,criticalRegressionsAllowed:0,highRegressionsAllowed:0}
  };
}

export function evalTrainingCapabilitiesV95(){
  return{
    version:EVAL_TRAINING_LOOP_V95,
    enabled:true,
    trainingMode:'eval_driven_shadow_training',
    benchmarkLossesBecomeRegressionCases:true,
    exactVerifiedArenaRequired:true,
    requiredCases:REQUIRED_VERIFIED_CASES,
    promotionGate:true,
    latencyRegressionGate:true,
    factualityGate:true,
    securityGate:true,
    baseModelWeightsChanged:false,
    rawPromptPersistence:false,
    rawCompetitorAnswerPersistence:false,
    claimPolicy:{globalNumberOneClaimAllowed:false,benchmarkScopedClaimsOnly:true,externalReferenceMustBeExactAndExecuted:true}
  };
}
