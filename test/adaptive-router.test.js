import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyTask,capabilityRequirements,rankModels,streamEligible,shouldOpenCircuit,estimateCostMicrounits,promotionGate,metacognitiveCanaryGate,METACOGNITIVE_CANARY_POLICY_V1} from '../lib/adaptive-router.js';

const healthy=(overrides={})=>({id:'healthy',enabled:true,effectiveHealth:'healthy',circuitState:'CLOSED',taskQuality:85,reliabilityScore:90,ewmaLatencyMs:2200,ewmaTtftMs:800,contextWindow:32768,reasoningCapable:true,structuredOutputCapable:true,streamingClaimed:true,streamingVerified:true,inputPerMillion:0,outputPerMillion:0,consecutiveFailures:0,...overrides});

test('simple greeting uses FAST path',()=>{assert.deepEqual(classifyTask('Hola'),{category:'simple_chat',path:'FAST',risk:'low',complexity:'low'});});
test('coding request uses STANDARD path',()=>{assert.equal(classifyTask('Refactoriza esta función TypeScript').category,'coding');assert.equal(classifyTask('Refactoriza esta función TypeScript').path,'STANDARD');});
test('high-risk request escalates to DEEP',()=>{const x=classifyTask('Analiza este riesgo legal penal');assert.equal(x.category,'high_risk');assert.equal(x.path,'DEEP');assert.equal(x.risk,'high');});
test('document analysis expresses files and RAG requirements',()=>{const task=classifyTask('Analiza',{attachments:[{name:'a.txt'}]});const r=capabilityRequirements(task,{attachments:[{name:'a.txt'}]});assert.equal(r.files,true);assert.equal(r.rag,true);assert.equal(r.contextWindow,32768);});
test('offline and OPEN models are excluded before inference',()=>{const task=classifyTask('Hola');const req=capabilityRequirements(task);const ranked=rankModels([healthy({id:'offline',effectiveHealth:'offline'}),healthy({id:'open',circuitState:'OPEN'}),healthy({id:'ok'})],task,req);assert.deepEqual(ranked.map(x=>x.id),['ok']);});
test('degraded model is penalized against equivalent healthy model',()=>{const task=classifyTask('Hola');const req=capabilityRequirements(task);const ranked=rankModels([healthy({id:'degraded',effectiveHealth:'degraded'}),healthy({id:'healthy'})],task,req);assert.equal(ranked[0].id,'healthy');assert.ok(ranked[0].score>ranked[1].score);});
test('FAST path chooses faster qualified healthy model without sacrificing minimum quality',()=>{const task=classifyTask('Hola');const req=capabilityRequirements(task);const ranked=rankModels([healthy({id:'fast',taskQuality:80,reliabilityScore:94,ewmaLatencyMs:700,ewmaTtftMs:250}),healthy({id:'slow',taskQuality:86,reliabilityScore:94,ewmaLatencyMs:7000,ewmaTtftMs:3500})],task,req);assert.equal(ranked[0].id,'fast');});
test('preferred CLOSED models retain HALF_OPEN fallbacks instead of erasing them',()=>{const task=classifyTask('Hola'),req=capabilityRequirements(task);const ranked=rankModels([healthy({id:'primary',taskQuality:95,reliabilityScore:95,circuitState:'CLOSED'}),healthy({id:'fallback',taskQuality:100,reliabilityScore:94,circuitState:'HALF_OPEN',effectiveHealth:'degraded'})],task,req);assert.deepEqual(ranked.map(x=>x.id),['primary','fallback']);});
test('large historical failure debt is strongly penalized after a circuit closes',()=>{const task=classifyTask('Hola'),req=capabilityRequirements(task);const ranked=rankModels([healthy({id:'unstable',taskQuality:100,reliabilityScore:94,ewmaLatencyMs:700,ewmaTtftMs:250,consecutiveFailures:215}),healthy({id:'stable',taskQuality:85,reliabilityScore:90,ewmaLatencyMs:2200,ewmaTtftMs:800,consecutiveFailures:0})],task,req);assert.equal(ranked[0].id,'stable');assert.equal(ranked.find(x=>x.id==='unstable').failureDebt,215);});
test('unverified recent streaming transport is excluded from stream route',()=>{const now=Date.now(),model=healthy({streamingVerified:false,streamingProbeCount:1,lastStreamFailureAt:new Date(now-60_000).toISOString()});assert.equal(streamEligible(model,{now}),false);const task=classifyTask('Hola'),req=capabilityRequirements(task,{stream:true});assert.equal(rankModels([model],task,req).length,0);});
test('streaming transport can be reprobed after cooldown',()=>{const now=Date.now(),model=healthy({streamingVerified:false,streamingProbeCount:1,lastStreamFailureAt:new Date(now-7*3600_000).toISOString()});assert.equal(streamEligible(model,{now}),true);});
test('429 opens circuit immediately for ten minutes',()=>{assert.deepEqual(shouldOpenCircuit({status:429,consecutiveFailures:1}),{open:true,minutes:10,reason:'rate_limit'});});
test('auth failures open circuit for sixty minutes',()=>{assert.deepEqual(shouldOpenCircuit({status:403}),{open:true,minutes:60,reason:'auth'});});
test('cost engine normalizes token cost to micro-units',()=>{assert.equal(estimateCostMicrounits({inputTokens:1_000_000,outputTokens:500_000,inputPerMillion:2,outputPerMillion:4}),4_000_000);assert.equal(estimateCostMicrounits({inputTokens:5,outputTokens:5}),null);});
test('promotion gate blocks quality, error, latency and security regression',()=>{const current={quality:90,errorRate:.01,p95Latency:5000,p95Ttft:1500,securityRegressions:0};const bad={quality:85,errorRate:.02,p95Latency:6000,p95Ttft:1800,securityRegressions:1};const g=promotionGate(current,bad);assert.equal(g.pass,false);assert.deepEqual(g.failures,['quality','error_rate','p95_latency','p95_ttft','security_regressions']);});
test('promotion gate accepts faster candidate inside quality tolerance',()=>{const current={quality:90,errorRate:.01,p95Latency:5000,p95Ttft:1500,securityRegressions:0};const better={quality:89.5,errorRate:.01,p95Latency:4200,p95Ttft:1100,securityRegressions:0};assert.equal(promotionGate(current,better).pass,true);});

test('metacognitive governor mirrors the live factual HOLD and cannot auto-apply',()=>{
  const control={samples:20,successRate:1,p95LatencyMs:31606.65,avgTtftMs:5097};
  const candidate={samples:146,successRate:.952054794520548,p95LatencyMs:31019.5,avgTtftMs:6216};
  const g=metacognitiveCanaryGate(control,candidate);
  assert.equal(g.decision,'HOLD_MULTIPLE_REGRESSIONS');
  assert.equal(g.pass,false);
  assert.equal(g.recommendedStagePct,0);
  assert.equal(g.routingInfluenceEnabled,false);
  assert.equal(g.autoApply,false);
  assert.deepEqual(g.blockers.map(x=>x.code),['insufficient_evidence','reliability_regression','latency_improvement_insufficient','ttft_regression']);
});

test('metacognitive governor only marks a proven candidate CANARY_ELIGIBLE at five percent',()=>{
  const control={samples:80,successRate:.99,p95LatencyMs:10000,avgTtftMs:3000};
  const candidate={samples:85,successRate:.989,p95LatencyMs:9000,avgTtftMs:3060};
  const g=metacognitiveCanaryGate(control,candidate);
  assert.equal(g.decision,'CANARY_ELIGIBLE');
  assert.equal(g.pass,true);
  assert.equal(g.recommendedStagePct,METACOGNITIVE_CANARY_POLICY_V1.initialStagePct);
  assert.equal(g.routingInfluenceEnabled,false);
  assert.equal(g.autoApply,false);
});

test('metacognitive governor fails closed when candidate lane is missing',()=>{
  const g=metacognitiveCanaryGate({samples:80,successRate:.99,p95LatencyMs:10000,avgTtftMs:3000},{});
  assert.equal(g.decision,'HOLD_NO_CANDIDATE');
  assert.equal(g.pass,false);
  assert.equal(g.recommendedStagePct,0);
});

test('metacognitive governor fails closed when required metrics are missing',()=>{
  const g=metacognitiveCanaryGate({samples:80,successRate:.99,p95LatencyMs:10000,avgTtftMs:3000},{samples:80});
  assert.equal(g.decision,'HOLD_MULTIPLE_REGRESSIONS');
  assert.ok(g.blockers.some(x=>x.code==='missing_reliability_metric'));
  assert.ok(g.blockers.some(x=>x.code==='missing_latency_metric'));
  assert.ok(g.blockers.some(x=>x.code==='missing_candidate_ttft'));
});

test('metacognitive governor isolates insufficient evidence when metrics otherwise pass',()=>{
  const g=metacognitiveCanaryGate(
    {samples:20,successRate:.99,p95LatencyMs:10000,avgTtftMs:3000},
    {samples:29,successRate:.989,p95LatencyMs:9000,avgTtftMs:3060}
  );
  assert.equal(g.decision,'HOLD_INSUFFICIENT_EVIDENCE');
  assert.deepEqual(g.blockers.map(x=>x.code),['insufficient_evidence']);
});
