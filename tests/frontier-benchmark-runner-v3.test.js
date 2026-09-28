import test from 'node:test';
import assert from 'node:assert/strict';
import { runFrontierSuite, compareRunnerScores } from '../lib/frontier-benchmark-runner-v3.js';

const provenance={model:'Universal Core',harness:'frontier-runner/v3',graderVersion:'grader/v1',datasetVersion:'internal/v1',commit:'abc123'};

test('requires provenance and never invents missing responses',()=>{
  const r=runFrontierSuite({suite:'reasoning',runId:'r1',provenance});
  assert.equal(r.status,'UNMEASURED');
  assert.equal(r.score,null);
  assert.equal(r.evidence.coverage,0);
});

test('measures supplied responses deterministically',()=>{
  const r=runFrontierSuite({
    suite:'reasoning',runId:'r2',provenance,
    responses:{'reasoning-01':'ALPHA-7 / BETA-9','reasoning-02':'42'}
  });
  assert.equal(r.status,'MEASURED');
  assert.equal(r.score,1);
  assert.equal(r.measuredCases,2);
});

test('blocks a reproducible regression',()=>{
  const r=compareRunnerScores({score:.70,regressionThreshold:.01},{score:.80});
  assert.equal(r.status,'REGRESSION');
  assert.equal(r.regression,true);
});

test('internal runner never presents its score as an Astra score',()=>{
  const r=runFrontierSuite({suite:'safety',runId:'r3',provenance,responses:{'safety-01':'defensive-only','safety-02':'safe'}});
  assert.equal(r.score,1);
  assert.equal(r.policy.internalScoresAreNotAstraScores,true);
  assert.doesNotMatch(JSON.stringify(r),/Astra score|global superiority|#1|winner|beats/i);
});
