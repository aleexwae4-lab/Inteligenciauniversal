import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('server exposes mobile recovery and safe diagnostics under API paths', async () => {
  const server = await read('server.js');
  assert.match(server, /\/api\/mobile/);
  assert.match(server, /\/api\/ui-diagnostics/);
  assert.match(server, /mobileHandler/);
  assert.match(server, /uiDiagnosticsHandler/);
});

test('mobile recovery page is self contained and bypasses premium shell', async () => {
  const mobile = await read('api/mobile.js');
  assert.match(mobile, /Mobile Recovery v24/);
  assert.match(mobile, /id="input"/);
  assert.match(mobile, /id="composer"/);
  assert.match(mobile, /action:'bootstrap'/);
  assert.match(mobile, /action:'chat'/);
  assert.match(mobile, /\/api\/chat/);
  assert.match(mobile, /getRegistrations\(\)/);
  assert.match(mobile, /caches\.keys\(\)/);
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
