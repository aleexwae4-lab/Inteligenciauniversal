// Compatibility alias: server.js and older clients may still reference v60,
// but the live pipeline is Universal Core v75: v63 distributed control wrapped by elastic GPU resilience.
export { default } from './capacity-chat-v75.js';
