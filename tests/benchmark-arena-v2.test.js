import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArenaV2, buildArenaCurriculum, BENCHMARK_ARENA_V2 } from '../lib/benchmark-arena-v2.js';
import { astraFrontierSuite } from '../lib/astra-frontier-challenge-v1.js';

test('arena v2 measures the complete frontier suite and creates regression queue',()=>{
  const suite=astraFrontierSuite();
  const entries=suite.map((c,i)=>({caseId:c.id,score:i===0 ? .42 : .91,verified:true}));
  const arena=buildArenaV2({entries});
  assert.equal(arena.version,BENCHMARK_ARENA_V2);
  assert.equal(arena.cases,suite.length);
  assert.ok(arena.regressionQueue.length>0);
  assert.ok(arena.nextDifficulty>0);
});

test('arena v2 blocks promotion when high or critical regression exists',()=>{
  const suite=astraFrontierSuite();
  const arena=buildArenaV2({entries:suite.map(c=>({caseId:c.id,score:.4,verified:true}))});
  const curriculum=buildArenaCurriculum({arena});
  assert.equal(curriculum.promotionBlocked,true);
  assert.equal(curriculum.priority,'critical');
});

test('arena v2 refuses unverified results as passing evidence',()=>{
  const suite=astraFrontierSuite();
  const arena=buildArenaV2({entries:suite.map(c=>({caseId:c.id,score:.99,verified:false}))});
  assert.equal(arena.regressionQueue.length,suite.length);
  assert.equal(arena.policy.verifiedOnly,true);
});
