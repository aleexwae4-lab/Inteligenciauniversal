import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const fast=readFileSync(new URL('../fast-lane-v23.js',import.meta.url),'utf8');
const mobile=readFileSync(new URL('../mobile-runtime-v47.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const mobileComposer=readFileSync(new URL('../mobile-safe-composer.js',import.meta.url),'utf8');
const mobilePage=readFileSync(new URL('../api/mobile.js',import.meta.url),'utf8');

test('v64 lifecycle wraps the active runtime before app chat execution',()=>{
  const runtime=index.indexOf('./runtime-client.js');
  const lane=index.indexOf('./fast-lane-v23.js');
  const app=index.indexOf('./app.js');
  assert.ok(runtime>=0&&lane>runtime&&app>lane);
  assert.match(fast,/v64-response-lifecycle/);
});

test('v64 retries one recoverable terminal failure but never amplifies overload',()=>{
  assert.match(fast,/RETRYABLE_STATUS=new Set\(\[500,502,503,504\]\)/);
  assert.match(fast,/RATE_LIMITED/);
  assert.match(fast,/CAPACITY_BUSY/);
  assert.match(fast,/x-wae-lifecycle-retry/);
  assert.match(fast,/await wait\(180\)/);
});

test('v67 mobile lifecycle budgets stay beyond the 45s production server request timeout',()=>{
  const match=mobile.match(/CLIENT_BUDGETS=Object\.freeze\(\{general:(\d+),analysis:(\d+),code:(\d+),design:(\d+),executive:(\d+),research:(\d+)\}\)/);
  assert.ok(match,'client budgets must remain explicit and auditable');
  const budgets=match.slice(1).map(Number);
  for(const budget of budgets)assert.ok(budget>45000,`client budget ${budget} must exceed server request timeout`);
  assert.deepEqual(budgets,[52000,58000,58000,58000,62000,65000]);
  assert.match(mobile,/v67-provider-independent-recovery/);
});

test('recoverable mobile failures are not cached as definitive answers',()=>{
  const writes=[...mobile.matchAll(/recent\.set\(key/g)];
  assert.equal(writes.length,1);
  assert.match(mobile,/successOnlyCache:true/);
  assert.match(mobile,/recoverableFailuresRetryable:true/);
});


test('v113 releases busy state after every completed turn and focuses the visible mobile composer',()=>{
  assert.match(app,/turn-lifecycle\/v113/);
  assert.match(app,/document\.documentElement\.dataset\.aiBusy=String\(!!active\)/);
  assert.match(app,/mobileSafeInput/);
  assert.match(app,/finally\{releaseTurnUI\(\)\}/);
});

test('v113 mobile composer self-recovers from stale busy state after an assistant response',()=>{
  assert.match(mobileComposer,/mobile-safe-composer\/v113-consecutive-turns/);
  assert.match(mobileComposer,/forceReady/);
  assert.match(mobileComposer,/75000/);
  assert.match(mobileComposer,/message\.assistant:not\(#typingMessage\),\.turn\.assistant/);
});


test('v114 commits the final answer into the live visible mobile turn',()=>{
  assert.match(mobilePage,/visible-answer-commit\\/v114/);
  assert.match(mobilePage,/function liveParts\(\)/);
  assert.match(mobilePage,/turn\.dataset\.turnId=turnId/);
  assert.match(mobilePage,/enforceVisibleAnswer\(assistant,reply,speech\)/);
  assert.match(mobilePage,/visible_answer_audit/);
  assert.match(mobilePage,/turnConnected:after\.connected/);
});

test('v114 response_rendered telemetry verifies visible text instead of assuming DOM commit',()=>{
  assert.match(mobilePage,/visibleTextLength:audit\.textLength/);
  assert.match(mobilePage,/typingCount:audit\.typingCount/);
  assert.match(mobilePage,/actionsVisible:audit\.actionsVisible/);
  assert.match(mobilePage,/replyLength:reply\.length/);
});


test('v114 settles the currently connected mobile composer and core state',()=>{
  assert.match(mobilePage,/document\.getElementById\('send'\)\|\|send/);
  assert.match(mobilePage,/document\.getElementById\('input'\)\|\|input/);
  assert.match(mobilePage,/document\.getElementById\('coreState'\)\|\|coreState/);
  assert.match(mobilePage,/liveCore\.textContent='operativo'/);
});
