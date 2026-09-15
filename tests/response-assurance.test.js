import test from 'node:test';
import assert from 'node:assert/strict';
import chatHandler from '../api/chat.js';
import { extractCoreUserQuery, adaptiveResponseContract, shouldEvidenceRescue, edgeRequestPolicy } from '../lib/providers.js';
import { researchRescueEligible, rescueMission } from '../lib/intelligence-rescue.js';

test('extractCoreUserQuery removes routing, memory and tool context', () => {
  const input='Investiga y verifica con evidencia web reciente antes de responder. Distingue hechos verificados de inferencias y cita las fuentes disponibles.\n\n¿Qué es una API REST?\n\nMEMORIA RECUPERADA (contexto previo potencialmente relevante):\n1. dato viejo\n\nEVIDENCIA DE HERRAMIENTAS (usa solo lo observado; no inventes ejecuciones):\n[web_search] OK';
  assert.equal(extractCoreUserQuery(input),'¿Qué es una API REST?');
});

test('factual API question gets factual response contract, not coding contract', () => {
  const contract=adaptiveResponseContract('¿Qué es una API REST?');
  assert.match(contract,/pregunta factual/i);
  assert.doesNotMatch(contract,/ingeniería de producción/i);
});

test('casual and exact-format prompts never trigger evidence rescue', () => {
  assert.equal(researchRescueEligible('Hola, ¿qué tan inteligente eres?','general'),false);
  assert.equal(researchRescueEligible('Responde exactamente con la palabra OK.','general'),false);
  assert.equal(shouldEvidenceRescue('Escribe un poema corto.'),false);
});

test('factual and current questions remain eligible for evidence rescue', () => {
  assert.equal(researchRescueEligible('¿Qué es una API REST y cuáles son sus errores de diseño comunes?','general'),true);
  assert.equal(researchRescueEligible('Investiga las noticias actuales sobre semiconductores.','general'),true);
  assert.equal(edgeRequestPolicy('Noticias actuales de semiconductores').webEnabled,true);
});

test('deterministic protocol returns exact OK without web search', async () => {
  const result=await rescueMission({payload:{message:'Responde exactamente con la palabra OK.',mode:'general'},userKey:'test',error:{code:'ALL_PROVIDERS_FAILED'}});
  assert.equal(result?.reply,'OK');
  assert.equal(result?.provider,'universal_core_protocol');
  assert.equal(result?.resilience?.path,'deterministic_protocol');
});

test('chat serves intelligence meta prompt before provider routing', async () => {
  const headers={};
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.44'},body:{message:'¿Qué tan inteligente eres?',mode:'general'}};
  const res={
    statusCode:200,
    setHeader(name,value){headers[String(name).toLowerCase()]=String(value);},
    status(code){this.statusCode=code;return this;},
    json(payload){this.payload=payload;return this;}
  };
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'deterministic-protocol-v1');
  assert.equal(res.payload?.provider,'universal_core_protocol');
  assert.equal(res.payload?.fast_lane,true);
  assert.match(res.payload?.reply||'',/Soy Universal Core/i);
  assert.equal(Array.isArray(res.payload?.web_sources),true);
  assert.equal(res.payload.web_sources.length,0);
});
