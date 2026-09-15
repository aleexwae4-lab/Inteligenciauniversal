import { applyHeaders } from '../lib/security.js';
import { aggregateHeadToHead, benchmarkManifest, compareBenchmarkCandidates, createTrainingCase, evaluateBenchmarkCandidate, evaluationPlaneCapabilities } from '../lib/evaluation-plane.js';
import { benchmarkSuite, benchmarkSuiteManifest, certifyBenchmarkRun, SUPREMACY_BENCHMARK_VERSION } from '../lib/supremacy-benchmark-v53.js';

const MAX_PROMPT=30000;
const MAX_ANSWER=80000;
const MAX_CANDIDATES=8;
const MAX_BENCHMARK_ENTRIES=64;
const MAX_TRUSTED_ENTRIES=32;

function text(value,max){return String(value??'').slice(0,max)}
function bodyOf(req){return req.body&&typeof req.body==='object'?req.body:{}}
function candidateList(value){
  return(Array.isArray(value)?value:[]).slice(0,MAX_CANDIDATES).map((candidate,index)=>({
    id:text(candidate?.id||`candidate_${index+1}`,120),
    answer:text(candidate?.answer??candidate?.text??'',MAX_ANSWER),
    sources:Array.isArray(candidate?.sources)?candidate.sources.slice(0,20):[],
    latencyMs:candidate?.latencyMs??null,
    costUsd:candidate?.costUsd??null
  }));
}
function benchmarkEntries(value){
  return(Array.isArray(value)?value:[]).slice(0,MAX_BENCHMARK_ENTRIES).map(entry=>({
    caseId:text(entry?.caseId,120),
    promptHash:text(entry?.promptHash,128),
    candidates:candidateList(entry?.candidates)
  }));
}
function workerToken(req){
  const raw=req?.headers?.['x-wae-worker-token']??req?.headers?.get?.('x-wae-worker-token')??'';
  return text(Array.isArray(raw)?raw[0]:raw,500);
}
async function persistTrustedCertification({req,certification,entries,targetId,referenceId,commitSha}){
  const token=workerToken(req);
  if(!token)return{ok:false,status:403,error:'worker_auth_required'};
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=String(process.env.SUPABASE_PUBLISHABLE_KEY||'');
  if(!base||!key)return{ok:false,status:503,error:'supabase_configuration_missing'};
  const safeEntries=entries.slice(0,MAX_TRUSTED_ENTRIES).map(({caseId,promptHash})=>({caseId,promptHash}));
  try{
    const response=await fetch(`${base}/rest/v1/rpc/wae_record_trusted_supremacy_v54`,{
      method:'POST',
      headers:{'Content-Type':'application/json',apikey:key,'X-Client-Info':'wae-continuous-improvement-v54'},
      body:JSON.stringify({p_worker_token:token,p_certification:certification,p_entries:safeEntries,p_target_id:targetId,p_reference_id:referenceId,p_commit_sha:text(commitSha,80)||null}),
      signal:AbortSignal.timeout(5000)
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok)return{ok:false,status:response.status===400||response.status===401||response.status===403?403:502,error:'trusted_record_rejected'};
    return{ok:true,status:200,record:payload};
  }catch{return{ok:false,status:502,error:'trusted_record_unavailable'}}
}

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json({success:true,capabilities:evaluationPlaneCapabilities(),manifest:benchmarkManifest(),supremacyBenchmark:benchmarkSuiteManifest()});
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});

  const body=bodyOf(req),action=text(body.action||'evaluate',40).toLowerCase(),prompt=text(body.prompt||body.message||'',MAX_PROMPT),mode=text(body.mode||'general',40),assertions=body.assertions&&typeof body.assertions==='object'?body.assertions:{};
  if(!prompt&&!['aggregate','suite','certify','certify_and_record'].includes(action))return res.status(422).json({success:false,error:'prompt_required'});

  if(action==='suite'){
    return res.status(200).json({success:true,version:SUPREMACY_BENCHMARK_VERSION,manifest:benchmarkSuiteManifest(),cases:benchmarkSuite()});
  }

  if(action==='certify'||action==='certify_and_record'){
    const referenceId=text(body.referenceId,120),targetId=text(body.targetId||'universal_core',120);
    if(!referenceId)return res.status(422).json({success:false,error:'reference_id_required'});
    const entries=benchmarkEntries(body.entries);
    if(action==='certify_and_record'&&entries.length>MAX_TRUSTED_ENTRIES)return res.status(422).json({success:false,error:'trusted_suite_max_32_cases'});
    const certification=certifyBenchmarkRun({entries,targetId,referenceId,minimumCases:body.minimumCases});
    if(action==='certify')return res.status(200).json({success:true,certification});
    const persisted=await persistTrustedCertification({req,certification,entries,targetId,referenceId,commitSha:body.commitSha});
    if(!persisted.ok)return res.status(persisted.status).json({success:false,error:persisted.error,certification});
    return res.status(200).json({success:true,certification,continuousImprovement:{version:'continuous-improvement/v54',trusted:true,persisted:true,...persisted.record}});
  }

  if(action==='evaluate'){
    const answer=text(body.answer??body.text??'',MAX_ANSWER);
    if(!answer)return res.status(422).json({success:false,error:'answer_required'});
    return res.status(200).json({success:true,evaluation:evaluateBenchmarkCandidate({caseId:text(body.caseId||'ad-hoc',120),prompt,mode,answer,sources:body.sources,latencyMs:body.latencyMs,costUsd:body.costUsd,assertions,metadata:{source:'api/evals'}})});
  }

  if(action==='compare'){
    const candidates=candidateList(body.candidates);
    if(candidates.length<2)return res.status(422).json({success:false,error:'at_least_two_candidates_required'});
    return res.status(200).json({success:true,comparison:compareBenchmarkCandidates({caseId:text(body.caseId||'ad-hoc',120),prompt,mode,candidates,assertions})});
  }

  if(action==='aggregate'){
    const comparisons=Array.isArray(body.comparisons)?body.comparisons.slice(0,500):[];
    const targetId=text(body.targetId||'universal_core',120);
    return res.status(200).json({success:true,aggregate:aggregateHeadToHead({comparisons,targetId,minimumCases:body.minimumCases,minimumWinRate:body.minimumWinRate,maxCriticalFailureRate:body.maxCriticalFailureRate})});
  }

  if(action==='training_case'){
    const candidates=candidateList(body.candidates);
    if(candidates.length<2)return res.status(422).json({success:false,error:'at_least_two_candidates_required'});
    const comparison=compareBenchmarkCandidates({caseId:text(body.caseId||'ad-hoc',120),prompt,mode,candidates,assertions});
    const trainingCase=createTrainingCase({caseId:text(body.caseId||'ad-hoc',120),prompt,mode,comparison,targetId:text(body.targetId||'universal_core',120)});
    return res.status(200).json({success:true,comparison,trainingCase});
  }

  return res.status(400).json({success:false,error:'unsupported_action'});
}
