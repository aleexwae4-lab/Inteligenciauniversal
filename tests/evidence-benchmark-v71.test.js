import test from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkSuite as v62Suite } from '../lib/supremacy-benchmark-v62.js';
import { compareBenchmarkCandidates } from '../lib/evaluation-plane.js';
import { evidenceBenchmarkSuite, evidenceBenchmarkManifest, certifyEvidenceBenchmarkRun, isVersionedReferenceId, EVIDENCE_BENCHMARK_VERSION } from '../lib/evidence-benchmark-v71.js';

test('v71 evidence arena preserves the immutable 32-case v62 base and adds exactly 16 evidence cases',()=>{
  const base=v62Suite(),suite=evidenceBenchmarkSuite();
  assert.equal(base.length,32);
  assert.equal(suite.length,48);
  assert.deepEqual(suite.slice(0,32).map(x=>[x.id,x.promptHash]),base.map(x=>[x.id,x.promptHash]));
  assert.equal(new Set(suite.map(x=>x.id)).size,48);
  assert.ok(suite.every(x=>typeof x.promptHash==='string'&&x.promptHash.length===64));
});

test('v71 has twelve balanced categories with four immutable cases each',()=>{
  const manifest=evidenceBenchmarkManifest();
  assert.equal(manifest.version,EVIDENCE_BENCHMARK_VERSION);
  assert.equal(manifest.holdoutCases,48);
  assert.equal(manifest.baseCases,32);
  assert.equal(manifest.evidenceCases,16);
  assert.equal(manifest.categories.length,12);
  assert.ok(manifest.categories.every(x=>x.count===4&&x.maxCriticalFailures===0));
  assert.equal(manifest.fullSuiteRequired,true);
  assert.equal(manifest.versionedReferenceRequired,true);
  assert.match(manifest.claimPolicy.forbidden,/simulated reference/i);
});

test('v71 rejects generic model-family labels and accepts only explicit versioned references',()=>{
  for(const id of ['gpt','chatgpt','claude','gemini','grok','reference','baseline',''])assert.equal(isVersionedReferenceId(id),false,id);
  assert.equal(isVersionedReferenceId('gpt-5.6-sol'),true);
  assert.equal(isVersionedReferenceId('claude-sonnet-5'),true);
  assert.equal(isVersionedReferenceId('reference-v2'),true);
});

test('v71 cannot certify a self-test with no paired reference responses',()=>{
  const suite=evidenceBenchmarkSuite();
  const entries=suite.map(item=>({caseId:item.id,promptHash:item.promptHash,candidates:[{id:'universal_core',answer:'respuesta de prueba'}]}));
  const result=certifyEvidenceBenchmarkRun({entries,targetId:'universal_core',referenceId:'gpt-5.6-sol'});
  assert.equal(result.claimAllowed,false);
  assert.equal(result.verdict,'NOT_PROVEN');
  assert.equal(result.gates.pairedSuiteGate,false);
  assert.equal(result.evaluatedCases,0);
  assert.equal(result.invalid.length,48);
  assert.ok(result.invalid.every(x=>x.reason==='missing_target_or_reference'));
});

test('v71 refuses an incomplete 47-case paired run even with a versioned reference',()=>{
  const suite=evidenceBenchmarkSuite().slice(0,47);
  const entries=suite.map(item=>({caseId:item.id,promptHash:item.promptHash,candidates:[{id:'universal_core',answer:'x'},{id:'gpt-5.6-sol',answer:'y'}]}));
  const result=certifyEvidenceBenchmarkRun({entries,targetId:'universal_core',referenceId:'gpt-5.6-sol'});
  assert.equal(result.gates.versionedReferenceGate,true);
  assert.equal(result.gates.fullSuiteGate,false);
  assert.equal(result.gates.pairedSuiteGate,false);
  assert.equal(result.claimAllowed,false);
});

test('v71 scientific relevance case ranks topic match above citation popularity',()=>{
  const item=evidenceBenchmarkSuite().find(x=>x.id==='conflict-03');
  const comparison=compareBenchmarkCandidates({
    caseId:item.id,prompt:item.prompt,mode:item.mode,assertions:item.assertions,
    candidates:[
      {id:'universal_core',answer:'K1 debe rankear primero por relevancia temática: responde directamente a hipertensión; el número de citas de K2 no compensa que trate COVID-19.'},
      {id:'reference-v2',answer:'K2 debe rankear primero porque tiene 4000 citas y por eso es más confiable.'}
    ]
  });
  const target=comparison.ranking.find(x=>x.id==='universal_core');
  const reference=comparison.ranking.find(x=>x.id==='reference-v2');
  assert.equal(comparison.ranking[0].id,'universal_core');
  assert.ok(target.evaluation.score>reference.evaluation.score);
  assert.equal(target.evaluation.hardFailure,false);
  assert.equal(reference.evaluation.hardFailure,true);
});

test('v71 integrity case ranks retraction-aware answer above unsafe evidence use',()=>{
  const item=evidenceBenchmarkSuite().find(x=>x.id==='integrity-01');
  const comparison=compareBenchmarkCandidates({
    caseId:item.id,prompt:item.prompt,mode:item.mode,assertions:item.assertions,
    candidates:[
      {id:'universal_core',answer:'K1 puede respaldar la afirmación con cautela. K2 está retractado y no debe usarse para sostener la afirmación factual.'},
      {id:'reference-v2',answer:'K2 puede respaldar la afirmación porque fue publicado y trata la misma intervención.'}
    ]
  });
  const target=comparison.ranking.find(x=>x.id==='universal_core');
  const reference=comparison.ranking.find(x=>x.id==='reference-v2');
  assert.equal(comparison.ranking[0].id,'universal_core');
  assert.ok(target.evaluation.score>reference.evaluation.score);
  assert.equal(target.evaluation.hardFailure,false);
  assert.equal(reference.evaluation.hardFailure,true);
});
