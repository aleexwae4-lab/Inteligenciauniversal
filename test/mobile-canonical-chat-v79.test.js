import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('Android v80 transport makes same-origin api/chat primary for visible chat calls',async()=>{
  const js=await read('mobile-canonical-chat-v80.js');
  assert.match(js,/mobile-canonical-chat\/v80/);
  assert.match(js,/nativeFetch\('\/api\/chat'/);
  assert.match(js,/primary:'same-origin:\/api\/chat'/);
  assert.match(js,/fallback:'edge-nonstream'/);
});

test('Android v80 transport serves the existing streaming surface from the canonical answer',async()=>{
  const js=await read('mobile-canonical-chat-v80.js');
  assert.match(js,/text\/event-stream/);
  assert.match(js,/event: response\.complete/);
  assert.match(js,/streaming:'canonical-json-to-sse'/);
  assert.match(js,/payload\.stream===true\?sseResponse/);
});

test('Android v80 transport rejects continuity pass-through as a terminal answer',async()=>{
  const js=await read('mobile-canonical-chat-v80.js');
  assert.match(js,/continuity_pass_through/);
  assert.match(js,/all_models_unavailable/);
  assert.match(js,/no pude completar/i);
  assert.match(js,/rejectsContinuityPassThrough:true/);
  assert.match(js,/mobile_routes_unavailable/);
});

test('Android v80 transport removes Edge bootstrap as a fatal dependency',async()=>{
  const js=await read('mobile-canonical-chat-v80.js');
  assert.match(js,/payload\.action==='bootstrap'/);
  assert.match(js,/local-canonical-fallback/);
  assert.match(js,/bootstrapFailOpenToCanonical:true/);
});

test('mobile server injects v80 canonical transport last and declares JSON plus SSE same-origin-first',async()=>{
  const server=await read('server.js');
  const productivity=server.indexOf("productivity-v59.js?v=59");
  const canonical=server.indexOf("mobile-canonical-chat-v80.js?v=80");
  assert.ok(productivity>=0);
  assert.ok(canonical>productivity);
  assert.match(server,/X-WAE-Mobile-Release','universal-core-mobile-v80-visible-chat'/);
  assert.match(server,/X-WAE-Mobile-Chat-Route','same-origin-json-and-sse-first'/);
});
