import { createHash } from 'node:crypto';
import { evidenceBenchmarkSuite, certifyEvidenceBenchmarkRun, isVersionedReferenceId, EVIDENCE_BENCHMARK_VERSION } from './evidence-benchmark-v71.js';

export const PAIRED_RUNNER_VERSION='trusted-paired-runner/v72';
const sha=value=>createHash('sha256').update(String(value??'')).digest('hex');
const text=(value,max=80000)=>String(value??'').slice(0,max);
const finite=value=>Number.isFinite(Number(value))?Number(value):null;

export function deterministicCandidateOrder(caseId=''){
  return parseInt(sha(caseId).slice(0,2),16)%2===0?['target','reference']:['reference','target'];
}

export function validateBenchmarkAdapter(adapter,name='adapter'){
  if(!adapter||typeof adapter.generate!=='function')throw new TypeError(`${name}_generate_required`);
  return adapter;
}

async function invokeWithBoundedTransportRetry({adapter,role,candidateId,testCase,onAttempt}){
  let lastError=null;
  for(let attempt=1;attempt<=2;attempt++){
    const started=Date.now();
    try{
      const raw=await adapter.generate({prompt:testCase.prompt,mode:testCase.mode,caseId:testCase.id,promptHash:testCase.promptHash,benchmarkVersion:EVIDENCE_BENCHMARK_VERSION});
      const answer=text(raw?.answer??raw?.text??'');
      if(!answer)throw Object.assign(new Error('empty_benchmark_response'),{retryable:false,code:'empty_response'});
      const result={role,candidateId,attempt,status:'success',answer,sources:Array.isArray(raw?.sources)?raw.sources.slice(0,20):[],latencyMs:finite(raw?.latencyMs)??(Date.now()-started),costUsd:finite(raw?.costUsd),requestedProvider:text(raw?.requestedProvider,80),requestedModel:text(raw?.requestedModel,160),actualProvider:text(raw?.provider??raw?.actualProvider,80),actualModel:text(raw?.model??raw?.actualModel,160),responseHash:sha(answer)};
      await onAttempt?.({...result,caseId:testCase.id,promptHash:testCase.promptHash});
      return result;
    }catch(error){
      lastError=error;
      const retryable=error?.retryable===true;
      const failed={role,candidateId,attempt,status:'error',answer:'',sources:[],latencyMs:Date.now()-started,costUsd:null,requestedProvider:'',requestedModel:'',actualProvider:'',actualModel:'',responseHash:null,errorCode:text(error?.code||error?.message||'adapter_error',120),retryable};
      await onAttempt?.({...failed,caseId:testCase.id,promptHash:testCase.promptHash});
      if(!retryable||attempt===2)return failed;
    }
  }
  return{role,candidateId,attempt:2,status:'error',errorCode:text(lastError?.message||'adapter_error',120),retryable:false};
}

export async function runTrustedPairedBenchmark({targetId='universal_core',referenceId,targetAdapter,referenceAdapter,suite=evidenceBenchmarkSuite(),onAttempt,onProgress}={}){
  const target=String(targetId||'').trim(),reference=String(referenceId||'').trim();
  if(!target)throw new Error('target_id_required');
  if(!isVersionedReferenceId(reference)||reference===target)throw new Error('versioned_reference_required');
  validateBenchmarkAdapter(targetAdapter,'target_adapter');validateBenchmarkAdapter(referenceAdapter,'reference_adapter');
  if(!Array.isArray(suite)||suite.length!==48)throw new Error('full_48_case_suite_required');
  const unique=new Set(suite.map(x=>x.id));if(unique.size!==48||suite.some(x=>!x.promptHash||!x.prompt))throw new Error('invalid_benchmark_suite');

  const entries=[],attempts=[];let completedPairs=0;
  for(let index=0;index<suite.length;index++){
    const testCase=suite[index];const results={};
    for(const role of deterministicCandidateOrder(testCase.id)){
      const candidateId=role==='target'?target:reference;
      const adapter=role==='target'?targetAdapter:referenceAdapter;
      results[role]=await invokeWithBoundedTransportRetry({adapter,role,candidateId,testCase,onAttempt:async attempt=>{attempts.push(attempt);await onAttempt?.(attempt)}});
    }
    if(results.target?.status==='success'&&results.reference?.status==='success'){
      completedPairs++;
      entries.push({caseId:testCase.id,promptHash:testCase.promptHash,candidates:[
        {id:target,answer:results.target.answer,sources:results.target.sources,latencyMs:results.target.latencyMs,costUsd:results.target.costUsd},
        {id:reference,answer:results.reference.answer,sources:results.reference.sources,latencyMs:results.reference.latencyMs,costUsd:results.reference.costUsd}
      ]});
    }
    await onProgress?.({caseId:testCase.id,index:index+1,total:48,completedPairs,complete:results.target?.status==='success'&&results.reference?.status==='success'});
  }

  const complete=completedPairs===48&&entries.length===48;
  const certification=complete?certifyEvidenceBenchmarkRun({entries,targetId:target,referenceId:reference}):null;
  return{
    schema:'trusted-paired-benchmark-run/v72',version:PAIRED_RUNNER_VERSION,benchmarkVersion:EVIDENCE_BENCHMARK_VERSION,targetId:target,referenceId:reference,
    expectedCases:48,completedPairs,complete,status:complete?(certification?.claimAllowed?'certified':'completed'):'incomplete',entries,attempts,certification,
    claimAllowed:Boolean(complete&&certification?.claimAllowed),verdict:complete?(certification?.verdict||'NOT_PROVEN'):'NOT_PROVEN',
    antiCherryPicking:{maxAttemptsPerCandidatePerCase:2,retryPolicy:'transport_errors_explicitly_marked_retryable_only',contentBasedRetry:false,successfulResponseReplacement:false,deterministicCandidateOrder:true}
  };
}

export function pairedRunnerCapabilities(){return{version:PAIRED_RUNNER_VERSION,benchmarkVersion:EVIDENCE_BENCHMARK_VERSION,cases:48,candidatesPerCase:2,expectedSuccessfulResponses:96,maxAttemptsPerCandidatePerCase:2,requiresVersionedReference:true,simulatedReferenceAllowed:false,contentBasedRetry:false,deterministicOrder:true}}
