import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPremiumRepairBodyV100,
  premiumRepairDecisionV100,
  publicPremiumRepairV100,
} from '../lib/premium-response-repair-v100.js';

function payload(blockers,critical=true){
  return{
    reply:'candidate output',
    quality_reliability:{critical_failure:critical,blockers},
    response:{content:'candidate output'},
  };
}

test('v100 attempts one repair for hard instruction contract violations',()=>{
  for(const blocker of ['invalid_json','missing_table','bullet_count_2_expected_3','word_limit_exceeded','exact_output_violated']){
    const decision=premiumRepairDecisionV100(payload([blocker]),{message:'test'});
    assert.equal(decision.attempt,true,blocker);
    assert.deepEqual(decision.instructionBlockers,[blocker]);
    assert.equal(decision.maxAttempts,1);
  }
});

test('v100 does not rewrite evidence holds or noncritical answers',()=>{
  assert.equal(premiumRepairDecisionV100(payload(['answer_intelligence_hold']),{message:'test'}).attempt,false);
  assert.equal(premiumRepairDecisionV100(payload(['citation_repair_required']),{message:'test'}).attempt,false);
  assert.equal(premiumRepairDecisionV100(payload(['invalid_json'],false),{message:'test'}).attempt,false);
  assert.equal(premiumRepairDecisionV100({reply:'',quality_reliability:{critical_failure:true,blockers:['invalid_json']}},{message:'test'}).attempt,false);
});

test('v100 refuses recursive repair attempts',()=>{
  const decision=premiumRepairDecisionV100(payload(['invalid_json']),{message:'test',quality_repair_v100:true});
  assert.equal(decision.attempt,false);
  assert.equal(decision.reason,'repair_already_attempted');
});

test('v100 repair body preserves original task and adds a bounded non-meta repair directive',()=>{
  const body={message:'Devuelve solo JSON válido con tres campos.',mode:'general',system:'Base system'};
  const decision=premiumRepairDecisionV100(payload(['invalid_json']),body);
  const repaired=buildPremiumRepairBodyV100(body,decision);
  assert.equal(repaired.message,body.message);
  assert.equal(repaired.mode,'general');
  assert.equal(repaired.quality_repair_v100,true);
  assert.match(repaired.system,/premium response repair v100/i);
  assert.match(repaired.system,/invalid_json/);
  assert.match(repaired.system,/no menciones la reparación/i);
  assert.ok(repaired.system.length<=30000);
});

test('v100 public repair metadata never includes raw candidate content',()=>{
  const decision=premiumRepairDecisionV100(payload(['missing_table']),{message:'test'});
  const publicState=publicPremiumRepairV100(decision,'accepted');
  assert.equal(publicState.attempted,true);
  assert.equal(publicState.status,'accepted');
  assert.deepEqual(publicState.repairedBlockers,['missing_table']);
  assert.equal(publicState.rawCandidatePersisted,false);
  assert.equal(publicState.baseModelWeightsChanged,false);
  assert.equal(JSON.stringify(publicState).includes('candidate output'),false);
});
