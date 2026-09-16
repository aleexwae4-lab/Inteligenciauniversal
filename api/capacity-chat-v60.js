// Compatibility alias: server.js and older clients still reference v60.
// The live pipeline is Universal Core v101. v101 adds grounded capability self-awareness
// and a terminal answer-continuity layer over v91. v91 -> v90 -> v89 -> v88 -> v87 ->
// v86 remain downstream specialist, latency, knowledge-fusion and verification layers.
export { default } from './capacity-chat-v101.js';