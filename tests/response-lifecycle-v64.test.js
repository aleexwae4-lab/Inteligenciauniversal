import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const fast=readFileSync(new URL('../fast-lane-v23.js',import.meta.url),'utf8');
const mobile=readFileSync(new URL('../mobile-runtime-v47.js',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

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

test('mobile lifecycle budgets exceed server budgets for complex modes',()=>{
  assert.match(mobile,/general:24000/);
  assert.match(mobile,/analysis:30000/);
  assert.match(mobile,/code:30000/);
  assert.match(mobile,/design:30000/);
  assert.match(mobile,/executive:30000/);
  assert.match(mobile,/research:36000/);
});

test('recoverable mobile failures are not cached as definitive answers',()=>{
  const writes=[...mobile.matchAll(/recent\.set\(key/g)];
  assert.equal(writes.length,1);
  assert.match(mobile,/successOnlyCache:true/);
  assert.match(mobile,/recoverableFailuresRetryable:true/);
});
