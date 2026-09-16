import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  hashScalePrincipal,
  admissionShardForHash,
  SCALE_CONTROL_VERSION,
  SCALE_TARGET_SUBSCRIBERS,
  SCALE_ADMISSION_SHARDS,
  scaleAdmissionNeeded
} from '../lib/scale-control-v63.js';

const migration=new URL('../supabase/migrations/20260915192500_universal_core_v63_scale_20k.sql',import.meta.url);

test('v63 declares a 20k subscriber software target without claiming current infrastructure load certification',()=>{
  assert.equal(SCALE_CONTROL_VERSION,'universal-runtime-control/v63');
  assert.equal(SCALE_TARGET_SUBSCRIBERS,20000);
  assert.equal(SCALE_ADMISSION_SHARDS,64);
});

test('20k deterministic principals distribute across all 64 admission shards without pathological concentration',()=>{
  const counts=Array.from({length:SCALE_ADMISSION_SHARDS},()=>0);
  for(let i=0;i<SCALE_TARGET_SUBSCRIBERS;i++)counts[admissionShardForHash(hashScalePrincipal(`principal-${i}`))]++;
  assert.equal(counts.filter(Boolean).length,SCALE_ADMISSION_SHARDS);
  assert.ok(Math.max(...counts)-Math.min(...counts)<100);
});

test('scale hashes are deterministic fixed-width SHA-256 and never echo the raw principal',()=>{
  const first=hashScalePrincipal('user@example.com');
  const second=hashScalePrincipal('user@example.com');
  assert.equal(first,second);
  assert.match(first,/^[a-f0-9]{64}$/);
  assert.doesNotMatch(first,/user@example\.com/);
});

test('cheap conversational fast paths bypass distributed admission while expensive work is governed',()=>{
  assert.equal(scaleAdmissionNeeded({message:'hola',mode:'general'}),false);
  assert.equal(scaleAdmissionNeeded({message:'gracias',mode:'general'}),false);
  assert.equal(scaleAdmissionNeeded({message:'diseña arquitectura multi tenant y analiza riesgos',mode:'analysis'}),true);
});

test('database migration is private, sharded and lease-based',async()=>{
  const sql=await readFile(migration,'utf8');
  assert.match(sql,/wae_chat_active_leases_v63/);
  assert.match(sql,/admission_shards',64/);
  assert.match(sql,/subscriber_target',20000/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/expires_at/);
  assert.match(sql,/revoke all on public\.wae_chat_active_leases_v63 from anon, authenticated/i);
  assert.match(sql,/contains_prompt_content|stores_prompt_content|never prompt/i);
});

test('v64 chat wrapper preserves v63 admission and makes deterministic rescue explicitly degraded',async()=>{
  const wrapper=await readFile(new URL('../api/capacity-chat-v63.js',import.meta.url),'utf8');
  const compatibility=await readFile(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const resilience=await readFile(new URL('../api/capacity-chat-v64.js',import.meta.url),'utf8');
  assert.match(wrapper,/distributedAdmission/);
  assert.match(wrapper,/releaseDistributedAdmission/);
  assert.match(wrapper,/capacityChatV62/);
  assert.match(wrapper,/finally/);
  assert.match(wrapper,/Retry-After/);
  assert.match(compatibility,/capacity-chat-v64\.js/);
  assert.match(resilience,/capacity-chat-v63\.js/);
  assert.match(resilience,/COGNITIVE_PATH_UNAVAILABLE/);
  assert.match(resilience,/direct-generative-core-v64/);
  assert.match(resilience,/emergencyGenerate/);
  assert.match(resilience,/continuityOnly:true/);
  assert.match(resilience,/evidenceRelevanceGate/);
  assert.match(resilience,/pass:false/);
});
