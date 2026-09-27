import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierArenaReferences, evaluateFrontierArena } from '../lib/frontier-arena-v1.js';

test('frontier arena exposes attributed Astra reference measurements', () => {
  const r = frontierArenaReferences();
  assert.equal(r.references['gpqa-diamond'].value, 0.96);
  assert.equal(r.policy.noSyntheticScores, true);
});

test('missing measurement is not treated as zero', () => {
  const r = evaluateFrontierArena({});
  assert.equal(r.cases[0].status, 'UNMEASURED');
  assert.equal(r.cases[0].actual, null);
  assert.equal(r.verdict, 'NO_EVIDENCE');
});

test('measured result is benchmark-scoped', () => {
  const r = evaluateFrontierArena({ 'gpqa-diamond': 0.97, 'terminal-bench-4': 0.50 });
  assert.equal(r.cases.find(x => x.id === 'gpqa-diamond').status, 'AT_OR_ABOVE_REFERENCE');
  assert.equal(r.cases.find(x => x.id === 'terminal-bench-4').status, 'BELOW_REFERENCE');
  assert.equal(r.verdict, 'BENCHMARK_SCOPED_ONLY');
});
