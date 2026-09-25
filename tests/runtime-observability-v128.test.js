import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recordChatSuccess, recordChatFailure, runtimeOperations} from '../lib/runtime-observability-v128.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('v128 derives production inference verification from real chat success without synthetic model calls',()=>{
  const before=runtimeOperations(Date.now(),60_000);
  assert.equal(before.providerInferenceVerified,false);

  recordChatSuccess({provider:'wae_core',model:'runtime_capabilities'},125);
  const deterministic=runtimeOperations(Date.now(),60_000);
  assert.equal(deterministic.chatSuccesses,1);
  assert.equal(deterministic.providerInferenceVerified,false);

  recordChatSuccess({provider:'google_gemma',model:'gemma-4-26b-a4b-it'},842);
  const verified=runtimeOperations(Date.now(),60_000);
  assert.equal(verified.providerInferenceVerified,true);
  assert.equal(verified.inferenceFresh,true);
  assert.equal(verified.lastInferenceProvider,'google_gemma');
  assert.equal(verified.lastInferenceModel,'gemma-4-26b-a4b-it');
  assert.equal(verified.lastLatencyMs,842);

  recordChatFailure('provider_timeout',910);
  const degraded=runtimeOperations(Date.now(),60_000);
  assert.equal(degraded.chatFailures,1);
  assert.equal(degraded.consecutiveFailures,1);
  assert.equal(degraded.lastFailureCode,'provider_timeout');
  assert.equal(degraded.providerInferenceVerified,true);
});

test('v128 chat and health wire observability without logging prompts or running billable health inference',()=>{
  const chat=read('api/chat.js');
  const health=read('api/health.js');
  assert.match(chat,/recordChatSuccess\(result,latencyMs\)/);
  assert.match(chat,/recordChatFailure\(code,latencyMs\)/);
  assert.match(chat,/Server-Timing/);
  assert.doesNotMatch(chat,/message\s*:/);
  assert.match(health,/runtimeOperations\(\)/);
  assert.match(health,/providerInferenceVerified:operations\.providerInferenceVerified/);
  assert.doesNotMatch(health,/executeMission|generateWithFallback|fetch\(/);
});
