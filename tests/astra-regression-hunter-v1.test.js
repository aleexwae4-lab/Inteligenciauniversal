import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAstraRegressionHunter, buildRegressionCurriculum } from '../lib/astra-regression-hunter-v1.js';

test('regression hunter prioritizes measured gaps',()=>{
 const r=buildAstraRegressionHunter({measurements:{'gpqa-diamond':0.80}});
 const row=r.tasks.find(x=>x.metricId==='gpqa-diamond');
 assert.equal(row.status,'GAP');
 assert.equal(row.severity,'P0');
 assert.ok(row.regressionCases.length>=0);
});

test('unmeasured reference becomes measurement work, never invented data',()=>{
 const r=buildAstraRegressionHunter({measurements:{}});
 const row=r.tasks.find(x=>x.metricId==='terminal-bench-4');
 assert.equal(row.status,'UNMEASURED');
 assert.equal(row.severity,'P1');
 assert.equal(row.universalScore,null);
});

test('curriculum contains only actionable P0/P1 work',()=>{
 const r=buildRegressionCurriculum({measurements:{'gpqa-diamond':0.80}});
 assert.ok(r.queue.some(x=>x.metricId==='gpqa-diamond'));
 assert.equal(r.policy.noSimulatedCompetitorData,true);
 assert.equal(r.policy.noGlobalSuperiorityClaim,true);
});
