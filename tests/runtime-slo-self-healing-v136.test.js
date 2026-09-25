import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  RUNTIME_SLO_VERSION,providerSloAssessment,selfHealingBeforeAttempt,selfHealingSuccess,selfHealingFailure,
  selfHealingSnapshot,turnOperationalScore,runtimeSloContract
} from '../lib/runtime-slo-v136.js';
import {runtimeHealth} from '../lib/runtime.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v136 provider SLO waits for enough samples before judging health',()=>{
  const warm=providerSloAssessment({attempts:2,successRate:0,latencyP95Ms:99999,ttftP95Ms:99999,qualityRejects:2});
  assert.equal(warm.status,'warmup');
  assert.equal(warm.breached,false);
});

test('v136 quarantines a repeatedly degraded route then grants one probation attempt',()=>{
  const id='quarantine-'+Date.now();
  const bad={id,attempts:8,successRate:.25,latencyP95Ms:42000,ttftP95Ms:12000,qualityRejects:3};
  const first=selfHealingBeforeAttempt(id,bad,1000);
  assert.equal(first.allowed,false);
  assert.equal(first.state,'quarantined');
  assert.match(first.reason,/success_rate/);
  const contract=runtimeSloContract();
  const during=selfHealingBeforeAttempt(id,bad,1000+Math.floor(contract.provider.quarantineMs/2));
  assert.equal(during.allowed,false);
  const probation=selfHealingBeforeAttempt(id,bad,1000+contract.provider.quarantineMs+1);
  assert.equal(probation.allowed,true);
  assert.equal(probation.state,'probation');
});

test('v136 probation success enters grace and probation failure re-quarantines',()=>{
  const contract=runtimeSloContract();

  const recovered='recover-'+Date.now();
  const bad={id:recovered,attempts:7,successRate:.3,latencyP95Ms:45000,ttftP95Ms:11000,qualityRejects:3};
  selfHealingBeforeAttempt(recovered,bad,2000);
  selfHealingBeforeAttempt(recovered,bad,2000+contract.provider.quarantineMs+1);
  const ok=selfHealingSuccess(recovered,2000+contract.provider.quarantineMs+2);
  assert.equal(ok.state,'recovered');
  const grace=selfHealingBeforeAttempt(recovered,bad,2000+contract.provider.quarantineMs+3);
  assert.equal(grace.allowed,true);
  assert.equal(grace.state,'recovery_grace');

  const failed='reprob-'+Date.now();
  selfHealingBeforeAttempt(failed,{...bad,id:failed},3000);
  selfHealingBeforeAttempt(failed,{...bad,id:failed},3000+contract.provider.quarantineMs+1);
  const fail=selfHealingFailure(failed,'provider_timeout',3000+contract.provider.quarantineMs+2);
  assert.equal(fail.state,'quarantined');
});

test('v136 turn score penalizes latency recovery fallback and failed stages without request content',()=>{
  const clean=turnOperationalScore({latencyMs:900,e2e:{recoveryCount:0,failedStageCount:0},fallbackCount:0});
  assert.equal(clean.score,100);
  assert.equal(clean.status,'met');
  const recovered=turnOperationalScore({latencyMs:21000,e2e:{recoveryCount:1,failedStageCount:0},fallbackCount:2});
  assert.ok(recovered.score<100);
  assert.equal(recovered.status,'breached');
  const critical=turnOperationalScore({latencyMs:50000,e2e:{recoveryCount:3,failedStageCount:2},fallbackCount:4});
  assert.ok(critical.score<recovered.score);
  assert.equal('prompt' in critical,false);
  assert.equal('message' in critical,false);
});

test('v136 runtime health exposes SLO contract and self-healing state for providers',()=>{
  const health=runtimeHealth();
  assert.equal(health.runtimeSlo.version,RUNTIME_SLO_VERSION);
  assert.equal(health.runtimeSlo.automatic,true);
  assert.equal(health.runtimeSlo.recovery,'quarantine-probation-grace');
  assert.ok(Array.isArray(health.providerOperations));
  assert.ok(health.providerOperations.every(row=>row.selfHealing&&typeof row.selfHealing.state==='string'));
});

test('v136 provider router applies SLO quarantine before circuit breaker and records recovery',()=>{
  const providers=read('lib/providers.js');
  assert.match(providers,/selfHealingBeforeAttempt\(p\.id,observed\)/);
  assert.ok(providers.indexOf("selfHealingBeforeAttempt(p.id,observed)")<providers.indexOf("providerCircuitOpen(p.id)"));
  assert.match(providers,/selfHealingFailure\(p\.id,qualityFailure\)/);
  assert.match(providers,/selfHealingFailure\(p\.id,code\)/);
  assert.match(providers,/selfHealingSuccess\(p\.id\)/);
  assert.match(providers,/type:'quarantined'/);
  assert.match(providers,/type:'probation'/);
  assert.match(providers,/type:'recovered'/);
});

test('v136 stream and UI expose only operational self-healing events',()=>{
  const api=read('api/chat-stream.js'),app=read('app.js');
  assert.match(api,/quarantined/);
  assert.match(api,/probation/);
  assert.match(api,/recovered/);
  assert.match(api,/remainingMs/);
  assert.match(app,/Ruta en cuarentena por SLO/);
  assert.match(app,/Probando recuperación controlada/);
  assert.match(app,/Ruta recuperada/);
  assert.doesNotMatch(api,/event\.message/);
});

test('v136 deterministic and generative runtime attach operational score metadata',()=>{
  const runtime=read('lib/runtime.js');
  assert.match(runtime,/turnOperationalScore/);
  assert.match(runtime,/response\.metadata\.operationalScore=operational\.score/);
  assert.match(runtime,/responseEnvelope\.metadata\.operationalScore=operational\.score/);
  assert.match(runtime,/runtimeSlo:runtimeSloContract\(\)/);
});

test('v136 PWA publishes matching self-healing app asset',()=>{
  const html=read('index.html'),sw=read('sw.js');
  const appAsset=html.match(/\.\/app\.js\?[^"'<>\s]+/)?.[0];
  assert.ok(appAsset);
  assert.match(appAsset,/slo=v136/);
  assert.ok(sw.includes(appAsset));
  assert.match(sw,/slo-v136/);
});
