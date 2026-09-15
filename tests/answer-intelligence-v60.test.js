import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAnswerIntelligence, applyAnswerIntelligence, answerIntelligenceCapabilities } from '../lib/answer-intelligence-v60.js';

test('v60 recognizes valid claim citations against retrieved sources',()=>{
  const payload={
    reply:'El informe fue publicado en 2026 [W1]. La cifra reportada fue 42 por ciento [W1].',
    web_sources:[{key:'W1',title:'Fuente',url:'https://example.com/source'}]
  };
  const audit=auditAnswerIntelligence(payload);
  assert.equal(audit.invalid_citations.length,0);
  assert.equal(audit.factual_claims>=2,true);
  assert.equal(audit.supported_factual_claims,audit.factual_claims);
  assert.equal(audit.citation_coverage,1);
  assert.equal(audit.gate,'PASS');
});

test('v60 detects and strips citations that do not exist in evidence',()=>{
  const payload={
    reply:'El reporte fue publicado en 2026 [W9].',
    web_sources:[{key:'W1',title:'Fuente',url:'https://example.com/source'}]
  };
  const audit=auditAnswerIntelligence(payload);
  assert.deepEqual(audit.invalid_citations,['W9']);
  assert.equal(audit.gate,'REPAIR');
  const applied=applyAnswerIntelligence(payload);
  assert.equal(applied.reply.includes('[W9]'),false);
  assert.equal(applied.response.metadata.answerIntelligence.gate,'REPAIR');
});

test('v60 distinguishes opinion and inference from factual claims',()=>{
  const payload={reply:'En mi opinión, conviene priorizar seguridad. Probablemente este enfoque reduzca errores.'};
  const audit=auditAnswerIntelligence(payload);
  assert.equal(audit.opinion_claims>=1,true);
  assert.equal(audit.inference_claims>=1,true);
  assert.equal(audit.factual_claims,0);
  assert.equal(audit.gate,'PASS');
});

test('v60 marks externally unsupported factual output as unverified rather than certified',()=>{
  const payload={reply:'La compañía fue fundada en 2024 y tiene 300 empleados.'};
  const audit=auditAnswerIntelligence(payload);
  assert.equal(audit.factual_claims>=1,true);
  assert.equal(audit.source_count,0);
  assert.equal(audit.gate,'UNVERIFIED');
  assert.equal(audit.risk,'medium');
});

test('v60 holds live factual claims when live path exposes no evidence',()=>{
  const payload={
    reply:'El precio actual es 99 pesos.',
    live_data:{used:true},
    response:{metadata:{liveDataMesh:'live-data-mesh/v58'}}
  };
  const audit=auditAnswerIntelligence(payload);
  assert.equal(audit.gate,'HOLD');
  assert.equal(audit.reason,'live_claim_without_live_evidence');
});

test('v60 capability surface never claims base model training',()=>{
  const capabilities=answerIntelligenceCapabilities();
  assert.equal(capabilities.version,'answer-intelligence/v60');
  assert.equal(capabilities.invalidCitationFailClosed,true);
  assert.equal(capabilities.baseModelTraining,false);
});
