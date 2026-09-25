import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ADAPTIVE_ROUTER_VERSION,adaptiveAttempt,adaptiveSuccess,adaptiveFailure,adaptiveQualityReject,
  adaptiveOrder,adaptiveSnapshot,providerAdaptiveScore,adaptiveContract
} from '../lib/provider-adaptive-v135.js';
import {runtimeHealth} from '../lib/runtime.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v135 preserves WAE/first-party priority even when an external route scores higher',()=>{
  const wae={id:'wae_edge',configured:true};
  const external={id:'gemini-v135-'+Date.now(),configured:true};
  for(let i=0;i<6;i++){adaptiveAttempt(wae.id);adaptiveFailure(wae.id,'timeout',{latencyMs:4000})}
  for(let i=0;i<6;i++){adaptiveAttempt(external.id);adaptiveSuccess(external.id,{latencyMs:200,ttftMs:80})}
  const ordered=adaptiveOrder([external,wae]);
  assert.equal(ordered[0].id,'wae_edge');
  assert.ok(providerAdaptiveScore(external)>providerAdaptiveScore(wae));
});

test('v135 reorders providers inside the same cost class from observed health',()=>{
  const bad={id:'external-bad-'+Date.now(),configured:true};
  const good={id:'external-good-'+Date.now(),configured:true};
  for(let i=0;i<4;i++){adaptiveAttempt(bad.id);adaptiveFailure(bad.id,'provider_timeout',{latencyMs:3500,ttftMs:1800})}
  for(let i=0;i<4;i++){adaptiveAttempt(good.id);adaptiveSuccess(good.id,{latencyMs:420,ttftMs:110})}
  const ordered=adaptiveOrder([bad,good]);
  assert.equal(ordered[0].id,good.id);
});

test('v135 snapshot publishes bounded P50/P95 latency and TTFT without request content',()=>{
  const id='metrics-'+Date.now();
  for(const [latency,ttft] of [[100,20],[200,40],[300,60],[400,80],[500,100]]){
    adaptiveAttempt(id);adaptiveSuccess(id,{latencyMs:latency,ttftMs:ttft});
  }
  adaptiveAttempt(id);adaptiveQualityReject(id,'quality_gate',{latencyMs:600,ttftMs:120});
  const row=adaptiveSnapshot([{id,configured:true}])[0];
  assert.equal(row.latencyP50Ms,300);
  assert.equal(row.latencyP95Ms,600);
  assert.equal(row.ttftP50Ms,60);
  assert.equal(row.ttftP95Ms,120);
  assert.equal(row.qualityRejects,1);
  assert.equal('prompt' in row,false);
  assert.equal('message' in row,false);
});

test('v135 runtime health exposes adaptive contract and merged provider telemetry',()=>{
  const health=runtimeHealth();
  assert.equal(health.adaptiveRouting.version,ADAPTIVE_ROUTER_VERSION);
  assert.equal(health.adaptiveRouting.strategy,'cost-class-then-health');
  assert.equal(health.adaptiveRouting.preservesFirstPartyPriority,true);
  assert.ok(Array.isArray(health.providerOperations));
  assert.ok(health.providerOperations.every(x=>'score' in x&&'latencyP50Ms' in x&&'ttftP95Ms' in x));
  assert.match(health.runtime.node,/^v\d+\./);
  assert.deepEqual(health.adaptiveRouting,adaptiveContract());
});

test('v135 provider router records attempts, success, quality rejects and failures before adaptive reorder',()=>{
  const providers=read('lib/providers.js');
  assert.match(providers,/adaptiveOrder\(configured\)/);
  assert.match(providers,/adaptiveAttempt\(p\.id\)/);
  assert.match(providers,/adaptiveSuccess\(p\.id/);
  assert.match(providers,/adaptiveFailure\(p\.id/);
  assert.match(providers,/adaptiveQualityReject\(p\.id/);
  assert.match(providers,/providerCircuitOpen\(p\.id\)/);
});

test('v135 pins Node to a stable major instead of an open-ended >= range',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.engines.node,'22.x');
  assert.equal(pkg.version,'0.6.5');
});
