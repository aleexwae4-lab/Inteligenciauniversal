import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentProviderRegistrySnapshot,
  maybeRefreshProviderRegistry,
  providerRegistryRecoveryState,
  __resetProviderRegistryResilienceForTests,
  PROVIDER_REGISTRY_RESILIENCE_V1,
} from '../lib/provider-registry-resilience-v1.js';

test('provider registry recovery has immediate static recovery', () => {
  __resetProviderRegistryResilienceForTests();
  const registry = [{ id:'static_provider', configured:true, model:'static-model' }];
  const snapshot = currentProviderRegistrySnapshot(registry);
  assert.equal(snapshot.source, 'static_registry');
  assert.deepEqual(snapshot.registry, registry);
  assert.equal(providerRegistryRecoveryState().version, PROVIDER_REGISTRY_RESILIENCE_V1);
});

test('provider registry recovery refresh is non-blocking for callers', () => {
  __resetProviderRegistryResilienceForTests();
  const registry = [{ id:'static_provider', configured:true, model:'static-model' }];
  const before = maybeRefreshProviderRegistry({ registry });
  assert.equal(before.source, 'static_registry');
  assert.equal(typeof providerRegistryRecoveryState().timeoutMs, 'number');
  assert.ok(providerRegistryRecoveryState().timeoutMs <= 900);
});
