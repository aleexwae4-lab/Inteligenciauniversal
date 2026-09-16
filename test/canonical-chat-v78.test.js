import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('visible chat uses same-origin api/chat as the canonical primary path',async()=>{
  const js=await read('canonical-chat-v78.js');
  assert.match(js,/const VERSION='canonical-chat\/v78'/);
  assert.match(js,/xhr\.open\('POST','\/api\/chat',true\)/);
  assert.match(js,/primary:'same-origin:\/api\/chat'/);
  assert.match(js,/previousFetch\(input,init\)/);
  assert.match(js,/continuity-fallback/);
});

test('canonical chat rejects continuity pass-through and incomplete runtime replies',async()=>{
  const js=await read('canonical-chat-v78.js');
  assert.match(js,/continuity_pass_through/);
  assert.match(js,/all_models_unavailable/);
  assert.match(js,/no pude completar/i);
  assert.match(js,/canonical_and_continuity_unavailable/);
  assert.match(js,/rejectsContinuityPassThrough:true/);
});

test('canonical chat carries user context into the backend route',async()=>{
  const js=await read('canonical-chat-v78.js');
  assert.match(js,/sessionId:/);
  assert.match(js,/storedHistory\(message\)/);
  assert.match(js,/window\.__waeRuntimeAttachments/);
  assert.match(js,/web_enabled:/);
  assert.match(js,/provider:incoming\.provider\|\|'auto'/);
});

test('progressive boot loads canonical chat after the base runtime stack',async()=>{
  const boot=await read('progressive-boot-v23.js');
  assert.match(boot,/canonical-chat-v78\.js\?v=78/);
  assert.match(boot,/v78-canonical-chat/);
  assert.match(boot,/canonicalChat/);
});
