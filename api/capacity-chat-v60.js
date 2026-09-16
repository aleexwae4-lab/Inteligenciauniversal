// Compatibility alias: server.js and older clients still reference v60,
// but the live pipeline is Universal Core v89. v89 adds federated universal
// knowledge retrieval before generation, then preserves v88 Knowledge Fusion,
// v87 planning and v86 verify-before-accept as downstream control layers.
export { default } from './capacity-chat-v89.js';