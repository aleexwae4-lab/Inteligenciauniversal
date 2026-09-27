import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupremacyManifest, scoreUniversalFrontier, comparePairedFrontier, promotionGate } from '../lib/supremacy-engine-v2.js';
import { astraFrontierSuite } from '../lib/astra-frontier-challenge-v1.js';

test('supremacy manifest has hard anti-simulation gates',()=>{
 const m=buildSupremacyManifest();
 assert.equal(m.cases,20);
 assert.equal(m.gates.noSimulation,true);
 assert.equal(m.claimPolicy.includes('global superiority'),true);
});
test('frontier scoring is deterministic and weighted',()=>{
 const rows=astraFrontierSuite().map(c=>({caseId:c.id,score:1,answer:'verified'}));
 const s=scoreUniversalFrontier(rows);
 assert.equal(s.score,1);
 assert.equal(s.criticalFailures,0);
});
test('comparison refuses incomplete external references',()=>{
 const out=comparePairedFrontier({universalEntries:[],referenceEntries:[]});
 assert.equal(out.comparable,false);
 assert.equal(out.claimAllowed,false);
});
test('promotion remains blocked from automatic superiority claims',()=>{
 const out=promotionGate({comparison:{comparable:true},criticalFailures:0});
 assert.equal(out.promote,true);
 assert.equal(out.gates.externalClaimAuthorization,false);
});
