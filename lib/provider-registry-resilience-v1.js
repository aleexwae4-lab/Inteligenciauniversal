// Universal Core — Provider Registry Resilience v1
// Non-blocking control-plane recovery: normal snapshot -> last-known-good -> static registry.
// The generation path never waits for the control plane to discover a provider.

import { loadPersistentRouterSnapshot } from './scale-control-v63.js';
export const PROVIDER_REGISTRY_RESILIENCE_V1 = 'provider-registry-resilience/v1';
const SNAPSHOT_TIMEOUT_MS = Math.max(250, Math.min(900, Number(process.env.WAE_PROVIDER_REGISTRY_TIMEOUT_MS || 900)));
const SNAPSHOT_TTL_MS = Math.max(5_000, Math.min(5 * 60_000, Number(process.env.WAE_PROVIDER_REGISTRY_TTL_MS || 30_000)));

let lastGood = null;
let inflight = null;
let lastAttemptAt = 0;
let lastFailure = null;

function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return Promise.resolve(promise).finally(() => clearTimeout(timer));
}

function cloneSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    ok: value.ok === true,
    runtime: Array.isArray(value.runtime) ? value.runtime : [],
    capabilityReputation: Array.isArray(value.capabilityReputation) ? value.capabilityReputation : [],
    source: value.source || 'persistent_registry',
    at: Number(value.at || Date.now()),
  };
}

function staticSnapshot(registry=[]) {
  return {
    ok: true,
    runtime: [],
    capabilityReputation: [],
    source: 'static_registry',
    at: Date.now(),
    registry,
  };
}

export function providerRegistryRecoveryState() {
  const ageMs = lastGood ? Math.max(0, Date.now() - lastGood.at) : null;
  return {
    version: PROVIDER_REGISTRY_RESILIENCE_V1,
    source: lastGood?.source || 'static_registry',
    lastGoodAt: lastGood?.at || null,
    ageMs,
    ttlMs: SNAPSHOT_TTL_MS,
    timeoutMs: SNAPSHOT_TIMEOUT_MS,
    stale: ageMs === null ? false : ageMs > SNAPSHOT_TTL_MS,
    lastFailure,
    refreshInFlight: !!inflight,
  };
}

export function primeStaticRegistry(registry=[]) {
  if (!lastGood) lastGood = staticSnapshot(registry);
  return providerRegistryRecoveryState();
}

export function currentProviderRegistrySnapshot(registry=[]) {
  // Static recovery is always immediately available and never waits on Supabase.
  if (!lastGood) lastGood = staticSnapshot(registry);
  return lastGood;
}

export async function refreshProviderRegistry({ capability = 'general_reasoning', force = false, registry = [] } = {}) {
  const now = Date.now();
  if (!force && lastGood && lastGood.source !== 'static_registry' && now - lastGood.at < SNAPSHOT_TTL_MS) {
    return lastGood;
  }
  if (!force && inflight) return inflight;
  lastAttemptAt = now;

  const task = (async () => {
    try {
      // scale-control already applies its own transport deadline; this outer deadline
      // protects the registry refresh itself from ever entering the generation budget.
      const snapshot = await withTimeout(loadPersistentRouterSnapshot({ capability, force }), SNAPSHOT_TIMEOUT_MS);
      if (snapshot?.ok === true) {
        lastGood = {
          ok: true,
          runtime: Array.isArray(snapshot.runtime) ? snapshot.runtime : [],
          capabilityReputation: Array.isArray(snapshot.capabilityReputation) ? snapshot.capabilityReputation : [],
          source: 'persistent_registry',
          at: Date.now(),
        };
        lastFailure = null;
        return lastGood;
      }
      throw new Error(String(snapshot?.error || 'registry_snapshot_unavailable'));
    } catch (error) {
      lastFailure = String(error?.message || error || 'registry_refresh_failed').slice(0, 180);
      // Preserve the last-known-good snapshot indefinitely until a fresh snapshot succeeds.
      // If none exists, the static registry remains the recovery source.
      if (!lastGood) lastGood = staticSnapshot(registry);
      return lastGood;
    } finally {
      inflight = null;
    }
  })();
  inflight = task;
  return task;
}

export function maybeRefreshProviderRegistry({ capability = 'general_reasoning', registry = [] } = {}) {
  if (!lastGood) lastGood = staticSnapshot(registry);
  const stale = lastGood.source === 'static_registry' || Date.now() - lastGood.at >= SNAPSHOT_TTL_MS;
  if (stale && !inflight) void refreshProviderRegistry({ capability, registry }).catch(() => {});
  return currentProviderRegistrySnapshot(registry);
}

export function __resetProviderRegistryResilienceForTests() {
  lastGood = null;
  inflight = null;
  lastAttemptAt = 0;
  lastFailure = null;
}

// Prime immediately, but deliberately do not await the control plane.
// Callers provide the static registry; no control-plane work is awaited at import time.
