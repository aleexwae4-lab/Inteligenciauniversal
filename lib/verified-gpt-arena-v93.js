import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  adversarialEvidenceSuite,
  adversarialEvidenceManifest,
  certifyAdversarialEvidenceRun,
  ADVERSARIAL_EVIDENCE_VERSION,
} from './adversarial-evidence-v72.js';
import { providerRegistry } from './providers.js';
import { openAIFrontierReferenceState } from './frontier-reference-v96.js';

export const VERIFIED_GPT_ARENA_VERSION = 'verified-gpt-arena/v93';
export const VERIFIED_GPT_ARENA_SCHEMA = 'verified-paired-benchmark/v1';
export const VERIFIED_GPT_REQUIRED_CASES = 64;
export const VERIFIED_GPT_REFERENCE_PROVIDER = 'openai';

const sha256 = value => createHash('sha256').update(String(value ?? '')).digest('hex');
const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const safeProvider = value => clean(value, 80).toLowerCase();
const safeModel = value => clean(value, 160);
const stableIso = value => {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
};

function secretValue(secretOverride = '') {
  return String(secretOverride || process.env.WAE_BENCHMARK_ATTESTATION_SECRET || process.env.WAE_RUNTIME_BRIDGE_TOKEN || '');
}

function canonicalAttestationPayload(attestation = {}) {
  return [
    clean(attestation.version, 80),
    clean(attestation.caseId, 120),
    clean(attestation.promptHash, 128),
    clean(attestation.candidateId, 160),
    safeProvider(attestation.provider),
    safeModel(attestation.model),
    clean(attestation.responseHash, 128),
    clean(attestation.responseId, 200),
    clean(attestation.requestId, 200),
    clean(attestation.commitSha, 80),
    stableIso(attestation.observedAt),
  ].join('|');
}

function signPayload(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function constantTimeHexEqual(a = '', b = '') {
  try {
    const left = Buffer.from(String(a), 'hex');
    const right = Buffer.from(String(b), 'hex');
    return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function versionedReferenceId(provider, model) {
  const p = safeProvider(provider);
  const m = safeModel(model).toLowerCase();
  if (!p || !m || !/\d/.test(m)) return '';
  return `${p}:${m}`;
}

export function gptComparatorReadiness(registry = providerRegistry()) {
  const frontier = openAIFrontierReferenceState(registry);
  return {
    provider: VERIFIED_GPT_REFERENCE_PROVIDER,
    configured: frontier.configured,
    model: frontier.model,
    referenceId: frontier.referenceId,
    versioned: frontier.versioned,
    executable: frontier.executable,
    exactExecution: true,
    fallbackAllowed: false,
    decoupledFromProductionModel: true,
    ordinaryProviderModel: frontier.ordinaryProviderModel,
    referenceVersion: frontier.version,
    reason: frontier.reason,
  };
}

export function benchmarkAttestationState(secretOverride = '') {
  const configured = secretValue(secretOverride).length >= 32;
  return {
    version: VERIFIED_GPT_ARENA_VERSION,
    configured,
    algorithm: 'HMAC-SHA256',
    secretExposed: false,
    minimumSecretBytes: 32,
  };
}

export function createRuntimeAttestation({
  caseId,
  promptHash,
  candidateId,
  provider,
  model,
  answer,
  responseId = '',
  requestId = '',
  commitSha = '',
  observedAt = new Date().toISOString(),
  secretOverride = '',
} = {}) {
  const secret = secretValue(secretOverride);
  const attestation = {
    version: VERIFIED_GPT_ARENA_VERSION,
    caseId: clean(caseId, 120),
    promptHash: clean(promptHash, 128),
    candidateId: clean(candidateId, 160),
    provider: safeProvider(provider),
    model: safeModel(model),
    responseHash: sha256(answer),
    responseId: clean(responseId, 200),
    requestId: clean(requestId, 200),
    commitSha: clean(commitSha, 80),
    observedAt: stableIso(observedAt) || new Date().toISOString(),
    signature: '',
  };
  if (secret.length < 32) return { ...attestation, signed: false, error: 'attestation_secret_unconfigured' };
  attestation.signature = signPayload(canonicalAttestationPayload(attestation), secret);
  return { ...attestation, signed: true };
}

export function verifyRuntimeAttestation({ attestation, answer, caseId, promptHash, candidateId, secretOverride = '' } = {}) {
  const secret = secretValue(secretOverride);
  const row = attestation && typeof attestation === 'object' ? attestation : {};
  const reasons = [];
  if (secret.length < 32) reasons.push('attestation_secret_unconfigured');
  if (row.version !== VERIFIED_GPT_ARENA_VERSION) reasons.push('version_mismatch');
  if (clean(row.caseId, 120) !== clean(caseId, 120)) reasons.push('case_mismatch');
  if (clean(row.promptHash, 128) !== clean(promptHash, 128)) reasons.push('prompt_hash_mismatch');
  if (clean(row.candidateId, 160) !== clean(candidateId, 160)) reasons.push('candidate_mismatch');
  if (clean(row.responseHash, 128) !== sha256(answer)) reasons.push('response_hash_mismatch');
  if (!safeProvider(row.provider)) reasons.push('provider_missing');
  if (!safeModel(row.model) || !/\d/.test(safeModel(row.model))) reasons.push('model_not_versioned');
  if (!stableIso(row.observedAt)) reasons.push('timestamp_invalid');
  if (!clean(row.responseId, 200) && !clean(row.requestId, 200)) reasons.push('runtime_receipt_missing');
  const expected = secret.length >= 32 ? signPayload(canonicalAttestationPayload(row), secret) : '';
  if (!expected || !constantTimeHexEqual(expected, row.signature)) reasons.push('signature_invalid');
  return {
    ok: reasons.length === 0,
    reasons,
    provider: safeProvider(row.provider) || null,
    model: safeModel(row.model) || null,
    referenceId: versionedReferenceId(row.provider, row.model) || null,
    responseHash: clean(row.responseHash, 128) || null,
    observedAt: stableIso(row.observedAt) || null,
  };
}

function findCandidate(entry, id) {
  return (Array.isArray(entry?.candidates) ? entry.candidates : []).find(candidate => clean(candidate?.id, 160) === clean(id, 160)) || null;
}

function attestationFor(entry, candidate) {
  if (candidate?.attestation && typeof candidate.attestation === 'object') return candidate.attestation;
  if (entry?.attestations && typeof entry.attestations === 'object') return entry.attestations[clean(candidate?.id, 160)] || null;
  return null;
}

export function verifiedGptArenaManifest() {
  const base = adversarialEvidenceManifest();
  return {
    schema: VERIFIED_GPT_ARENA_SCHEMA,
    version: VERIFIED_GPT_ARENA_VERSION,
    baseArena: ADVERSARIAL_EVIDENCE_VERSION,
    suiteHash: base.suiteHash,
    requiredCases: VERIFIED_GPT_REQUIRED_CASES,
    targetAttestationRequired: true,
    referenceAttestationRequired: true,
    referenceProvider: VERIFIED_GPT_REFERENCE_PROVIDER,
    responseHash: 'SHA-256',
    attestationSignature: 'HMAC-SHA256',
    runtimeReceiptRequired: true,
    exactVersionedReferenceRequired: true,
    simulatedReferenceForbidden: true,
    fullPairedSuiteRequired: true,
    claimPolicy: {
      allowed: 'Only a benchmark-scoped measured advantage over the exact OpenAI GPT model that produced all 64 signed reference responses, after every v72 quality/statistical gate and every v93 provenance gate passes.',
      forbidden: 'Global superiority, unversioned GPT-family claims, pasted or simulated competitor answers, unsigned responses, mixed reference models, incomplete suites, or claims when OpenAI is not actually configured and executed.',
    },
  };
}

export function certifyVerifiedGptRun({ entries = [], targetId = 'universal_core', referenceId = '', secretOverride = '' } = {}) {
  const suite = adversarialEvidenceSuite();
  const base = certifyAdversarialEvidenceRun({ entries, targetId, referenceId, minimumCases: VERIFIED_GPT_REQUIRED_CASES });
  const invalid = [];
  const targetProviders = new Set();
  const targetModels = new Set();
  const referenceProviders = new Set();
  const referenceModels = new Set();
  const commitShas = new Set();
  const observedTimes = [];
  let targetAttested = 0;
  let referenceAttested = 0;

  for (const testCase of suite) {
    const entry = (Array.isArray(entries) ? entries : []).find(item => clean(item?.caseId, 120) === testCase.id);
    if (!entry) {
      invalid.push({ caseId: testCase.id, reason: 'entry_missing' });
      continue;
    }
    const target = findCandidate(entry, targetId);
    const reference = findCandidate(entry, referenceId);
    if (!target || !reference) {
      invalid.push({ caseId: testCase.id, reason: 'paired_candidates_missing' });
      continue;
    }

    const targetCheck = verifyRuntimeAttestation({
      attestation: attestationFor(entry, target), answer: target.answer ?? target.text ?? '', caseId: testCase.id,
      promptHash: testCase.promptHash, candidateId: targetId, secretOverride,
    });
    const referenceCheck = verifyRuntimeAttestation({
      attestation: attestationFor(entry, reference), answer: reference.answer ?? reference.text ?? '', caseId: testCase.id,
      promptHash: testCase.promptHash, candidateId: referenceId, secretOverride,
    });

    if (!targetCheck.ok) invalid.push({ caseId: testCase.id, candidate: targetId, reason: 'target_attestation_invalid', details: targetCheck.reasons });
    else {
      targetAttested++;
      targetProviders.add(targetCheck.provider);
      targetModels.add(targetCheck.model);
      const raw = attestationFor(entry, target);
      if (raw?.commitSha) commitShas.add(clean(raw.commitSha, 80));
      const ms = Date.parse(targetCheck.observedAt || ''); if (Number.isFinite(ms)) observedTimes.push(ms);
    }

    if (!referenceCheck.ok) invalid.push({ caseId: testCase.id, candidate: referenceId, reason: 'reference_attestation_invalid', details: referenceCheck.reasons });
    else {
      referenceAttested++;
      referenceProviders.add(referenceCheck.provider);
      referenceModels.add(referenceCheck.model);
      const ms = Date.parse(referenceCheck.observedAt || ''); if (Number.isFinite(ms)) observedTimes.push(ms);
    }
  }

  const expectedReference = referenceModels.size === 1 ? versionedReferenceId([...referenceProviders][0], [...referenceModels][0]) : '';
  const attestationGate = benchmarkAttestationState(secretOverride).configured;
  const fullTargetAttestationGate = targetAttested === suite.length;
  const fullReferenceAttestationGate = referenceAttested === suite.length;
  const referenceProviderGate = referenceProviders.size === 1 && [...referenceProviders][0] === VERIFIED_GPT_REFERENCE_PROVIDER;
  const referenceModelGate = referenceModels.size === 1 && [...referenceModels][0].toLowerCase().includes('gpt') && /\d/.test([...referenceModels][0]);
  const referenceIdentityGate = Boolean(expectedReference && expectedReference === clean(referenceId, 160).toLowerCase());
  const targetProviderGate = targetProviders.size >= 1 && [...targetProviders].every(provider => provider === 'wae_edge' || provider === 'wae_supabase' || provider === 'universal_core');
  const targetModelGate = targetModels.size >= 1 && [...targetModels].every(model => /\d/.test(String(model || '')));
  const commitGate = commitShas.size === 1;
  const runWindowMs = observedTimes.length ? Math.max(...observedTimes) - Math.min(...observedTimes) : Infinity;
  const boundedRunWindowGate = observedTimes.length === suite.length * 2 && runWindowMs <= 6 * 60 * 60 * 1000;
  const provenanceGate = Boolean(attestationGate && fullTargetAttestationGate && fullReferenceAttestationGate && referenceProviderGate && referenceModelGate && referenceIdentityGate && targetProviderGate && targetModelGate && commitGate && boundedRunWindowGate && invalid.length === 0);
  const claimAllowed = Boolean(base.claimAllowed && provenanceGate);

  return {
    schema: 'verified-paired-benchmark-certification/v1',
    version: VERIFIED_GPT_ARENA_VERSION,
    baseCertification: base,
    targetId: clean(targetId, 160),
    referenceId: clean(referenceId, 160).toLowerCase(),
    evaluatedCases: base.evaluatedCases,
    provenance: {
      targetAttested,
      referenceAttested,
      targetProviders: [...targetProviders],
      targetModels: [...targetModels],
      referenceProviders: [...referenceProviders],
      referenceModels: [...referenceModels],
      commitShas: [...commitShas],
      runWindowMs: Number.isFinite(runWindowMs) ? runWindowMs : null,
    },
    invalid,
    gates: {
      baseArena: base.claimAllowed,
      attestationSecret: attestationGate,
      fullTargetAttestation: fullTargetAttestationGate,
      fullReferenceAttestation: fullReferenceAttestationGate,
      referenceProviderOpenAI: referenceProviderGate,
      referenceModelVersionedGpt: referenceModelGate,
      exactReferenceIdentity: referenceIdentityGate,
      targetProvider: targetProviderGate,
      targetModelVersioned: targetModelGate,
      singleTargetCommit: commitGate,
      boundedRunWindow: boundedRunWindowGate,
      noAttestationErrors: invalid.length === 0,
      provenance: provenanceGate,
    },
    claimAllowed,
    verdict: claimAllowed ? 'VERIFIED_BENCHMARK_ADVANTAGE' : 'NOT_PROVEN',
    claim: claimAllowed
      ? `Measured advantage over ${clean(referenceId, 160)} on ${ADVERSARIAL_EVIDENCE_VERSION}, with signed v93 runtime provenance for every paired response. This does not establish universal superiority.`
      : 'No GPT superiority claim is authorized: the complete quality, statistical, and signed-runtime provenance gates have not all passed.',
  };
}

export function verifiedGptArenaCapabilities(registry = providerRegistry()) {
  return {
    version: VERIFIED_GPT_ARENA_VERSION,
    manifest: verifiedGptArenaManifest(),
    comparator: gptComparatorReadiness(registry),
    attestation: benchmarkAttestationState(),
    baseModelTraining: false,
    superiorityClaimDefault: 'HOLD',
  };
}
