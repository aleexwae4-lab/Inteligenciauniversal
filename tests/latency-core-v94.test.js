import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LATENCY_METRICS_V94, recordLatencyV94, latencySnapshotV94, __resetLatencyMetricsV94 } from '../lib/latency-metrics-v94.js';
import { CAPACITY_CHAT_V90, LATENCY_CORE_V94 } from '../api/capacity-chat-v90.js';

test('v94 keeps the public v90 compatibility contract while enabling hedged verified execution',()=>{
  assert.equal(CAPACITY_CHAT_V90,'capacity-chat/v90.2-latency-autonomous-knowledge');
  assert.equal(LATENCY_CORE_V94,'latency-core/v94-hedged-verified');
});

test('v94 latency telemetry calculates deterministic percentiles and stores no prompt or user data',()=>{
  __resetLatencyMetricsV94();
  for(const durationMs of [100,200,300,400,500,600,700,800,900,1000])recordLatencyV94({route:'fast',durationMs,statusCode:200});
  recordLatencyV94({route:'fallback',durationMs:2000,statusCode:503,success:false});
  const snapshot=latencySnapshotV94({windowMs:60_000,now:Date.now()});
  assert.equal(snapshot.version,LATENCY_METRICS_V94);
  assert.equal(snapshot.privacy.prompt_content_stored,false);
  assert.equal(snapshot.privacy.user_identifiers_stored,false);
  assert.equal(snapshot.aggregate.count,11);
  assert.equal(snapshot.routes.fast.count,10);
  assert.equal(snapshot.routes.fast.p50_ms,500);
  assert.equal(snapshot.routes.fast.p95_ms,1000);
  assert.equal(snapshot.routes.fast.p99_ms,1000);
  assert.equal(snapshot.routes.fallback.error_count,1);
  assert.deepEqual(Object.keys(snapshot.routes.fast).sort(),['count','error_count','max_ms','p50_ms','p95_ms','p99_ms','success_count','success_rate'].sort());
});

test('invalid latency samples are rejected instead of polluting percentiles',()=>{
  __resetLatencyMetricsV94();
  assert.equal(recordLatencyV94({route:'x',durationMs:'not-a-number'}),false);
  assert.equal(latencySnapshotV94().aggregate.count,0);
});

test('fast factual v94 hedges instead of waiting sequentially and preserves verification gates',async()=>{
  const source=await readFile(new URL('../api/capacity-chat-v90.js',import.meta.url),'utf8');
  assert.match(source,/hedgedVerifiedFastPath/);
  assert.match(source,/Promise\.race\(/);
  assert.match(source,/WAE_FAST_FACTUAL_HEDGE_DELAY_MS/);
  assert.match(source,/tryFastFactual/);
  assert.match(source,/tryFusion/);
  assert.match(source,/firstAccepted/);
  assert.match(source,/factualityDecision/);
  assert.match(source,/applyAnswerIntelligence/);
  assert.match(source,/applyQualityReliability/);
  assert.match(source,/X-WAE-Factuality-Status/);
  assert.match(source,/qualityGatePreserved:true/);
  const fastStart=source.indexOf('const fastPromise=tryFastFactual');
  const hedge=source.indexOf("kind:'hedge'",fastStart);
  const fusion=source.indexOf('const fusionPromise=tryFusion',hedge);
  assert.ok(fastStart>0&&hedge>fastStart&&fusion>hedge);
});

test('v94 performance endpoint exposes latency snapshot without changing supremacy gate semantics',async()=>{
  const source=await readFile(new URL('../api/performance.js',import.meta.url),'utf8');
  assert.match(source,/latencySnapshotV94/);
  assert.match(source,/live_latency:liveLatency/);
  assert.match(source,/supremacy_claim_allowed:selfImprovement\?\.supremacy_gate\?\.claim_allowed===true/);
  assert.match(source,/universal-performance\+quality\+reliability\+streaming\+learning\+latency\/v7/);
});
