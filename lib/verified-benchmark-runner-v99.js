import { createHash } from 'node:crypto';

export const VERIFIED_BENCHMARK_RUNNER_V99='verified-benchmark-runner/v99';
export const VERIFIED_BENCHMARK_REQUIRED_CASES=64;

const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const finite=value=>Number.isFinite(Number(value));
const sha256=value=>createHash('sha256').update(String(value??'')).digest('hex');
const isHash=value=>/^[a-f0-9]{64}$/i.test(clean(value,128));
const asArray=value=>Array.isArray(value)?value:[];

export function validateSuiteV99(suite=[]){
  const rows=asArray(suite);
  const ids=new Set();
  const duplicateIds=[];
  const invalid=[];
  for(const item of rows){
    const id=clean(item?.id,120);
    const promptHash=clean(item?.promptHash,128).toLowerCase();
    if(!id||!isHash(promptHash))invalid.push({id:id||null,reason:!id?'missing_case_id':'invalid_prompt_hash'});
    if(ids.has(id))duplicateIds.push(id);
    ids.add(id);
  }
  const exactCount=rows.length===VERIFIED_BENCHMARK_REQUIRED_CASES;
  const uniqueCount=ids.size===VERIFIED_BENCHMARK_REQUIRED_CASES;
  return{
    version:VERIFIED_BENCHMARK_RUNNER_V99,
    ok:Boolean(exactCount&&uniqueCount&&duplicateIds.length===0&&invalid.length===0),
    exactCount,
    uniqueCount,
    count:rows.length,
    duplicateIds,
    invalid,
  };
}

function candidateFor(entry,id){
  const expected=clean(id,160).toLowerCase();
  return asArray(entry?.candidates).find(candidate=>clean(candidate?.id,160).toLowerCase()===expected)||null;
}

function attestationValid(candidate,caseId,promptHash){
  const att=candidate?.attestation&&typeof candidate.attestation==='object'?candidate.attestation:null;
  if(!att||att.signed!==true)return false;
  if(clean(att.caseId,120)&&clean(att.caseId,120)!==caseId)return false;
  if(clean(att.promptHash,128)&&clean(att.promptHash,128).toLowerCase()!==promptHash)return false;
  return Boolean(clean(att.signature||att.signatureHash||att.digest,600)||clean(att.responseId||att.requestId,240));
}

export function validateAttestedEntriesV99({entries=[],suite=[],targetId='universal_core',referenceId=''}={}){
  const suiteCheck=validateSuiteV99(suite);
  const target=clean(targetId,160).toLowerCase();
  const reference=clean(referenceId,160).toLowerCase();
  const suiteMap=new Map(asArray(suite).map(item=>[clean(item?.id,120),clean(item?.promptHash,128).toLowerCase()]));
  const seen=new Set();
  const invalid=[];

  for(const entry of asArray(entries)){
    const caseId=clean(entry?.caseId,120);
    const promptHash=clean(entry?.promptHash,128).toLowerCase();
    if(!suiteMap.has(caseId)){invalid.push({caseId:caseId||null,reason:'unknown_case'});continue;}
    if(seen.has(caseId)){invalid.push({caseId,reason:'duplicate_case'});continue;}
    seen.add(caseId);
    if(promptHash!==suiteMap.get(caseId)){invalid.push({caseId,reason:'prompt_hash_mismatch'});continue;}
    const targetCandidate=candidateFor(entry,target);
    const referenceCandidate=candidateFor(entry,reference);
    if(!targetCandidate||!referenceCandidate){invalid.push({caseId,reason:'missing_target_or_reference'});continue;}
    if(!clean(targetCandidate.answer??targetCandidate.text,80_000)){invalid.push({caseId,reason:'empty_target_answer'});continue;}
    if(!clean(referenceCandidate.answer??referenceCandidate.text,80_000)){invalid.push({caseId,reason:'empty_reference_answer'});continue;}
    if(!finite(targetCandidate.latencyMs)||Number(targetCandidate.latencyMs)<0){invalid.push({caseId,reason:'invalid_target_latency'});continue;}
    if(!finite(referenceCandidate.latencyMs)||Number(referenceCandidate.latencyMs)<0){invalid.push({caseId,reason:'invalid_reference_latency'});continue;}
    if(!attestationValid(targetCandidate,caseId,promptHash)){invalid.push({caseId,reason:'invalid_target_attestation'});continue;}
    if(!attestationValid(referenceCandidate,caseId,promptHash)){invalid.push({caseId,reason:'invalid_reference_attestation'});continue;}
  }

  const complete=asArray(entries).length===VERIFIED_BENCHMARK_REQUIRED_CASES&&seen.size===VERIFIED_BENCHMARK_REQUIRED_CASES;
  return{
    version:VERIFIED_BENCHMARK_RUNNER_V99,
    ok:Boolean(suiteCheck.ok&&complete&&invalid.length===0&&target&&reference&&target!==reference),
    complete,
    count:asArray(entries).length,
    uniqueCases:seen.size,
    targetId:target,
    referenceId:reference,
    invalid,
    suite:suiteCheck,
  };
}

export function readinessGateV99({arenaStatus={},premiumStatus={},expectedReferenceId='openai:gpt-6-astra'}={}){
  const expected=clean(expectedReferenceId,160).toLowerCase();
  const arenaReference=clean(arenaStatus?.comparator?.referenceId,160).toLowerCase();
  const premiumReference=clean(premiumStatus?.readiness?.expectedReferenceId,160).toLowerCase();
  const checks={
    arenaReachable:arenaStatus?.success===true,
    premiumReachable:premiumStatus?.success===true,
    comparatorExecutable:arenaStatus?.comparator?.executable===true,
    exactReference:arenaReference===expected&&premiumReference===expected,
    signedAttestation:arenaStatus?.attestation?.configured===true&&premiumStatus?.readiness?.signedAttestationReady===true,
    trustedRuntimeOnly:arenaStatus?.policy?.candidateExecutionMustOccurInsideTrustedRuntime===true,
    simulatedReferenceForbidden:arenaStatus?.policy?.simulatedGptForbidden===true,
  };
  return{
    version:VERIFIED_BENCHMARK_RUNNER_V99,
    ready:Object.values(checks).every(Boolean),
    checks,
    expectedReferenceId:expected,
    observedReferenceId:arenaReference||null,
  };
}

function compactQuality(source={}){
  const base=source?.baseCertification&&typeof source.baseCertification==='object'?source.baseCertification:{};
  return{
    version:clean(source?.version,120)||null,
    evaluatedCases:Number(source?.evaluatedCases)||0,
    verdict:clean(source?.verdict,160)||'NOT_PROVEN',
    claimAllowed:source?.claimAllowed===true,
    gates:source?.gates&&typeof source.gates==='object'?source.gates:{},
    aggregate:base?.aggregate&&typeof base.aggregate==='object'?base.aggregate:(source?.aggregate&&typeof source.aggregate==='object'?source.aggregate:{}),
    metrics:base?.metrics&&typeof base.metrics==='object'?base.metrics:(source?.metrics&&typeof source.metrics==='object'?source.metrics:{}),
  };
}

export function buildPublicEvidenceV99({
  suiteHash='',targetId='universal_core',referenceId='',commitSha='',startedAt='',completedAt='',
  arenaResult={},premiumResult={},entryValidation={},readiness={},executionSummary={}
}={}){
  const quality=compactQuality(arenaResult?.certification||arenaResult?.qualityCertification||{});
  const premium=arenaResult?.premiumCertification||premiumResult?.premiumCertification||{};
  const training=arenaResult?.training&&typeof arenaResult.training==='object'?arenaResult.training:{};
  const evidence={
    schema:'universal-core-verified-benchmark-public-evidence/v1',
    version:VERIFIED_BENCHMARK_RUNNER_V99,
    generatedAt:new Date().toISOString(),
    startedAt:clean(startedAt,80)||null,
    completedAt:clean(completedAt,80)||null,
    suite:{hash:clean(suiteHash,128).toLowerCase()||null,requiredCases:VERIFIED_BENCHMARK_REQUIRED_CASES,executedCases:Number(executionSummary?.executedCases)||0},
    target:{id:clean(targetId,160).toLowerCase(),commitSha:clean(commitSha,80)||null},
    reference:{id:clean(referenceId,160).toLowerCase()},
    readiness,
    validation:{ok:entryValidation?.ok===true,complete:entryValidation?.complete===true,count:Number(entryValidation?.count)||0,uniqueCases:Number(entryValidation?.uniqueCases)||0,invalidCount:asArray(entryValidation?.invalid).length},
    quality,
    training:{
      version:clean(training?.version,120)||null,
      mode:clean(training?.mode,160)||null,
      counts:training?.counts&&typeof training.counts==='object'?training.counts:{},
      promotionBlocked:training?.promotionBlocked===true,
      baseModelWeightsChanged:training?.baseModelWeightsChanged===true,
    },
    premium:{
      version:clean(premium?.version,120)||null,
      verdict:clean(premium?.verdict,160)||'NOT_PROVEN',
      claimAllowed:premium?.claimAllowed===true,
      gates:premium?.gates&&typeof premium.gates==='object'?premium.gates:{},
    },
    claimAuthorization:{
      allowed:premiumResult?.claimAuthorization?.allowed===true,
      scope:clean(premiumResult?.claimAuthorization?.scope||arenaResult?.claimAuthorization?.scope||'No superiority claim authorized.',500),
      globalNumberOneClaimAllowed:false,
      benchmarkScopedOnly:true,
    },
    execution:{
      executedCases:Number(executionSummary?.executedCases)||0,
      targetLatencyMs:executionSummary?.targetLatencyMs&&typeof executionSummary.targetLatencyMs==='object'?executionSummary.targetLatencyMs:{},
      referenceLatencyMs:executionSummary?.referenceLatencyMs&&typeof executionSummary.referenceLatencyMs==='object'?executionSummary.referenceLatencyMs:{},
      failedCases:Number(executionSummary?.failedCases)||0,
    },
    privacy:{rawPromptsPersisted:false,rawAnswersPersisted:false,chainOfThoughtPersisted:false,secretsPersisted:false},
  };
  const canonical=JSON.stringify(evidence);
  return{...evidence,evidenceDigest:`sha256:${sha256(canonical)}`};
}

export function publicEvidenceIsSanitizedV99(value){
  const json=JSON.stringify(value??{}).toLowerCase();
  const forbidden=['"answer":','"prompt":','chainofthought','api_key','authorization":"bearer','x-wae-worker-token'];
  return forbidden.every(token=>!json.includes(token));
}
