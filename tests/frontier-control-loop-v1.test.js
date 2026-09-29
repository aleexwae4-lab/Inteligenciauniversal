import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromotionDecision } from '../lib/frontier-control-loop-v1.js';

test('blocks promotion when score regresses beyond threshold',()=>{
  const r=buildPromotionDecision({evaluation:{score:.70},baselineScore:.75,regressionThreshold:.01});
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.regression,true);
});

test('requires a baseline instead of inventing one',()=>{
  const r=buildPromotionDecision({evaluation:{score:.90}});
  assert.equal(r.status,'BASELINE_REQUIRED');
});

test('allows eligibility only when measured score is stable or better',()=>{
  const r=buildPromotionDecision({evaluation:{score:.80},baselineScore:.79,regressionThreshold:.01});
  assert.equal(r.status,'ELIGIBLE');
});
