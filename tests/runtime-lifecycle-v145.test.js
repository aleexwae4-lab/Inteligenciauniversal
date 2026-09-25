import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  startupSafety,
  markRuntimeReady,
  beginRuntimeDrain,
  lifecycleSnapshot,
  RUNTIME_LIFECYCLE_VERSION
} from '../lib/runtime-lifecycle-v145.js';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('v145 startup safety accepts the production Node 22 contract',()=>{
  const result=startupSafety({port:10000,maxBodyBytes:2_000_000,nodeVersion:'v22.20.0'});
  assert.equal(result.ok,true);
  assert.deepEqual(result.issues,[]);
  assert.equal(result.requiredNodeMajor,22);
});

test('v145 startup safety rejects unsupported runtime and unsafe configuration',()=>{
  const result=startupSafety({port:0,maxBodyBytes:64_000_000,nodeVersion:'v20.19.0'});
  assert.equal(result.ok,false);
  assert.ok(result.issues.includes('invalid_port'));
  assert.ok(result.issues.includes('invalid_body_limit'));
  assert.ok(result.issues.includes('unsupported_node_major'));
});

test('runtime lifecycle transitions ready to draining without reverting',()=>{
  const ready=markRuntimeReady();
  assert.equal(ready.version,RUNTIME_LIFECYCLE_VERSION);
  assert.equal(ready.phase,'ready');
  assert.equal(ready.acceptingTraffic,true);
  const draining=beginRuntimeDrain('SIGTERM');
  assert.equal(draining.phase,'draining');
  assert.equal(draining.acceptingTraffic,false);
  assert.equal(draining.drainReason,'SIGTERM');
  assert.equal(markRuntimeReady().phase,'draining');
  assert.equal(lifecycleSnapshot().phase,'draining');
});

test('server and health expose a non-billable lifecycle canary',()=>{
  const server=read('server.js');
  const health=read('api/health.js');
  const canary=read('scripts/release-canary-v145.mjs');
  assert.match(server,/\/api\/health\/canary/);
  assert.match(server,/beginRuntimeDrain/);
  assert.match(server,/SIGTERM/);
  assert.match(server,/markRuntimeReady/);
  assert.match(health,/component:'release-canary'/);
  assert.match(health,/paidInferenceTriggered:false/);
  assert.match(canary,/\/api\/health\/liveness/);
  assert.match(canary,/\/api\/health\/readiness/);
  assert.match(canary,/\/api\/health\/canary/);
  assert.doesNotMatch(canary,/\/api\/chat/);
  assert.doesNotMatch(canary,/OPENAI|ANTHROPIC|GEMINI|inference/i);
});
