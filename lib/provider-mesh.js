// Compatibility surface for existing runtime imports.
// Universal Core v63 preserves the v62 local learner and adds persistent cross-instance reputation.
export {
  PERFORMANCE_ROUTER_VERSION,
  PERFORMANCE_ROUTER_CONTRACT,
  selectProviderRoute,
  observeProviderOutcome,
  hydratePersistentProviderReputation,
  queueQualityPersistence,
  drainPersistentObservations,
  providerMeshSnapshot,
  performanceRouterCapabilities,
  __resetProviderMeshForTests
} from './provider-mesh-v63.js';

// Kept for compatibility with callers that explicitly perform the local v62 quality update.
export { observeQualityOutcome } from './provider-mesh-v62.js';
