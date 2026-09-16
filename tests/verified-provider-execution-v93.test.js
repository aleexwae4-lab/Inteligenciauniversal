import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExactOpenAIReferenceRequest,
  executeExactOpenAIReference,
  executeExactUniversalCoreTarget,
  exactOpenAIReferenceState,
  extractOpenAIReferenceSources,
  VERIFIED_PROVIDER_EXECUTION_VERSION,
} from '../lib/verified-provider-execution-v93.js';

function fakeResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(payload),
  };
}

function withEnv(patch, fn) {
  const prior = Object.fromEntries(Object.keys(patch).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) delete process.env[key]; else process.env[key] = String(value);
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

test('v93 exact OpenAI reference is isolated from the normal provider routing model', async () => {
  await withEnv({ OPENAI_API_KEY: undefined, OPENAI_MODEL: 'gpt-5.6-sol', WAE_GPT_REFERENCE_MODEL: undefined }, async () => {
    const state = exactOpenAIReferenceState();
    assert.equal(state.configured, false);
    assert.equal(state.model, 'gpt-6-astra');
    assert.equal(state.providerRoutingModel, 'gpt-5.6-sol');
    assert.equal(state.reasoningEffort, 'high');
    assert.equal(state.fallbackAllowed, false);
    await assert.rejects(() => executeExactOpenAIReference({ prompt: 'test' }), /openai_provider_not_configured/);
  });
});

test('v93 benchmark reference model can be explicitly overridden without changing normal routing', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-5.6-sol', WAE_GPT_REFERENCE_MODEL: 'gpt-6-astra-snapshot-1', WAE_GPT_REFERENCE_REASONING_EFFORT: 'xhigh' }, async () => {
    const state = exactOpenAIReferenceState();
    assert.equal(state.model, 'gpt-6-astra-snapshot-1');
    assert.equal(state.providerRoutingModel, 'gpt-5.6-sol');
    assert.equal(state.reasoningEffort, 'xhigh');
  });
});

test('v93 research reference grants Astra reasoning plus web search and source inclusion', () => {
  const body = buildExactOpenAIReferenceRequest({ prompt: 'Investiga el estado actual.', mode: 'research', model: 'gpt-6-astra', reasoningEffort: 'high' });
  assert.equal(body.model, 'gpt-6-astra');
  assert.equal(body.reasoning.effort, 'high');
  assert.deepEqual(body.tools, [{ type: 'web_search_preview' }]);
  assert.deepEqual(body.include, ['web_search_call.action.sources']);
  assert.equal(body.store, false);
  const analysis = buildExactOpenAIReferenceRequest({ prompt: 'Razona.', mode: 'analysis', model: 'gpt-6-astra', reasoningEffort: 'high' });
  assert.equal(analysis.tools, undefined);
  assert.equal(analysis.include, undefined);
});

test('v93 exact OpenAI reference calls Astra directly and retains verified web sources', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-5.6-sol', WAE_GPT_REFERENCE_MODEL: undefined, WAE_GPT_REFERENCE_REASONING_EFFORT: undefined }, async () => {
    let calls = 0;
    const transport = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.method, 'POST');
      assert.match(String(options.headers.Authorization), /^Bearer test-key$/);
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'gpt-6-astra');
      assert.equal(body.reasoning.effort, 'high');
      assert.deepEqual(body.tools, [{ type: 'web_search_preview' }]);
      assert.equal(body.metadata.benchmark, VERIFIED_PROVIDER_EXECUTION_VERSION);
      return fakeResponse({
        id: 'resp_verified_123',
        model: 'gpt-6-astra',
        output_text: 'Respuesta GPT ejecutada realmente.',
        output: [
          { type: 'web_search_call', action: { sources: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }] } },
          { type: 'message', content: [{ type: 'output_text', text: 'Respuesta GPT ejecutada realmente.', annotations: [{ type: 'url_citation', url: 'https://example.com/a' }] }] },
        ],
      });
    };
    const result = await executeExactOpenAIReference({ prompt: 'Responde el caso.', mode: 'research', transport });
    assert.equal(calls, 1);
    assert.equal(result.provider, 'openai');
    assert.equal(result.model, 'gpt-6-astra');
    assert.equal(result.responseId, 'resp_verified_123');
    assert.equal(result.execution, 'server_direct_no_fallback');
    assert.equal(result.reasoningEffort, 'high');
    assert.equal(result.webSearchEnabled, true);
    assert.deepEqual(result.sources, ['https://example.com/a','https://example.com/b']);
    assert.match(result.answer, /ejecutada realmente/);
  });
});

test('v93 source extraction deduplicates citations deterministically', () => {
  const sources = extractOpenAIReferenceSources({ output: [
    { type: 'web_search_call', action: { sources: [{ url: 'https://b.example' }, { url: 'https://a.example' }] } },
    { type: 'message', content: [{ type: 'output_text', text: 'x', annotations: [{ type: 'url_citation', url: 'https://a.example' }] }] },
  ] });
  assert.deepEqual(sources, ['https://a.example','https://b.example']);
});

test('v93 exact OpenAI reference refuses a successful-looking payload without provider receipt', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', WAE_GPT_REFERENCE_MODEL: undefined }, async () => {
    const transport = async () => fakeResponse({ model: 'gpt-6-astra', output_text: 'Texto sin receipt.' });
    await assert.rejects(() => executeExactOpenAIReference({ prompt: 'test', transport }), /openai_runtime_receipt_missing/);
  });
});

test('v93 exact OpenAI reference rejects runtime model substitution', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', WAE_GPT_REFERENCE_MODEL: undefined }, async () => {
    const transport = async () => fakeResponse({ id: 'resp-1', model: 'gpt-5.6-sol', output_text: 'Texto de otro modelo.' });
    await assert.rejects(() => executeExactOpenAIReference({ prompt: 'test', transport }), /model_identity_mismatch/);
  });
});

test('v93 target execution goes through canonical Universal Core chat and retains sources', async () => {
  let calledUrl = '';
  const transport = async (url, options) => {
    calledUrl = url;
    const body = JSON.parse(options.body);
    assert.equal(body.message, 'Caso objetivo');
    assert.equal(body.mode, 'analysis');
    assert.equal(body.benchmark.version, VERIFIED_PROVIDER_EXECUTION_VERSION);
    assert.ok(body.benchmark.requestId);
    return fakeResponse({ reply: 'Respuesta Universal Core.', provider: 'wae_edge', model: 'iu-gpt-runtime-v13', sources: [{ url: 'https://wae.example/source' }] });
  };
  const result = await executeExactUniversalCoreTarget({ prompt: 'Caso objetivo', mode: 'analysis', baseUrl: 'https://universal-core.test', transport });
  assert.equal(calledUrl, 'https://universal-core.test/api/chat');
  assert.equal(result.provider, 'wae_edge');
  assert.equal(result.model, 'iu-gpt-runtime-v13');
  assert.deepEqual(result.sources, ['https://wae.example/source']);
  assert.match(result.requestId, /^v93-/);
  assert.equal(result.execution, 'server_loopback_canonical_chat');
});

test('v93 target execution rejects a non-WAE provider even if it returns a polished answer', async () => {
  const transport = async () => fakeResponse({ reply: 'Respuesta bonita.', provider: 'openai', model: 'gpt-6-astra' });
  await assert.rejects(() => executeExactUniversalCoreTarget({ prompt: 'Caso', baseUrl: 'https://universal-core.test', transport }), /target_provider_unverified/);
});
