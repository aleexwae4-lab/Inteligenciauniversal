import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRunChallenger, supremacyStats } from '../lib/supremacy-runtime.js';

test('v85 challenges research drafts below the production pass threshold',()=>{
  assert.equal(shouldRunChallenger({
    message:'Investiga el estado actual del mercado y contrasta las fuentes disponibles antes de responder.',
    mode:'research',
    quality:{score:.61,pass:false,requirementCoverage:{hardFailure:false}},
    degraded:false,
    requestedProvider:'auto'
  }),true);
});

test('v85 challenges materially weak short prompts instead of exempting them by length',()=>{
  assert.equal(shouldRunChallenger({
    message:'Explica el entrelazamiento cuántico',
    mode:'general',
    quality:{score:.41,pass:false,requirementCoverage:{hardFailure:false}},
    degraded:false,
    requestedProvider:'auto'
  }),true);
});

test('v85 avoids unnecessary second generation for reasonably strong short answers',()=>{
  assert.equal(shouldRunChallenger({
    message:'Explica qué es una API',
    mode:'general',
    quality:{score:.62,pass:false,requirementCoverage:{hardFailure:false}},
    degraded:false,
    requestedProvider:'auto'
  }),false);
});

test('v85 retries explicit hard requirement failures even when the score is otherwise moderate',()=>{
  assert.equal(shouldRunChallenger({
    message:'Dame tres pasos',
    mode:'general',
    quality:{score:.65,pass:false,requirementCoverage:{hardFailure:true}},
    degraded:false,
    requestedProvider:'auto'
  }),true);
});

test('v85 never spends challenger capacity on already passing or continuity-only output',()=>{
  assert.equal(shouldRunChallenger({message:'Analiza este problema con detalle',mode:'analysis',quality:{score:.72,pass:true},requestedProvider:'auto'}),false);
  assert.equal(shouldRunChallenger({message:'Analiza este problema con detalle y propón acciones concretas',mode:'analysis',quality:{score:.30,pass:false},requestedProvider:'continuity_core'}),false);
});

test('v85 exposes the stricter tournament contract',()=>{
  const stats=supremacyStats();
  assert.equal(stats.contract,'universal-core-supremacy/v3');
  assert.equal(stats.selectiveTournament.passThreshold,.68);
  assert.equal(stats.selectiveTournament.researchThresholdAligned,true);
  assert.equal(stats.selectiveTournament.hardRequirementRetry,true);
});
