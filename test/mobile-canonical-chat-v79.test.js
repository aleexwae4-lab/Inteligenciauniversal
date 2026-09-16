import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('Android transport makes same-origin api/chat primary for Edge chat calls',async()=>{
  const js=await read('mobile-canonical-chat-v79.js');
  assert.match(js,/mobile-canonical-chat\/v79/);
  assert.match(js,/nativeFetch\('\/api\/chat'/);
  assert.match(js,/primary:'same-origin:\/api\/chat'/);
  assert.match(js,/fallback:'edge'/);
});

test('Android transport rejects continuity pass-through as a terminal answer',async()=>{
  const js=await read('mobile-canonical-chat-v79.js');
  assert.match(js,/continuity_pass_through/);
  assert.match(js,/all_models_unavailable/);
  assert.match(js,/no pude completar/i);
  assert.match(js,/rejectsContinuityPassThrough:true/);
  assert.match(js,/mobile_routes_unavailable/);
});

test('Android transport removes Edge bootstrap as a fatal dependency',async()=>{
  const js=await read('mobile-canonical-chat-v79.js');
  assert.match(js,/payload\.action==='bootstrap'/);
  assert.match(js,/local-canonical-fallback/);
  assert.match(js,/bootstrapFailOpenToCanonical:true/);
});

test('mobile server injects canonical transport last and declares same-origin-first',async()=>{
  const server=await read('server.js');
  const productivity=server.indexOf("productivity-v59.js?v=59");
  const canonical=server.indexOf("mobile-canonical-chat-v79.js?v=79");
  assert.ok(productivity>=0);
  assert.ok(canonical>productivity);
  assert.match(server,/X-WAE-Mobile-Release','universal-core-mobile-v79-canonical-chat'/);
  assert.match(server,/X-WAE-Mobile-Chat-Route','same-origin-first'/);
});
