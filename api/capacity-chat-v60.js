// Compatibility alias: server.js and older clients may still reference v60,
// but the live pipeline is Universal Core v84: v83 factual/knowledge recovery
// plus a bounded ia.gratis resilience provider when all existing generation
// paths are unavailable. The external token remains server-side only.
export { default } from './capacity-chat-v84.js';
