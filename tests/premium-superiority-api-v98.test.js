import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('public runtime exposes the v98 premium benchmark endpoint',async()=>{
  const server=await read('server.js');
  assert.match(server,/premiumGateV98Handler/);
  assert.match(server,/\/api\/benchmark\/v98/);
  assert.match(server,/\.\/api\/premium-gate-v98\.js/);
});

test('v98 endpoint recomputes v93 certification from signed entries instead of trusting pasted certification',async()=>{
  const api=await read('api/premium-gate-v98.js');
  assert.match(api,/certifyVerifiedGptRun\(\{entries,targetId,referenceId\}\)/);
  assert.match(api,/workerAuthorized\(req\)/);
  assert.match(api,/WAE_RUNTIME_BRIDGE_TOKEN/);
  assert.doesNotMatch(api,/body\.certification/);
});

test('v98 endpoint requires trusted regression state and returns only compact quality evidence',async()=>{
  const api=await read('api/premium-gate-v98.js');
  assert.match(api,/wae_premium_regression_status_v98/);
  assert.match(api,/compactQualityCertification/);
  assert.match(api,/rawPromptsReturned:false/);
  assert.match(api,/rawAnswersReturned:false/);
  assert.match(api,/chainOfThoughtReturned:false/);
  assert.doesNotMatch(api,/regressions:base/);
});

test('v98 database status exposes only aggregate benchmark state',async()=>{
  const sql=await read('supabase/migrations/20260916190500_premium_superiority_gate_v98.sql');
  assert.match(sql,/wae_premium_regression_status_v98/);
  assert.match(sql,/trusted_runs/);
  assert.match(sql,/critical_open/);
  assert.match(sql,/high_open/);
  assert.match(sql,/release_gate/);
  assert.match(sql,/raw_prompts_exposed',false/);
  assert.match(sql,/raw_answers_exposed',false/);
  assert.match(sql,/user_data_exposed',false/);
  assert.doesNotMatch(sql,/select\s+.*prompt/i);
  assert.doesNotMatch(sql,/select\s+.*answer/i);
});
