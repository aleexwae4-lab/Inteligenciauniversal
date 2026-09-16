import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8')}

test('v89 bootstrap rotates stale Edge sessions into Render-owned sessions',async()=>{
  const text=await read('mobile-bootstrap-v45.js');
  assert.match(text,/v45\.1-render-authoritative-bootstrap/);
  assert.match(text,/sessionId\.startsWith\('render-'\)/);
  assert.match(text,/sessionSecret\.startsWith\('local-'\)/);
  assert.match(text,/localStorage\.setItem\(ORIGIN_KEY,'render'\)/);
});

test('v89 canonical mobile chat does not retry the broken Edge chat path',async()=>{
  const text=await read('mobile-canonical-chat-v80.js');
  assert.match(text,/v80\.1-render-primary/);
  assert.match(text,/CANONICAL_BUDGET_MS=28000/);
  assert.match(text,/Edge retry suppressed to avoid duplicate long waits/);
  assert.match(text,/edgeChatRetry:false/);
  assert.doesNotMatch(text,/async function edgeFallbackData/);
});

test('v89 mobile voice is browser-first and cloud requires an Edge-owned session',async()=>{
  const text=await read('mobile-voice-v46.js');
  assert.match(text,/v46\.1-browser-first/);
  assert.match(text,/if\(browserSupported\(\)\)/);
  assert.match(text,/origin!==\'edge\'/);
  assert.match(text,/browserFirst:true/);
  assert.match(text,/cloudRequiresEdgeSession:true/);
});

test('v89 server cache-busts critical mobile assets and emits chat metrics',async()=>{
  const text=await read('server.js');
  assert.match(text,/mobile-bootstrap-v45\.js\?v=45\.1&rev=89/);
  assert.match(text,/mobile-voice-v46\.js\?v=46\.1&rev=89/);
  assert.match(text,/mobile-canonical-chat-v80\.js\?v=80\.1&rev=89/);
  assert.match(text,/\[CHAT_METRIC\]/);
  assert.match(text,/universal-core-mobile-v89-render-primary/);
});
