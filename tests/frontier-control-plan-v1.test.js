import test from 'node:test';
import assert from 'node:assert/strict';
import { frontierControlPlan } from '../lib/frontier-control-v1.js';

test('frontier control plan contains promotion gates',()=>{
  const r=frontierControlPlan('coding-agents');
  assert.equal(r.version,'frontier-control/v1');
  assert.ok(r.gates.includes('run_regression_suite'));
  assert.ok(r.gates.includes('promote_only_with_provenance'));
});

test('frontier control plan never claims superiority',()=>{
  const r=frontierControlPlan('collect_measurements');
  const text=JSON.stringify(r);
  assert.doesNotMatch(text,/superior|#1|winner|beats/i);
});
