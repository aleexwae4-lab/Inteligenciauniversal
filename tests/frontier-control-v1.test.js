import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMeasurement, frontierControlSnapshot } from '../lib/frontier-control-v1.js';

const valid={benchmark:'gpqa-diamond',score:.97,runId:'run-001',harness:'wae-eval-1',graderVersion:'grader-1',datasetVersion:'gpqa-diamond-v1',model:'universal-core'};

test('requires reproducible provenance',()=>{
  const r=validateMeasurement({benchmark:'gpqa-diamond',score:.97});
  assert.equal(r.valid,false);
  assert.ok(r.errors.includes('runId_required'));
  assert.ok(r.errors.includes('harness_required'));
});

test('accepts a fully attributed measurement',()=>{
  const r=validateMeasurement(valid);
  assert.equal(r.valid,true);
  assert.equal(r.measurement.score,.97);
});

test('rejects unknown benchmarks and out of range scores',()=>{
  const r=validateMeasurement({...valid,benchmark:'fake',score:2});
  assert.equal(r.valid,false);
  assert.ok(r.errors.includes('benchmark_not_in_reference_matrix'));
  assert.ok(r.errors.includes('score_must_be_between_0_and_1'));
});

test('control snapshot preserves accepted and rejected evidence',()=>{
  const r=frontierControlSnapshot([valid,{benchmark:'gpqa-diamond',score:.5}]);
  assert.equal(r.accepted,1);
  assert.equal(r.rejected,1);
  assert.equal(r.evidenceCoverage,Number((1/11).toFixed(4)));
  assert.equal(r.learning.cases.find(x=>x.id==='gpqa-diamond').actual,.97);
});
