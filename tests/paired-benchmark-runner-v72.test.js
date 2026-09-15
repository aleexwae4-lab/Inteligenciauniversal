import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evidenceBenchmarkSuite } from '../lib/evidence-benchmark-v71.js';
import { deterministicCandidateOrder, pairedRunnerCapabilities, runTrustedPairedBenchmark } from '../lib/paired-benchmark-runner-v72.js';

const minimalSuite=evidenceBenchmarkSuite();
function adapter(prefix,{failCase=null,retryOnceCase=null}={}){
  const calls=new Map();
  return{generate:async({caseId,prompt})=>{
    calls.set(caseId,(calls.get(caseId)||0)+1);
    if(caseId===failCase)throw Object.assign(new Error('permanent_failure'),{retryable:false,code:'permanent'});
    if(caseId===retryOnceCase&&calls.get(caseId)===1)throw Object.assign(new Error('transport_timeout'),{retryable:true,code:'timeout'});
    return{answer:`${prefix}: ${prompt}`,provider:prefix,model:`${prefix}-model-v2`,latencyMs:10,costUsd:0};
  },calls};
}

test('v72 capabilities fix the arena at 48 paired cases / 96 successful responses',()=>{
  const caps=pairedRunnerCapabilities();
  assert.equal(caps.cases,48);assert.equal(caps.expectedSuccessfulResponses,96);assert.equal(caps.maxAttemptsPerCandidatePerCase,2);assert.equal(caps.simulatedReferenceAllowed,false);assert.equal(caps.contentBasedRetry,false);
});

test('candidate execution order is deterministic and not globally target-first',()=>{
  const orders=minimalSuite.map(x=>deterministicCandidateOrder(x.id).join(':'));
  assert.deepEqual(deterministicCandidateOrder(minimalSuite[0].id),deterministicCandidateOrder(minimalSuite[0].id));
  assert.ok(orders.includes('target:reference'));assert.ok(orders.includes('reference:target'));
});

test('v72 completes all 48 pairs with real injected adapters and never fabricates a reference',async()=>{
  const target=adapter('target'),reference=adapter('reference');
  const run=await runTrustedPairedBenchmark({targetId:'universal_core',referenceId:'reference-v2',targetAdapter:target,referenceAdapter:reference});
  assert.equal(run.complete,true);assert.equal(run.completedPairs,48);assert.equal(run.entries.length,48);assert.equal(run.attempts.length,96);assert.equal(run.certification.evaluatedCases,48);
  assert.ok(run.entries.every(x=>x.candidates.length===2));
});

test('v72 retries only an explicitly retryable transport failure once',async()=>{
  const retryCase=minimalSuite[0].id;const target=adapter('target',{retryOnceCase:retryCase}),reference=adapter('reference');
  const run=await runTrustedPairedBenchmark({targetId:'universal_core',referenceId:'reference-v2',targetAdapter:target,referenceAdapter:reference});
  assert.equal(run.complete,true);assert.equal(target.calls.get(retryCase),2);assert.equal(run.attempts.filter(x=>x.caseId===retryCase&&x.role==='target').length,2);
});

test('v72 fails incomplete instead of replacing a bad/permanent response',async()=>{
  const failCase=minimalSuite[3].id;const target=adapter('target',{failCase}),reference=adapter('reference');
  const run=await runTrustedPairedBenchmark({targetId:'universal_core',referenceId:'reference-v2',targetAdapter:target,referenceAdapter:reference});
  assert.equal(run.complete,false);assert.equal(run.status,'incomplete');assert.equal(run.verdict,'NOT_PROVEN');assert.equal(run.certification,null);assert.equal(target.calls.get(failCase),1);assert.equal(run.completedPairs,47);
});

test('v72 rejects generic or unversioned references before executing any case',async()=>{
  const target=adapter('target'),reference=adapter('reference');
  await assert.rejects(()=>runTrustedPairedBenchmark({targetId:'universal_core',referenceId:'gpt',targetAdapter:target,referenceAdapter:reference}),/versioned_reference_required/);
  assert.equal(target.calls.size,0);assert.equal(reference.calls.size,0);
});

test('v72 migration pins 48 canonical case hashes and private RLS ledgers',()=>{
  const sql=fs.readFileSync(new URL('../supabase/migrations/20260915234500_trusted_evidence_benchmark_v72.sql',import.meta.url),'utf8');
  assert.match(sql,/wae_evidence_benchmark_manifest_v71/);assert.match(sql,/wae_evidence_benchmark_runs_v72/);assert.match(sql,/wae_evidence_benchmark_attempts_v72/);
  assert.match(sql,/enable row level security/i);assert.match(sql,/wae_validate_worker_token/);assert.match(sql,/v_pairs<>48/);assert.match(sql,/successful_response_already_recorded/);assert.match(sql,/attempt between 1 and 2/);
  const tuples=[...sql.matchAll(/\('(?:adversarial|conflict|efficiency|engineering|instruction|integrity|multilingual|noisy|provenance|reasoning|research|structured)-\d{2}','[0-9a-f]{64}'/g)];
  assert.equal(tuples.length,48);
});
