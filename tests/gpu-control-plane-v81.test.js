import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  gpuScopeHash,
  generateWithGpuControlPlane,
  gpuControlPlaneSnapshot,
  __seedGpuPersistentSnapshotForTests,
  __resetGpuControlPlaneForTests,
  GPU_CONTROL_PLANE_VERSION,
  GPU_SCHEDULER_VERSION,
} from '../lib/gpu-control-plane-v81.js';
import {__resetGpuFabricForTests} from '../lib/gpu-fabric-v77.js';

const ENV_KEYS=['SUPABASE_SERVICE_ROLE_KEY','SUPABASE_URL','WAE_GPU_SCOPE_HASH_SECRET','WAE_GPU_FABRIC_ENABLED','WAE_GPU_HEDGING_ENABLED','WAE_GPU_DAILY_RELATIVE_BUDGET','WAE_GPU_LANE_1_ID','WAE_GPU_LANE_1_BASE_URL','WAE_GPU_LANE_1_API_KEY','WAE_GPU_LANE_1_MODEL','WAE_GPU_LANE_1_PRIORITY','WAE_GPU_LANE_2_ID','WAE_GPU_LANE_2_BASE_URL','WAE_GPU_LANE_2_API_KEY','WAE_GPU_LANE_2_MODEL','WAE_GPU_LANE_2_PRIORITY'];
function saveEnv(){return Object.fromEntries(ENV_KEYS.map(k=>[k,process.env[k]]))}
function restoreEnv(saved){for(const key of ENV_KEYS){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key]}}
function configureTwoLanes(){
  process.env.WAE_GPU_FABRIC_ENABLED='1';process.env.WAE_GPU_HEDGING_ENABLED='0';delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_URL;delete process.env.WAE_GPU_SCOPE_HASH_SECRET;
  process.env.WAE_GPU_LANE_1_ID='lane_one';process.env.WAE_GPU_LANE_1_BASE_URL='https://lane-one.example';process.env.WAE_GPU_LANE_1_API_KEY='secret-one';process.env.WAE_GPU_LANE_1_MODEL='model-one';process.env.WAE_GPU_LANE_1_PRIORITY='101';
  process.env.WAE_GPU_LANE_2_ID='lane_two';process.env.WAE_GPU_LANE_2_BASE_URL='https://lane-two.example';process.env.WAE_GPU_LANE_2_API_KEY='secret-two';process.env.WAE_GPU_LANE_2_MODEL='model-two';process.env.WAE_GPU_LANE_2_PRIORITY='102';
}

test('v81 keyed scope hash is fixed-width and never exposes raw scope identity',()=>{
  const a=gpuScopeHash({tenantId:'tenant-alpha'}),b=gpuScopeHash({tenantId:'tenant-beta'});
  assert.match(a,/^[a-f0-9]{32}$/);assert.match(b,/^[a-f0-9]{32}$/);assert.notEqual(a,b);assert.ok(!a.includes('tenant'));
});

test('v81 persistent task telemetry can steer the proven v77 underlay',async()=>{
  const saved=saveEnv(),originalFetch=global.fetch;configureTwoLanes();__resetGpuControlPlaneForTests();__resetGpuFabricForTests();
  const payload={sessionId:'session-learning',mode:'analysis',message:'Analiza esta arquitectura'};
  __seedGpuPersistentSnapshotForTests(payload,{rows:[
    {lane_id:'lane_one',task_class:'analysis',attempts:10,successes:2,failures:8,latency_ewma_ms:9000,response_start_ewma_ms:3000},
    {lane_id:'lane_two',task_class:'analysis',attempts:10,successes:10,failures:0,latency_ewma_ms:450,response_start_ewma_ms:120}
  ],daily_relative_cost_units:0});
  global.fetch=async url=>new Response(JSON.stringify({id:'r1',choices:[{message:{content:`ok:${new URL(String(url)).hostname}`}}],usage:{total_tokens:123}}),{status:200,headers:{'content-type':'application/json'}});
  try{
    const result=await generateWithGpuControlPlane({...payload,system:'system'});
    assert.equal(result.gpuLane,'lane_two');assert.equal(result.controlPlane.version,GPU_CONTROL_PLANE_VERSION);assert.equal(result.schedulerVersion,GPU_SCHEDULER_VERSION);assert.equal(result.controlPlane.scopeHashing,'hmac-sha256');
  }finally{global.fetch=originalFetch;restoreEnv(saved);__resetGpuControlPlaneForTests();__resetGpuFabricForTests()}
});

test('v81 enforces optional relative budget without presenting units as currency',async()=>{
  const saved=saveEnv();configureTwoLanes();process.env.WAE_GPU_DAILY_RELATIVE_BUDGET='100';__resetGpuControlPlaneForTests();__resetGpuFabricForTests();
  const payload={sessionId:'budget-scope',mode:'general',message:'Hola'};__seedGpuPersistentSnapshotForTests(payload,{rows:[],daily_relative_cost_units:120});
  try{await assert.rejects(()=>generateWithGpuControlPlane({...payload,system:'system'}),error=>error?.code==='GPU_SCOPE_BUDGET_EXCEEDED');const snap=await gpuControlPlaneSnapshot(payload);assert.equal(snap.budget.units,'relative_usage_units_not_currency');assert.equal(snap.physicalGpuOwnership,false);assert.equal(snap.verifiedGpuCount,null);assert.equal(snap.persistentTelemetry.contentStored,false);assert.equal(snap.persistentTelemetry.rawScopeIdentifiersStored,false)}finally{restoreEnv(saved);__resetGpuControlPlaneForTests();__resetGpuFabricForTests()}
});

test('live compatibility chain is v60 -> v81 -> v63 and telemetry contract stores no content',async()=>{
  const [alias,v81,control]=await Promise.all([
    readFile(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8'),
    readFile(new URL('../api/capacity-chat-v81.js',import.meta.url),'utf8'),
    readFile(new URL('../lib/gpu-control-plane-v81.js',import.meta.url),'utf8')
  ]);
  assert.match(alias,/capacity-chat-v81\.js/);assert.match(v81,/capacity-chat-v63\.js/);assert.match(v81,/generateWithGpuControlPlane/);
  assert.match(control,/wae_gpu_metrics_record_v79/);assert.match(control,/p_scope_hash/);assert.match(control,/createHmac/);
  assert.doesNotMatch(control,/\bp_prompt\b|\bp_response\b|\bp_response_content\b|\bp_message_content\b|\bp_attachment_content\b/);
  assert.match(control,/p_response_start_ms/);
});

test('Edge v81 bounds PostgREST transport without weakening the existing runtime contract',async()=>{
  const [guard,router]=await Promise.all([
    readFile(new URL('../supabase/functions/wae-local-voice-demo-v61/supabase-client-v81.ts',import.meta.url),'utf8'),
    readFile(new URL('../supabase/functions/wae-local-voice-demo-v61/router-v25.ts',import.meta.url),'utf8')
  ]);
  assert.match(guard,/EDGE_DB_TRANSPORT_VERSION='wae-edge-db-transport\/v81'/);
  assert.match(guard,/AbortSignal\.timeout/);assert.match(guard,/AbortSignal\.any/);assert.match(guard,/edge_db_transport_timeout/);
  assert.match(router,/REGISTRY_DEADLINE_MS=2500/);assert.match(router,/wae_deterministic_rescue/);
  assert.doesNotMatch(guard,/session_secret|prompt|response_content|attachment_content/);
});
