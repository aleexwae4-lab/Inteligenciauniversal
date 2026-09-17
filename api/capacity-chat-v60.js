// Compatibility alias: server.js and older clients still reference v60.
// v105 adds a conversation-routing firewall before the established legacy stack.
// Identity, capability and casual prompts use the modern context-integrity runtime.
// Research, factual knowledge, multiagent and specialist workloads continue through:
// ./capacity-chat-v105.js -> ./capacity-chat-v91.js -> ./capacity-chat-v90.js ->
// ./capacity-chat-v89.js -> ./capacity-chat-v88.js -> ./capacity-chat-v87.js ->
// ./capacity-chat-v86.js (verify-before-accept) and the preserved downstream chain.
export { default } from './capacity-chat-v105.js';
