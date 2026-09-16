import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mobileSource=readFileSync(new URL('../mobile-v26.js',import.meta.url),'utf8');
const serverSource=readFileSync(new URL('../server.js',import.meta.url),'utf8');

test('v97 mobile lifecycle detects a completed assistant before removing orphan typing placeholders',()=>{
  assert.match(mobileSource,/mobile-response-lifecycle\/v97/);
  assert.match(mobileSource,/function completedAssistant\(turn\)/);
  assert.match(mobileSource,/!body\.querySelector\('\.typing'\)/);
  assert.match(mobileSource,/!actions\.classList\.contains\('hidden'\)/);
  assert.match(mobileSource,/const completed=turns\.filter\(completedAssistant\)/);
  assert.match(mobileSource,/if\(!completed\.length\)return false/);
});

test('v97 removes only orphan pending assistants from the latest user turn after a final answer exists',()=>{
  assert.match(mobileSource,/function latestTurnSegment\(\)/);
  assert.match(mobileSource,/children\.slice\(lastUser\+1\)/);
  assert.match(mobileSource,/turn!==winner&&turn\.querySelector\('\.typing'\)/);
  assert.match(mobileSource,/turn\.remove\(\)/);
});

test('v97 restores the live composer independently from voice playback',()=>{
  assert.match(mobileSource,/function settleVisibleComposer\(\)/);
  assert.match(mobileSource,/document\.getElementById\('send'\)/);
  assert.match(mobileSource,/liveSend\.classList\.remove\('stop'\)/);
  assert.match(mobileSource,/liveSend\.textContent='↑'/);
  assert.match(mobileSource,/setCoreState\('operational'\)/);
  assert.doesNotMatch(mobileSource,/await\s+.*speak.*settleVisibleComposer/);
});

test('v97 reconciliation is driven by DOM completion and voice-state as a secondary signal, not a blind timeout',()=>{
  assert.match(mobileSource,/new MutationObserver\(\(\)=>queueMicrotask\(inspect\)\)/);
  assert.match(mobileSource,/wae:voice-state/);
  assert.doesNotMatch(mobileSource,/setTimeout\([^\n]*reconcileCompletedTurn/);
});

test('server cache-busts the mobile lifecycle asset and exposes the production release header',()=>{
  assert.match(serverSource,/mobile-v26\.js\?v=97/);
  assert.match(serverSource,/X-WAE-Mobile-Response-Lifecycle/);
  assert.match(serverSource,/mobile-response-lifecycle\/v97/);
  assert.match(serverSource,/universal-core-mobile-v97-response-lifecycle/);
});
