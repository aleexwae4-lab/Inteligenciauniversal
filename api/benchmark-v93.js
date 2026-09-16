import { timingSafeEqual } from 'node:crypto';
import { applyHeaders } from '../lib/security.js';
import { callInternalSupabaseRpc } from '../lib/internal-supabase-rpc-v74.js';
import {
  VERIFIED_GPT_ARENA_VERSION,
  benchmarkAttestationState,
  createRuntimeAttestation,
  certifyVerifiedGptRun,
  gptComparatorReadiness,
  verifiedGptArenaCapabilities,
  verifiedGptArenaManifest,
} from '../lib/verified-gpt-arena-v93.js';

const MAX_ENTRIES = 64;
const MAX_ANSWER = 80_000;
const text = (value, max = 200) => String(value ?? '').slice(0, max);
const bodyOf = req => req?.body && typeof req.body === 'object' ? req.body : {};

function requestToken(req) {
  const raw = req?.headers?.['x-wae-worker-token'] ?? req?.headers?.get?.('x-wae-worker-token') ?? '';
  return text(Array.isArray(raw) ? raw[0] : raw, 500);
}

function secureEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

function workerAuthorized(req) {
  const expected = String(process.env.WAE_RUNTIME_BRIDGE_TOKEN || '');
  if (expected.length < 24) return { ok: false, status: 503, error: 'trusted_worker_token_unconfigured' };
  const received = requestToken(req);
  if (!received || !secureEqual(received, expected)) return { ok: false, status: 403, error: 'trusted_worker_auth_required' };
  return { ok: true };
}

function normalizeEntries(value) {
  return (Array.isArray(value) ? value : []).slice(0, MAX_ENTRIES).map(entry => ({
    caseId: text(entry?.caseId, 120),
    promptHash: text(entry?.promptHash, 128),
    candidates: (Array.isArray(entry?.candidates) ? entry.candidates : []).slice(0, 4).map(candidate => ({
      id: text(candidate?.id, 160),
      answer: text(candidate?.answer ?? candidate?.text ?? '', MAX_ANSWER),
      sources: Array.isArray(candidate?.sources) ? candidate.sources.slice(0, 20) : [],
      latencyMs: candidate?.latencyMs ?? null,
      costUsd: candidate?.costUsd ?? null,
      attestation: candidate?.attestation && typeof candidate.attestation === 'object' ? candidate.attestation : null,
    })),
    attestations: entry?.attestations && typeof entry.attestations === 'object' ? entry.attestations : undefined,
  }));
}

async function databaseGate() {
  const result = await callInternalSupabaseRpc({
    functionName: 'iu_supremacy_gate_v1',
    body: {},
    timeoutMs: 3_000,
    clientInfo: 'wae-verified-gpt-arena-v93',
  });
  if (!result.ok) {
    return {
      available: false,
      state: 'HOLD_DATABASE_GATE_UNAVAILABLE',
      claimAllowed: false,
      reason: result.unconfigured ? 'supabase_internal_transport_unconfigured' : result.error || 'database_gate_unavailable',
    };
  }
  const payload = result.payload && typeof result.payload === 'object' ? result.payload : {};
  return {
    available: true,
    state: text(payload.state || 'HOLD_UNKNOWN', 120),
    claimAllowed: payload.claim_allowed === true,
    reason: text(payload.reason || '', 500),
    runId: payload.run_id || null,
    runStatus: payload.run_status || null,
    caseCount: payload.case_count ?? null,
    activeDomains: payload.active_domains ?? null,
    wae: payload.wae || null,
    gpt: payload.gpt || null,
    evaluatedAt: payload.evaluated_at || null,
  };
}

async function statusPayload() {
  const comparator = gptComparatorReadiness();
  const attestation = benchmarkAttestationState();
  const db = await databaseGate();
  const publicClaimAllowed = Boolean(db.claimAllowed && comparator.executable && attestation.configured);
  return {
    success: true,
    version: VERIFIED_GPT_ARENA_VERSION,
    manifest: verifiedGptArenaManifest(),
    comparator,
    attestation,
    databaseGate: db,
    publicGate: {
      claimAllowed: publicClaimAllowed,
      state: publicClaimAllowed ? 'ELIGIBLE_FOR_V93_ATTESTED_CERTIFICATION' : 'HOLD',
      reason: publicClaimAllowed
        ? 'The database, exact GPT comparator, and signed-attestation prerequisites are present. A complete 64-case attested certification is still required for a benchmark-scoped advantage claim.'
        : !comparator.executable
          ? comparator.reason
          : !attestation.configured
            ? 'benchmark_attestation_secret_unconfigured'
            : db.state,
    },
    policy: {
      globalSuperiorityClaimAllowed: false,
      benchmarkScopedClaimRequiresCompleteCertification: true,
      simulatedGptForbidden: true,
      unversionedGptForbidden: true,
    },
  };
}

export default async function handler(req, res) {
  applyHeaders(res);
  if (req.method === 'GET') return res.status(200).json(await statusPayload());
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'method_not_allowed' });

  const body = bodyOf(req);
  const action = text(body.action || 'status', 60).toLowerCase();
  if (action === 'status') return res.status(200).json(await statusPayload());
  if (action === 'capabilities') return res.status(200).json({ success: true, capabilities: verifiedGptArenaCapabilities() });

  const auth = workerAuthorized(req);
  if (!auth.ok) return res.status(auth.status).json({ success: false, error: auth.error });

  if (action === 'attest') {
    const attestation = createRuntimeAttestation({
      caseId: body.caseId,
      promptHash: body.promptHash,
      candidateId: body.candidateId,
      provider: body.provider,
      model: body.model,
      answer: text(body.answer ?? body.text ?? '', MAX_ANSWER),
      responseId: body.responseId,
      requestId: body.requestId,
      commitSha: body.commitSha,
      observedAt: body.observedAt || new Date().toISOString(),
    });
    if (attestation.signed !== true) return res.status(503).json({ success: false, error: attestation.error || 'attestation_failed' });
    return res.status(200).json({ success: true, attestation });
  }

  if (action === 'certify_attested') {
    const entries = normalizeEntries(body.entries);
    if (entries.length !== MAX_ENTRIES) return res.status(422).json({ success: false, error: 'complete_64_case_suite_required', received: entries.length });
    const certification = certifyVerifiedGptRun({
      entries,
      targetId: text(body.targetId || 'universal_core', 160),
      referenceId: text(body.referenceId || '', 160).toLowerCase(),
    });
    return res.status(200).json({
      success: true,
      certification,
      claimAuthorization: {
        allowed: certification.claimAllowed === true,
        scope: certification.claimAllowed ? certification.claim : 'No superiority claim authorized.',
      },
    });
  }

  return res.status(400).json({ success: false, error: 'unsupported_action' });
}
