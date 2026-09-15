import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateHeadToHead, compareBenchmarkCandidates, createTrainingCase, evaluateBenchmarkCandidate, evaluationPlaneCapabilities } from '../lib/evaluation-plane.js';

test('evaluation plane is blind and never claims base-model training',()=>{
  const caps=evaluationPlaneCapabilities();
  assert.equal(caps.version,'supremacy-evaluation/v35');
  assert.equal(caps.blind,true);
  assert.equal(caps.providerIdentityUsed,false);
  assert.equal(caps.baseModelTraining,false);
  assert.equal(caps.superiorityPolicy.claimRequiresEvidence,true);
});

test('hard output requirements defeat a polished but non-compliant answer',()=>{
  const prompt='Devuelve JSON válido con las claves result y unit para el cálculo 100 x 200.';
  const weak=evaluateBenchmarkCandidate({caseId:'json-contract',prompt,answer:'El resultado es veinte mil y la unidad solicitada es MXN.',assertions:{expectedJson:{result:20000,unit:'MXN'},numericFacts:[{value:20000}]}});
  const strong=evaluateBenchmarkCandidate({caseId:'json-contract',prompt,answer:'{"result":20000,"unit":"MXN"}',assertions:{expectedJson:{result:20000,unit:'MXN'},numericFacts:[{value:20000}]}});
  assert.equal(weak.hardFailure,true);
  assert.equal(weak.pass,false);
  assert.equal(strong.hardFailure,false);
  assert.equal(strong.assertions.pass,true);
  assert.ok(strong.score>weak.score);
});

test('blind comparison ranks by verified compliance, never provider identity',()=>{
  const comparison=compareBenchmarkCandidates({
    caseId:'blind-table',
    prompt:'Compara PostgreSQL y SQLite en una tabla e incluye dos riesgos.',
    mode:'analysis',
    candidates:[
      {id:'universal_core',provider:'unknown',answer:'| Motor | Fortaleza | Riesgo |\n|---|---|---|\n| PostgreSQL | Concurrencia | Operación más compleja |\n| SQLite | Simplicidad | Escrituras concurrentes limitadas |\n\nRiesgos: 1. elegir SQLite con alta concurrencia; 2. sobredimensionar PostgreSQL para una app local.'},
      {id:'famous_model',provider:'famous',answer:'PostgreSQL y SQLite son dos bases de datos excelentes. PostgreSQL suele ser más potente y SQLite más simple.'}
    ]
  });
  assert.equal(comparison.providerIdentityUsed,false);
  assert.equal(comparison.ranking[0].id,'universal_core');
  assert.ok(comparison.ranking[0].evaluation.score>comparison.ranking[1].evaluation.score);
});

test('superiority certification requires enough reproducible cases',()=>{
  const comparison={verdict:'win',winnerId:'universal_core',ranking:[{id:'universal_core',evaluation:{hardFailure:false}},{id:'competitor',evaluation:{hardFailure:false}}]};
  const short=aggregateHeadToHead({comparisons:Array.from({length:29},()=>comparison),targetId:'universal_core'});
  assert.equal(short.claimAllowed,false);
  assert.equal(short.verdict,'NOT_PROVEN');
  const enough=aggregateHeadToHead({comparisons:Array.from({length:30},()=>comparison),targetId:'universal_core'});
  assert.equal(enough.claimAllowed,true);
  assert.equal(enough.verdict,'CERTIFIED_ADVANTAGE');
});

test('benchmark losses become explicit regression training cases',()=>{
  const prompt='Compara A y B en una tabla.';
  const comparison=compareBenchmarkCandidates({caseId:'training-loop',prompt,candidates:[
    {id:'universal_core',answer:'A es rápido y B es flexible.'},
    {id:'reference',answer:'| Opción | Rasgo |\n|---|---|\n| A | rápido |\n| B | flexible |'}
  ]});
  const training=createTrainingCase({caseId:'training-loop',prompt,comparison,targetId:'universal_core'});
  assert.equal(training.baseModelWeightsChanged,false);
  assert.equal(training.schema,'universal-training-case/v1');
  assert.ok(training.failureTags.some(tag=>tag.includes('table')));
  assert.ok(training.requiredRegression.length>=1);
});
