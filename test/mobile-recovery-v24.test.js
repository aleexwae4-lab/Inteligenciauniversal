import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('server exposes premium mobile route with v47 backpressure, v46 voice and v97 response lifecycle', async () => {
  const server = await read('server.js');
  assert.match(server, /\/api\/mobile/);
  assert.match(server, /\/api\/ui-diagnostics/);
  assert.match(server, /\/api\/tools/);
  assert.match(server, /isMobileRequest/);
  assert.match(server, /sec-ch-ua-mobile/);
  assert.match(server, /url\.pathname === '\/'/);
  assert.match(server, /mobilePremiumHandler\(req, res\)/);
  assert.match(server, /return mobileHandler\(req,res\)/);
  assert.match(server, /mobile-v26\.css\?v=34/);
  assert.match(server, /fast-lane-v23\.js\?v=34/);
  assert.match(server, /mobile-v26\.js\?v=97/);
  assert.match(server, /telemetry-throttle-v47\.js\?v=47/);
  assert.match(server, /mobile-runtime-v47\.js\?v=47/);
  assert.match(server, /mobile-bootstrap-v45\.js\?v=45/);
  assert.match(server, /semantic-ux-v32\.js\?v=46/);
  assert.match(server, /speech-lifecycle-v46\.js\?v=46/);
  assert.match(server, /mobile-voice-v46\.js\?v=46/);
  assert.match(server, /learning-client-v29\.js\?v=34/);
  assert.match(server, /X-WAE-Mobile-Release','universal-core-mobile-v80-visible-chat'/);
  assert.match(server, /X-WAE-Mobile-Response-Lifecycle','mobile-response-lifecycle\/v97'/);
  assert.match(server, /universal-core-mobile-v47-long-session/);
  assert.match(server, /long-session-backpressure-v47/);
  assert.match(server, /desktop.*=== '1'/s);
});

test('semantic v33 repairs the exact mobile answer and Edge request surface', async () => {
  const semantic = await read('semantic-ux-v32.js');
  assert.match(semantic, /semantic-ux\/v33-edge-context/);
  assert.match(semantic, /\.assistant-body table/);
  assert.match(semantic, /\.rich-answer,\.assistant-body/);
  assert.match(semantic, /data-mobile-table/);
  assert.match(semantic, /Ω/g);
  assert.match(semantic, /ohmios/);
  assert.match(semantic, /speechSynthesis/);
  assert.match(semantic, /__waeVoice/);
  assert.match(semantic, /wae-local-voice-demo-v61/);
  assert.match(semantic, /client-context-v33/);
  assert.match(semantic, /iodo\|yodo/);
  assert.match(semantic, /\(un\|una\|el\|los\|unos\|unas\).*what/);
  assert.match(semantic, /wat\|guat/);
  assert.match(semantic, /payload\.message=intent\.text/);
  assert.match(semantic, /electricalScore<2/);
  assert.match(semantic, /chemistryScore===0/);
});

test('mobile base remains a self-contained premium conversational surface', async () => {
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

test('mobile keeps diagnostics privacy-safe and v47 suppresses per-key transport', async () => {
  const mobile = await read('api/mobile.js');
  const diagnostics = await read('api/ui-diagnostics.js');
  const throttle = await read('telemetry-throttle-v47.js');
  assert.match(mobile, /valueLength/);
  assert.match(diagnostics, /ALLOWED_EVENTS/);
  assert.match(diagnostics, /\[UI_DIAGNOSTIC\]/);
  assert.doesNotMatch(diagnostics, /body\.message/);
  assert.doesNotMatch(diagnostics, /body\.text/);
  assert.doesNotMatch(diagnostics, /body\.content/);
  assert.match(throttle, /'input'/);
  assert.match(throttle, /throttled:true/);
});

test('legacy mobile surface remains compatible while v47 strips forced control and deduplicates fallbacks', async () => {
  const mobile = await read('api/mobile.js');
  const bridge = await read('mobile-runtime-v47.js');
  assert.match(mobile, /streamAvailable/);
  assert.match(mobile, /streamEdge/);
  assert.match(mobile, /edge\(payload,70000\)/);
  assert.match(mobile, /fallbackChat/);
  assert.match(mobile, /currentController\.abort\('user_cancelled'\)/);
  assert.match(mobile, /routing_variant:'candidate'/);
  assert.match(mobile, /routing_variant:'control'/);
  assert.match(bridge, /delete body\.routing_variant/);
  assert.match(bridge, /\/api\/chat/);
  assert.match(bridge, /directChatRequest/);
  assert.doesNotMatch(bridge, /routing_variant:'control'/);
});
