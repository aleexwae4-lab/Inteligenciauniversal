import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProviderRoute, observeProviderOutcome, providerMeshSnapshot, __resetProviderMeshForTests } from '../lib/provider-mesh.js';

const registry=[
  {id:'wae_edge',configured:true,model:'edge'},
  {id:'wae_supabase',configured:true,model:'gateway'},
  {id:'openai',configured:true,model:'model-a'}
];

test('provider mesh preserves stable priority before operational evidence exists',()=>{
  __resetProviderMeshForTests();
  const route=selectProviderRoute({message:'Analiza la arquitectura de este servicio y sus riesgos.',mode:'analysis',registry,now:1_000});
  assert.equal(route.contract,'universal-provider-mesh/v1');
  assert.equal(route.applied,true);
  assert.equal(route.selectedProvider,'wae_edge');
  assert.equal(route.strategy,'adaptive_provider_mesh');
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

test('successful outcomes update reliability and latency without claiming model training',()=>{
  __resetProviderMeshForTests();
  const route={selectedProvider:'wae_supabase',fallbackOrder:['wae_supabase','wae_edge','openai']};
  observeProviderOutcome({route,result:{provider:'wae_supabase',latencyMs:420,degraded:false,fallbackFailures:[]},now:30_000});
  observeProviderOutcome({route,result:{provider:'wae_supabase',latencyMs:300,degraded:false,fallbackFailures:[]},now:30_100});
  const snap=providerMeshSnapshot({registry,now:30_200});
  const gateway=snap.providers.find(x=>x.id==='wae_supabase');
  assert.equal(snap.learning,'operational_runtime_only');
  assert.equal(snap.baseModelWeightsChanged,false);
  assert.equal(gateway.successes,2);
  assert.ok(gateway.ewmaLatencyMs>300&&gateway.ewmaLatencyMs<420);
  assert.ok(gateway.reliability>80);
});

test('nested provider labels are credited to the actual attempted WAE route',()=>{
  __resetProviderMeshForTests();
  const route={selectedProvider:'wae_edge',fallbackOrder:['wae_edge','wae_supabase','openai']};
  observeProviderOutcome({route,result:{provider:'gemini',latencyMs:250,degraded:false,fallbackFailures:[]},now:35_000});
  const snap=providerMeshSnapshot({registry,now:35_010});
  assert.equal(snap.providers.find(x=>x.id==='wae_edge').successes,1);
  assert.equal(snap.providers.find(x=>x.id==='openai').successes,0);
});

test('explicit provider selection is respected and simple chat stays on local fast path',()=>{
  __resetProviderMeshForTests();
  const explicit=selectProviderRoute({message:'Escribe una función en JavaScript.',mode:'code',requestedProvider:'openai',registry,now:40_000});
  assert.equal(explicit.applied,false);
  assert.equal(explicit.strategy,'explicit_provider');
  assert.equal(explicit.selectedProvider,'openai');
  const casual=selectProviderRoute({message:'Hola',mode:'general',registry,now:40_000});
  assert.equal(casual.applied,false);
  assert.equal(casual.strategy,'local_fast_path');
  assert.equal(casual.selectedProvider,'auto');
});
