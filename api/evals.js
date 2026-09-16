import { createHash } from 'node:crypto';
import { applyHeaders } from '../lib/security.js';
import { callInternalSupabaseRpc } from '../lib/internal-supabase-rpc-v74.js';
import { aggregateHeadToHead, benchmarkManifest, compareBenchmarkCandidates, createTrainingCase, evaluateBenchmarkCandidate, evaluationPlaneCapabilities } from '../lib/evaluation-plane.js';
import { benchmarkSuite, benchmarkSuiteManifest, certifyBenchmarkRun, SUPREMACY_BENCHMARK_VERSION } from '../lib/supremacy-benchmark-v62.js';
import { evidenceBenchmarkSuite, evidenceBenchmarkManifest, certifyEvidenceBenchmarkRun, EVIDENCE_BENCHMARK_VERSION } from '../lib/evidence-benchmark-v71.js';
import { adversarialEvidenceSuite, adversarialEvidenceManifest, certifyAdversarialEvidenceRun, ADVERSARIAL_EVIDENCE_VERSION } from '../lib/adversarial-evidence-v72.js';

const MAX_PROMPT=30000;
const MAX_ANSWER=80000;
const MAX_CANDIDATES=8;
const MAX_BENCHMARK_ENTRIES=80;
const MAX_TRUSTED_ENTRIES=32;
const MAX_ADVERSARIAL_TRUSTED_ENTRIES=64;
const sha256=value=>createHash('sha256').update(String(value??'')).digest('hex');

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
function adversarialAttestations(entries,targetId,referenceId){
  const suiteMap=new Map(adversarialEvidenceSuite().map(item=>[item.id,item]));
  return entries.slice(0,MAX_ADVERSARIAL_TRUSTED_ENTRIES).map(entry=>{
    const testCase=suiteMap.get(entry.caseId),candidates=candidateList(entry.candidates),target=candidates.find(x=>x.id===targetId),reference=candidates.find(x=>x.id===referenceId);
    if(!testCase||!target||!reference)return{caseId:entry.caseId,promptHash:entry.promptHash,targetAnswerHash:sha256(target?.answer||''),referenceAnswerHash:sha256(reference?.answer||''),targetScore:null,referenceScore:null,winnerId:'',critical:true};
    const comparison=compareBenchmarkCandidates({caseId:entry.caseId,prompt:testCase.prompt,mode:testCase.mode,candidates:[target,reference],assertions:testCase.assertions});
    const targetRank=comparison.ranking?.find(x=>x.id===targetId),referenceRank=comparison.ranking?.find(x=>x.id===referenceId);
    return{caseId:entry.caseId,promptHash:entry.promptHash,targetAnswerHash:sha256(target.answer),referenceAnswerHash:sha256(reference.answer),targetScore:targetRank?.evaluation?.score??null,referenceScore:referenceRank?.evaluation?.score??null,winnerId:comparison.verdict==='tie'?'tie':comparison.winnerId||'',critical:Boolean(targetRank?.evaluation?.hardFailure)};
  });
}
async function persistTrustedCertification({req,certification,entries,targetId,referenceId,commitSha}){
  const token=workerToken(req);
  if(!token)return{ok:false,status:403,error:'worker_auth_required'};
  const safeEntries=entries.slice(0,MAX_TRUSTED_ENTRIES).map(({caseId,promptHash})=>({caseId,promptHash}));
  const result=await callInternalSupabaseRpc({
    functionName:'wae_record_trusted_supremacy_v54',
    body:{p_worker_token:token,p_certification:certification,p_entries:safeEntries,p_target_id:targetId,p_reference_id:referenceId,p_commit_sha:text(commitSha,80)||null},
    timeoutMs:5000,
    clientInfo:'wae-benchmark-arena-v74'
  });
  if(!result.ok)return{ok:false,status:[400,401,403].includes(result.status)?403:502,error:result.unconfigured?'supabase_configuration_missing':'trusted_record_rejected'};
  return{ok:true,status:200,record:result.payload,transportMode:result.mode};
}
async function persistAdversarialCertification({req,certification,entries,targetId,referenceId,commitSha}){
  const token=workerToken(req);if(!token)return{ok:false,status:403,error:'worker_auth_required'};
  const attestations=adversarialAttestations(entries,targetId,referenceId);
  if(attestations.length!==MAX_ADVERSARIAL_TRUSTED_ENTRIES||attestations.some(x=>!x.caseId||!x.promptHash))return{ok:false,status:422,error:'complete_64_case_attestation_required'};
  const result=await callInternalSupabaseRpc({
    functionName:'wae_record_trusted_evidence_v72',
    body:{p_worker_token:token,p_certification:certification,p_entries:attestations,p_target_id:targetId,p_reference_id:referenceId,p_commit_sha:text(commitSha,80)||null},
    timeoutMs:8000,
    clientInfo:'wae-adversarial-evidence-v74'
  });
  if(!result.ok)return{ok:false,status:[400,401,403].includes(result.status)?403:502,error:result.unconfigured?'supabase_configuration_missing':'trusted_evidence_record_rejected',detail:text(result.detail||'',180)};
  return{ok:true,status:200,record:result.payload,transportMode:result.mode};
}

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method==='GET')return res.status(200).json({success:true,capabilities:evaluationPlaneCapabilities(),manifest:benchmarkManifest(),benchmarkArena:benchmarkSuiteManifest(),evidenceArena:evidenceBenchmarkManifest(),adversarialEvidenceArena:adversarialEvidenceManifest()});
  if(req.method!=='POST')return res.status(405).json({success:false,error:'method_not_allowed'});
  const body=bodyOf(req),action=text(body.action||'evaluate',40).toLowerCase(),prompt=text(body.prompt||body.message||'',MAX_PROMPT),mode=text(body.mode||'general',40),assertions=body.assertions&&typeof body.assertions==='object'?body.assertions:{};
  if(!prompt&&!['aggregate','suite','certify','certify_and_record','evidence_suite','evidence_certify','adversarial_suite','adversarial_certify','adversarial_certify_and_record'].includes(action))return res.status(422).json({success:false,error:'prompt_required'});

  if(action==='suite')return res.status(200).json({success:true,version:SUPREMACY_BENCHMARK_VERSION,manifest:benchmarkSuiteManifest(),cases:benchmarkSuite()});
  if(action==='evidence_suite')return res.status(200).json({success:true,version:EVIDENCE_BENCHMARK_VERSION,manifest:evidenceBenchmarkManifest(),cases:evidenceBenchmarkSuite(),referenceContract:{pairedResponsesRequired:true,versionedReferenceRequired:true,simulatedReferenceForbidden:true}});
  if(action==='adversarial_suite')return res.status(200).json({success:true,version:ADVERSARIAL_EVIDENCE_VERSION,manifest:adversarialEvidenceManifest(),cases:adversarialEvidenceSuite(),referenceContract:{pairedResponsesRequired:true,exact64CaseSuite:true,versionedReferenceRequired:true,simulatedReferenceForbidden:true,fullAnswersStored:false,answerHashesStoredOnTrustedRecord:true}});

  if(action==='evidence_certify'){
    const referenceId=text(body.referenceId,120),targetId=text(body.targetId||'universal_core',120);if(!referenceId)return res.status(422).json({success:false,error:'reference_id_required'});const entries=benchmarkEntries(body.entries);const certification=certifyEvidenceBenchmarkRun({entries,targetId,referenceId,minimumCases:body.minimumCases});return res.status(200).json({success:true,certification,persistence:{supported:false,reason:'trusted_v54_recorder_is_32_case_bound; use adversarial_certify_and_record for v72 trusted persistence'}});
  }
  if(action==='adversarial_certify'||action==='adversarial_certify_and_record'){
    const referenceId=text(body.referenceId,120),targetId=text(body.targetId||'universal_core',120);if(!referenceId)return res.status(422).json({success:false,error:'reference_id_required'});const entries=benchmarkEntries(body.entries);const certification=certifyAdversarialEvidenceRun({entries,targetId,referenceId,minimumCases:body.minimumCases});
    if(action==='adversarial_certify')return res.status(200).json({success:true,certification,persistence:{supported:true,action:'adversarial_certify_and_record',answersPersisted:false,hashAttestation:true}});
    if(!certification.gates?.fullPairedSuite||!certification.gates?.noInvalidEntries)return res.status(422).json({success:false,error:'complete_valid_paired_suite_required',certification});
    const persisted=await persistAdversarialCertification({req,certification,entries,targetId,referenceId,commitSha:body.commitSha});if(!persisted.ok)return res.status(persisted.status).json({success:false,error:persisted.error,detail:persisted.detail,certification});return res.status(200).json({success:true,certification,trustedEvidence:{version:'trusted-evidence-recorder/v72',trusted:true,persisted:true,fullAnswersStored:false,transportMode:persisted.transportMode,...persisted.record}});
  }

  if(action==='certify'||action==='certify_and_record'){
    const referenceId=text(body.referenceId,120),targetId=text(body.targetId||'universal_core',120);if(!referenceId)return res.status(422).json({success:false,error:'reference_id_required'});const entries=benchmarkEntries(body.entries);if(action==='certify_and_record'&&entries.length>MAX_TRUSTED_ENTRIES)return res.status(422).json({success:false,error:'trusted_suite_max_32_cases'});const certification=certifyBenchmarkRun({entries,targetId,referenceId,minimumCases:body.minimumCases});if(action==='certify')return res.status(200).json({success:true,certification});const persisted=await persistTrustedCertification({req,certification,entries,targetId,referenceId,commitSha:body.commitSha});if(!persisted.ok)return res.status(persisted.status).json({success:false,error:persisted.error,certification});return res.status(200).json({success:true,certification,continuousImprovement:{version:'continuous-improvement/v54',trusted:true,persisted:true,transportMode:persisted.transportMode,...persisted.record}});
  }

  if(action==='evaluate'){
    const answer=text(body.answer??body.text??'',MAX_ANSWER);if(!answer)return res.status(422).json({success:false,error:'answer_required'});return res.status(200).json({success:true,evaluation:evaluateBenchmarkCandidate({caseId:text(body.caseId||'ad-hoc',120),prompt,mode,answer,sources:body.sources,latencyMs:body.latencyMs,costUsd:body.costUsd,assertions,metadata:{source:'api/evals-v72'}})});
  }
  if(action==='compare'){
    const candidates=candidateList(body.candidates);if(candidates.length<2)return res.status(422).json({success:false,error:'at_least_two_candidates_required'});return res.status(200).json({success:true,comparison:compareBenchmarkCandidates({caseId:text(body.caseId||'ad-hoc',120),prompt,mode,candidates,assertions})});
  }
  if(action==='aggregate'){
    const comparisons=Array.isArray(body.comparisons)?body.comparisons.slice(0,500):[];const targetId=text(body.targetId||'universal_core',120);return res.status(200).json({success:true,aggregate:aggregateHeadToHead({comparisons,targetId,minimumCases:body.minimumCases,minimumWinRate:body.minimumWinRate,maxCriticalFailureRate:body.maxCriticalFailureRate}),note:'Aggregate is diagnostic only. Competitor advantage claims require a complete versioned-reference certification under the appropriate benchmark arena.'});
  }
  if(action==='training_case'){
    const candidates=candidateList(body.candidates);if(candidates.length<2)return res.status(422).json({success:false,error:'at_least_two_candidates_required'});const comparison=compareBenchmarkCandidates({caseId:text(body.caseId||'ad-hoc',120),prompt,mode,candidates,assertions});const trainingCase=createTrainingCase({caseId:text(body.caseId||'ad-hoc',120),prompt,mode,comparison,targetId:text(body.targetId||'universal_core',120)});return res.status(200).json({success:true,comparison,trainingCase});
  }
  return res.status(400).json({success:false,error:'unsupported_action'});
}
