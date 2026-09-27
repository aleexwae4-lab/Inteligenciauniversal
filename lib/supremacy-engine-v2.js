import { createHash } from 'node:crypto';
import { astraFrontierSuite } from './astra-frontier-challenge-v1.js';
import { validateExternalReferenceBatch } from './external-reference-adapter-v1.js';

export const SUPREMACY_ENGINE_VERSION='supremacy-engine/v2';

const hash=v=>createHash('sha256').update(String(v??'')).digest('hex');
const n=v=>Number.isFinite(Number(v))?Number(v):0;

const WEIGHTS={
  reasoning:.15,coding:.15,agentic:.15,long_context:.10,professional:.10,
  computer_use:.10,research:.10,multimodal:.05,security:.05,verification:.05
};

export function buildSupremacyManifest({reference={}}={}){
  const suite=astraFrontierSuite();
  return {
    version:SUPREMACY_ENGINE_VERSION,
    suiteVersion:'astra-frontier-challenge/v1',
    cases:suite.length,
    weightedDimensions:WEIGHTS,
    reference:reference||null,
    gates:{
      exactReference:true,
      pairedPrompts:true,
      provenance:true,
      noSimulation:true,
      criticalFailuresBlock:true
    },
    claimPolicy:'Benchmark-scoped only. No global superiority claim without an exact external execution.'
  };
}

export function scoreUniversalFrontier(entries=[]){
  const byId=new Map((Array.isArray(entries)?entries:[]).map(x=>[String(x?.caseId||x?.id),x]));
  const suite=astraFrontierSuite();
  const buckets={};
  for(const c of suite){
    const row=byId.get(c.id);
    const score=Math.max(0,Math.min(1,n(row?.score)));
    const category=c.category;
    if(!buckets[category])buckets[category]={sum:0,count:0,critical:0};
    buckets[category].sum+=score;buckets[category].count++;
    if(row?.critical===true)buckets[category].critical++;
  }
  const dimensions=Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,{
    score:Number((v.count?v.sum/v.count:0).toFixed(4)),cases:v.count,critical:v.critical
  }]));
  let weighted=0,weightTotal=0;
  for(const [k,w] of Object.entries(WEIGHTS)){weighted+=(dimensions[k]?.score||0)*w;weightTotal+=w}
  return {
    version:SUPREMACY_ENGINE_VERSION,
    score:Number((weighted/weightTotal).toFixed(4)),
    dimensions,
    criticalFailures:Object.values(dimensions).reduce((a,x)=>a+x.critical,0)
  };
}

export function comparePairedFrontier({universalEntries=[],referenceEntries=[],referenceManifest={}}={}){
  const suite=astraFrontierSuite();
  const referenceValidation=validateExternalReferenceBatch({entries:referenceEntries,suite});
  if(!referenceValidation.complete||referenceValidation.invalid.length){
    return {
      version:SUPREMACY_ENGINE_VERSION,
      comparable:false,
      claimAllowed:false,
      reason:'verified_external_reference_incomplete',
      referenceValidation
    };
  }

  const u=new Map(universalEntries.map(x=>[String(x?.caseId||x?.id),x]));
  const r=new Map(referenceEntries.map(x=>[String(x?.caseId||x?.id),x]));
  const pairs=[];
  for(const c of suite){
    const us=u.get(c.id), rr=r.get(c.id);
    if(!us||!rr)continue;
    const uscore=Math.max(0,Math.min(1,n(us.score)));
    const rscore=Math.max(0,Math.min(1,n(rr.score)));
    pairs.push({
      caseId:c.id,category:c.category,
      universalScore:uscore,referenceScore:rscore,
      delta:Number((uscore-rscore).toFixed(4)),
      universalHash:hash(us.answer||''),
      referenceHash:hash(rr.answer||'')
    });
  }
  const meanU=pairs.length?pairs.reduce((a,x)=>a+x.universalScore,0)/pairs.length:0;
  const meanR=pairs.length?pairs.reduce((a,x)=>a+x.referenceScore,0)/pairs.length:0;
  const wins=pairs.filter(x=>x.delta>0).length;
  const losses=pairs.filter(x=>x.delta<0).length;
  return {
    version:SUPREMACY_ENGINE_VERSION,
    comparable:pairs.length===suite.length,
    claimAllowed:false,
    reference:referenceManifest,
    cases:pairs.length,
    universalScore:Number(meanU.toFixed(4)),
    referenceScore:Number(meanR.toFixed(4)),
    delta:Number((meanU-meanR).toFixed(4)),
    wins,losses,ties:pairs.length-wins-losses,
    pairs
  };
}

export function promotionGate({comparison={},criticalFailures=0}={}){
  const valid=comparison?.comparable===true;
  const safe=n(criticalFailures)===0;
  return {
    version:SUPREMACY_ENGINE_VERSION,
    promote:Boolean(valid&&safe),
    state:valid&&safe?'CERTIFIABLE_PENDING_STATISTICAL_REVIEW':'HOLD',
    gates:{pairedBenchmark:valid,criticalFailuresZero:safe,externalClaimAuthorization:false},
    note:'A positive benchmark delta is evidence for this benchmark only; it does not authorize a global model-superiority claim.'
  };
}
