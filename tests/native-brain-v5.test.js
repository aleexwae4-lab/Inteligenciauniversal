import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nativeBrainReply, nativeBrainStatus, NATIVE_BRAIN_VERSION } from '../lib/native-brain-v5.js';

const source=readFileSync(new URL('../lib/native-brain-v5.js',import.meta.url),'utf8');
const apiSource=readFileSync(new URL('../api/native-brain.js',import.meta.url),'utf8');

test('native brain v5 exposes quality council and self-repair runtime',()=>{
  const status=nativeBrainStatus();
  assert.equal(status.version,NATIVE_BRAIN_VERSION);
  assert.equal(status.ready,true);
  assert.equal(status.qualityCouncil,true);
  assert.equal(status.selfRepair,true);
  assert.equal(status.memoryAwareRouting,true);
  assert.equal(status.contextDependentFollowups,true);
  for(const lane of ['quality-council','memory-context','knowledge-fabric','inference-fabric-auto','quality-self-repair','verified-rescue'])assert.equal(status.lanes.includes(lane),true);
});

test('stable factual routing ranks candidates instead of first-value collapse',()=>{
  assert.match(source,/Promise\.allSettled\(candidates\)/);
  assert.match(source,/selectionScore/);
  assert.match(source,/strategy:'quality-council'/);
  assert.doesNotMatch(source,/Promise\.any\(\[knowledge,reference,generation\]\)/);
});

test('quality recovery is wired into generated answers',()=>{
  assert.match(source,/repairInstruction\(originalQuality\)/);
  assert.match(source,/NATIVE_QUALITY_REPAIR/);
  assert.match(source,/inference-fabric-auto-repaired/);
  assert.match(source,/revision_not_better/);
});

test('native generation budget fits the client envelope and no longer rejects a viable Edge response at 7.6 seconds',()=>{
  assert.match(source,/COMPLEX_MODES\.has\(intent\.mode\)\?27_000:17_000/);
  assert.doesNotMatch(source,/\?14000:7600/);
});

test('context-dependent followups bypass context-free factual council',()=>{
  assert.match(source,/function contextDependent/);
  assert.match(source,/!needsContext/);
  assert.match(source,/recallMemory\(userKey,message,10,sessionId,conversationId\)/);
});

test('native API is promoted to v5 and exports quality telemetry headers',()=>{
  assert.match(apiSource,/native-brain-v5\.js/);
  assert.match(apiSource,/X-WAE-Quality-Score/);
  assert.match(apiSource,/X-WAE-Quality-Strategy/);
});

test('deterministic kernel remains available for low-risk exact answers',async()=>{
  const result=await nativeBrainReply({message:'12 * 7',mode:'general',userKey:'test-user'});
  assert.equal(result.native_brain,NATIVE_BRAIN_VERSION);
  assert.equal(result.native_path,'local-kernel-first');
  assert.match(result.reply,/84/);
  assert.ok(result.quality.score>=0.62);
});
