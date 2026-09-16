// Compatibility alias: server.js and older clients may still reference v60,
// but the live pipeline is Universal Core v81: persistent operational provider health
// in front of v77 GPU scheduling, v63 distributed control and the existing runtime.
export { default } from './capacity-chat-v81.js';
