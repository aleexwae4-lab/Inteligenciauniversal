import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeExactOpenAIReference,
  executeExactUniversalCoreTarget,
  exactOpenAIReferenceState,
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

test('v93 exact OpenAI reference execution is disabled when OpenAI is not configured', async () => {
  await withEnv({ OPENAI_API_KEY: undefined, OPENAI_MODEL: 'gpt-5.6-sol' }, async () => {
    const state = exactOpenAIReferenceState();
    assert.equal(state.configured, false);
    assert.equal(state.fallbackAllowed, false);
    await assert.rejects(() => executeExactOpenAIReference({ prompt: 'test' }), /openai_provider_not_configured/);
  });
});

test('v93 exact OpenAI reference calls OpenAI directly and requires a real response receipt', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-5.6-sol' }, async () => {
    let calls = 0;
    const transport = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.method, 'POST');
      assert.match(String(options.headers.Authorization), /^Bearer test-key$/);
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'gpt-5.6-sol');
      assert.equal(body.metadata.benchmark, VERIFIED_PROVIDER_EXECUTION_VERSION);
      return fakeResponse({ id: 'resp_verified_123', output_text: 'Respuesta GPT ejecutada realmente.' });
    };
    const result = await executeExactOpenAIReference({ prompt: 'Responde el caso.', mode: 'analysis', transport });
    assert.equal(calls, 1);
    assert.equal(result.provider, 'openai');
    assert.equal(result.model, 'gpt-5.6-sol');
    assert.equal(result.responseId, 'resp_verified_123');
    assert.equal(result.execution, 'server_direct_no_fallback');
    assert.match(result.answer, /ejecutada realmente/);
  });
});

test('v93 exact OpenAI reference refuses a successful-looking payload without provider receipt', async () => {
  await withEnv({ OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'gpt-5.6-sol' }, async () => {
    const transport = async () => fakeResponse({ output_text: 'Texto sin receipt.' });
    await assert.rejects(() => executeExactOpenAIReference({ prompt: 'test', transport }), /openai_runtime_receipt_missing/);
  });
});

test('v93 target execution goes through canonical Universal Core chat and verifies WAE provider/model', async () => {
  let calledUrl = '';
  const transport = async (url, options) => {
    calledUrl = url;
    const body = JSON.parse(options.body);
    assert.equal(body.message, 'Caso objetivo');
    assert.equal(body.mode, 'analysis');
    assert.equal(body.benchmark.version, VERIFIED_PROVIDER_EXECUTION_VERSION);
    assert.ok(body.benchmark.requestId);
    return fakeResponse({ reply: 'Respuesta Universal Core.', provider: 'wae_edge', model: 'iu-gpt-runtime-v13' });
  };
  const result = await executeExactUniversalCoreTarget({ prompt: 'Caso objetivo', mode: 'analysis', baseUrl: 'https://universal-core.test', transport });
  assert.equal(calledUrl, 'https://universal-core.test/api/chat');
  assert.equal(result.provider, 'wae_edge');
  assert.equal(result.model, 'iu-gpt-runtime-v13');
  assert.match(result.requestId, /^v93-/);
  assert.equal(result.execution, 'server_loopback_canonical_chat');
});

test('v93 target execution rejects a non-WAE provider even if it returns a polished answer', async () => {
  const transport = async () => fakeResponse({ reply: 'Respuesta bonita.', provider: 'openai', model: 'gpt-5.6-sol' });
  await assert.rejects(() => executeExactUniversalCoreTarget({ prompt: 'Caso', baseUrl: 'https://universal-core.test', transport }), /target_provider_unverified/);
});
