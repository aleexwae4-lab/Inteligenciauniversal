import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeFrontierCurriculumV102,
  frontierQualityInstructionV102,
  premiumQualityTargetV102,
  assessFrontierQualityV102,
  frontierUpgradeInstructionV102,
  preferFrontierCandidateV102,
  frontierQualityCapabilitiesV102,
} from '../lib/frontier-quality-curriculum-v102.js';
import { selfAwarenessSnapshotV99 } from '../lib/self-awareness-v99.js';

const quality=(score,{hardFailure=false,coverage=1,evidence=.9}={})=>({
  score,
  critical:score<.42,
  requirementContract:{requirements:hardFailure?['table']:[]},
  requirementCoverage:{coverage,hardFailure,missing:hardFailure?['table']:[]},
  signals:{evidence},
});

test('v102 curriculum normalizes only sanitized training signals', () => {
  const snapshot=normalizeFrontierCurriculumV102({
    openCount:3,
    criticalOpen:1,
    highOpen:1,
    baselineRegressionCases:10,
    frontierBenchmark:{enabledCases:36,criticalCases:24,pillars:6,capabilities:25},
    items:[{category:'research',severity:'high',failureTags:['citation_missing'],occurrenceCount:4,targetScore:.61,referenceScore:.82,benchmarkVersion:'verified-gpt-arena/v93'}],
    rawPrompt:'should-not-survive',
  });
  assert.equal(snapshot.version,'frontier-quality-curriculum/v102');
  assert.equal(snapshot.items.length,1);
  assert.equal(snapshot.items[0].category,'research');
  assert.equal(snapshot.privacy.rawPromptsReturned,false);
  assert.equal(snapshot.privacy.rawAnswersReturned,false);
  assert.equal(Object.hasOwn(snapshot,'rawPrompt'),false);
});

test('v102 keeps simple conversation lightweight but raises complex quality targets', () => {
  assert.deepEqual(premiumQualityTargetV102({message:'Hola',mode:'general',quality:quality(.9)}),{premiumRequired:false,target:.68,mode:'general'});
  const code=premiumQualityTargetV102({message:'Audita este backend y corrige el bug de producción',mode:'code',quality:quality(.75)});
  assert.equal(code.premiumRequired,true);
  assert.equal(code.target,.79);
  const executive=premiumQualityTargetV102({message:'Construye una estrategia completa de expansión',mode:'executive',quality:quality(.75)});
  assert.equal(executive.target,.8);
});

test('v102 current information instruction explicitly requires evidence', () => {
  const instruction=frontierQualityInstructionV102({message:'Investiga el precio actual y las noticias de hoy',mode:'research'});
  assert.match(instruction,/FRONTIER QUALITY CURRICULUM v102/);
  assert.match(instruction,/evidencia reciente/i);
  assert.match(instruction,/No inventes hechos/i);
});

test('v102 upgrades valid-but-mediocre complex answers instead of treating pass as enough', () => {
  const report=assessFrontierQualityV102({
    question:'Audita esta arquitectura y dame un plan completo de producción.',
    mode:'analysis',
    quality:quality(.70),
    sources:[],
    degraded:false,
  });
  assert.equal(report.premiumRequired,true);
  assert.equal(report.premiumPass,false);
  assert.equal(report.needsUpgrade,true);
  assert.equal(report.hardReject,false);
  assert.match(frontierUpgradeInstructionV102(report),/no alcanzó el umbral premium/i);
});

test('v102 hard-rejects broken requirements and very weak complex answers', () => {
  const requirements=assessFrontierQualityV102({question:'Devuelve una tabla comparativa',mode:'analysis',quality:quality(.72,{hardFailure:true,coverage:.4}),sources:[]});
  assert.equal(requirements.hardReject,true);
  assert.ok(requirements.reasons.includes('hard_requirement_failure'));
  const weak=assessFrontierQualityV102({question:'Diseña la arquitectura completa y riesgos',mode:'executive',quality:quality(.55),sources:[]});
  assert.equal(weak.hardReject,true);
});

test('v102 research cannot earn premium pass without grounding', () => {
  const report=assessFrontierQualityV102({question:'Noticias actuales sobre semiconductores',mode:'research',quality:quality(.9,{evidence:.58}),sources:[]});
  assert.equal(report.premiumPass,false);
  assert.ok(report.reasons.includes('grounding_missing'));
});

test('v102 candidate selection prefers premium compliance and never trades away requirement coverage', () => {
  assert.equal(preferFrontierCandidateV102({
    currentQuality:quality(.73),candidateQuality:quality(.78),
    currentReport:{premiumPass:false,hardReject:false},candidateReport:{premiumPass:true,hardReject:false}
  }),true);
  assert.equal(preferFrontierCandidateV102({
    currentQuality:quality(.73,{coverage:1}),candidateQuality:quality(.9,{coverage:.7}),
    currentReport:{premiumPass:false,hardReject:false},candidateReport:{premiumPass:false,hardReject:false}
  }),false);
});

test('self-awareness v102 is grounded in the real capability kernel and quality curriculum', () => {
  const snapshot=selfAwarenessSnapshotV99({});
  assert.equal(snapshot.version,'self-awareness/v102');
  assert.equal(snapshot.capabilityKernel.domainCount,38);
  assert.ok(snapshot.capabilityKernel.abilityCount>100);
  assert.equal(snapshot.capabilityKernel.availabilityAware,true);
  assert.equal(snapshot.qualityCurriculum.version,'frontier-quality-curriculum/v102');
  assert.equal(snapshot.qualityCurriculum.baseModelWeightsChanged,false);
  assert.equal(snapshot.claimPolicy.globalNumberOneClaimAllowed,false);
});

test('runtime and public capabilities wire v102 into production response flow', () => {
  const runtime=readFileSync(new URL('../lib/runtime.js',import.meta.url),'utf8');
  const capabilities=readFileSync(new URL('../api/capabilities.js',import.meta.url),'utf8');
  assert.match(runtime,/frontierQualityInstructionV102/);
  assert.match(runtime,/premiumUpgradeAttempted/);
  assert.match(runtime,/preferFrontierCandidateV102/);
  assert.match(runtime,/frontierQuality\.hardReject/);
  assert.match(runtime,/semanticCacheStore[\s\S]+frontierQuality\.premiumPass/);
  assert.match(capabilities,/frontierQuality:frontierQualityCapabilitiesV102\(\)/);
  assert.match(capabilities,/refreshFrontierCurriculumV102/);
});

test('v102 capability contract never claims hidden weight training or universal victory', () => {
  const capabilities=frontierQualityCapabilitiesV102();
  assert.equal(capabilities.baseModelWeightsChanged,false);
  assert.equal(capabilities.claimPolicy.globalNumberOneClaimAllowed,false);
  assert.equal(capabilities.claimPolicy.superiorityRequiresExternalVerifiedBenchmark,true);
});
