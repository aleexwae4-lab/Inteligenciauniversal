import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const SOURCE = await readFile(new URL('../mobile-canonical-chat-v80.js', import.meta.url), 'utf8');
const EDGE = 'https://pbswcbryxawsmltyromd.supabase.co/functions/v1/wae-local-voice-demo-v61';

function makeRuntime(fetchImpl) {
  const store = new Map([
    ['iu.sessionId', 'session-test'],
    ['iu.sessionSecret', 'secret-test'],
  ]);
  const window = { fetch: fetchImpl, __iuLastRuntime: null };
  const context = vm.createContext({
    window,
    document: { documentElement: { dataset: {} } },
    location: { href: 'https://wae-inteligencia-universal.onrender.com/' },
    localStorage: {
      getItem: key => store.get(key) || null,
      setItem: (key, value) => store.set(key, String(value)),
    },
    globalThis: { crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000001' } },
    URL,
    Response,
    Headers,
    JSON,
    String,
    Object,
    console: { warn() {} },
  });
  vm.runInContext(SOURCE, context, { filename: 'mobile-canonical-chat-v80.js' });
  return { window, document: context.document };
}

function requestBody(stream = false) {
  return JSON.stringify({
    action: 'chat',
    message: 'Explica brevemente por qué el cielo se ve azul.',
    mode: 'general',
    session_id: 'session-test',
    session_secret: 'secret-test',
    stream,
  });
}

test('v80 converts the canonical JSON answer into SSE for the real mobile stream path', async () => {
  const calls = [];
  const { window, document } = makeRuntime(async (input, init = {}) => {
    calls.push({ input: String(input), init });
    assert.equal(String(input), '/api/chat');
    return new Response(JSON.stringify({
      success: true,
      reply: 'La dispersión de Rayleigh hace que las longitudes de onda azules se dispersen más en la atmósfera.',
      provider: 'wae_supabase',
      model: 'test-model',
      degraded: false,
      response: { schema: 'assistant-response/v1', content: 'La dispersión de Rayleigh hace que el cielo se vea azul.' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  const response = await window.fetch(EDGE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: requestBody(true),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/i);
  const body = await response.text();
  assert.match(body, /event: response\.complete/);
  assert.match(body, /dispersi/);
  assert.equal(calls.length, 1);
  assert.equal(document.documentElement.dataset.mobileChatRoute, 'same-origin-v103');
  assert.equal(window.__iuLastRuntime.canonical_route, 'same-origin-v103');
  assert.ok(window.__iuLastRuntime.reply_length > 20);
});

test('v80 rejects continuity_pass_through and recovers through Edge only as fallback', async () => {
  const calls = [];
  const { window, document } = makeRuntime(async (input, init = {}) => {
    calls.push(String(input));
    if (String(input) === '/api/chat') {
      return new Response(JSON.stringify({ success: true, reply: 'continuity_pass_through', degraded: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const sent = JSON.parse(String(init.body || '{}'));
    assert.equal(sent.stream, false);
    return new Response(JSON.stringify({
      success: true,
      reply: 'Respuesta recuperada por la ruta de respaldo.',
      degraded: false,
      provider: 'wae_edge',
      response: { schema: 'assistant-response/v1', content: 'Respuesta recuperada por la ruta de respaldo.' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  });

  const response = await window.fetch(EDGE, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: requestBody(true),
  });

  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /response\.complete/);
  assert.match(body, /Respuesta recuperada/);
  assert.doesNotMatch(body, /continuity_pass_through/);
  assert.deepEqual(calls, ['/api/chat', EDGE]);
  assert.equal(document.documentElement.dataset.mobileChatRoute, 'edge-fallback-v103');
});

test('v80 never exposes weak continuity output as a successful non-stream answer', async () => {
  const { window } = makeRuntime(async input => {
    if (String(input) === '/api/chat') {
      return new Response(JSON.stringify({ success: true, reply: 'continuity_pass_through', degraded: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true, reply: 'No pude completar la respuesta.', degraded: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const response = await window.fetch(EDGE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: requestBody(false),
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.error, 'mobile_routes_unavailable');
  assert.notEqual(data.message, 'continuity_pass_through');
});
