// Compatibility alias: server.js and older clients still reference v60.
// The live pipeline is Universal Core v91. v91 adds specialist copilot routing
// and delegates factual/current knowledge to v90. v90 -> v89 -> v88 -> v87 ->
// v86 remain downstream latency, knowledge-fusion and verification layers.
export { default } from './capacity-chat-v91.js';