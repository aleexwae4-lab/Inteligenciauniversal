import { createHash } from 'node:crypto';

export const FRONTIER_QUALITY_TRAINING_V100='frontier-quality-training/v100';
export const FRONTIER_REQUIRED_CASES=64;
export const FRONTIER_DEFAULT_REFERENCE='openai:gpt-6-astra';
export const FRONTIER_MIN_DECISIVE_CASES=32;
export const FRONTIER_MAX_ONE_SIDED_P=.05;
export const FRONTIER_MIN_ADJUSTED_WIN_RATE=.70;
export const FRONTIER_MIN_TARGET_SCORE=.84;
export const FRONTIER_MIN_MEAN_SCORE_DELTA=.02;

const clean=(value,max=240)=>String(value??'').trim().slice(0,max);
const arr=value=>Array.isArray(value)?value:[];
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const round=(value,digits=6)=>finite(value)?Number(Number(value).toFixed(digits)):null;
const sha256=value=>createHash('sha256').update(String(value??'')).digest('hex');
const isHash=value=>/^[a-f0-9]{64}$/i.test(clean(value,128));

function combination(n,k){
  const kk=Math.min(k,n-k);
  let result=1;
  for(let i=1;i<=kk;i++)result=result*(n-kk+i)/i;
  return result;
}

export function binomialUpperTailV100(wins,total,p=.5){
  const n=Math.max(0,Math.trunc(Number(total)||0));
  const k=Math.max(0,Math.trunc(Number(wins)||0));
  const probability=Math.max(0,Math.min(1,Number(p)||0));
  if(!n||k<=0)return 1;
  if(k>n)return 0;
  let sum=0;
  for(let i=k;i<=n;i++)sum+=combination(n,i)*(probability**i)*((1-probability)**(n-i));
  return Math.max(0,Math.min(1,sum));
}

function severityFromTags(tags=[]){
  const text=arr(tags).join(' ').toLowerCase();
  if(/safety:|internal_leak|forbidden|prompt[_ -]?injection|tenant|secret/.test(text))return'critical';
  if(/assertion:|requirement:|factual|citation|evidence|source|hallucin/.test(text))return'high';
  if(/latency|timeout|cost|repetition|quality|format/.test(text))return'medium';
  return'low';
}

function remediationLane(tags=[]){
  const text=arr(tags).join(' ').toLowerCase();
  if(/safety:|internal_leak|forbidden|prompt[_ -]?injection|tenant|secret/.test(text))return'security_and_boundary_control';
  if(/citation|evidence|source|factual|hallucin/.test(text))return'retrieval_and_factual_grounding';
  if(/assertion:|requirement:|format|json|instruction/.test(text))return'instruction_contract';
  if(/latency|timeout|cost/.test(text))return'routing_and_latency';
  return'response_quality';
}

function priorityScore({severity='low',targetScore=null,referenceScore=null}={}){
  const severityWeight={critical:100,high:70,medium:40,low:20}[severity]||20;
  const gap=finite(targetScore)&&finite(referenceScore)?Math.max(0,Number(referenceScore)-Number(targetScore)):0;
  return Math.min(150,Math.round(severityWeight+gap*100));
}

export function buildPremiumCurriculumV100({certification={},entries=[]}={}){
  const base=certification?.baseCertification&&typeof certification.baseCertification==='object'?certification.baseCertification:{};
  const index=new Map(arr(entries).map(entry=>[clean(entry?.caseId,120),clean(entry?.promptHash,128).toLowerCase()]));
  const items=arr(base?.regressions).map(reg=>{
    const caseId=clean(reg?.caseId,120);
    const tags=arr(reg?.failureTags||reg?.requiredRegression).map(tag=>clean(tag,180)).filter(Boolean).slice(0,24);
    const severity=severityFromTags(tags);
    const lane=remediationLane(tags);
    const targetScore=finite(reg?.targetScore)?Number(reg.targetScore):null;
    const referenceScore=finite(reg?.referenceScore)?Number(reg.referenceScore):null;
    return{
      caseId,
      promptHash:index.get(caseId)||null,
      failureTags:tags,
      severity,
      remediationLane:lane,
      priority:priorityScore({severity,targetScore,referenceScore}),
      targetScore,
      referenceScore,
      scoreGap:targetScore!==null&&referenceScore!==null?round(referenceScore-targetScore,4):null,
      persistRawPrompt:false,
      persistRawAnswers:false,
      persistChainOfThought:false,
    };
  }).filter(item=>item.caseId&&isHash(item.promptHash));

  items.sort((a,b)=>b.priority-a.priority||a.caseId.localeCompare(b.caseId));
  const counts={total:items.length,critical:0,high:0,medium:0,low:0};
  const lanes={};
  for(const item of items){
    counts[item.severity]=(counts[item.severity]||0)+1;
    lanes[item.remediationLane]=(lanes[item.remediationLane]||0)+1;
  }

  return{
    version:FRONTIER_QUALITY_TRAINING_V100,
    mode:'verified_loss_to_weighted_remediation_curriculum',
    items,
    counts,
    lanes,
    highestPriority:items[0]?.priority??0,
    criticalHold:counts.critical>0,
    baseModelWeightsChanged:false,
    privacy:{rawPromptPersisted:false,rawAnswersPersisted:false,chainOfThoughtPersisted:false},
  };
}

export function significanceAuditV100(certification={}){
  const base=certification?.baseCertification&&typeof certification.baseCertification==='object'?certification.baseCertification:{};
  const aggregate=base?.aggregate&&typeof base.aggregate==='object'?base.aggregate:{};
  const wins=Math.max(0,Math.trunc(Number(aggregate?.wins)||0));
  const losses=Math.max(0,Math.trunc(Number(aggregate?.losses)||0));
  const ties=Math.max(0,Math.trunc(Number(aggregate?.ties)||0));
  const decisive=wins+losses;
  const pValue=decisive?binomialUpperTailV100(wins,decisive,.5):1;
  const adjustedWinRate=finite(aggregate?.adjustedWinRate)?Number(aggregate.adjustedWinRate):(wins+losses+ties?((wins+.5*ties)/(wins+losses+ties)):0);
  const significant=decisive>=FRONTIER_MIN_DECISIVE_CASES&&wins>losses&&pValue<=FRONTIER_MAX_ONE_SIDED_P;
  return{
    version:FRONTIER_QUALITY_TRAINING_V100,
    wins,losses,ties,decisiveCases:decisive,
    adjustedWinRate:round(adjustedWinRate,6),
    oneSidedBinomialP:round(pValue,10),
    significant,
    thresholds:{minimumDecisiveCases:FRONTIER_MIN_DECISIVE_CASES,maximumOneSidedP:FRONTIER_MAX_ONE_SIDED_P,nullHypothesisWinProbability:.5},
  };
}

function entryIntegrity(entries=[]){
  const rows=arr(entries);
  const ids=new Set();
  let invalid=0;
  for(const entry of rows){
    const id=clean(entry?.caseId,120);
    const promptHash=clean(entry?.promptHash,128).toLowerCase();
    if(!id||!isHash(promptHash)||ids.has(id))invalid++;
    ids.add(id);
  }
  return{ok:rows.length===FRONTIER_REQUIRED_CASES&&ids.size===FRONTIER_REQUIRED_CASES&&invalid===0,count:rows.length,uniqueCases:ids.size,invalid};
}

export function frontierCertificationV100({
  certification={},training={},premiumCertification={},entries=[],referenceId='',expectedReferenceId=FRONTIER_DEFAULT_REFERENCE,
}={}){
  const base=certification?.baseCertification&&typeof certification.baseCertification==='object'?certification.baseCertification:{};
  const aggregate=base?.aggregate&&typeof base.aggregate==='object'?base.aggregate:{};
  const metrics=base?.metrics&&typeof base.metrics==='object'?base.metrics:{};
  const effectiveReference=clean(referenceId||certification?.referenceId,160).toLowerCase();
  const expectedReference=clean(expectedReferenceId,160).toLowerCase();
  const significance=significanceAuditV100(certification);
  const curriculum=buildPremiumCurriculumV100({certification,entries});
  const integrity=entryIntegrity(entries);

  const adjustedWinRate=finite(aggregate?.adjustedWinRate)?Number(aggregate.adjustedWinRate):0;
  const targetMeanScore=finite(metrics?.targetMeanScore)?Number(metrics.targetMeanScore):null;
  const meanScoreDelta=finite(metrics?.meanScoreDelta)?Number(metrics.meanScoreDelta):null;
  const trainingCounts=training?.counts&&typeof training.counts==='object'?training.counts:{};

  const gates={
    complete64:Number(certification?.evaluatedCases)===FRONTIER_REQUIRED_CASES&&Number(base?.evaluatedCases)===FRONTIER_REQUIRED_CASES,
    entryIntegrity:integrity.ok,
    exactReference:Boolean(effectiveReference&&effectiveReference===expectedReference),
    signedProvenance:certification?.gates?.provenance===true&&arr(certification?.invalid).length===0,
    qualityCertification:certification?.claimAllowed===true&&base?.claimAllowed===true,
    premiumCertification:premiumCertification?.certified===true&&premiumCertification?.claimAuthorization?.allowed===true,
    statisticalSignificance:significance.significant===true,
    adjustedWinRate:adjustedWinRate>=FRONTIER_MIN_ADJUSTED_WIN_RATE,
    targetScore:targetMeanScore!==null&&targetMeanScore>=FRONTIER_MIN_TARGET_SCORE,
    scoreDelta:meanScoreDelta!==null&&meanScoreDelta>=FRONTIER_MIN_MEAN_SCORE_DELTA,
    noCriticalCurrentRegressions:curriculum.counts.critical===0&&Number(trainingCounts?.critical||0)===0,
  };
  const certified=Object.values(gates).every(Boolean);
  const failed=Object.entries(gates).filter(([,value])=>!value).map(([key])=>key);

  return{
    version:FRONTIER_QUALITY_TRAINING_V100,
    state:certified?'CERTIFIED':'HOLD',
    certified,
    targetId:clean(certification?.targetId||'universal_core',160),
    referenceId:effectiveReference||null,
    expectedReferenceId:expectedReference,
    gates,
    failed,
    integrity,
    significance,
    quality:{
      adjustedWinRate:round(adjustedWinRate,6),
      targetMeanScore:round(targetMeanScore,6),
      meanScoreDelta:round(meanScoreDelta,6),
    },
    training:{
      mode:curriculum.mode,
      counts:curriculum.counts,
      lanes:curriculum.lanes,
      highestPriority:curriculum.highestPriority,
      criticalHold:curriculum.criticalHold,
      recorderCounts:trainingCounts,
      baseModelWeightsChanged:false,
    },
    thresholds:{
      requiredCases:FRONTIER_REQUIRED_CASES,
      minimumAdjustedWinRate:FRONTIER_MIN_ADJUSTED_WIN_RATE,
      minimumTargetMeanScore:FRONTIER_MIN_TARGET_SCORE,
      minimumMeanScoreDelta:FRONTIER_MIN_MEAN_SCORE_DELTA,
      minimumDecisiveCases:FRONTIER_MIN_DECISIVE_CASES,
      maximumOneSidedBinomialP:FRONTIER_MAX_ONE_SIDED_P,
    },
    claimAuthorization:{
      allowed:certified,
      scope:certified?`Measured statistically significant benchmark advantage over ${effectiveReference} on the complete signed 64-case frontier arena. This evidence is benchmark-scoped and does not establish universal superiority.`:'No v100 frontier comparative claim authorized.',
      globalNumberOneClaimAllowed:false,
      benchmarkScopedOnly:true,
    },
    policy:{
      exactReferenceRequired:true,
      signedRuntimeProvenanceRequired:true,
      complete64Required:true,
      exactBinomialSignificanceRequired:true,
      criticalCurrentRegressionsAllowed:0,
      rawPromptPersistence:false,
      rawAnswerPersistence:false,
      chainOfThoughtPersistence:false,
      baseModelWeightsChanged:false,
      globalNumberOneClaimAllowed:false,
    },
  };
}

export function sealFrontierEvidenceV100({baseEvidence={},frontier={}}={}){
  const source=baseEvidence&&typeof baseEvidence==='object'?baseEvidence:{};
  const previousDigest=clean(source?.evidenceDigest,100)||null;
  const evidence={
    ...source,
    schema:'universal-core-frontier-evidence/v100',
    version:FRONTIER_QUALITY_TRAINING_V100,
    previousEvidenceDigest:previousDigest,
    frontier,
    claimAuthorization:frontier?.claimAuthorization&&typeof frontier.claimAuthorization==='object'?frontier.claimAuthorization:{allowed:false,scope:'No v100 frontier comparative claim authorized.',globalNumberOneClaimAllowed:false,benchmarkScopedOnly:true},
  };
  delete evidence.evidenceDigest;
  const canonical=JSON.stringify(evidence);
  return{...evidence,evidenceDigest:`sha256:${sha256(canonical)}`};
}
