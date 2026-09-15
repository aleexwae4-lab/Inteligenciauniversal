import { aggregateHeadToHead, compareBenchmarkCandidates, createTrainingCase } from './evaluation-plane.js';
import { benchmarkSuite as legacyBenchmarkSuite } from './supremacy-benchmark-v53.js';

export const SUPREMACY_BENCHMARK_VERSION='universal-benchmark-arena/v62';
export const SUPREMACY_MIN_CASES=32;
export const SUPREMACY_MIN_WIN_RATE=.68;
export const SUPREMACY_MAX_CRITICAL_RATE=0;
export const SUPREMACY_MIN_WILSON_LOWER=.50;
export const SUPREMACY_MIN_MEAN_DELTA=.015;
export const SUPREMACY_MIN_TARGET_SCORE=.82;

const cleanId=value=>String(value||'').trim().slice(0,120);
const round=(value,digits=4)=>Number(Number(value||0).toFixed(digits));
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;

export function benchmarkSuite(){return legacyBenchmarkSuite()}

export function wilsonLowerBound(rate,total,z=1.96){
  const n=Math.max(0,Number(total)||0),p=Math.max(0,Math.min(1,Number(rate)||0));
  if(!n)return 0;
  const z2=z*z,den=1+z2/n,centre=p+z2/(2*n),margin=z*Math.sqrt((p*(1-p)+z2/(4*n))/n);
  return Math.max(0,(centre-margin)/den);
}

function categorySummary(comparisons,suite,target){
  const map=new Map(suite.map(item=>[item.id,item.category]));
  const categories=[...new Set(suite.map(item=>item.category))];
  return Object.fromEntries(categories.map(category=>{
    const rows=comparisons.filter(row=>map.get(row.caseId)===category);
    let wins=0,ties=0,losses=0,critical=0;
    const targetScores=[];
    for(const row of rows){
      const t=row.ranking?.find(item=>item.id===target);
      if(t?.evaluation?.hardFailure)critical++;
      if(Number.isFinite(Number(t?.evaluation?.score)))targetScores.push(Number(t.evaluation.score));
      if(row.verdict==='tie')ties++;else if(row.winnerId===target)wins++;else losses++;
    }
    const adjustedWinRate=rows.length?(wins+ties*.5)/rows.length:0;
    return[category,{total:rows.length,wins,ties,losses,critical,adjustedWinRate:round(adjustedWinRate),targetMeanScore:round(mean(targetScores))}];
  }));
}

export function benchmarkSuiteManifest(){
  const suite=benchmarkSuite(),categories=[...new Set(suite.map(x=>x.category))];
  return{
    schema:'universal-benchmark-arena/v2',version:SUPREMACY_BENCHMARK_VERSION,blind:true,providerIdentityUsedForScoring:false,holdoutCases:suite.length,
    minimumCases:SUPREMACY_MIN_CASES,minimumWinRate:SUPREMACY_MIN_WIN_RATE,maxCriticalFailureRate:SUPREMACY_MAX_CRITICAL_RATE,
    minimumWilsonLowerBound:SUPREMACY_MIN_WILSON_LOWER,minimumMeanScoreDelta:SUPREMACY_MIN_MEAN_DELTA,minimumTargetMeanScore:SUPREMACY_MIN_TARGET_SCORE,
    fullSuiteRequired:true,versionedReferenceRequired:true,
    categories:categories.map(category=>({category,count:suite.filter(x=>x.category===category).length,minAdjustedWinRate:.50,maxCriticalFailures:0})),
    methodology:'Same immutable holdout prompt and assertions for Universal Core and one explicitly versioned reference model. Scoring is blind and deterministic. Certification requires the complete 32-case suite, zero critical failures, >=68% adjusted win rate, positive score margin, no collapsed category, and a 95% Wilson lower bound >=50%.',
    claimPolicy:{allowed:'Measured benchmark-scoped advantage over the exact named and versioned reference when every v62 gate passes.',forbidden:'Universal, global, or model-family superiority claims; claims against an unversioned GPT/Claude/Gemini/Grok label; extrapolation beyond this suite.'}
  };
}

export function certifyBenchmarkRun({entries=[],targetId='universal_core',referenceId='',minimumCases=SUPREMACY_MIN_CASES}={}){
  const target=cleanId(targetId)||'universal_core',reference=cleanId(referenceId),suite=benchmarkSuite(),suiteMap=new Map(suite.map(item=>[item.id,item]));
  const seen=new Set(),comparisons=[],invalid=[];
  for(const entry of Array.isArray(entries)?entries:[]){
    const caseId=cleanId(entry?.caseId),testCase=suiteMap.get(caseId);
    if(!testCase){invalid.push({caseId,reason:'unknown_case'});continue}
    if(seen.has(caseId)){invalid.push({caseId,reason:'duplicate_case'});continue}
    if(String(entry?.promptHash||'')!==testCase.promptHash){invalid.push({caseId,reason:'prompt_hash_mismatch'});continue}
    const candidates=Array.isArray(entry?.candidates)?entry.candidates:[];
    const targetCandidate=candidates.find(x=>cleanId(x?.id)===target),referenceCandidate=candidates.find(x=>cleanId(x?.id)===reference);
    if(!targetCandidate||!referenceCandidate){invalid.push({caseId,reason:'missing_target_or_reference'});continue}
    seen.add(caseId);
    comparisons.push(compareBenchmarkCandidates({caseId,prompt:testCase.prompt,mode:testCase.mode,candidates:[targetCandidate,referenceCandidate],assertions:testCase.assertions}));
  }

  const required=Math.max(SUPREMACY_MIN_CASES,Number(minimumCases)||SUPREMACY_MIN_CASES),categoryStats=categorySummary(comparisons,suite,target);
  const categoryCoverage=Object.fromEntries(Object.entries(categoryStats).map(([category,row])=>[category,row.total]));
  const fullSuiteGate=seen.size===suite.length&&suite.every(item=>seen.has(item.id));
  const coverageGate=seen.size>=required;
  const versionedReferenceGate=Boolean(reference&&reference!==target&&!['reference','baseline','gpt','chatgpt','claude','gemini','grok'].includes(reference.toLowerCase())&&/\d/.test(reference));
  const categoryGate=Object.values(categoryStats).every(row=>row.total===4&&row.adjustedWinRate>=.50&&row.critical===0);
  const aggregate=aggregateHeadToHead({comparisons,targetId:target,minimumCases:required,minimumWinRate:SUPREMACY_MIN_WIN_RATE,maxCriticalFailureRate:SUPREMACY_MAX_CRITICAL_RATE});
  const targetScores=[],referenceScores=[],deltas=[];
  for(const row of comparisons){
    const t=row.ranking?.find(item=>item.id===target),r=row.ranking?.find(item=>item.id===reference);
    if(Number.isFinite(Number(t?.evaluation?.score)))targetScores.push(Number(t.evaluation.score));
    if(Number.isFinite(Number(r?.evaluation?.score)))referenceScores.push(Number(r.evaluation.score));
    if(Number.isFinite(Number(t?.evaluation?.score))&&Number.isFinite(Number(r?.evaluation?.score)))deltas.push(Number(t.evaluation.score)-Number(r.evaluation.score));
  }
  const targetMeanScore=mean(targetScores),referenceMeanScore=mean(referenceScores),meanScoreDelta=mean(deltas),wilsonLower=wilsonLowerBound(aggregate.adjustedWinRate,aggregate.total);
  const scoreGate=targetMeanScore>=SUPREMACY_MIN_TARGET_SCORE&&meanScoreDelta>=SUPREMACY_MIN_MEAN_DELTA;
  const statisticalGate=wilsonLower>=SUPREMACY_MIN_WILSON_LOWER;
  const regressions=comparisons.filter(row=>row.verdict!=='tie'&&row.winnerId!==target||row.ranking?.find(x=>x.id===target)?.evaluation?.hardFailure).map(row=>createTrainingCase({caseId:row.caseId,prompt:suiteMap.get(row.caseId)?.prompt||'',mode:suiteMap.get(row.caseId)?.mode||'general',comparison:row,targetId:target}));
  const noInvalidEntries=invalid.length===0;
  const claimAllowed=Boolean(versionedReferenceGate&&fullSuiteGate&&coverageGate&&categoryGate&&aggregate.claimAllowed&&scoreGate&&statisticalGate&&noInvalidEntries);
  return{
    schema:'universal-benchmark-arena-certification/v2',version:SUPREMACY_BENCHMARK_VERSION,targetId:target,referenceId:reference,evaluatedCases:comparisons.length,invalid,categoryCoverage,categoryStats,
    metrics:{targetMeanScore:round(targetMeanScore),referenceMeanScore:round(referenceMeanScore),meanScoreDelta:round(meanScoreDelta),wilsonLowerBound95:round(wilsonLower)},
    thresholds:{minimumCases:required,minimumWinRate:SUPREMACY_MIN_WIN_RATE,maxCriticalFailureRate:SUPREMACY_MAX_CRITICAL_RATE,minimumTargetMeanScore:SUPREMACY_MIN_TARGET_SCORE,minimumMeanScoreDelta:SUPREMACY_MIN_MEAN_DELTA,minimumWilsonLowerBound95:SUPREMACY_MIN_WILSON_LOWER},
    gates:{versionedReferenceGate,fullSuiteGate,coverageGate,categoryGate,aggregateGate:aggregate.claimAllowed,scoreGate,statisticalGate,noInvalidEntries},aggregate,regressions,claimAllowed,
    verdict:claimAllowed?'CERTIFIED_BENCHMARK_ADVANTAGE':'NOT_PROVEN',
    claim:claimAllowed?`Measured advantage over ${reference} on ${SUPREMACY_BENCHMARK_VERSION}. This certification is limited to this immutable 32-case arena and does not establish universal superiority.`:'Superiority is not proven for this benchmark run.'
  };
}
