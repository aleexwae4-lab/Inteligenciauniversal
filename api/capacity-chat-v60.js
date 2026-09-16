// Compatibility alias: server.js and older clients still reference v60,
// but the live pipeline is Universal Core v90. v90 adds the Enterprise
// Intelligence Fabric for official-source research, authorized integrations,
// provenance and public-system reconstruction, then delegates through v87/v86
// so the existing Universal Intelligence Planner and verify-before-accept gate
// remain authoritative.
export { default } from './capacity-chat-v90.js';