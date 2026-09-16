import { randomUUID } from 'node:crypto';
import { providerRegistry } from './providers.js';
import {
  verifiedGptReferenceModel,
  verifiedGptReasoningEffort,
} from './gpt-reference-config-v93.js';

export const VERIFIED_PROVIDER_EXECUTION_VERSION = 'verified-provider-execution/v93';

const MAX_ANSWER = 80_000;
const MAX_SOURCES = 40;
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

function sourceValue(item) {
  if (typeof item === 'string') return safeText(item, 2_000);
  if (!item || typeof item !== 'object') return '';
  return safeText(item.url ?? item.uri ?? item.href ?? item.source_url ?? item.sourceUrl ?? item.title ?? item.name ?? '', 2_000);
}

export function normalizeBenchmarkSources(items = []) {
  return [...new Set((Array.isArray(items) ? items : []).map(sourceValue).filter(Boolean))].sort().slice(0, MAX_SOURCES);
}

export function extractOpenAIReferenceSources(data = {}) {
  const sources = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    if (item?.type === 'web_search_call') {
      if (Array.isArray(item?.action?.sources)) sources.push(...item.action.sources);
      if (Array.isArray(item?.sources)) sources.push(...item.sources);
    }
    if (item?.type === 'message') {
      for (const part of Array.isArray(item?.content) ? item.content : []) {
        for (const annotation of Array.isArray(part?.annotations) ? part.annotations : []) {
          if (annotation?.type === 'url_citation') {
            sources.push(annotation?.url ?? annotation?.url_citation?.url ?? annotation);
          }
        }
      }
    }
  }
  return normalizeBenchmarkSources(sources);
}

export function extractUniversalCoreSources(data = {}) {
  return normalizeBenchmarkSources([
    ...(Array.isArray(data?.sources) ? data.sources : []),
    ...(Array.isArray(data?.web_sources) ? data.web_sources : []),
    ...(Array.isArray(data?.citations) ? data.citations : []),
    ...(Array.isArray(data?.response?.sources) ? data.response.sources : []),
    ...(Array.isArray(data?.response?.metadata?.sources) ? data.response.metadata.sources : []),
  ]);
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
  const row = (Array.isArray(registry) ? registry : []).find(item => String(item?.id || '').toLowerCase() === 'openai') || null;
  const model = verifiedGptReferenceModel();
  const reasoningEffort = verifiedGptReasoningEffort();
  return {
    provider: 'openai',
    configured: row?.configured === true,
    model,
    providerRoutingModel: safeText(row?.model, 160) || null,
    reasoningEffort,
    researchWebSearch: true,
    versioned: Boolean(model && /\d/.test(model)),
    exactExecution: true,
    fallbackAllowed: false,
  };
}

export function buildExactOpenAIReferenceRequest({ prompt, mode = 'general', model = verifiedGptReferenceModel(), reasoningEffort = verifiedGptReasoningEffort() } = {}) {
  const research = safeText(mode, 40).toLowerCase() === 'research';
  const body = {
    model: safeText(model, 160),
    instructions: benchmarkSystemInstruction(),
    input: safeText(prompt, 30_000),
    reasoning: { effort: reasoningEffort },
    store: false,
    metadata: { benchmark: VERIFIED_PROVIDER_EXECUTION_VERSION, mode: safeText(mode, 40) },
  };
  if (research) {
    body.tools = [{ type: 'web_search_preview' }];
    body.include = ['web_search_call.action.sources'];
  }
  return body;
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
  const requestBody = buildExactOpenAIReferenceRequest({ prompt, mode, model: state.model, reasoningEffort: state.reasoningEffort });
  const { data, latencyMs } = await jsonRequest('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Client-Info': 'wae-verified-gpt-arena-v93',
    },
    body: JSON.stringify(requestBody),
  }, 75_000, transport);

  const answer = outputText(data).slice(0, MAX_ANSWER);
  if (!answer) throw new Error('openai_reference_empty_output');
  if (!data?.id) throw new Error('openai_runtime_receipt_missing');
  const observedModel = safeText(data?.model || state.model, 160);
  if (observedModel.toLowerCase() !== state.model.toLowerCase()) {
    const error = new Error('openai_reference_model_identity_mismatch');
    error.expectedModel = state.model;
    error.observedModel = observedModel;
    throw error;
  }
  return {
    provider: 'openai',
    model: observedModel,
    answer,
    sources: extractOpenAIReferenceSources(data),
    responseId: safeText(data.id, 200),
    requestId: '',
    latencyMs,
    observedAt: nowIso(),
    reasoningEffort: state.reasoningEffort,
    webSearchEnabled: safeText(mode, 40).toLowerCase() === 'research',
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
    sources: extractUniversalCoreSources(data),
    responseId: safeText(data?.responseId ?? data?.response_id ?? data?.id ?? '', 200),
    requestId,
    latencyMs,
    observedAt: nowIso(),
    execution: 'server_loopback_canonical_chat',
  };
}
