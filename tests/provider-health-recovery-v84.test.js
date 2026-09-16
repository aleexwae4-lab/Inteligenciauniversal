import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOperationalProvider, PROVIDER_RECOVERY_PROBE_AFTER_MS } from '../lib/provider-health-v81.js';

const provider={id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true};
const NOW=Date.parse('2026-09-16T06:00:00Z');

function row(overrides={}){
  return{
    provider:'wae_edge',
    model:'iu-gpt-runtime-v13',
    attempts:47,
    successes:3,
    failures:44,
    consecutive_failures:10,
    circuit_until:null,
    last_error_class:'session_creation_failed',
    last_failure_at:new Date(NOW-PROVIDER_RECOVERY_PROBE_AFTER_MS-1000).toISOString(),
    ...overrides
  };
}

test('stale failure debt becomes a bounded half-open recovery probe',()=>{
  const result=classifyOperationalProvider(provider,row(),NOW);
  assert.equal(result.state,'degraded');
  assert.equal(result.eligible,true);
  assert.equal(result.healthy,false);
  assert.equal(result.reason,'half_open_recovery_probe');
  assert.equal(result.recoveryProbe,true);
});

test('recent failure debt remains ineligible',()=>{
  const result=classifyOperationalProvider(provider,row({last_failure_at:new Date(NOW-60_000).toISOString()}),NOW);
  assert.equal(result.state,'unhealthy');
  assert.equal(result.eligible,false);
  assert.equal(result.reason,'failure_debt');
  assert.equal(result.recoveryProbe,false);
});

test('an active circuit never enters half-open recovery',()=>{
  const result=classifyOperationalProvider(provider,row({circuit_until:new Date(NOW+60_000).toISOString()}),NOW);
  assert.equal(result.state,'unhealthy');
  assert.equal(result.eligible,false);
  assert.equal(result.reason,'persistent_circuit_open');
  assert.equal(result.recoveryProbe,false);
});
