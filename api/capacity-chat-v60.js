// Compatibility alias: server.js and older clients still reference v60,
// but the live pipeline is Universal Core v86. v86 wraps the v84 provider
// resilience chain with verify-before-accept factuality enforcement so precise,
// current, research and high-risk factual answers cannot bypass evidence gates.
export { default } from './capacity-chat-v86.js';
