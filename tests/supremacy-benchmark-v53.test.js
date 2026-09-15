import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkSuite, benchmarkSuiteManifest, certifyBenchmarkRun, SUPREMACY_BENCHMARK_VERSION } from '../lib/supremacy-benchmark-v53.js';

const suite=benchmarkSuite();
const byId=id=>suite.find(x=>x.id===id);
const entry=(caseId,targetAnswer,referenceAnswer,{targetSources=[],referenceSources=[],targetLatencyMs=100,referenceLatencyMs=100}={})=>{
  const c=byId(caseId);
  return{caseId,promptHash:c.promptHash,candidates:[
    {id:'universal_core',answer:targetAnswer,sources:targetSources,latencyMs:targetLatencyMs},
    {id:'gpt-5.6-sol',answer:referenceAnswer,sources:referenceSources,latencyMs:referenceLatencyMs}
  ]};
};

test('v53 publishes a 32-case balanced blind holdout suite',()=>{
  const manifest=benchmarkSuiteManifest();
  assert.equal(manifest.version,SUPREMACY_BENCHMARK_VERSION);
  assert.equal(manifest.holdoutCases,32);
  assert.equal(manifest.categories.length,8);
  assert.ok(manifest.categories.every(x=>x.count===4));
  assert.equal(manifest.blind,true);
  assert.equal(manifest.providerIdentityUsedForScoring,false);
  assert.equal(manifest.minimumCases,30);
  assert.match(manifest.claimPolicy.forbidden,/Global|universal/i);
});

test('every benchmark case has a deterministic unique prompt hash',()=>{
  assert.equal(new Set(suite.map(x=>x.id)).size,32);
  assert.equal(new Set(suite.map(x=>x.promptHash)).size,32);
  assert.ok(suite.every(x=>/^[a-f0-9]{64}$/.test(x.promptHash)));
});

test('certification fails closed when sample coverage is insufficient',()=>{
  const c=byId('structured-03');
  const result=certifyBenchmarkRun({referenceId:'gpt-5.6-sol',entries:[entry(c.id,'12','13')]});
  assert.equal(result.claimAllowed,false);
  assert.equal(result.gates.referenceGate,true);
  assert.equal(result.gates.coverageGate,false);
  assert.equal(result.verdict,'NOT_PROVEN');
  assert.match(result.claim,/not proven/i);
});

test('a prompt hash mismatch invalidates the run rather than silently scoring it',()=>{
  const result=certifyBenchmarkRun({referenceId:'gpt-5.6-sol',entries:[{caseId:'structured-03',promptHash:'bad',candidates:[{id:'universal_core',answer:'12'},{id:'gpt-5.6-sol',answer:'13'}]}]});
  assert.equal(result.invalid.length,1);
  assert.equal(result.invalid[0].reason,'prompt_hash_mismatch');
  assert.equal(result.gates.noInvalidEntries,false);
  assert.equal(result.claimAllowed,false);
});

test('named external reference is mandatory and generic baseline labels cannot certify superiority',()=>{
  const result=certifyBenchmarkRun({referenceId:'baseline',entries:[]});
  assert.equal(result.gates.referenceGate,false);
  assert.equal(result.claimAllowed,false);
});

test('benchmark losses become explicit regression cases without claiming weight training',()=>{
  const result=certifyBenchmarkRun({referenceId:'gpt-5.6-sol',entries:[entry('structured-03','13','12')]});
  assert.ok(result.regressions.length>=1);
  assert.equal(result.regressions[0].baseModelWeightsChanged,false);
  assert.match(result.regressions[0].instruction,/regression/i);
});

test('benchmark wins do not bypass the minimum-case superiority gate',()=>{
  const result=certifyBenchmarkRun({referenceId:'gpt-5.6-sol',entries:[entry('structured-03','12','13')]});
  assert.equal(result.aggregate.total,1);
  assert.equal(result.claimAllowed,false);
  assert.doesNotMatch(result.claim,/universal superiority/i);
});
