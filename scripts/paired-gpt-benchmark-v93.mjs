import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { benchmarkSuite, certifyBenchmarkRun, benchmarkSuiteManifest } from '../lib/supremacy-benchmark-v62.js';
import {
  PAIRED_GPT_BENCHMARK_VERSION,
  DEFAULT_TARGET_ID,
  DEFAULT_REFERENCE_ID,
  DEFAULT_REASONING_EFFORT,
  buildOpenAIRequest,
  buildUniversalRequest,
  extractOpenAIText,
  extractOpenAISources,
  extractUniversalAnswer,
  extractUniversalSources,
  estimateOpenAICostUsd,
  benchmarkRunManifest,
} from '../lib/paired-gpt-benchmark-v93.js';

const TARGET_URL=String(process.env.UNIVERSAL_CORE_URL||'https://wae-inteligencia-universal.onrender.com').replace(/\/$/,'');
const TARGET_ID=String(process.env.BENCHMARK_TARGET_ID||DEFAULT_TARGET_ID).trim();
const REFERENCE_ID=String(process.env.BENCHMARK_REFERENCE_ID||DEFAULT_REFERENCE_ID).trim();
const REASONING_EFFORT=String(process.env.BENCHMARK_REASONING_EFFORT||DEFAULT_REASONING_EFFORT).trim();
const FIXTURE_PATH=String(process.env.GPT_REFERENCE_FIXTURE||'').trim();
const INTER_CASE_MS=Math.max(0,Number(process.env.BENCHMARK_INTER_CASE_MS||4500));
const REQUEST_TIMEOUT_MS=Math.max(10_000,Number(process.env.BENCHMARK_REQUEST_TIMEOUT_MS||180_000));
const REQUIRE_CERTIFICATION=String(process.env.BENCHMARK_REQUIRE_CERTIFICATION||'0')==='1';
const CASE_FILTER=new Set(String(process.env.BENCHMARK_CASES||'').split(',').map(x=>x.trim()).filter(Boolean));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function safeJson(raw){try{return raw?JSON.parse(raw):{}}catch{return{raw:String(raw||'')}}}
function publicHeaders(headers){
  const keep=['x-wae-chat-release','x-wae-latency-path','x-wae-latency-profile','x-wae-specialist-path','x-wae-factuality-status','x-request-id','server-timing'];
  return Object.fromEntries(keep.map(name=>[name,headers.get(name)]).filter(([,value])=>value));
}

async function fetchJson(url,options={},timeoutMs=REQUEST_TIMEOUT_MS){
  const started=performance.now();
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(timeoutMs)});
  const raw=await response.text();
  const data=safeJson(raw);
  const latencyMs=Math.round(performance.now()-started);
  if(!response.ok){
    const error=new Error(`HTTP ${response.status}: ${String(data?.error?.message||data?.error||data?.message||raw||'request_failed').slice(0,500)}`);
    error.status=response.status;error.payload=data;error.latencyMs=latencyMs;
    throw error;
  }
  return{data,latencyMs,status:response.status,headers:publicHeaders(response.headers)};
}

async function retry(label,fn,maxAttempts=2){
  const started=performance.now();
  let last;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{return{...(await fn(attempt)),attempts:attempt,totalLatencyMs:Math.round(performance.now()-started)}}catch(error){
      last=error;
      const status=Number(error?.status||0),retryable=!status||status===408||status===409||status===429||status>=500;
      if(!retryable||attempt===maxAttempts)break;
      await sleep(900*attempt);
    }
  }
  const error=new Error(`${label}: ${last?.message||'request_failed'}`);
  error.status=last?.status||0;error.cause=last;
  throw error;
}

async function runUniversal(testCase){
  const endpoint=`${TARGET_URL}/api/chat`;
  const request=buildUniversalRequest(testCase);
  const started=performance.now();
  try{
    const result=await retry('universal_core',()=>fetchJson(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json','origin':TARGET_URL,'x-wae-benchmark':'paired-gpt-v93'},
      body:JSON.stringify(request),
    }),2);
    return{
      ok:true,
      answer:extractUniversalAnswer(result.data),
      sources:extractUniversalSources(result.data),
      latencyMs:result.totalLatencyMs,
      costUsd:null,
      attempts:result.attempts,
      status:result.status,
      headers:result.headers,
      runtime:{provider:result.data?.provider||null,model:result.data?.model||null,routingPath:result.data?.routing_path||result.data?.runtime_control?.path||null,responseSchema:result.data?.response_schema||null},
      raw:result.data,
    };
  }catch(error){
    return{ok:false,answer:'',sources:[],latencyMs:Math.round(performance.now()-started),costUsd:null,attempts:null,status:Number(error?.status||0)||null,error:String(error?.message||error),raw:null};
  }
}

function fixtureMap(payload={}){
  const entries=Array.isArray(payload)?payload:(Array.isArray(payload?.entries)?payload.entries:[]);
  return new Map(entries.map(entry=>[String(entry?.caseId||''),entry]));
}

async function loadReferenceFixture(){
  if(!FIXTURE_PATH)return null;
  const payload=JSON.parse(await readFile(resolve(FIXTURE_PATH),'utf8'));
  const declared=String(payload?.referenceId||payload?.manifest?.referenceId||REFERENCE_ID);
  if(declared!==REFERENCE_ID)throw new Error(`fixture_reference_mismatch: expected ${REFERENCE_ID}, got ${declared}`);
  if(payload?.simulated===true)throw new Error('simulated_reference_forbidden');
  return{payload,map:fixtureMap(payload)};
}

async function runOpenAI(testCase,fixture){
  if(fixture){
    const row=fixture.map.get(testCase.id);
    if(!row)throw new Error(`fixture_missing_case:${testCase.id}`);
    const candidate=(Array.isArray(row.candidates)?row.candidates.find(x=>String(x?.id)===REFERENCE_ID):null)||row.reference||row;
    const answer=String(candidate?.answer??candidate?.text??'');
    if(!answer.trim())throw new Error(`fixture_empty_answer:${testCase.id}`);
    return{ok:true,answer,sources:Array.isArray(candidate?.sources)?candidate.sources:[],latencyMs:Number(candidate?.latencyMs)||null,costUsd:Number.isFinite(Number(candidate?.costUsd))?Number(candidate.costUsd):null,attempts:0,status:null,headers:{},runtime:{model:REFERENCE_ID,mode:'fixture'},raw:null};
  }
  const apiKey=String(process.env.OPENAI_API_KEY||'').trim();
  if(!apiKey)throw new Error('OPENAI_API_KEY is required for a direct paired GPT benchmark');
  const body=buildOpenAIRequest(testCase,{model:REFERENCE_ID,reasoningEffort:REASONING_EFFORT});
  const started=performance.now();
  try{
    const result=await retry('openai_reference',()=>fetchJson('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'authorization':`Bearer ${apiKey}`,'content-type':'application/json','x-client-request-id':`wae-${testCase.id}-${Date.now()}`},
      body:JSON.stringify(body),
    }),2);
    return{
      ok:true,
      answer:extractOpenAIText(result.data),
      sources:extractOpenAISources(result.data),
      latencyMs:result.totalLatencyMs,
      costUsd:estimateOpenAICostUsd(result.data?.usage,REFERENCE_ID),
      attempts:result.attempts,
      status:result.status,
      headers:result.headers,
      runtime:{model:result.data?.model||REFERENCE_ID,responseId:result.data?.id||null,reasoningEffort:REASONING_EFFORT},
      raw:result.data,
    };
  }catch(error){
    return{ok:false,answer:'',sources:[],latencyMs:Math.round(performance.now()-started),costUsd:null,attempts:null,status:Number(error?.status||0)||null,error:String(error?.message||error),raw:null};
  }
}

async function main(){
  const suite=benchmarkSuite().filter(testCase=>!CASE_FILTER.size||CASE_FILTER.has(testCase.id));
  if(!suite.length)throw new Error('benchmark_case_selection_empty');
  const fixture=await loadReferenceFixture();
  const referenceMode=fixture?'external_fixture':'direct_api';
  const startedAt=new Date().toISOString();
  const entries=[];const rawCases=[];

  console.log(`[${PAIRED_GPT_BENCHMARK_VERSION}] target=${TARGET_ID} reference=${REFERENCE_ID} cases=${suite.length} reference_mode=${referenceMode}`);
  for(let i=0;i<suite.length;i++){
    const testCase=suite[i];
    const [targetResult,referenceResult]=await Promise.all([runUniversal(testCase),runOpenAI(testCase,fixture)]);
    entries.push({
      caseId:testCase.id,
      promptHash:testCase.promptHash,
      candidates:[
        {id:TARGET_ID,answer:targetResult.answer,sources:targetResult.sources,latencyMs:targetResult.latencyMs,costUsd:targetResult.costUsd},
        {id:REFERENCE_ID,answer:referenceResult.answer,sources:referenceResult.sources,latencyMs:referenceResult.latencyMs,costUsd:referenceResult.costUsd},
      ],
    });
    rawCases.push({caseId:testCase.id,category:testCase.category,mode:testCase.mode,prompt:testCase.prompt,promptHash:testCase.promptHash,target:targetResult,reference:referenceResult});
    console.log(`[${i+1}/${suite.length}] ${testCase.id} target=${targetResult.ok?'ok':'error'} ${targetResult.latencyMs}ms reference=${referenceResult.ok?'ok':'error'} ${referenceResult.latencyMs??'n/a'}ms`);
    if(i<suite.length-1&&INTER_CASE_MS)await sleep(INTER_CASE_MS);
  }

  const certification=certifyBenchmarkRun({entries,targetId:TARGET_ID,referenceId:REFERENCE_ID});
  const report={
    schema:'paired-gpt-benchmark-report/v1',
    manifest:benchmarkRunManifest({targetId:TARGET_ID,referenceId:REFERENCE_ID,targetUrl:TARGET_URL,reasoningEffort:REASONING_EFFORT,commitSha:process.env.UNIVERSAL_CORE_COMMIT||'',referenceMode}),
    suiteManifest:benchmarkSuiteManifest(),
    startedAt,
    completedAt:new Date().toISOString(),
    selectedCases:suite.length,
    completeSuite:suite.length===benchmarkSuite().length,
    entries,
    certification,
    rawCases,
  };
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const dir=resolve(process.env.BENCHMARK_ARTIFACT_DIR||'artifacts');
  await mkdir(dir,{recursive:true});
  const path=resolve(dir,`paired-gpt-benchmark-v93-${stamp}.json`);
  await writeFile(path,JSON.stringify(report,null,2),'utf8');
  const summary={artifact:path,verdict:certification.verdict,claimAllowed:certification.claimAllowed,evaluatedCases:certification.evaluatedCases,aggregate:certification.aggregate,metrics:certification.metrics,gates:certification.gates,regressions:certification.regressions?.map(x=>({caseId:x.caseId,targetScore:x.targetScore,winnerScore:x.winnerScore,failureTags:x.failureTags}))||[]};
  console.log(JSON.stringify(summary,null,2));
  if(REQUIRE_CERTIFICATION&&!certification.claimAllowed)process.exitCode=2;
}

main().catch(error=>{console.error(`[${PAIRED_GPT_BENCHMARK_VERSION}] fatal: ${error?.stack||error}`);process.exitCode=1;});
