const BOOT_AT = Date.now();
const DEFAULT_FRESH_MS = 30 * 60 * 1000;

const state = {
  chatSuccesses: 0,
  chatFailures: 0,
  consecutiveFailures: 0,
  lastChatAt: 0,
  lastFailureAt: 0,
  lastFailureCode: null,
  lastSuccessAt: 0,
  lastProvider: null,
  lastModel: null,
  lastLatencyMs: null,
  lastInferenceSuccessAt: 0,
  lastInferenceProvider: null,
  lastInferenceModel: null,
};

const NON_INFERENCE_PROVIDERS = new Set([
  'wae_core',
  'wae_research_registry',
]);

function safeText(value, max = 80) {
  return String(value || '').trim().slice(0, max) || null;
}

function numericLatency(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function isGenerativeProvider(provider) {
  const id = safeText(provider, 80);
  return !!id && !NON_INFERENCE_PROVIDERS.has(id);
}

export function recordChatSuccess(result = {}, latencyMs = 0) {
  const at = Date.now();
  const provider = safeText(result.provider);
  const model = safeText(result.model, 120);
  state.chatSuccesses += 1;
  state.consecutiveFailures = 0;
  state.lastChatAt = at;
  state.lastSuccessAt = at;
  state.lastProvider = provider;
  state.lastModel = model;
  state.lastLatencyMs = numericLatency(latencyMs);

  if (isGenerativeProvider(provider)) {
    state.lastInferenceSuccessAt = at;
    state.lastInferenceProvider = provider;
    state.lastInferenceModel = model;
  }
}

export function recordChatFailure(code = 'runtime_error', latencyMs = 0) {
  const at = Date.now();
  state.chatFailures += 1;
  state.consecutiveFailures += 1;
  state.lastChatAt = at;
  state.lastFailureAt = at;
  state.lastFailureCode = safeText(code);
  state.lastLatencyMs = numericLatency(latencyMs);
}

export function runtimeOperations(now = Date.now(), freshMs = Number(process.env.WAE_INFERENCE_FRESH_MS || DEFAULT_FRESH_MS)) {
  const freshnessWindowMs = Math.max(60_000, Number.isFinite(freshMs) ? freshMs : DEFAULT_FRESH_MS);
  const inferenceAgeMs = state.lastInferenceSuccessAt ? Math.max(0, now - state.lastInferenceSuccessAt) : null;
  return {
    processStartedAt: new Date(BOOT_AT).toISOString(),
    uptimeSeconds: Math.floor(Math.max(0, now - BOOT_AT) / 1000),
    chatSuccesses: state.chatSuccesses,
    chatFailures: state.chatFailures,
    consecutiveFailures: state.consecutiveFailures,
    lastChatAt: state.lastChatAt ? new Date(state.lastChatAt).toISOString() : null,
    lastSuccessAt: state.lastSuccessAt ? new Date(state.lastSuccessAt).toISOString() : null,
    lastFailureAt: state.lastFailureAt ? new Date(state.lastFailureAt).toISOString() : null,
    lastFailureCode: state.lastFailureCode,
    lastProvider: state.lastProvider,
    lastModel: state.lastModel,
    lastLatencyMs: state.lastLatencyMs,
    providerInferenceVerified: !!state.lastInferenceSuccessAt,
    inferenceFresh: inferenceAgeMs !== null && inferenceAgeMs <= freshnessWindowMs,
    inferenceAgeMs,
    inferenceFreshWindowMs: freshnessWindowMs,
    lastInferenceVerifiedAt: state.lastInferenceSuccessAt ? new Date(state.lastInferenceSuccessAt).toISOString() : null,
    lastInferenceProvider: state.lastInferenceProvider,
    lastInferenceModel: state.lastInferenceModel,
  };
}
