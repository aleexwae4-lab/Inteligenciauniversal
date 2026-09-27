import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningSnapshot, recordAdaptiveOutcome, readAdaptiveLearning, adaptiveLearningCapabilities, __resetAdaptiveLearningForTests } from '../lib/adaptive-learning-loop-v1.js';

test('learning snapshot ranks only after minimum evidence',()=>{
 const s=buildLearningSnapshot([{category:'coding',strategy:'execution_first',attempts:2,successes:2,quality_sum:2,latency_sum_ms:100},{category:'coding',strategy:'deep_verify',attempts:4,successes:4,quality_sum:3.8,latency_sum_ms:800}]);
 assert.ok(s.categories.coding,JSON.stringify(s));
 assert.equal(s.categories.coding[0].strategy,'deep_verify');
 assert.equal(s.policy.minSamplesForPreference,3);
});

test('learning outcome rejects unconfigured persistence without failing runtime',async()=>{
 const r=await recordAdaptiveOutcome({category:'coding',strategy:'execution_first',qualityScore:.9,qualityPass:true,verified:true,env:{}});
 assert.equal(r.persisted,false);
 assert.equal(r.success,true);
});

test('learning never trusts client competitor data and stores aggregate-only policy',()=>{
 const c=adaptiveLearningCapabilities();
 assert.equal(c.rawCompetitorAnswersPersisted,false);
 assert.equal(c.clientFeedbackTrusted,false);
 assert.equal(c.baseModelWeightsChanged,false);
});

test('learning read fails closed without Supabase',async()=>{
 __resetAdaptiveLearningForTests();
 assert.equal(await readAdaptiveLearning({category:'coding',env:{}}),null);
});
