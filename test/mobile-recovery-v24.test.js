import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('server exposes Universal Core mobile and routes mobile root to it', async () => {
  const server = await read('server.js');
  assert.match(server, /\/api\/mobile/);
  assert.match(server, /\/api\/ui-diagnostics/);
  assert.match(server, /isMobileRequest/);
  assert.match(server, /sec-ch-ua-mobile/);
  assert.match(server, /url\.pathname === '\/'/);
  assert.match(server, /mobileHandler\(req, res\)/);
  assert.match(server, /desktop.*=== '1'/s);
});

test('mobile v25 is a self-contained premium conversational surface', async () => {
  const mobile = await read('api/mobile.js');
  assert.match(mobile, /universal-core-mobile-v25/);
  assert.match(mobile, /¿En qué trabajamos\?/);
  assert.match(mobile, /Pregunta lo que quieras/);
  assert.match(mobile, /id="input"/);
  assert.match(mobile, /id="composer"/);
  assert.match(mobile, /stream:true/);
  assert.match(mobile, /text\/event-stream/);
  assert.match(mobile, /content\.delta/);
  assert.match(mobile, /response\.complete/);
  assert.match(mobile, /\/api\/performance/);
  assert.match(mobile, /\/api\/chat/);
  assert.match(mobile, /markdown\(text\)/);
  assert.match(mobile, /Regenerar/);
  assert.match(mobile, /Escuchar/);
  assert.match(mobile, /Copiar/);
  assert.match(mobile, /SpeechRecognition/);
  assert.match(mobile, /speechSynthesis/);
  assert.match(mobile, /FileReader/);
  assert.match(mobile, /getRegistrations\(\)/);
  assert.match(mobile, /caches\.keys\(\)/);
  assert.doesNotMatch(mobile, /Mobile Recovery v24/);
  assert.doesNotMatch(mobile, /modo móvil aislado/i);
  assert.doesNotMatch(mobile, /experience-v[5-8]/i);
  assert.doesNotMatch(mobile, /polish-v2/i);
  assert.doesNotMatch(mobile, /navigator\.serviceWorker\.register/);
});

test('mobile v25 keeps diagnostics privacy-safe and never logs prompt content', async () => {
  const mobile = await read('api/mobile.js');
  const diagnostics = await read('api/ui-diagnostics.js');
  assert.match(mobile, /valueLength/);
  assert.match(diagnostics, /ALLOWED_EVENTS/);
  assert.match(diagnostics, /\[UI_DIAGNOSTIC\]/);
  assert.doesNotMatch(diagnostics, /body\.message/);
  assert.doesNotMatch(diagnostics, /body\.text/);
  assert.doesNotMatch(diagnostics, /body\.content/);
});

test('mobile v25 preserves fail-safe generation paths', async () => {
  const mobile = await read('api/mobile.js');
  assert.match(mobile, /streamAvailable/);
  assert.match(mobile, /streamEdge/);
  assert.match(mobile, /edge\(payload,70000\)/);
  assert.match(mobile, /fallbackChat/);
  assert.match(mobile, /currentController\.abort\('user_cancelled'\)/);
  assert.match(mobile, /routing_variant:'candidate'/);
  assert.match(mobile, /routing_variant:'control'/);
});
