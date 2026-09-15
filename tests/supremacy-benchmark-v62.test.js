import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkSuite, benchmarkSuiteManifest, certifyBenchmarkRun, wilsonLowerBound } from '../lib/supremacy-benchmark-v62.js';

function entriesFor(referenceId='gpt-5.6-sol',count=32){
  return benchmarkSuite().slice(0,count).map(item=>({
    caseId:item.id,promptHash:item.promptHash,
    candidates:[
      {id:'universal_core',answer:'Respuesta de prueba.',sources:[],latencyMs:1000,costUsd:0},
      {id:referenceId,answer:'Respuesta de referencia.',sources:[],latencyMs:1000,costUsd:0}
    ]
  }));
}

test('v62 arena requires the complete 32-case immutable suite and strict thresholds',()=>{
  const manifest=benchmarkSuiteManifest();
  assert.equal(manifest.version,'universal-benchmark-arena/v62');
  assert.equal(manifest.holdoutCases,32);
  assert.equal(manifest.minimumCases,32);
  assert.equal(manifest.minimumWinRate,.68);
  assert.equal(manifest.maxCriticalFailureRate,0);
  assert.equal(manifest.fullSuiteRequired,true);
  assert.equal(manifest.versionedReferenceRequired,true);
});

test('v62 statistical gate is stronger than a raw majority',()=>{
  assert.ok(wilsonLowerBound(.50,32)<.50);
  assert.ok(wilsonLowerBound(.80,32)>.50);
});

test('v62 refuses certification when even one holdout case is missing',()=>{
  const result=certifyBenchmarkRun({entries:entriesFor('gpt-5.6-sol',31),targetId:'universal_core',referenceId:'gpt-5.6-sol'});
  assert.equal(result.gates.fullSuiteGate,false);
  assert.equal(result.claimAllowed,false);
  assert.equal(result.verdict,'NOT_PROVEN');
});

test('v62 refuses unversioned competitor family labels',()=>{
  const result=certifyBenchmarkRun({entries:entriesFor('gpt',32),targetId:'universal_core',referenceId:'gpt'});
  assert.equal(result.gates.versionedReferenceGate,false);
  assert.equal(result.claimAllowed,false);
});

test('v62 exposes category-level anti-collapse gates',()=>{
  const result=certifyBenchmarkRun({entries:entriesFor('gpt-5.6-sol',32),targetId:'universal_core',referenceId:'gpt-5.6-sol'});
  assert.equal(Object.keys(result.categoryStats).length,8);
  for(const row of Object.values(result.categoryStats))assert.equal(row.total,4);
  assert.equal(typeof result.metrics.wilsonLowerBound95,'number');
  assert.equal(typeof result.gates.categoryGate,'boolean');
});
