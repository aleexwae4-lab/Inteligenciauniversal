import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProviderRoute, observeProviderOutcome, observeQualityOutcome, providerMeshSnapshot, __resetProviderMeshForTests } from '../lib/provider-mesh.js';

const registry=[
  {id:'wae_edge',configured:true,model:'edge'},
  {id:'wae_supabase',configured:true,model:'gateway'},
  {id:'openai',configured:true,model:'model-a'}
];

test('provider mesh v63 preserves stable priority before persistent evidence exists',()=>{
  __resetProviderMeshForTests();
  const route=selectProviderRoute({message:'Analiza la arquitectura de este servicio y sus riesgos.',mode:'analysis',registry,now:1_000});
  assert.equal(route.contract,'universal-provider-mesh/v3');
  assert.equal(route.version,'adaptive-performance-router/v63');
  assert.equal(route.applied,true);
  assert.equal(route.selectedProvider,'wae_edge');
  assert.equal(route.strategy,'persistent_quality_performance_adaptive');
  assert.equal(route.policy.qualityAware,true);
  assert.equal(route.policy.ttftAware,true);
  assert.equal(route.policy.persistentLearning,true);
});

test('rate limit opens provider circuit and moves the next request to a healthy route',()=>{
  __resetProviderMeshForTests();
  const first=selectProviderRoute({message:'Investiga el mercado actual.',mode:'research',registry,now:10_000});
  observeProviderOutcome({route:first,error:{failures:[{provider:'wae_edge',error:'429 rate limit'}]},now:10_100});
  const second=selectProviderRoute({message:'Investiga el mercado actual.',mode:'research',registry,now:10_200});
  assert.equal(second.selectedProvider,'wae_supabase');
  const snap=providerMeshSnapshot({registry,now:10_200});
  const edge=snap.providers.find(x=>x.id==='wae_edge');
  assert.equal(edge.circuitState,'OPEN');
  assert.equal(edge.lastErrorClass,'rate_limit');
});

test('three timeout failures open a temporary circuit',()=>{
  __resetProviderMeshForTests();
  const route={selectedProvider:'wae_edge',fallbackOrder:['wae_edge','wae_supabase','openai']};
  for(let i=0;i<3;i++)observeProviderOutcome({route,error:{failures:[{provider:'wae_edge',error:'request timeout'}]},now:20_000+i});
  const snap=providerMeshSnapshot({registry,now:20_010});
  const edge=snap.providers.find(x=>x.id==='wae_edge');
  assert.equal(edge.circuitState,'OPEN');
  assert.equal(edge.consecutiveFailures,3);
  assert.equal(edge.lastErrorClass,'timeout');
});

test('successful outcomes learn reliability latency TTFT and cost without claiming model training',()=>{
  __resetProviderMeshForTests();
  const route={selectedProvider:'wae_supabase',fallbackOrder:['wae_supabase','wae_edge','openai']};
  observeProviderOutcome({route,result:{provider:'wae_supabase',latencyMs:420,ttft_ms:180,cost_microunits:120,degraded:false,fallbackFailures:[]},now:30_000});
  observeProviderOutcome({route,result:{provider:'wae_supabase',latencyMs:300,ttft_ms:120,cost_microunits:80,degraded:false,fallbackFailures:[]},now:30_100});
  const snap=providerMeshSnapshot({registry,now:30_200});
  const gateway=snap.providers.find(x=>x.id==='wae_supabase');
  assert.equal(snap.learning,'operational_runtime_quality_feedback');
  assert.equal(snap.baseModelWeightsChanged,false);
  assert.equal(snap.persistent,true);
  assert.equal(gateway.successes,2);
  assert.ok(gateway.ewmaLatencyMs>300&&gateway.ewmaLatencyMs<420);
  assert.ok(gateway.ewmaTtftMs>120&&gateway.ewmaTtftMs<180);
  assert.ok(gateway.reliability>80);
});

test('quality feedback changes deep-route preference when a provider repeatedly underperforms',()=>{
  __resetProviderMeshForTests();
  const edgeRoute={selectedProvider:'wae_edge',fallbackOrder:['wae_edge','wae_supabase','openai']};
  const gatewayRoute={selectedProvider:'wae_supabase',fallbackOrder:['wae_supabase','wae_edge','openai']};
  for(let i=0;i<4;i++){
    observeProviderOutcome({route:edgeRoute,result:{latencyMs:250,degraded:false},now:40_000+i});
    observeQualityOutcome({route:edgeRoute,payload:{quality_reliability:{score:62,grade:'C',dimensions:{evidence:50,instruction:65}}},now:40_100+i});
    observeProviderOutcome({route:gatewayRoute,result:{latencyMs:650,degraded:false},now:40_200+i});
    observeQualityOutcome({route:gatewayRoute,payload:{quality_reliability:{score:95,grade:'A+',dimensions:{evidence:96,instruction:97}}},now:40_300+i});
  }
  const deep=selectProviderRoute({message:'Analiza profundamente la arquitectura y sus riesgos con evidencia.',mode:'analysis',registry,now:41_000});
  assert.equal(deep.selectedProvider,'wae_supabase');
  assert.ok(deep.candidates[0].quality>deep.candidates.find(x=>x.id==='wae_edge').quality);
});

test('nested provider labels are credited to the attempted WAE route',()=>{
  __resetProviderMeshForTests();
  const route={selectedProvider:'wae_edge',fallbackOrder:['wae_edge','wae_supabase','openai']};
  observeProviderOutcome({route,result:{provider:'gemini',latencyMs:250,degraded:false,fallbackFailures:[]},now:50_000});
  const snap=providerMeshSnapshot({registry,now:50_010});
  assert.equal(snap.providers.find(x=>x.id==='wae_edge').successes,1);
  assert.equal(snap.providers.find(x=>x.id==='openai').successes,0);
});

test('explicit provider selection is respected and simple chat stays local',()=>{
  __resetProviderMeshForTests();
  const explicit=selectProviderRoute({message:'Escribe una función en JavaScript.',mode:'code',requestedProvider:'openai',registry,now:60_000});
  assert.equal(explicit.applied,false);
  assert.equal(explicit.strategy,'explicit_provider');
  assert.equal(explicit.selectedProvider,'openai');
  const casual=selectProviderRoute({message:'Hola',mode:'general',registry,now:60_000});
  assert.equal(casual.applied,false);
  assert.equal(casual.strategy,'local_fast_path');
  assert.equal(casual.selectedProvider,'auto');
});
