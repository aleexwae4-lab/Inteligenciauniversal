import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdaptiveBenchmarkRuntime } from '../lib/lanes/benchmark-runtime-v1.js';

test('benchmark lane stays lazy when no adaptive or benchmark inputs are requested', async()=>{
  const result=await buildAdaptiveBenchmarkRuntime({
    payload:{},
    category:'general',
  });
  assert.equal(result.adaptiveRequested,false);
  assert.equal(result.learnedRows,null);
  assert.equal(result.benchmarkRequested,false);
  assert.equal(result.benchmarkArena.cases,0);
  assert.deepEqual(result.benchmarkCurriculum.cases,[]);
});

test('benchmark lane activates benchmark inputs without changing the public shape', async()=>{
  const result=await buildAdaptiveBenchmarkRuntime({
    payload:{
      benchmarkMode:true,
      benchmarkEntries:[],
      benchmarkDifficulty:1,
    },
    category:'coding',
  });
  assert.equal(result.benchmarkRequested,true);
  assert.equal(result.benchmarkArena.version,'benchmark-arena/v2');
  assert.equal(result.benchmarkCurriculum.version,'benchmark-arena/v2');
  assert.equal(result.adaptiveSupremacy.category,'coding');
});
