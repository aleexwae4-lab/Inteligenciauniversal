import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdaptiveSupremacyRouter, routeTask, ADAPTIVE_SUPREMACY_ROUTER_VERSION } from '../lib/adaptive-supremacy-router-v1.js';

test('adaptive router activates hard challenge for P0 gaps',()=>{
  const out=buildAdaptiveSupremacyRouter({
    taskCategory:'coding',
    curriculum:{queue:[{id:'astra-terminal-bench',severity:'P0',regressionCases:['frontier-coding-01']}]},
    gapReport:{summary:{p0:1}},
    constraints:{budget:'balanced'}
  });
  assert.equal(out.version,ADAPTIVE_SUPREMACY_ROUTER_VERSION);
  assert.equal(out.category,'coding');
  assert.equal(out.decision.hardMode,true);
  assert.ok(out.strategy.steps.includes('independent_challenger'));
  assert.ok(out.decision.reasonCodes.includes('P0_ASTRA_GAP'));
});

test('unmeasured curriculum is treated as P1 without fabricating results',()=>{
  const out=buildAdaptiveSupremacyRouter({
    taskCategory:'research',
    curriculum:{queue:[{id:'astra-browsecomp',severity:'P1',regressionCases:['frontier-research-01']}]}
  });
  assert.equal(out.decision.hardMode,false);
  assert.ok(out.decision.reasonCodes.includes('P1_REGRESSION_CURRICULUM'));
  assert.equal(out.policy.noSimulatedCompetitorData,true);
});

test('aliases map benchmark domains to executable strategies',()=>{
  const out=routeTask({domain:'computer_use'},{history:{computer_use:{successRate:.98,p95LatencyMs:1000}}});
  assert.equal(out.category,'computer_use');
  assert.equal(out.strategy.strategy,'action_observe_verify');
});

test('router never enables provider selection or global superiority claims',()=>{
  const out=buildAdaptiveSupremacyRouter({taskCategory:'security'});
  assert.equal(out.policy.providerSelectionDelegated,true);
  assert.equal(out.policy.noGlobalSuperiorityClaim,true);
});
