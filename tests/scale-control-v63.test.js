import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SCALE_CONTROL_VERSION,
  SCALE_TARGET_SUBSCRIBERS,
  SCALE_ADMISSION_SHARDS,
  hashScalePrincipal,
  admissionShardForHash,
  scaleAdmissionNeeded,
  scaleControlCapabilities
} from '../lib/scale-control-v63.js';

test('v63 declares a 20k subscriber software target without claiming current infrastructure load certification',()=>{
  const caps=scaleControlCapabilities();
  assert.equal(SCALE_CONTROL_VERSION,'universal-runtime-control/v63');
  assert.equal(SCALE_TARGET_SUBSCRIBERS,20_000);
  assert.equal(caps.softwareSubscriberTarget,20_000);
  assert.equal(caps.horizontalScaleReady,true);
  assert.equal(caps.currentInfrastructureLoadCertified,false);
  assert.equal(caps.persistentProviderReputation,true);
  assert.equal(caps.hashedPrincipalsOnly,true);
  assert.equal(caps.storesPromptContent,false);
  assert.equal(caps.storesResponseContent,false);
});

test('20k deterministic principals distribute across all 64 admission shards without pathological concentration',()=>{
  const counts=Array.from({length:SCALE_ADMISSION_SHARDS},()=>0);
  for(let i=0;i<20_000;i++)counts[admissionShardForHash(hashScalePrincipal(`subscriber-${i}`))]++;
  assert.equal(counts.filter(Boolean).length,64);
  assert.ok(Math.max(...counts)<400);
  assert.ok(Math.min(...counts)>230);
});

test('scale hashes are deterministic fixed-width SHA-256 and never echo the raw principal',()=>{
  const raw='private-user@example.test';
  const first=hashScalePrincipal(raw),second=hashScalePrincipal(raw);
  assert.equal(first,second);
  assert.match(first,/^[a-f0-9]{64}$/);
  assert.equal(first.includes(raw),false);
});

test('cheap conversational fast paths bypass distributed admission while expensive work is governed',()=>{
  assert.equal(scaleAdmissionNeeded({message:'Hola',mode:'general'}),false);
  assert.equal(scaleAdmissionNeeded({message:'Analiza profundamente esta arquitectura',mode:'analysis'}),true);
  assert.equal(scaleAdmissionNeeded({message:'Busca noticias actuales',mode:'research',web_enabled:true}),true);
  assert.equal(scaleAdmissionNeeded({message:'Resume el archivo',attachments:[{name:'a.pdf'}]}),true);
});

test('database migration is private, sharded and lease-based',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260915192500_universal_core_v63_scale_20k.sql',import.meta.url),'utf8');
  assert.match(sql,/wae_provider_runtime_reputation_v63/);
  assert.match(sql,/wae_chat_active_leases_v63/);
  assert.match(sql,/wae_chat_rate_buckets_v63/);
  assert.match(sql,/admission_shards',64/);
  assert.match(sql,/subscriber_target',20000/);
  assert.match(sql,/pg_advisory_xact_lock/);
  assert.match(sql,/expires_at/);
  assert.match(sql,/revoke all on public\.wae_chat_active_leases_v63 from anon, authenticated/i);
  assert.match(sql,/contains_prompt_content|stores_prompt_content|never prompt/i);
});

test('v91 and v90 wrap v89 knowledge, v88 fusion and v87 planner while preserving the v86 -> v84 -> v83 -> v81 -> v77 -> v63 chain and v82 compatibility',async()=>{
  const wrapper=await readFile(new URL('../api/capacity-chat-v63.js',import.meta.url),'utf8');
  const compatibility=await readFile(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const specialistWrapper=await readFile(new URL('../api/capacity-chat-v91.js',import.meta.url),'utf8');
  const latencyWrapper=await readFile(new URL('../api/capacity-chat-v90.js',import.meta.url),'utf8');
  const knowledgeWrapper=await readFile(new URL('../api/capacity-chat-v89.js',import.meta.url),'utf8');
  const fusionWrapper=await readFile(new URL('../api/capacity-chat-v88.js',import.meta.url),'utf8');
  const plannerWrapper=await readFile(new URL('../api/capacity-chat-v87.js',import.meta.url),'utf8');
  const factualityWrapper=await readFile(new URL('../api/capacity-chat-v86.js',import.meta.url),'utf8');
  const resilienceWrapper=await readFile(new URL('../api/capacity-chat-v84.js',import.meta.url),'utf8');
  const factualWrapper=await readFile(new URL('../api/capacity-chat-v83.js',import.meta.url),'utf8');
  const recoveryWrapper=await readFile(new URL('../api/capacity-chat-v82.js',import.meta.url),'utf8');
  const healthWrapper=await readFile(new URL('../api/capacity-chat-v81.js',import.meta.url),'utf8');
  const gpuWrapper=await readFile(new URL('../api/capacity-chat-v77.js',import.meta.url),'utf8');
  assert.match(wrapper,/distributedAdmission/);
  assert.match(wrapper,/releaseDistributedAdmission/);
  assert.match(wrapper,/capacityChatV62/);
  assert.match(wrapper,/finally/);
  assert.match(wrapper,/Retry-After/);
  assert.match(compatibility,/capacity-chat-v91\.js/);
  assert.match(specialistWrapper,/capacity-chat-v90\.js/);
  assert.match(latencyWrapper,/capacity-chat-v89\.js/);
  assert.match(knowledgeWrapper,/capacity-chat-v88\.js/);
  assert.match(knowledgeWrapper,/classifyUniversalKnowledge/);
  assert.match(fusionWrapper,/capacity-chat-v87\.js/);
  assert.match(fusionWrapper,/runKnowledgeFusion/);
  assert.match(plannerWrapper,/capacity-chat-v86\.js/);
  assert.match(plannerWrapper,/planUniversalIntelligence/);
  assert.match(factualityWrapper,/capacity-chat-v84\.js/);
  assert.match(factualityWrapper,/factualityDecision/);
  assert.match(factualityWrapper,/applyAnswerIntelligence/);
  assert.match(resilienceWrapper,/capacity-chat-v83\.js/);
  assert.match(resilienceWrapper,/callIaGratisChat/);
  assert.match(factualWrapper,/capacity-chat-v81\.js/);
  assert.match(factualWrapper,/runFocusedFactualAnswer/);
  assert.match(factualWrapper,/runKnowledgeAnswer/);
  assert.match(recoveryWrapper,/capacity-chat-v81\.js/);
  assert.match(recoveryWrapper,/runKnowledgeAnswer/);
  assert.match(healthWrapper,/capacity-chat-v77\.js/);
  assert.match(healthWrapper,/chooseOperationalProvider/);
  assert.match(healthWrapper,/terminalControlFailure/);
  assert.match(gpuWrapper,/capacityChatV63/);
  assert.match(gpuWrapper,/GPU_SCHEDULER_VERSION/);
});
