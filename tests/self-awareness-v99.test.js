import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifySelfAwarenessV99, buildSelfAwarenessReplyV99, selfAwarenessCapabilitiesV99, SELF_AWARENESS_V99 } from '../lib/self-awareness-v99.js';
import { planLatencyV90 } from '../lib/latency-governor-v90.js';

const read=name=>readFile(new URL(`../${name}`,import.meta.url),'utf8');

test('v99 recognizes the exact self-awareness questions observed in the mobile clip',()=>{
  assert.equal(classifySelfAwarenessV99({message:'¿Qué tan inteligente eres?'}).kind,'capability');
  assert.equal(classifySelfAwarenessV99({message:'¿Puedes competir contra GPT Astra?'}).kind,'comparison');
  assert.equal(classifySelfAwarenessV99({message:'Quiero saber si eres competente contra GPT Astra'}).kind,'comparison');
});

test('v99 answers competitive intent confidently without fabricating superiority',()=>{
  const reply=buildSelfAwarenessReplyV99({kind:'comparison',stats:{executiveOrchestration:{executiveRoles:22,activeAgentInstances:6}}});
  assert.match(reply,/construido para competir contra GPT-6 Astra/i);
  assert.match(reply,/64 casos emparejados/i);
  assert.match(reply,/CERTIFIED/);
  assert.match(reply,/tengo arquitectura y mecanismos para competir/i);
  assert.doesNotMatch(reply,/No puedo competir directamente/i);
  assert.doesNotMatch(reply,/No dispongo de datos comparativos públicos/i);
  assert.doesNotMatch(reply,/ya super[eé] a Astra/i);
});

test('v99 capability answer describes measurable system capabilities rather than invented IQ',()=>{
  const reply=buildSelfAwarenessReplyV99({kind:'capability',stats:{}});
  assert.match(reply,/no se resume en un “IQ” inventado/i);
  assert.match(reply,/Investigación actual/i);
  assert.match(reply,/Ingeniería/i);
  assert.match(reply,/Orquestación/i);
  assert.match(reply,/P50\/P95\/P99/);
});

test('v99 frontier model facts route to current evidence and benchmark research routes deep',()=>{
  const current=planLatencyV90({message:'¿Qué sabes sobre GPT-6 Astra y cuál es su versión actual?'},{});
  assert.equal(current.signals.competitor_current,true);
  assert.equal(current.profile,'live_current');
  const deep=planLatencyV90({message:'Investiga y compara el benchmark de GPT-6 Astra con Universal Core'},{});
  assert.equal(deep.signals.competitor_current,true);
  assert.equal(deep.profile,'deep_research');
});

test('v99 is wired before generic chat protocol and exposed in public capabilities',async()=>{
  const chat=await read('api/capacity-chat.js');
  const caps=await read('api/capabilities.js');
  const selfIndex=chat.indexOf('selfAwarenessFastPath(req,res,body)');
  const modernIndex=chat.indexOf('modernFastPath(req,res,body)');
  assert.ok(selfIndex>=0&&modernIndex>selfIndex);
  assert.match(chat,/X-WAE-Self-Awareness/);
  assert.match(chat,/self-awareness-v99/);
  assert.match(caps,/selfAwarenessCapabilitiesV99/);
  assert.match(caps,/selfAwareness:/);
});

test('v99 capability contract preserves strict benchmark-scoped claim discipline',()=>{
  const caps=selfAwarenessCapabilitiesV99();
  assert.equal(caps.version,SELF_AWARENESS_V99);
  assert.equal(caps.exactPremiumReference,'openai:gpt-6-astra');
  assert.equal(caps.requiredVerifiedCases,64);
  assert.equal(caps.falseSuperiorityClaimsBlocked,true);
  assert.equal(caps.benchmarkScopedClaimsOnly,true);
});
