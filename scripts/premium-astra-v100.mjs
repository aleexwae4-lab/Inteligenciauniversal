import fs from 'node:fs/promises';
import path from 'node:path';
import { adversarialEvidenceSuite, adversarialEvidenceManifest } from '../lib/adversarial-evidence-v72.js';

const CORE_URL=String(process.env.UNIVERSAL_CORE_URL||'https://wae-inteligencia-universal.onrender.com').replace(/\/$/,'');
const WORKER_TOKEN=String(process.env.WAE_RUNTIME_BRIDGE_TOKEN||'');
const EXPECTED_REFERENCE=String(process.env.PREMIUM_REFERENCE_ID||'openai:gpt-6-astra').toLowerCase();
const ARTIFACT_DIR=String(process.env.BENCHMARK_ARTIFACT_DIR||'artifacts');
const INTER_CASE_MS=Math.max(0,Number(process.env.BENCHMARK_INTER_CASE_MS||1200));
const TIMEOUT_MS=Math.max(10_000,Number(process.env.BENCHMARK_REQUEST_TIMEOUT_MS||180000));
const REQUIRE_CERTIFICATION=String(process.env.BENCHMARK_REQUIRE_CERTIFICATION||'0')==='1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

if(WORKER_TOKEN.length<24)throw new Error('WAE_RUNTIME_BRIDGE_TOKEN is missing or too short; trusted runtime benchmark cannot execute.');

async function requestJson(url,{method='GET',body,worker=false}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new Error('request_timeout')),TIMEOUT_MS);
  try{
    const headers={'Accept':'application/json','User-Agent':'wae-premium-astra-v100/1.0'};
    if(body!==undefined)headers['Content-Type']='application/json';
    if(worker)headers['x-wae-worker-token']=WORKER_TOKEN;
    const response=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
    const text=await response.text();
    let payload;
    try{payload=text?JSON.parse(text):{}}catch{throw new Error(`non_json_response:${response.status}:${text.slice(0,180)}`)}
    if(!response.ok)throw new Error(`http_${response.status}:${payload?.error||payload?.detail||text.slice(0,180)}`);
    return{response,payload};
  }finally{clearTimeout(timer)}
}

async function runtimeStatus(){
  const [caps,v93,v98]=await Promise.all([
    requestJson(`${CORE_URL}/api/capabilities`),
    requestJson(`${CORE_URL}/api/benchmark/v93`),
    requestJson(`${CORE_URL}/api/benchmark/v98`),
  ]);
  const selfVersion=caps.payload?.selfAwareness?.version;
  if(selfVersion!=='self-awareness/v99')throw new Error(`production_self_awareness_mismatch:${selfVersion||'missing'}`);
  const comparator=v93.payload?.comparator||{};
  const attestation=v93.payload?.attestation||{};
  if(comparator.executable!==true)throw new Error(`astra_comparator_not_executable:${comparator.reason||'unknown'}`);
  if(String(comparator.referenceId||'').toLowerCase()!==EXPECTED_REFERENCE)throw new Error(`reference_mismatch:${comparator.referenceId||'missing'}!=${EXPECTED_REFERENCE}`);
  if(attestation.configured!==true)throw new Error('benchmark_attestation_secret_unconfigured');
  return{
    selfAwarenessVersion:selfVersion,
    comparator:{provider:comparator.provider,model:comparator.model,referenceId:comparator.referenceId,configured:comparator.configured,executable:comparator.executable},
    attestation:{version:attestation.version,configured:attestation.configured,algorithm:attestation.algorithm},
    premiumReadiness:v98.payload?.readiness||null,
    premiumRegressionStatus:v98.payload?.regressionStatus||null,
  };
}

async function proveSelfAwareness(){
  const prompts=[
    '¿Qué tan inteligente eres?',
    '¿Puedes competir contra GPT Astra?',
    'Quiero saber si eres competente contra GPT Astra',
  ];
  const results=[];
  for(const message of prompts){
    const {response,payload}=await requestJson(`${CORE_URL}/api/chat`,{method:'POST',body:{message,mode:'general'}});
    const reply=String(payload?.reply??payload?.response?.content??'');
    const version=response.headers.get('x-wae-self-awareness')||payload?.self_awareness?.version||null;
    if(version!=='self-awareness/v99')throw new Error(`clip_prompt_not_routed_to_v99:${message}`);
    if(!reply.trim())throw new Error(`empty_self_awareness_reply:${message}`);
    if(/No puedo competir directamente|No dispongo de datos comparativos públicos/i.test(reply))throw new Error(`legacy_weak_reply_detected:${message}`);
    results.push({
      promptSha256:await sha256(message),
      responseSha256:await sha256(reply),
      responseChars:reply.length,
      selfAwarenessVersion:version,
      competitiveLanguage:/competir|competitivo/i.test(reply),
      claimDiscipline:/CERTIFIED|no debo afirmar|no.*super/i.test(reply),
    });
  }
  return results;
}

async function sha256(value){
  const bytes=new TextEncoder().encode(String(value??''));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Buffer.from(digest).toString('hex');
}

async function executeCase(testCase,side){
  const {payload}=await requestJson(`${CORE_URL}/api/benchmark/v93`,{
    method:'POST',worker:true,
    body:{action:'execute_case',caseId:testCase.id,promptHash:testCase.promptHash,side},
  });
  if(payload?.success!==true||!payload?.candidate?.answer||!payload?.candidate?.attestation?.signed){
    throw new Error(`invalid_${side}_execution:${testCase.id}:${payload?.error||'missing_signed_candidate'}`);
  }
  return payload;
}

function candidateFromExecution(run,id){
  return{
    id,
    answer:run.candidate.answer,
    latencyMs:run.candidate.latencyMs,
    costUsd:run.candidate.costUsd??null,
    attestation:run.candidate.attestation,
    sources:Array.isArray(run.candidate.sources)?run.candidate.sources:[],
  };
}

function sanitizedCandidate(candidate){
  const a=candidate?.attestation||{};
  return{
    id:candidate.id,
    latencyMs:candidate.latencyMs,
    provider:a.provider||null,
    model:a.model||null,
    responseHash:a.responseHash||null,
    responseIdPresent:Boolean(a.responseId),
    requestIdPresent:Boolean(a.requestId),
    commitSha:a.commitSha||null,
    observedAt:a.observedAt||null,
    signed:a.signed===true,
  };
}

const status=await runtimeStatus();
const selfAwarenessProof=await proveSelfAwareness();
const referenceId=String(status.comparator.referenceId).toLowerCase();
const suite=adversarialEvidenceSuite();
if(suite.length!==64)throw new Error(`immutable_suite_size_mismatch:${suite.length}`);

const entries=[];
const sanitizedCases=[];
for(let i=0;i<suite.length;i++){
  const testCase=suite[i];
  const [targetRun,referenceRun]=await Promise.all([executeCase(testCase,'target'),executeCase(testCase,'reference')]);
  const target=candidateFromExecution(targetRun,'universal_core');
  const reference=candidateFromExecution(referenceRun,referenceId);
  entries.push({caseId:testCase.id,promptHash:testCase.promptHash,candidates:[target,reference]});
  sanitizedCases.push({caseId:testCase.id,promptHash:testCase.promptHash,target:sanitizedCandidate(target),reference:sanitizedCandidate(reference)});
  console.log(`[${String(i+1).padStart(2,'0')}/64] ${testCase.id} target=${target.latencyMs}ms reference=${reference.latencyMs}ms`);
  if(i<suite.length-1&&INTER_CASE_MS)await sleep(INTER_CASE_MS);
}

const v93=(await requestJson(`${CORE_URL}/api/benchmark/v93`,{
  method:'POST',worker:true,
  body:{action:'certify_attested_and_record',entries,targetId:'universal_core',referenceId},
})).payload;

const v98=(await requestJson(`${CORE_URL}/api/benchmark/v98`,{
  method:'POST',worker:true,
  body:{action:'certify',entries,targetId:'universal_core',referenceId},
})).payload;

const artifact={
  schema:'wae-premium-astra-evidence/v100',
  createdAt:new Date().toISOString(),
  targetId:'universal_core',
  targetRelease:'self-awareness/v99',
  referenceId,
  suite:adversarialEvidenceManifest(),
  runtimeStatus:status,
  selfAwarenessProof,
  cases:sanitizedCases,
  verifiedArena:{
    certification:v93?.certification||null,
    training:v93?.training||null,
    recorder:v93?.recorder||null,
    claimAuthorization:v93?.claimAuthorization||null,
  },
  premiumGate:{
    version:v98?.version||null,
    qualityCertification:v98?.qualityCertification||null,
    regressionStatus:v98?.regressionStatus||null,
    premiumCertification:v98?.premiumCertification||null,
    claimAuthorization:v98?.claimAuthorization||null,
  },
  privacy:{rawPromptsPersisted:false,rawAnswersPersisted:false,chainOfThoughtPersisted:false,artifactContainsResponseHashesNotAnswers:true},
};

await fs.mkdir(ARTIFACT_DIR,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const file=path.join(ARTIFACT_DIR,`premium-astra-v100-${stamp}.json`);
await fs.writeFile(file,JSON.stringify(artifact,null,2));

const premium=v98?.premiumCertification||{};
console.log(`Premium gate: ${premium.state||'UNKNOWN'}`);
console.log(`Reference: ${referenceId}`);
console.log(`Failed gates: ${(premium.failed||[]).join(',')||'none'}`);
console.log(`Target P95: ${premium.performance?.target?.p95_ms??'n/a'} ms`);
console.log(`Reference P95: ${premium.performance?.reference?.p95_ms??'n/a'} ms`);
console.log(`Target quality: ${premium.quality?.targetMeanScore??'n/a'}`);
console.log(`Reference quality: ${premium.quality?.referenceMeanScore??'n/a'}`);
console.log(`Artifact: ${file}`);

if(REQUIRE_CERTIFICATION&&premium.certified!==true)process.exitCode=2;
