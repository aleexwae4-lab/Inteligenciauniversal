import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvaluationRun, evaluateRun, compareEvaluationRuns } from '../lib/frontier-evaluation-fabric-v1.js';

const valid={model:'Universal Core',harness:'wae-frontier-harness/v1',graderVersion:'grader/v1',datasetVersion:'dataset/v1',commit:'abc123',runId:'run-1'};

test('requires reproducibility provenance',()=>{
  const r=createEvaluationRun({model:'Universal Core'});
  assert.equal(r.valid,false);
  assert.ok(r.errors.includes('harness_required'));
  assert.ok(r.errors.includes('graderVersion_required'));
  assert.ok(r.errors.includes('datasetVersion_required'));
  assert.ok(r.errors.includes('commit_required'));
});

test('accepts attributed evaluation run',()=>{
  const r=evaluateRun({...valid,measurements:[{benchmark:'internal-reasoning-v1',score:.81}]});
  assert.equal(r.valid,true);
  assert.equal(r.accepted.length,1);
  assert.equal(r.promotion.status,'ELIGIBLE_PENDING_REFERENCE_COMPARISON');
});

test('blocks promotion on reproducible regression',()=>{
  const r=evaluateRun({...valid,regressionThreshold:.01,measurements:[{benchmark:'internal-coding-v1',score:.70}],baselines:{'internal-coding-v1':.72}});
  assert.equal(r.regressionCount,1);
  assert.equal(r.promotion.status,'BLOCKED');
  assert.equal(r.regressions[0].comparison.status,'REGRESSION');
});

test('does not invent missing baselines or superiority claims',()=>{
  const r=evaluateRun({...valid,measurements:[{benchmark:'internal-v1',score:.9}]});
  assert.equal(r.regressions[0].comparison.status,'NO_BASELINE');
  assert.doesNotMatch(JSON.stringify(r),/superior|#1|winner|beats/i);
});

test('missing scores remain unmeasured',()=>{
  const r=compareEvaluationRuns({score:null},{score:.8});
  assert.equal(r.status,'UNMEASURED');
  assert.equal(r.regression,false);
});
