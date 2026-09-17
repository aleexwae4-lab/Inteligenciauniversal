import test from 'node:test';
import assert from 'node:assert/strict';
import capacityChatV86 from '../api/capacity-chat-v86.js';
import { conversationRoutingClassV105 } from '../api/capacity-chat-v105.js';
import { edgeGenerativeRescueEligible } from '../lib/intelligence-rescue.js';
import { classifyFactualityRequest, factualityDecision, factualityGateCapabilities } from '../lib/factuality-gate-v86.js';

test('v86 live chat handler loads',()=>{
  assert.equal(typeof capacityChatV86,'function');
});

test('v86 requires verification for current information',()=>{
  const profile=classifyFactualityRequest({message:'¿Quién es el presidente actual de esta organización?'});
  assert.equal(profile.current,true);
  assert.equal(profile.requires_verification,true);
  assert.equal(profile.preferred_repair,'research');
});

test('stable factual prompts stay on premium brain and keep Edge as post-failure rescue',()=>{
  const message='¿Sabes qué es un termostato?';
  assert.equal(conversationRoutingClassV105({message,mode:'general',provider:'auto'}),'premium');
  assert.equal(edgeGenerativeRescueEligible(message,'general'),true);
  assert.equal(edgeGenerativeRescueEligible('Dime el precio actual de Bitcoin','general'),false);
});

test('ordinary explanations default to premium generation',()=>{
  assert.equal(conversationRoutingClassV105({message:'Explícame cómo funciona la fotosíntesis',mode:'general',provider:'auto'}),'premium');
  assert.equal(conversationRoutingClassV105({message:'Dime por qué el cielo se ve azul',mode:'general',provider:'auto'}),'premium');
});

test('casual capability questions route to grounded Universal Core self-awareness',()=>{
  assert.equal(conversationRoutingClassV105({message:'Hola que sabes?',mode:'general',provider:'auto'}),'capabilities');
  assert.equal(conversationRoutingClassV105({message:'¿Qué sabes hacer?',mode:'general',provider:'auto'}),'capabilities');
});

test('ordinary creation prompts bypass factual retrieval but verified domains do not',()=>{
  assert.equal(conversationRoutingClassV105({message:'Crea un contacto sobre que es la ciencia',mode:'general',provider:'auto'}),'creative');
  assert.equal(conversationRoutingClassV105({message:'Crea un texto breve sobre qué es la ciencia',mode:'general',provider:'auto'}),'creative');
  assert.equal(conversationRoutingClassV105({message:'Crea un informe con fuentes actuales sobre una reforma legal',mode:'general',provider:'auto'}),'legacy');
  assert.equal(conversationRoutingClassV105({message:'Crea un resumen de un diagnóstico médico actual',mode:'general',provider:'auto'}),'legacy');
});

test('v86 blocks precise factual answers without evidence',()=>{
  const payload={
    reply:'La persona nació en 1978.',
    answer_intelligence:{gate:'UNVERIFIED',source_count:0,cited_source_count:0,factual_claims:1,citation_coverage:0}
  };
  const decision=factualityDecision(payload,{message:'¿Cuándo nació esa persona?'});
  assert.equal(decision.accept,false);
  assert.equal(decision.requires_repair,true);
  assert.equal(decision.reasons.includes('verification_required_without_evidence'),true);
  assert.equal(decision.reasons.includes('answer_gate_unverified'),true);
});

test('v86 accepts source-backed precise facts only when evidence is actually cited',()=>{
  const payload={
    reply:'La persona nació en 1978 [K1].',
    web_sources:[{key:'K1',url:'https://example.com/source'}],
    answer_intelligence:{gate:'PASS',source_count:1,cited_source_count:1,factual_claims:1,citation_coverage:1}
  };
  const decision=factualityDecision(payload,{message:'¿Cuándo nació esa persona?'});
  assert.equal(decision.accept,true);
  assert.equal(decision.requires_repair,false);
});

test('v86 does not accept decorative sources with no citation binding',()=>{
  const payload={
    reply:'La persona nació en 1978.',
    web_sources:[{key:'K1',url:'https://example.com/source'}],
    answer_intelligence:{gate:'PASS',source_count:1,cited_source_count:0,factual_claims:0,citation_coverage:1}
  };
  const decision=factualityDecision(payload,{message:'¿Cuándo nació esa persona?'});
  assert.equal(decision.accept,false);
  assert.equal(decision.reasons.includes('evidence_present_but_uncited'),true);
});

test('v86 blocks under-cited material factual output even when sources exist',()=>{
  const payload={
    reply:'Dato uno [K1]. Dato dos sin cita.',
    web_sources:[{key:'K1',url:'https://example.com/source'}],
    answer_intelligence:{gate:'REVIEW',source_count:1,cited_source_count:1,factual_claims:2,citation_coverage:.5}
  };
  const decision=factualityDecision(payload,{message:'¿Quién fundó la empresa y cuándo ocurrió?'});
  assert.equal(decision.accept,false);
  assert.equal(decision.reasons.includes('answer_gate_review'),true);
  assert.equal(decision.reasons.includes('material_claims_under_cited'),true);
});

test('v86 does not force evidence for creative transformation prompts',()=>{
  const profile=classifyFactualityRequest({message:'Escribe un mensaje breve de agradecimiento'});
  assert.equal(profile.transform,true);
  assert.equal(profile.requires_verification,false);
  const decision=factualityDecision({reply:'Gracias por tu apoyo.'},{message:'Escribe un mensaje breve de agradecimiento'});
  assert.equal(decision.accept,true);
});

test('v86 treats high-impact medical facts as verify-before-accept',()=>{
  const profile=classifyFactualityRequest({message:'¿Cuál es la dosis actual de este medicamento?'});
  assert.equal(profile.high_risk,true);
  assert.equal(profile.high_impact_fact,true);
  assert.equal(profile.requires_verification,true);
  assert.equal(profile.preferred_repair,'research');
});

test('v86 does not confuse a legal analysis request with a factual lookup',()=>{
  const profile=classifyFactualityRequest({message:'Analiza este contrato legal y señala cláusulas ambiguas.'});
  assert.equal(profile.high_risk,true);
  assert.equal(profile.high_impact_fact,false);
  assert.equal(profile.requires_verification,false);
});

test('v86 does not treat generic cuál recommendations as precise factual questions',()=>{
  const profile=classifyFactualityRequest({message:'¿Cuál estrategia recomiendas para mejorar la experiencia de usuario?'});
  assert.equal(profile.precise_fact,false);
  assert.equal(profile.requires_verification,false);
});

test('v86 still verifies legal claims that assert a concrete legal status',()=>{
  const profile=classifyFactualityRequest({message:'¿Esto es legal actualmente en México?'});
  assert.equal(profile.high_risk,true);
  assert.equal(profile.high_impact_fact,true);
  assert.equal(profile.requires_verification,true);
});

test('v86 capabilities prohibit promotion of unverified factual output',()=>{
  const capabilities=factualityGateCapabilities();
  assert.equal(capabilities.policy,'verify-before-accept');
  assert.equal(capabilities.failClosedWhenEvidenceMissing,true);
  assert.equal(capabilities.requireCitedEvidence,true);
  assert.equal(capabilities.unverifiedPromotion,false);
  assert.equal(capabilities.minimumMaterialCitationCoverage,.6);
});
