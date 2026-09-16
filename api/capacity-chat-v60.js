// Compatibility alias: server.js and older clients may still reference v60,
// but the live pipeline is Universal Core v80: v63 distributed control wrapped by the persistent adaptive GPU control plane.
export { default } from './capacity-chat-v80.js';
