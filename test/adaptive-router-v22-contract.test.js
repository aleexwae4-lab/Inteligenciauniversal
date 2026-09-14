import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl=new URL('../supabase/functions/wae-local-voice-demo-v61/router-v22.ts',import.meta.url);

async function source(){return readFile(sourceUrl,'utf8')}

test('FAST lane has an explicit 3 second production budget',async()=>{
  const text=await source();
  assert.match(text,/FAST_LATENCY_BUDGET_MS=3000/);
  assert.match(text,/task\.path==='FAST'/);
  assert.match(text,/fastLaneEligible/);
  assert.match(text,/ewma_latency_ms/);
});

test('production streaming requires current verified healthy closed transport',async()=>{
  const text=await source();
  assert.match(text,/function productionStreamEligible/);
  assert.match(text,/streaming_verified===true/);
  assert.match(text,/circuit_state==='CLOSED'/);
  assert.match(text,/health\(m\)==='healthy'/);
  assert.match(text,/STREAM_TTFT_BUDGET_MS=2500/);
  assert.match(text,/if\(req\.streaming\)list=list\.filter\(productionStreamEligible\)/);
});

test('continuity stays at the end of candidate ordering',async()=>{
  const text=await source();
  assert.match(text,/function isContinuity/);
  const returns=[...text.matchAll(/return\[\.\.\.([^\n;]+)\];/g)].map(x=>x[1]);
  assert.ok(returns.some(x=>x.endsWith('continuity')));
  assert.ok(returns.filter(x=>x.includes('continuity')).every(x=>x.endsWith('continuity')));
});

test('stream probe remains permissive for discovery while production is strict',async()=>{
  const text=await source();
  assert.match(text,/export function streamEligible/);
  assert.match(text,/Probe eligibility remains permissive/);
  assert.notEqual(text.indexOf('export function streamEligible'),text.indexOf('function productionStreamEligible'));
});
