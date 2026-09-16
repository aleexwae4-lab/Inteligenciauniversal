// Compatibility alias: server.js and older clients may still reference v60,
// but the live pipeline is Universal Core v82: same-origin knowledge recovery
// in front of v81 provider health, v77 GPU scheduling, v63 distributed control
// and the existing Universal Core runtime.
export { default } from './capacity-chat-v82.js';
