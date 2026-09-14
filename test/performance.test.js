import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPerformanceGate, normalizePerformanceGate } from '../lib/performance.js';

test('performance gate defaults fail closed',()=>{
  const gate=defaultPerformanceGate('test');
  assert.equal(gate.available,false);
  assert.equal(gate.candidate_promotable,false);
  assert.equal(gate.stream_ready,false);
  assert.equal(gate.routing_state,'HOLD');
});

test('performance gate promotes only explicit approved metrics',()=>{
  const gate=normalizePerformanceGate({
    schema:'universal-performance-gate/v2',
    routing_state:'PROMOTE',
    candidate_promotable:true,
    stream_ready:true,
    fast_lane_ready:true,
    control:{ok:100,errors:5,error_rate:4.76,p50_ms:1800,p95_ms:8000,avg_ms:3000,avg_ttft_ms:2200},
    candidate:{ok:100,errors:3,error_rate:2.91,p50_ms:900,p95_ms:6000,avg_ms:1800,avg_ttft_ms:900},
    policy:{candidate_p95_improvement_required_pct:5,stream_ttft_ceiling_ms:2500,fast_lane_latency_ceiling_ms:3000}
  });
  assert.equal(gate.available,true);
  assert.equal(gate.candidate_promotable,true);
  assert.equal(gate.stream_ready,true);
  assert.equal(gate.control.p95_ms,8000);
  assert.equal(gate.candidate.avg_ttft_ms,900);
});

test('malformed performance values are normalized safely',()=>{
  const gate=normalizePerformanceGate({routing_state:'INVALID',candidate_promotable:'yes',stream_ready:1,control:{ok:-3,p95_ms:'bad'}});
  assert.equal(gate.routing_state,'HOLD');
  assert.equal(gate.candidate_promotable,false);
  assert.equal(gate.stream_ready,false);
  assert.equal(gate.control.ok,0);
  assert.equal(gate.control.p95_ms,0);
});
