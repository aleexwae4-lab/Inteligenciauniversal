import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adversarialEvidenceSuite, adversarialSuiteHash } from '../lib/adversarial-evidence-v72.js';
import {
  VERIFIED_BENCHMARK_REQUIRED_CASES,
  buildPublicEvidenceV99,
  publicEvidenceIsSanitizedV99,
  readinessGateV99,
  validateAttestedEntriesV99,
  validateSuiteV99,
} from '../lib/verified-benchmark-runner-v99.js';

const BASE_URL=String(process.env.UNIVERSAL_CORE_URL||'https://wae-inteligencia-universal.onrender.com').replace(/\/+$/,'');
const TOKEN=String(process.env.WAE_RUNTIME_BRIDGE_TOKEN||'');
const TARGET_ID=String(process.env.BENCHMARK_TARGET_ID||'universal_core').trim().toLowerCase();
const EXPECTED_REFERENCE_ID=String(process.env.BENCHMARK_REFERENCE_ID||'openai:gpt-6-astra').trim().toLowerCase();
const CONCURRENCY=Math.max(1,Math.min(4,Number(process.env.BENCHMARK_CONCURRENCY)||2));
const REQUEST_TIMEOUT_MS=Math.max(30_000,Math.min(240_000,Number(process.env.BENCHMARK_REQUEST_TIMEOUT_MS)||180_000));
const REQUIRE_CERTIFICATION=String(process.env.BENCHMARK_REQUIRE_CERTIFICATION||'0')==='1';
const ARTIFACT_DIR=resolve(process.cwd(),process.env.BENCHMARK_ARTIFACT_DIR||'artifacts');

const suite=adversarialEvidenceSuite();
const suiteCheck=validateSuiteV99(suite);
if(!suiteCheck.ok)throw new Error(`v99_suite_contract_failed:${JSON.stringify(suiteCheck)}`);
if(suite.length!==VERIFIED_BENCHMARK_REQUIRED_CASES)throw new Error(`expected_${VERIFIED_BENCHMARK_REQUIRED_CASES}_cases_received_${suite.length}`);
if(TOKEN.length<24)throw new Error('WAE_RUNTIME_BRIDGE_TOKEN is required for trusted runtime execution.');

const startedAt=new Date().toISOString();

async function requestJson(path,{method='GET',body=null,auth=false}={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  try{
    const response=await fetch(`${BASE_URL}${path}`,{
      method,
      headers:{
        accept:'application/json',
        ...(body?{'content-type':'application/json'}:{}),
        ...(auth?{'x-wae-worker-token':TOKEN}:{}),
      },
      body:body?JSON.stringify(body):undefined,
      signal:controller.signal,
    });
    const text=await response.text();
    let payload;
    try{payload=text?JSON.parse(text):{};}catch{payload={success:false,error:'non_json_response',detail:text.slice(0,300)};}
    if(!response.ok){
      const error=new Error(`${path}:${response.status}:${payload?.error||'request_failed'}:${payload?.detail||''}`);
      error.status=response.status;
      error.payload=payload;
      throw error;
    }
    return payload;
  }finally{clearTimeout(timer);}
}

function percentile(values,p){
  const rows=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!rows.length)return null;
  const index=Math.min(rows.length-1,Math.max(0,Math.ceil(rows.length*p)-1));
  return Number(rows[index].toFixed(2));
}

function latencySummary(values){
  const rows=values.map(Number).filter(value=>Number.isFinite(value)&&value>=0);
  return{
    samples:rows.length,
    meanMs:rows.length?Number((rows.reduce((a,b)=>a+b,0)/rows.length).toFixed(2)):null,
    p50Ms:percentile(rows,.50),
    p95Ms:percentile(rows,.95),
    p99Ms:percentile(rows,.99),
    maxMs:rows.length?Number(Math.max(...rows).toFixed(2)):null,
  };
}

async function executeSide(testCase,side){
  return requestJson('/api/benchmark/v93',{
    method:'POST',auth:true,
    body:{action:'execute_case',caseId:testCase.id,promptHash:testCase.promptHash,side},
  });
}

async function executePair(testCase,index){
  const order=index%2===0?['target','reference']:['reference','target'];
  const results={};
  for(const side of order)results[side]=await executeSide(testCase,side);
  const target=results.target?.candidate;
  const reference=results.reference?.candidate;
  if(!target||!reference)throw new Error(`candidate_missing:${testCase.id}`);
  return{
    caseId:testCase.id,
    promptHash:testCase.promptHash,
    candidates:[target,reference],
  };
}

async function mapConcurrent(items,limit,worker){
  const results=new Array(items.length);
  let cursor=0;
  const runners=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      results[index]=await worker(items[index],index);
      process.stdout.write(`completed ${index+1}/${items.length}\n`);
    }
  });
  await Promise.all(runners);
  return results;
}

console.log(`Universal Core v99 verified arena: ${suite.length} paired cases; target=${TARGET_ID}; expectedReference=${EXPECTED_REFERENCE_ID}`);
const [arenaStatus,premiumStatus]=await Promise.all([
  requestJson('/api/benchmark/v93'),
  requestJson('/api/benchmark/v98'),
]);
const readiness=readinessGateV99({arenaStatus,premiumStatus,expectedReferenceId:EXPECTED_REFERENCE_ID});
if(!readiness.ready)throw new Error(`benchmark_readiness_hold:${JSON.stringify(readiness)}`);

const referenceId=String(arenaStatus?.comparator?.referenceId||'').trim().toLowerCase();
if(referenceId!==EXPECTED_REFERENCE_ID)throw new Error(`exact_reference_mismatch:${referenceId||'none'}!=${EXPECTED_REFERENCE_ID}`);

const entries=await mapConcurrent(suite,CONCURRENCY,executePair);
const entryValidation=validateAttestedEntriesV99({entries,suite,targetId:TARGET_ID,referenceId});
if(!entryValidation.ok)throw new Error(`attested_entry_validation_failed:${JSON.stringify(entryValidation)}`);

const arenaResult=await requestJson('/api/benchmark/v93',{
  method:'POST',auth:true,
  body:{action:'certify_attested_and_record',entries,targetId:TARGET_ID,referenceId},
});
const premiumResult=await requestJson('/api/benchmark/v98',{
  method:'POST',auth:true,
  body:{action:'certify',entries,targetId:TARGET_ID,referenceId},
});

const targetLatencies=[];
const referenceLatencies=[];
for(const entry of entries){
  const target=entry.candidates.find(candidate=>String(candidate?.id||'').toLowerCase()===TARGET_ID);
  const reference=entry.candidates.find(candidate=>String(candidate?.id||'').toLowerCase()===referenceId);
  targetLatencies.push(Number(target?.latencyMs));
  referenceLatencies.push(Number(reference?.latencyMs));
}
const commitSha=entries[0]?.candidates?.find(candidate=>String(candidate?.id||'').toLowerCase()===TARGET_ID)?.attestation?.commitSha||'';
const completedAt=new Date().toISOString();
const publicEvidence=buildPublicEvidenceV99({
  suiteHash:adversarialSuiteHash(),
  targetId:TARGET_ID,
  referenceId,
  commitSha,
  startedAt,
  completedAt,
  arenaResult,
  premiumResult,
  entryValidation,
  readiness,
  executionSummary:{
    executedCases:entries.length,
    failedCases:0,
    targetLatencyMs:latencySummary(targetLatencies),
    referenceLatencyMs:latencySummary(referenceLatencies),
  },
});
if(!publicEvidenceIsSanitizedV99(publicEvidence))throw new Error('public_evidence_sanitization_failed');

await mkdir(ARTIFACT_DIR,{recursive:true});
const stamp=completedAt.replace(/[:.]/g,'-');
const artifact=resolve(ARTIFACT_DIR,`verified-astra-benchmark-v99-${stamp}.json`);
await writeFile(artifact,`${JSON.stringify(publicEvidence,null,2)}\n`,'utf8');
console.log(`sanitized evidence: ${artifact}`);
console.log(`premium verdict: ${publicEvidence.premium.verdict}; claimAllowed=${publicEvidence.claimAuthorization.allowed}`);
console.log(`evidence digest: ${publicEvidence.evidenceDigest}`);

if(REQUIRE_CERTIFICATION&&publicEvidence.claimAuthorization.allowed!==true){
  process.exitCode=2;
}
