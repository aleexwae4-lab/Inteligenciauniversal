import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseHealthSnapshot, RELEASE_HEALTH_VERSION } from '../lib/release-health-v144.js';

test('release health is non-billable and ready when a provider is configured',()=>{
  const snapshot=releaseHealthSnapshot({
    health:{providers:[{id:'wae_edge',configured:true},{id:'openai',configured:false}]},
    operations:{providerInferenceVerified:false}
  });
  assert.equal(snapshot.ok,true);
  assert.equal(snapshot.status,'ready');
  assert.equal(snapshot.readiness,'ready_upstream_not_probed');
  assert.equal(snapshot.checks.providersConfigured,1);
  assert.deepEqual(snapshot.checks.configuredProviderIds,['wae_edge']);
  assert.equal(snapshot.checks.providerInference,'not_run');
  assert.equal(snapshot.checks.paidInferenceTriggered,false);
  assert.equal(snapshot.release.version,RELEASE_HEALTH_VERSION);
});

test('release health degrades only when no provider is configured',()=>{
  const snapshot=releaseHealthSnapshot({
    health:{providers:[{id:'wae_edge',configured:false}]},
    operations:{providerInferenceVerified:false}
  });
  assert.equal(snapshot.ok,false);
  assert.equal(snapshot.status,'degraded');
  assert.equal(snapshot.readiness,'degraded_no_provider_configured');
  assert.equal(snapshot.checks.providersConfigured,0);
  assert.equal(snapshot.checks.paidInferenceTriggered,false);
});

test('verified provider state is reported without requiring a new probe',()=>{
  const snapshot=releaseHealthSnapshot({
    health:{providers:[{id:'wae_edge',configured:true}]},
    operations:{providerInferenceVerified:true}
  });
  assert.equal(snapshot.readiness,'ready_verified_recently');
  assert.equal(snapshot.checks.providerInference,'verified');
});
