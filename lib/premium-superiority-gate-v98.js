export const PREMIUM_SUPERIORITY_GATE_V98='premium-superiority-gate/v98';
export const PREMIUM_REQUIRED_CASES=64;
export const PREMIUM_DEFAULT_REFERENCE='openai:gpt-6-astra';

const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const clean=(value,max=180)=>String(value??'').trim().slice(0,max);
const arr=value=>Array.isArray(value)?value:[];
const round=(value,digits=2)=>finite(value)?Number(Number(value).toFixed(digits)):null;

function percentile(values,q){
  const sorted=arr(values).map(Number).filter(Number.isFinite).filter(value=>value>=0).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const index=Math.max(0,Math.min(sorted.length-1,Math.ceil(q*sorted.length)-1));
  return sorted[index];
}

function candidate(entry,id){
  return arr(entry?.candidates).find(item=>clean(item?.id,160)===clean(id,160))||null;
}

export function pairedPerformanceV98({entries=[],targetId='universal_core',referenceId=''}={}){
  const targetLatencies=[];
  const referenceLatencies=[];
  let paired=0;
  let missingTarget=0;
  let missingReference=0;
  let invalidTargetLatency=0;
  let invalidReferenceLatency=0;

  for(const entry of arr(entries)){
    const target=candidate(entry,targetId);
    const reference=candidate(entry,referenceId);
    if(!target){missingTarget++;continue;}
    if(!reference){missingReference++;continue;}
    paired++;
    if(finite(target.latencyMs)&&Number(target.latencyMs)>=0)targetLatencies.push(Number(target.latencyMs));
    else invalidTargetLatency++;
    if(finite(reference.latencyMs)&&Number(reference.latencyMs)>=0)referenceLatencies.push(Number(reference.latencyMs));
    else invalidReferenceLatency++;
  }

  const target={
    samples:targetLatencies.length,
    p50_ms:round(percentile(targetLatencies,.50)),
    p95_ms:round(percentile(targetLatencies,.95)),
    p99_ms:round(percentile(targetLatencies,.99)),
    max_ms:targetLatencies.length?round(Math.max(...targetLatencies)):null,
  };
  const reference={
    samples:referenceLatencies.length,
    p50_ms:round(percentile(referenceLatencies,.50)),
    p95_ms:round(percentile(referenceLatencies,.95)),
    p99_ms:round(percentile(referenceLatencies,.99)),
    max_ms:referenceLatencies.length?round(Math.max(...referenceLatencies)):null,
  };
  return{
    version:PREMIUM_SUPERIORITY_GATE_V98,
    paired,
    missingTarget,
    missingReference,
    invalidTargetLatency,
    invalidReferenceLatency,
    target,
    reference,
    deltas:{
      p50_ms:finite(target.p50_ms)&&finite(reference.p50_ms)?round(target.p50_ms-reference.p50_ms):null,
      p95_ms:finite(target.p95_ms)&&finite(reference.p95_ms)?round(target.p95_ms-reference.p95_ms):null,
      p99_ms:finite(target.p99_ms)&&finite(reference.p99_ms)?round(target.p99_ms-reference.p99_ms):null,
    }
  };
}

export function premiumSuperiorityGateV98({
  certification={},
  entries=[],
  targetId='universal_core',
  referenceId='',
  exactReferenceId=process.env.WAE_PREMIUM_REFERENCE_ID||PREMIUM_DEFAULT_REFERENCE,
  regressionStatus=null,
}={}){
  const base=certification?.baseCertification&&typeof certification.baseCertification==='object'?certification.baseCertification:{};
  const effectiveReference=clean(referenceId||certification?.referenceId,160).toLowerCase();
  const expectedReference=clean(exactReferenceId||PREMIUM_DEFAULT_REFERENCE,160).toLowerCase();
  const performance=pairedPerformanceV98({entries,targetId,referenceId:effectiveReference});
  const aggregate=base?.aggregate&&typeof base.aggregate==='object'?base.aggregate:{};
  const metrics=base?.metrics&&typeof base.metrics==='object'?base.metrics:{};
  const regressions=regressionStatus&&typeof regressionStatus==='object'?regressionStatus:null;

  const complete64=Number(certification?.evaluatedCases)===PREMIUM_REQUIRED_CASES&&Number(base?.evaluatedCases)===PREMIUM_REQUIRED_CASES&&performance.paired===PREMIUM_REQUIRED_CASES;
  const exactReference=Boolean(effectiveReference&&effectiveReference===expectedReference);
  const signedProvenance=certification?.gates?.provenance===true&&arr(certification?.invalid).length===0;
  const qualityCertification=certification?.claimAllowed===true&&base?.claimAllowed===true;
  const zeroCriticalFailures=Number(aggregate?.criticalFailureRate||0)===0;
  const targetScore=finite(metrics?.targetMeanScore)?Number(metrics.targetMeanScore):null;
  const referenceScore=finite(metrics?.referenceMeanScore)?Number(metrics.referenceMeanScore):null;
  const scoreAdvantage=targetScore!==null&&referenceScore!==null&&targetScore>referenceScore;
  const latencyCoverage=performance.target.samples===PREMIUM_REQUIRED_CASES&&performance.reference.samples===PREMIUM_REQUIRED_CASES&&performance.invalidTargetLatency===0&&performance.invalidReferenceLatency===0;
  const p95NonInferior=latencyCoverage&&finite(performance.target.p95_ms)&&finite(performance.reference.p95_ms)&&performance.target.p95_ms<=performance.reference.p95_ms;
  const p99Controlled=latencyCoverage&&finite(performance.target.p99_ms)&&finite(performance.reference.p99_ms)&&performance.target.p99_ms<=performance.reference.p99_ms*1.05;
  const regressionEvidence=Boolean(regressions);
  const noCriticalRegressions=regressionEvidence&&Number(regressions?.critical_open??regressions?.criticalOpen??Infinity)===0;
  const noHighRegressions=regressionEvidence&&Number(regressions?.high_open??regressions?.highOpen??Infinity)===0;
  const releasePass=regressionEvidence&&String(regressions?.release_gate??regressions?.releaseGate??'').toUpperCase()==='PASS';

  const gates={
    complete64,
    exactReference,
    signedProvenance,
    qualityCertification,
    zeroCriticalFailures,
    scoreAdvantage,
    latencyCoverage,
    p95NonInferior,
    p99Controlled,
    regressionEvidence,
    noCriticalRegressions,
    noHighRegressions,
    releasePass,
  };
  const certified=Object.values(gates).every(Boolean);
  const failed=Object.entries(gates).filter(([,value])=>!value).map(([key])=>key);

  return{
    version:PREMIUM_SUPERIORITY_GATE_V98,
    state:certified?'CERTIFIED':'HOLD',
    certified,
    targetId:clean(targetId,160),
    referenceId:effectiveReference||null,
    expectedReferenceId:expectedReference,
    gates,
    failed,
    performance,
    quality:{
      targetMeanScore:round(targetScore,4),
      referenceMeanScore:round(referenceScore,4),
      adjustedWinRate:finite(aggregate?.adjustedWinRate)?round(aggregate.adjustedWinRate,4):null,
      criticalFailureRate:finite(aggregate?.criticalFailureRate)?round(aggregate.criticalFailureRate,4):null,
    },
    claimAuthorization:{
      allowed:certified,
      scope:certified?`Measured premium benchmark advantage over ${effectiveReference} on the complete signed 64-case verified arena, including quality and latency non-regression gates. This is benchmark-scoped evidence, not a universal claim.`:'No premium superiority claim authorized.',
    },
    policy:{
      requiredCases:PREMIUM_REQUIRED_CASES,
      exactReferenceRequired:true,
      signedRuntimeProvenanceRequired:true,
      v72v93QualityCertificationRequired:true,
      criticalFailuresAllowed:0,
      p95MustNotExceedReference:true,
      p99MaxRegressionPct:5,
      criticalOpenRegressionsAllowed:0,
      highOpenRegressionsAllowed:0,
      globalNumberOneClaimAllowed:false,
      benchmarkScopedClaimsOnly:true,
      rawPromptPersistence:false,
      rawAnswerPersistence:false,
      chainOfThoughtPersistence:false,
    }
  };
}

export function premiumSuperiorityCapabilitiesV98(){
  return{
    version:PREMIUM_SUPERIORITY_GATE_V98,
    requiredCases:PREMIUM_REQUIRED_CASES,
    defaultExactReference:PREMIUM_DEFAULT_REFERENCE,
    qualityArena:'verified-gpt-arena/v93 + universal-adversarial-evidence/v72',
    performanceGates:['paired_latency_coverage','p95_non_inferiority','p99_max_5pct_regression'],
    regressionGates:['zero_critical_open','zero_high_open','release_gate_pass'],
    claimPolicy:'benchmark_scoped_only',
    globalNumberOneClaimAllowed:false,
  };
}
