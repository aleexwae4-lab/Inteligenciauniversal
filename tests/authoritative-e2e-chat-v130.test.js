import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimeClient=fs.readFileSync(new URL('../runtime-client.js',import.meta.url),'utf8');
const chat=fs.readFileSync(new URL('../api/chat.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../lib/runtime.js',import.meta.url),'utf8');

test('v130 ordinary chat is server-authoritative by default',()=>{
  assert.match(runtimeClient,/__WAE_AUTHORITATIVE_CHAT__!==false\)return nativeFetch\(input,init\)/);
  assert.match(runtimeClient,/one authoritative E2E chat path/);
});

test('v130 authoritative path owns telemetry, tools, memory and sources',()=>{
  assert.match(chat,/recordChatSuccess\(result,latencyMs\)/);
  assert.match(chat,/recordChatFailure\(code,latencyMs\)/);
  assert.match(runtime,/runTools\(/);
  assert.match(runtime,/recallMemory\(/);
  assert.match(runtime,/saveTurn\(/);
  assert.match(runtime,/sources:realSources/);
  assert.match(runtime,/generateWithFallback\(/);
});

test('legacy direct Edge route remains only as explicit non-persistent emergency escape hatch',()=>{
  const gate=runtimeClient.indexOf("if(window.__WAE_AUTHORITATIVE_CHAT__!==false)return nativeFetch(input,init);");
  const direct=runtimeClient.indexOf("await bootstrap(init.signal)",gate);
  assert.ok(gate>0);
  assert.ok(direct>gate);
  assert.doesNotMatch(runtimeClient,/localStorage\.setItem\(['"]__WAE_AUTHORITATIVE_CHAT__/);
});
