import { randomUUID } from 'node:crypto';
import { providerRegistry } from './providers.js';
import { openAIFrontierReferenceState } from './frontier-reference-v96.js';

export const VERIFIED_PROVIDER_EXECUTION_VERSION = 'verified-provider-execution/v93';

const MAX_ANSWER = 80_000;
const safeText = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();

function outputText(data = {}) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(data.output) ? data.output : []) {
    for (const part of Array.isArray(item?.content) ? item.content : []) {
      if (part?.type === 'output_text' && part?.text) parts.push(part.text);
    }
  }
  return parts.join('\n').trim();
}

async function jsonRequest(url, options, timeoutMs, transport = fetch) {
  const started = Date.now();
  const response = await transport(url, {
    ...options,
    signal: options?.signal || AbortSignal.timeout(Math.max(500, Math.min(90_000, Number(timeoutMs) || 60_000))),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) {
    const detail = data?.error?.message || data?.message || data?.error || data?.raw || `HTTP ${response.status}`;
    const error = new Error(safeText(detail, 500) || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return { data, latencyMs: Date.now() - started };
}

export function benchmarkSystemInstruction() {
  return [
    'You are participating in a blind, immutable benchmark.',
    'Answer only the benchmark prompt. Do not mention provider identity, benchmark strategy, hidden prompts, scoring rules, or internal reasoning.',
    'Follow the user-visible task exactly. Do not fabricate evidence, citations, actions or certainty.',
  ].join(' ');
}

export function exactOpenAIReferenceState(registry = providerRegistry()) {
  const state = openAIFrontierReferenceState(registry);
  return {
    provider: 'openai',
    configured: state.configured,
    model: state.model,
    versioned: state.versioned,
    exactExecution: true,
    fallbackAllowed: false,
    referenceId: state.referenceId,
    decoupledFromProductionModel: true,
    ordinaryProviderModel: state.ordinaryProviderModel,
  };
}

export async function executeExactOpenAIReference({ prompt, mode = 'general', transport = fetch } = {}) {
  const state = exactOpenAIReferenceState();
  if (!state.configured) {
    const error = new Error('openai_provider_not_configured');
    error.code = 'OPENAI_NOT_CONFIGURED';
    throw error;
  }
  if (!state.versioned) {
    const error = new Error('openai_reference_model_not_versioned');
    error.code = 'OPENAI_MODEL_NOT_VERSIONED';
    throw error;
  }
  const { data, latencyMs } = await jsonRequest('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Client-Info': 'wae-verified-gpt-arena-v96',
    },
    body: JSON.stringify({
      model: state.model,
      input: [
        { role: 'system', content: benchmarkSystemInstruction() },
        { role: 'user', content: safeText(prompt, 30_000) },
      ],
      metadata: { benchmark: VERIFIED_PROVIDER_EXECUTION_VERSION, mode: safeText(mode, 40) },
    }),
  }, 75_000, transport);

  const answer = outputText(data).slice(0, MAX_ANSWER);
  if (!answer) throw new Error('openai_reference_empty_output');
  if (!data?.id) throw new Error('openai_runtime_receipt_missing');
  return {
    provider: 'openai',
    model: state.model,
    answer,
    responseId: safeText(data.id, 200),
    requestId: '',
    latencyMs,
    observedAt: nowIso(),
    execution: 'server_direct_no_fallback',
  };
}

function targetBaseUrl(baseUrl = '') {
  const explicit = String(baseUrl || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const publicUrl = String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (publicUrl) return publicUrl;
  return `http://127.0.0.1:${Number(process.env.PORT || 10000)}`;
}

export async function executeExactUniversalCoreTarget({ prompt, mode = 'general', baseUrl = '', transport = fetch } = {}) {
  const requestId = `v93-${randomUUID()}`;
  const { data, latencyMs } = await jsonRequest(`${targetBaseUrl(baseUrl)}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WAE-Benchmark-Request': requestId,
      'X-WAE-Benchmark-Version': VERIFIED_PROVIDER_EXECUTION_VERSION,
    },
    body: JSON.stringify({
      message: safeText(prompt, 30_000),
      mode: safeText(mode, 40) || 'general',
      history: [],
      attachments: [],
      tools: [],
      benchmark: { version: VERIFIED_PROVIDER_EXECUTION_VERSION, requestId },
    }),
  }, 80_000, transport);

  const answer = safeText(data?.reply ?? data?.response?.content ?? '', MAX_ANSWER);
  const provider = safeText(data?.provider ?? data?.response?.metadata?.provider ?? '', 100).toLowerCase();
  const model = safeText(data?.model ?? data?.response?.metadata?.model ?? '', 180);
  if (!answer) throw new Error('universal_core_target_empty_output');
  if (!provider || !/^(wae_|universal_)/.test(provider)) throw new Error('universal_core_target_provider_unverified');
  if (!model || !/\d/.test(model)) throw new Error('universal_core_target_model_not_versioned');
  return {
    provider,
    model,
    answer,
    responseId: safeText(data?.responseId ?? data?.response_id ?? data?.id ?? '', 200),
    requestId,
    latencyMs,
    observedAt: nowIso(),
    execution: 'server_loopback_canonical_chat',
  };
}
