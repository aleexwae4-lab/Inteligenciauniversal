import test from 'node:test';
import assert from 'node:assert/strict';
import { rankFallbackOrderV96, tailLatencyRiskV96, tailLatencyRouterCapabilitiesV96 } from '../lib/tail-latency-router-v96.js';

test('v96 flags high-confidence FAST and STANDARD tail latency but never hard-blocks a provider',()=>{
  const fast=tailLatencyRiskV96({path:'FAST',p95LatencyMs:12000,confidence:90});
  assert.equal(fast.risk,true);
  assert.equal(fast.thresholdMs,6000);
  assert.ok(fast.penalty>0);
  assert.equal(fast.hardBlocked,false);
  const standard=tailLatencyRiskV96({path:'STANDARD',p95LatencyMs:11660,confidence:80});
  assert.equal(standard.risk,true);
  assert.equal(standard.thresholdMs,10000);
  assert.ok(standard.penalty>0);
});

test('v96 ignores weak tail evidence and does not penalize DEEP routes',()=>{
  assert.equal(tailLatencyRiskV96({path:'STANDARD',p95LatencyMs:20000,confidence:20}).risk,false);
  const deep=tailLatencyRiskV96({path:'DEEP',p95LatencyMs:30000,confidence:100});
  assert.equal(deep.risk,false);
  assert.equal(deep.penalty,0);
  assert.equal(deep.thresholdMs,null);
});

test('v96 fallback ranking prefers healthy low-tail high-score routes and preserves last-resort recovery',()=>{
  const ranked=rankFallbackOrderV96({
    selected:'fast',
    path:'STANDARD',
    candidates:[
      {id:'fast',score:95,interactiveTailRisk:false},
      {id:'slow',score:94,interactiveTailRisk:true},
      {id:'healthy',score:90,interactiveTailRisk:false},
      {id:'open',score:99,circuitOpen:true,interactiveTailRisk:false},
    ],
    baseFallbackOrder:['fast','slow','healthy','open','rescue'],
  });
  assert.deepEqual(ranked.order,['fast','healthy','slow','open','rescue']);
  assert.equal(new Set(ranked.order).size,ranked.order.length);
});

test('v96 tail latency capability is evidence-based and preserves explicit provider override',()=>{
  const caps=tailLatencyRouterCapabilitiesV96();
  assert.equal(caps.evidenceBased,true);
  assert.equal(caps.hardBlock,false);
  assert.equal(caps.explicitProviderOverridePreserved,true);
  assert.equal(caps.thresholdsMs.STANDARD,10000);
});
