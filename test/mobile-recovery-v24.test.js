import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('server exposes isolated mobile chat and routes mobile root to it', async () => {
  const server = await read('server.js');
  assert.match(server, /\/api\/mobile/);
  assert.match(server, /\/api\/ui-diagnostics/);
  assert.match(server, /function isMobileRequest/);
  assert.match(server, /url\.pathname === '\/' && isMobileRequest/);
  assert.match(server, /mobileHandler\(req, res\)/);
});

test('mobile v25 is a self-contained GPT-like streaming client', async () => {
  const mobile = await read('api/mobile.js');
  assert.match(mobile, /universal-core-mobile-v25/);
  assert.match(mobile, /¿En qué puedo ayudarte\?/);
  assert.match(mobile, /Pregunta lo que quieras/);
  assert.match(mobile, /action:'bootstrap'/);
  assert.match(mobile, /action:'chat'/);
  assert.match(mobile, /action:'list_conversations'/);
  assert.match(mobile, /action:'get_conversation'/);
  assert.match(mobile, /action:'feedback'/);
  assert.match(mobile, /text\/event-stream/);
  assert.match(mobile, /content\.delta/);
  assert.match(mobile, /response\.complete/);
  assert.match(mobile, /AbortController/);
  assert.match(mobile, /routing_variant:'candidate'/);
  assert.match(mobile, /SpeechRecognition/);
  assert.match(mobile, /speechSynthesis/);
  assert.match(mobile, /Regenerar/);
  assert.match(mobile, /Copiar/);
  assert.match(mobile, /\/api\/chat/);
  assert.match(mobile, /getRegistrations\(\)/);
  assert.match(mobile, /caches\.keys\(\)/);
  assert.doesNotMatch(mobile, /Mobile Recovery v24/);
  assert.doesNotMatch(mobile, /UI READY/);
  assert.doesNotMatch(mobile, /experience-v[5-8]/i);
  assert.doesNotMatch(mobile, /polish-v2/i);
  assert.doesNotMatch(mobile, /navigator\.serviceWorker\.register/);
});

test('diagnostics never accept or log message content', async () => {
  const diagnostics = await read('api/ui-diagnostics.js');
  assert.match(diagnostics, /valueLength/);
  assert.match(diagnostics, /ALLOWED_EVENTS/);
  assert.match(diagnostics, /\[UI_DIAGNOSTIC\]/);
  assert.doesNotMatch(diagnostics, /body\.message/);
  assert.doesNotMatch(diagnostics, /body\.text/);
  assert.doesNotMatch(diagnostics, /body\.content/);
});
