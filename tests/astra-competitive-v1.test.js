import test from 'node:test';
import assert from 'node:assert/strict';
import { competitiveContract, scoreCompetitiveRun } from '../lib/astra-supremacy-v1.js';
test('competitive contract is reproducible and evidence-first',()=>{const c=competitiveContract();assert.equal(c.version,'astra-competitive-v1');assert.equal(c.tests.length,7);assert.equal(c.comparisonPolicy.noCherryPicking,true);});
test('score is bounded and weighted',()=>{const r=scoreCompetitiveRun({reasoning:100,coding:90,research:80,agentic:70,multimodal:60,verification:50,latency:40});assert.equal(r.complete,true);assert.ok(r.weightedOverall>0&&r.weightedOverall<=100);assert.equal(r.coverage,100);});
test('missing dimensions remain incomplete',()=>{const r=scoreCompetitiveRun({reasoning:100});assert.equal(r.complete,false);assert.equal(r.coverage,20);});
