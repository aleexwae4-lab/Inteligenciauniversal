// Compatibility alias: server.js and older clients still reference v60.
// The live pipeline is Universal Core v101. v101 adds grounded capability self-awareness
// and terminal answer continuity, then wraps ./capacity-chat-v91.js.
// Downstream chain remains v91 -> v90 -> v89 -> v88 -> v87 -> v86, preserving specialist,
// latency, knowledge-fusion, planning and factual-verification layers.
export { default } from './capacity-chat-v101.js';