import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOperationalProvider, rankOperationalProviders, directFallbackProvider, PROVIDER_HEALTH_VERSION, PROVIDER_RECOVERY_PROBE_AFTER_MS, PROVIDER_RECENT_SUCCESS_GRACE_MS } from '../lib/provider-health-v81.js';
import capacityChatV81, { CAPACITY_CHAT_V81 } from '../api/capacity-chat-v81.js';

test('v81 modules expose stable contracts',()=>{
  assert.equal(PROVIDER_HEALTH_VERSION,'provider-health/v81');
  assert.equal(CAPACITY_CHAT_V81,'capacity-chat/v81-health-aware');
  assert.equal(typeof capacityChatV81,'function');
  assert.equal(PROVIDER_RECOVERY_PROBE_AFTER_MS,5*60*1000);
  assert.equal(PROVIDER_RECENT_SUCCESS_GRACE_MS,10*60*1000);
});

test('configured is not the same as operationally healthy',()=>{
  const provider={id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true};
  const row={provider:'wae_edge',model:'iu-gpt-runtime-v13',attempts:47,successes:3,failures:44,consecutiveFailures:10};
  const state=classifyOperationalProvider(provider,row,Date.parse('2026-09-16T02:00:00Z'));
  assert.equal(state.configured,true);
  assert.equal(state.healthy,false);
  assert.equal(state.eligible,false);
  assert.equal(state.state,'unhealthy');
});

test('fresh successful recovery rehabilitates a provider without erasing historical failure debt',()=>{
  const now=Date.parse('2026-09-16T20:34:00Z');
  const provider={id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true};
  const row={
    provider:'wae_edge',model:'iu-gpt-runtime-v13',attempts:58,successes:7,failures:51,consecutiveFailures:0,
    lastSuccessAt:'2026-09-16T20:33:19Z',lastFailureAt:'2026-09-16T20:31:51Z',circuitUntil:null,
  };
  const state=classifyOperationalProvider(provider,row,now);
  assert.equal(state.state,'degraded');
  assert.equal(state.eligible,true);
  assert.equal(state.healthy,false);
  assert.equal(state.reason,'recent_success_recovery');
  assert.equal(state.recoveryProbe,true);
  assert.equal(state.successRate,Number((7/58).toFixed(4)));
  assert.ok(state.successAgeMs<60_000);
});

test('production-like eight minute recovery remains eligible instead of reporting generative unavailability',()=>{
  const now=Date.parse('2026-09-16T20:40:00Z');
  const provider={id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true};
  const row={
    provider:'wae_edge',model:'iu-gpt-runtime-v13',attempts:58,successes:7,failures:51,consecutiveFailures:0,
    lastSuccessAt:'2026-09-16T20:33:19Z',lastFailureAt:'2026-09-16T20:31:51Z',circuitUntil:null,
  };
  const state=classifyOperationalProvider(provider,row,now);
  assert.equal(state.eligible,true);
  assert.equal(state.state,'degraded');
  assert.equal(state.reason,'recent_success_recovery');
  assert.equal(state.healthy,false);
});

test('fresh success never overrides an explicitly open circuit',()=>{
  const now=Date.parse('2026-09-16T20:34:00Z');
  const provider={id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true};
  const row={
    provider:'wae_edge',model:'iu-gpt-runtime-v13',attempts:58,successes:7,failures:51,consecutiveFailures:0,
    lastSuccessAt:'2026-09-16T20:33:19Z',circuitUntil:'2026-09-16T20:40:00Z',
  };
  const state=classifyOperationalProvider(provider,row,now);
  assert.equal(state.state,'unhealthy');
  assert.equal(state.eligible,false);
  assert.equal(state.reason,'persistent_circuit_open');
});

test('stale successful observation does not permanently rehabilitate low reliability',()=>{
  const now=Date.parse('2026-09-16T20:34:00Z');
  const provider={id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true};
  const row={
    provider:'wae_edge',model:'iu-gpt-runtime-v13',attempts:58,successes:7,failures:51,consecutiveFailures:0,
    lastSuccessAt:'2026-09-16T20:10:00Z',lastFailureAt:'2026-09-16T20:33:30Z',circuitUntil:null,
  };
  const state=classifyOperationalProvider(provider,row,now);
  assert.equal(state.state,'unhealthy');
  assert.equal(state.eligible,false);
  assert.equal(state.reason,'low_recent_reliability');
});

test('old failure debt becomes a bounded half-open recovery probe after five minutes',()=>{
  const now=Date.parse('2026-09-16T20:40:00Z');
  const provider={id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true};
  const row={
    provider:'wae_edge',model:'iu-gpt-runtime-v13',attempts:58,successes:7,failures:51,consecutiveFailures:4,
    lastSuccessAt:'2026-09-16T20:10:00Z',lastFailureAt:'2026-09-16T20:34:30Z',circuitUntil:null,
  };
  const state=classifyOperationalProvider(provider,row,now);
  assert.equal(state.state,'degraded');
  assert.equal(state.eligible,true);
  assert.equal(state.reason,'half_open_recovery_probe');
  assert.equal(state.recoveryProbe,true);
});

test('open persistent circuit is removed from eligible routing',()=>{
  const registry=[
    {id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true},
    {id:'wae_supabase',model:'wae-capability-router-v90',configured:true}
  ];
  const runtime=[{provider:'wae_edge',model:'iu-gpt-runtime-v13',attempts:47,successes:3,failures:44,consecutiveFailures:10,circuitUntil:'2026-09-16T02:10:00Z'}];
  const ranked=rankOperationalProviders({registry,runtime,now:Date.parse('2026-09-16T02:00:00Z')});
  assert.equal(ranked[0].id,'wae_supabase');
  assert.equal(ranked[0].eligible,true);
  assert.equal(ranked.find(x=>x.id==='wae_edge').eligible,false);
});

test('proven healthy provider outranks an unknown provider',()=>{
  const registry=[
    {id:'wae_edge',model:'iu-gpt-runtime-v13',configured:true},
    {id:'wae_supabase',model:'wae-capability-router-v90',configured:true}
  ];
  const runtime=[{provider:'wae_edge',model:'iu-gpt-runtime-v13',attempts:10,successes:9,failures:1,consecutiveFailures:0}];
  const ranked=rankOperationalProviders({registry,runtime,now:Date.parse('2026-09-16T02:00:00Z')});
  assert.equal(ranked[0].id,'wae_edge');
  assert.equal(ranked[0].healthy,true);
});

test('control-plane outage prefers a configured direct provider over Supabase-dependent routes',()=>{
  const providers=rankOperationalProviders({registry:[
    {id:'wae_edge',model:'edge',configured:true},
    {id:'wae_supabase',model:'gateway',configured:true},
    {id:'gemini',model:'gemini-test',configured:true},
    {id:'openrouter',model:'router-test',configured:true}
  ],runtime:[],now:Date.parse('2026-09-16T02:00:00Z')});
  assert.equal(directFallbackProvider(providers),'gemini');
});

test('control-plane outage does not invent a direct provider when none is configured',()=>{
  const providers=rankOperationalProviders({registry:[
    {id:'wae_edge',model:'edge',configured:true},
    {id:'wae_supabase',model:'gateway',configured:true}
  ],runtime:[],now:Date.parse('2026-09-16T02:00:00Z')});
  assert.equal(directFallbackProvider(providers),null);
});
