import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import capacityChatV91, { CAPACITY_CHAT_V91, capacityChatV91Capabilities } from '../api/capacity-chat-v91.js';
import { SPECIALIST_COPILOT_VERSION, planSpecialistCopilots, publicSpecialistPlan, specialistCopilotCapabilitiesV91, shouldRunSpecialistCouncilV91 } from '../lib/specialist-copilot-arsenal-v91.js';
import { shouldRunSpecialistSinglePassV91 } from '../lib/specialist-copilot-runtime-v91.js';

test('v91 exposes a broad specialist arsenal without claiming benchmark superiority',()=>{
  assert.equal(CAPACITY_CHAT_V91,'capacity-chat/v91-specialist-copilot-arsenal');
  assert.equal(SPECIALIST_COPILOT_VERSION,'specialist-copilot-arsenal/v91');
  assert.equal(typeof capacityChatV91,'function');
  const caps=specialistCopilotCapabilitiesV91();
  assert.ok(caps.specialistCount>=60);
  assert.ok(caps.domains.length>=10);
  assert.equal(caps.comparativeSuperiorityClaim,false);
  assert.equal(caps.benchmarkRequired,true);
  assert.equal(capacityChatV91Capabilities().policy.noUniversalSuperiorityClaimWithoutBenchmark,true);
});

test('software architecture missions automatically select technical copilots',()=>{
  const plan=planSpecialistCopilots({message:'Diseña y optimiza una arquitectura backend TypeScript con APIs, base de datos y baja latencia.',mode:'code'});
  const ids=plan.specialists.map(x=>x.id);
  assert.equal(plan.eligible,true);
  assert.ok(ids.includes('software_architect')||ids.includes('backend_engineer')||ids.includes('performance_engineer'));
  assert.ok(plan.specialists.length<=2);
  assert.equal(shouldRunSpecialistSinglePassV91(plan,{message:'Diseña y optimiza una arquitectura backend TypeScript con APIs, base de datos y baja latencia.',mode:'code'}),true);
});

test('medical questions activate high-impact specialist calibration',()=>{
  const body={message:'Analiza la evidencia médica y farmacológica de este tratamiento clínico.',mode:'analysis'};
  const plan=planSpecialistCopilots(body);
  assert.equal(plan.highImpact,true);
  assert.ok(plan.specialists.some(x=>['medical_evidence','pharmacology','academic_research'].includes(x.id)));
  assert.equal(publicSpecialistPlan(plan).high_impact,true);
});

test('explicit multidisciplinary requests use a bounded parallel council',()=>{
  const body={message:'Quiero varios especialistas: diseñen una estrategia que integre producto, software, seguridad y monetización.',mode:'analysis',multiagent:true};
  const plan=planSpecialistCopilots(body);
  assert.equal(plan.strategy,'parallel-council');
  assert.ok(plan.specialists.length>=2);
  assert.ok(plan.specialists.length<=3);
  assert.equal(shouldRunSpecialistCouncilV91(plan,body),true);
});

test('current information never bypasses the verified evidence pipeline for a specialist council',()=>{
  const body={message:'Usa varios especialistas para investigar las noticias actuales de inteligencia artificial hoy.',mode:'research',multiagent:true,web_enabled:true};
  const plan=planSpecialistCopilots(body);
  assert.equal(plan.current,true);
  assert.equal(shouldRunSpecialistCouncilV91(plan,body),false);
  assert.equal(shouldRunSpecialistSinglePassV91(plan,body),false);
});

test('simple factual questions stay out of the specialist single-pass lane',()=>{
  const body={message:'¿Qué es una base de datos relacional?',mode:'general'};
  const plan=planSpecialistCopilots(body);
  assert.equal(shouldRunSpecialistSinglePassV91(plan,body),false);
});

test('explicit continuity provider is routed directly before v89 recovery layers',async()=>{
  const source=await readFile(new URL('../api/capacity-chat-v90.js',import.meta.url),'utf8');
  const direct=source.indexOf('if(hasExplicitContinuityProvider(body))');
  const generic=source.indexOf('if(hasExplicitProvider(body))');
  const fusion=source.indexOf('runKnowledgeFusionV90({body:v90Body');
  assert.ok(direct>0);
  assert.ok(generic>direct);
  assert.ok(fusion>generic);
  assert.match(source,/return baseCapacityChatHandler\(req,res\)/);
  assert.match(source,/explicit-continuity-direct/);
  assert.match(source,/capacity-chat\/v90\.2-latency-autonomous-knowledge/);
});

test('public v60 alias advances through v106 to v91 and preserves v90 downstream',async()=>{
  const alias=await readFile(new URL('../api/capacity-chat-v60.js',import.meta.url),'utf8');
  const v106=await readFile(new URL('../api/capacity-chat-v106.js',import.meta.url),'utf8');
  const v91=await readFile(new URL('../api/capacity-chat-v91.js',import.meta.url),'utf8');
  assert.match(alias,/capacity-chat-v106\.js/);
  assert.match(v106,/capacity-chat-v91\.js/);
  assert.match(v91,/capacity-chat-v90\.js/);
  assert.match(v91,/runSpecialistCouncilV91/);
  assert.match(v91,/runSpecialistSinglePassV91/);
});
