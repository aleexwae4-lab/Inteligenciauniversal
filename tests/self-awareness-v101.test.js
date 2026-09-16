import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSelfAwarenessSnapshotV101, buildSelfAwarenessReplyV101, classifySelfAwarenessV101, selfAwarenessCapabilitiesV101, SELF_AWARENESS_V101 } from '../lib/self-awareness-v101.js';
import { applyFrontierFreshnessGuardV101, FRONTIER_FRESHNESS_V101 } from '../api/capacity-chat-v101.js';

test('v101 exposes grounded self-awareness contract',()=>{
  const caps=selfAwarenessCapabilitiesV101();
  assert.equal(caps.version,SELF_AWARENESS_V101);
  assert.equal(caps.groundedSelfKnowledge,true);
  assert.equal(caps.dynamicOperationalStatus,true);
  assert.equal(caps.falseSuperiorityClaimsBlocked,true);
});

test('healthy eligible generation is reported available',()=>{
  const snapshot=buildSelfAwarenessSnapshotV101({
    stats:{executiveOrchestration:{executiveRoles:22,activeAgentInstances:88}},
    operational:{generativeConfigured:true,generativeEligibleNow:true,generativeHealthyNow:true,configuredProviderCount:4,eligibleProviderCount:2,healthyProviderCount:1,preferredProvider:'wae_edge'},
    toolCount:12,
    capabilityDomains:9,
  });
  assert.equal(snapshot.operational.generative,'available');
  assert.equal(snapshot.capabilities.reasoning.status,'available');
  assert.equal(snapshot.capabilities.toolExecution.status,'available');
  assert.equal(snapshot.capabilities.multiAgentOrchestration.status,'available');
  assert.equal(snapshot.capabilities.multiAgentOrchestration.executiveRoles,22);
  assert.equal(snapshot.truthPolicy.globalNumberOneClaimAllowed,false);
});

test('eligible but not healthy generation is degraded, not falsely healthy',()=>{
  const snapshot=buildSelfAwarenessSnapshotV101({
    operational:{generativeConfigured:true,generativeEligibleNow:true,generativeHealthyNow:false,configuredProviderCount:3,eligibleProviderCount:1,healthyProviderCount:0},
  });
  assert.equal(snapshot.operational.generative,'degraded');
  assert.equal(snapshot.capabilities.reasoning.status,'degraded');
  assert.equal(snapshot.operational.generativeHealthy,false);
});

test('configured but ineligible generation is unavailable',()=>{
  const snapshot=buildSelfAwarenessSnapshotV101({
    operational:{generativeConfigured:true,generativeEligibleNow:false,generativeHealthyNow:false,configuredProviderCount:2,eligibleProviderCount:0,healthyProviderCount:0},
  });
  assert.equal(snapshot.operational.generative,'unavailable');
  assert.equal(snapshot.capabilities.codeAndEngineering.status,'unavailable');
});

test('unconfigured generation is explicit instead of invented',()=>{
  const snapshot=buildSelfAwarenessSnapshotV101({operational:{generativeConfigured:false}});
  assert.equal(snapshot.operational.generative,'unconfigured');
  assert.equal(snapshot.capabilities.reasoning.status,'unconfigured');
});

test('comparison reply requires signed certification and blocks global number one claim',()=>{
  const snapshot=buildSelfAwarenessSnapshotV101({
    operational:{generativeConfigured:true,generativeEligibleNow:true,generativeHealthyNow:true,configuredProviderCount:1,eligibleProviderCount:1,healthyProviderCount:1},
  });
  const reply=buildSelfAwarenessReplyV101({kind:'comparison',snapshot});
  assert.match(reply,/64 casos emparejados/i);
  assert.match(reply,/NO VERIFICADO/i);
  assert.match(reply,/#1.*bloqueada/i);
  assert.doesNotMatch(reply,/ya super[eé] a/i);
});

test('capability and competitor intents are recognized through v101',()=>{
  assert.equal(classifySelfAwarenessV101({message:'¿Cuáles son tus capacidades?'}).kind,'capability');
  assert.equal(classifySelfAwarenessV101({message:'¿Superas a GPT-6 Astra?'}).kind,'comparison');
  assert.equal(classifySelfAwarenessV101({message:'Escribe un poema sobre Jalisco'}).eligible,false);
});

test('clip regression: GPT Astra factual lookup is forced into live research',()=>{
  const guarded=applyFrontierFreshnessGuardV101({message:'Hola sabes que es gpt Astra?'});
  assert.equal(guarded.mode,'research');
  assert.equal(guarded.research_mode,true);
  assert.equal(guarded.web_enabled,true);
  assert.equal(guarded.freshness_required,true);
  assert.equal(guarded.frontier_entity_query,true);
  assert.equal(guarded.freshness_guard,FRONTIER_FRESHNESS_V101);
});

test('frontier freshness respects explicit web disable but still marks verification required',()=>{
  const guarded=applyFrontierFreshnessGuardV101({message:'¿Qué es GPT-6 Astra y cuándo salió?',web_enabled:false});
  assert.equal(guarded.web_enabled,false);
  assert.equal(guarded.mode,'research');
  assert.equal(guarded.freshness_required,true);
});

test('stable non-frontier questions are not unnecessarily forced into web research',()=>{
  const guarded=applyFrontierFreshnessGuardV101({message:'¿Qué es la fotosíntesis?'});
  assert.equal(guarded.freshness_required,undefined);
  assert.equal(guarded.web_enabled,undefined);
});
