// Compatibility surface for existing runtime imports.
// Universal Core v62 routes through the quality-aware performance mesh.
export {
  PERFORMANCE_ROUTER_VERSION,
  PERFORMANCE_ROUTER_CONTRACT,
  selectProviderRoute,
  observeProviderOutcome,
  observeQualityOutcome,
  providerMeshSnapshot,
  performanceRouterCapabilities,
  __resetProviderMeshForTests
} from './provider-mesh-v62.js';
