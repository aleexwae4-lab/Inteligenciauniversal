import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8')}

test('v89 bootstrap rotates stale Edge sessions into Render-owned sessions',async()=>{
  const text=await read('mobile-bootstrap-v45.js');
  assert.ok(text.includes('v45.1-render-authoritative-bootstrap'));
  assert.ok(text.includes("sessionId.startsWith('render-')"));
  assert.ok(text.includes("sessionSecret.startsWith('local-')"));
  assert.ok(text.includes("localStorage.setItem(ORIGIN_KEY,'render')"));
});

test('v89 canonical mobile chat does not retry the broken Edge chat path',async()=>{
  const text=await read('mobile-canonical-chat-v80.js');
  assert.ok(text.includes('v80.1-render-primary'));
  assert.ok(text.includes('const CANONICAL_BUDGET_MS=28000'));
  assert.ok(text.includes('Edge retry suppressed to avoid duplicate long waits'));
  assert.ok(text.includes('edgeChatRetry:false'));
  assert.ok(!text.includes('async function edgeFallbackData'));
});

test('v89 mobile voice is browser-first and cloud requires an Edge-owned session',async()=>{
  const text=await read('mobile-voice-v46.js');
  assert.ok(text.includes('v46.1-browser-first'));
  assert.ok(text.includes('if(browserSupported())'));
  assert.ok(text.includes("origin!=='edge'"));
  assert.ok(text.includes('browserFirst:true'));
  assert.ok(text.includes('cloudRequiresEdgeSession:true'));
});

test('v89 server cache-busts critical mobile assets and emits chat metrics',async()=>{
  const text=await read('server.js');
  assert.ok(text.includes('mobile-bootstrap-v45.js?v=45.1&rev=89'));
  assert.ok(text.includes('mobile-voice-v46.js?v=46.1&rev=89'));
  assert.ok(text.includes('mobile-canonical-chat-v80.js?v=80.1&rev=89'));
  assert.ok(text.includes('[CHAT_METRIC]'));
  assert.ok(text.includes('universal-core-mobile-v89-render-primary'));
});
