// Compatibility alias: server.js and older clients still reference v60.
// v105 adds a conversation-routing firewall in front of the v91 knowledge stack.
// Identity, capability and casual prompts use the modern context-integrity runtime;
// research, factual knowledge, multiagent and specialist workloads continue to v91.
export { default } from './capacity-chat-v105.js';
