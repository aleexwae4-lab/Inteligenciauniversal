import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptRequestV102, capacityChatV102Capabilities, CAPACITY_CHAT_V102 } from '../api/capacity-chat-v102.js';

test('capacity v102 injects adaptive project instructions before v101 execution',()=>{
  const adapted=adaptRequestV102({message:'Soy abogado. Analiza esta controversia y prepara una estrategia.',operator_context:{profession:'Abogado',jurisdiction:'Jalisco'}});
  assert.equal(adapted.publicContext.context.working_domain,'legal');
  assert.match(adapted.body.preferences.projectInstructions,/WAE ADAPTIVE ASSET INTELLIGENCE v102/);
  assert.equal(adapted.body.mode,'analysis');
});

test('capacity v102 exposes the five adaptive architecture components',()=>{
  const caps=capacityChatV102Capabilities();
  assert.equal(caps.release,CAPACITY_CHAT_V102);
  assert.match(caps.adaptive.contextIntelligence,/context-intelligence/);
  assert.match(caps.adaptive.professionalOrganizationGraph,/professional-organization-graph/);
  assert.match(caps.adaptive.adaptiveCapabilityRouter,/adaptive-capability-router/);
  assert.match(caps.adaptive.memoryFabric,/memory-fabric/);
  assert.match(caps.adaptive.assetCompiler,/asset-compiler-quality-gate/);
  assert.equal(caps.policy.assetOrientedResponses,true);
});
