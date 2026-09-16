import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VERIFIED_GPT_ARENA_VERSION,
  benchmarkAttestationState,
  benchmarkSourcesHash,
  createRuntimeAttestation,
  certifyVerifiedGptRun,
  gptComparatorReadiness,
  verifiedGptArenaManifest,
  verifyRuntimeAttestation,
} from '../lib/verified-gpt-arena-v93.js';
import { adversarialEvidenceSuite } from '../lib/adversarial-evidence-v72.js';

const SECRET = 'v93-test-secret-abcdefghijklmnopqrstuvwxyz-0123456789';
const TARGET = 'universal_core';
const REFERENCE = 'openai:gpt-6-astra';
const TARGET_MODEL = 'iu-gpt-runtime-v13';
const REFERENCE_MODEL = 'gpt-6-astra';
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const OBSERVED = '2026-09-16T17:00:00.000Z';

function pairEntry(testCase, index = 0) {
  const targetAnswer = `Universal Core respuesta verificable caso ${index}. K1 K2 evidencia no inventada; no se ejecutan instrucciones no confiables.`;
  const referenceAnswer = `GPT respuesta de referencia caso ${index}. K1 K2 evidencia no inventada; no se ejecutan instrucciones no confiables.`;
  const targetSources = [`https://wae.example/evidence/${index}`];
  const referenceSources = [`https://openai.example/evidence/${index}`];
  const targetAttestation = createRuntimeAttestation({
    caseId: testCase.id,
    promptHash: testCase.promptHash,
    candidateId: TARGET,
    provider: 'wae_edge',
    model: TARGET_MODEL,
    answer: targetAnswer,
    sources: targetSources,
    responseId: `wae-${index}`,
    commitSha: COMMIT,
    observedAt: OBSERVED,
    secretOverride: SECRET,
  });
  const referenceAttestation = createRuntimeAttestation({
    caseId: testCase.id,
    promptHash: testCase.promptHash,
    candidateId: REFERENCE,
    provider: 'openai',
    model: REFERENCE_MODEL,
    answer: referenceAnswer,
    sources: referenceSources,
    responseId: `openai-${index}`,
    commitSha: 'external-reference',
    observedAt: OBSERVED,
    secretOverride: SECRET,
  });
  return {
    caseId: testCase.id,
    promptHash: testCase.promptHash,
    candidates: [
      { id: TARGET, answer: targetAnswer, sources: targetSources, attestation: targetAttestation },
      { id: REFERENCE, answer: referenceAnswer, sources: referenceSources, attestation: referenceAttestation },
    ],
  };
}

test('v93 exposes signed answer/source provenance and forbids simulated GPT claims', () => {
  const manifest = verifiedGptArenaManifest();
  assert.equal(manifest.version, VERIFIED_GPT_ARENA_VERSION);
  assert.equal(manifest.requiredCases, 64);
  assert.equal(manifest.referenceProvider, 'openai');
  assert.equal(manifest.referencePolicy.model, 'gpt-6-astra');
  assert.equal(manifest.referencePolicy.reasoningEffort, 'high');
  assert.equal(manifest.referencePolicy.researchWebSearch, true);
  assert.equal(manifest.sourcesHash, 'SHA-256');
  assert.equal(manifest.simulatedReferenceForbidden, true);
  assert.equal(manifest.exactVersionedReferenceRequired, true);
  assert.match(manifest.claimPolicy.forbidden, /simulated/i);
});

test('v93 comparator readiness pins Astra independently from normal OpenAI routing', () => {
  const missing = gptComparatorReadiness([{ id: 'openai', configured: false, model: 'gpt-5.6-sol' }]);
  assert.equal(missing.executable, false);
  assert.equal(missing.reason, 'openai_provider_not_configured');
  assert.equal(missing.model, REFERENCE_MODEL);
  assert.equal(missing.providerRoutingModel, 'gpt-5.6-sol');
  assert.equal(missing.reasoningEffort, 'high');
  const ready = gptComparatorReadiness([{ id: 'openai', configured: true, model: 'gpt-5.6-sol' }]);
  assert.equal(ready.executable, true);
  assert.equal(ready.referenceId, REFERENCE);
  assert.equal(ready.model, REFERENCE_MODEL);
});

test('v93 HMAC attestation binds answer, sources, case, provider, model and runtime receipt', () => {
  const testCase = adversarialEvidenceSuite()[0];
  const answer = 'Respuesta exacta de prueba';
  const sources = ['https://example.com/b','https://example.com/a','https://example.com/a'];
  const attestation = createRuntimeAttestation({
    caseId: testCase.id,
    promptHash: testCase.promptHash,
    candidateId: REFERENCE,
    provider: 'openai',
    model: REFERENCE_MODEL,
    answer,
    sources,
    responseId: 'resp-123',
    observedAt: OBSERVED,
    secretOverride: SECRET,
  });
  assert.equal(attestation.signed, true);
  assert.equal(attestation.sourcesHash, benchmarkSourcesHash(['https://example.com/a','https://example.com/b']));
  const valid = verifyRuntimeAttestation({ attestation, answer, sources, caseId: testCase.id, promptHash: testCase.promptHash, candidateId: REFERENCE, secretOverride: SECRET });
  assert.equal(valid.ok, true);
  const tamperedAnswer = verifyRuntimeAttestation({ attestation, answer: `${answer} alterada`, sources, caseId: testCase.id, promptHash: testCase.promptHash, candidateId: REFERENCE, secretOverride: SECRET });
  assert.equal(tamperedAnswer.ok, false);
  assert.ok(tamperedAnswer.reasons.includes('response_hash_mismatch'));
  const tamperedSources = verifyRuntimeAttestation({ attestation, answer, sources: ['https://malicious.example'], caseId: testCase.id, promptHash: testCase.promptHash, candidateId: REFERENCE, secretOverride: SECRET });
  assert.equal(tamperedSources.ok, false);
  assert.ok(tamperedSources.reasons.includes('sources_hash_mismatch'));
});

test('v93 refuses to sign when the benchmark attestation secret is not strong enough', () => {
  assert.equal(benchmarkAttestationState('short').configured, false);
  const testCase = adversarialEvidenceSuite()[0];
  const attestation = createRuntimeAttestation({ caseId: testCase.id, promptHash: testCase.promptHash, candidateId: TARGET, provider: 'wae_edge', model: TARGET_MODEL, answer: 'x', responseId: 'r', secretOverride: 'short' });
  assert.equal(attestation.signed, false);
  assert.equal(attestation.error, 'attestation_secret_unconfigured');
});

test('complete 64-case signed provenance can pass v93 provenance without manufacturing a quality win', () => {
  const entries = adversarialEvidenceSuite().map(pairEntry);
  const certification = certifyVerifiedGptRun({ entries, targetId: TARGET, referenceId: REFERENCE, secretOverride: SECRET });
  assert.equal(certification.evaluatedCases, 64);
  assert.equal(certification.gates.fullTargetAttestation, true);
  assert.equal(certification.gates.fullReferenceAttestation, true);
  assert.equal(certification.gates.referenceProviderOpenAI, true);
  assert.equal(certification.gates.referenceModelVersionedGpt, true);
  assert.equal(certification.gates.exactReferenceIdentity, true);
  assert.equal(certification.gates.singleTargetCommit, true);
  assert.equal(certification.gates.boundedRunWindow, true);
  assert.equal(certification.gates.provenance, true);
  assert.equal(certification.provenance.answerAndSourceIntegrity, true);
  assert.equal(certification.claimAllowed, false);
  assert.equal(certification.verdict, 'NOT_PROVEN');
});

test('one forged reference provider invalidates the entire v93 provenance gate', () => {
  const entries = adversarialEvidenceSuite().map(pairEntry);
  const entry = entries[10];
  const reference = entry.candidates.find(candidate => candidate.id === REFERENCE);
  reference.attestation = createRuntimeAttestation({
    caseId: entry.caseId,
    promptHash: entry.promptHash,
    candidateId: REFERENCE,
    provider: 'wae_edge',
    model: REFERENCE_MODEL,
    answer: reference.answer,
    sources: reference.sources,
    responseId: 'forged-route',
    commitSha: COMMIT,
    observedAt: OBSERVED,
    secretOverride: SECRET,
  });
  const certification = certifyVerifiedGptRun({ entries, targetId: TARGET, referenceId: REFERENCE, secretOverride: SECRET });
  assert.equal(certification.gates.referenceProviderOpenAI, false);
  assert.equal(certification.gates.provenance, false);
  assert.equal(certification.claimAllowed, false);
});

test('public Node runtime wires the v93 benchmark status endpoint', () => {
  const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
  assert.match(source, /import benchmarkV93Handler from ['"]\.\/api\/benchmark-v93\.js['"]/);
  assert.match(source, /\['\/api\/benchmark\/v93',\s*benchmarkV93Handler\]/);
});
