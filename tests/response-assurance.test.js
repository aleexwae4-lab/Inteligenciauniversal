import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  assert.equal(researchRescueEligible('Hola, ¿cómo te sientes?','general'),false);
  assert.equal(researchRescueEligible('Responde exactamente con la palabra OK.','general'),false);
  assert.equal(shouldEvidenceRescue('Escribe un poema corto.'),false);
  assert.equal(shouldEvidenceRescue('¿Cuáles son tus capacidades?'),false);
  assert.equal(shouldEvidenceRescue('¿Cómo funcionas?'),false);
});

test('factual and current questions remain eligible for evidence rescue', () => {
  assert.equal(researchRescueEligible('¿Qué es una API REST y cuáles son sus errores de diseño comunes?','general'),true);
  assert.equal(researchRescueEligible('Investiga las noticias actuales sobre semiconductores.','general'),true);
  assert.equal(edgeRequestPolicy('Noticias actuales de semiconductores').webEnabled,true);
  assert.equal(shouldEvidenceRescue('¿Qué es una API REST?'),true);
});

test('deterministic protocol returns exact OK without web search', async () => {
  const result=await rescueMission({payload:{message:'Responde exactamente con la palabra OK.',mode:'general'},userKey:'test',error:{code:'ALL_PROVIDERS_FAILED'}});
  assert.equal(result?.reply,'OK');
  assert.equal(result?.provider,'universal_core_protocol');
  assert.equal(result?.resilience?.path,'deterministic_protocol');
});

function fakeResponse(){
  const headers={};
  return {
    headers,
    res:{
      statusCode:200,
      writableEnded:false,
      setHeader(name,value){headers[String(name).toLowerCase()]=String(value);},
      status(code){this.statusCode=code;return this;},
      json(payload){this.payload=payload;this.writableEnded=true;return this;}
    }
  };
}

test('chat serves intelligence meta prompt before provider routing', async () => {
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.44'},body:{message:'¿Qué tan inteligente eres?',mode:'general'}};
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'deterministic-protocol-v4');
  assert.equal(res.payload?.provider,'universal_core_protocol');
  assert.equal(res.payload?.fast_lane,true);
  assert.match(res.payload?.reply||'',/Soy Universal Core/i);
  assert.equal(Array.isArray(res.payload?.web_sources),true);
  assert.equal(res.payload.web_sources.length,0);
});

test('casual feeling greeting is answered locally and never leaks web recovery', async () => {
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.45'},body:{message:'Hola, ¿cómo te sientes?',mode:'general'}};
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'deterministic-protocol-v4');
  assert.equal(res.payload?.provider,'universal_core_protocol');
  assert.equal(res.payload?.fast_lane,true);
  assert.equal(Array.isArray(res.payload?.web_sources),true);
  assert.equal(res.payload.web_sources.length,0);
  assert.doesNotMatch(res.payload?.reply||'',/evidencia recuperada|rutas generativas|cdc|swine|google/i);
});

test('mobile Auto greeting bypasses providers and returns deterministic protocol immediately', async () => {
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.47'},body:{message:'Hola cómo estás ?',mode:'auto'}};
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'deterministic-protocol-v4');
  assert.equal(res.payload?.provider,'universal_core_protocol');
  assert.equal(res.payload?.fast_lane,true);
  assert.match(res.payload?.reply||'',/Muy bien|listo/i);
  assert.doesNotMatch(res.payload?.reply||'',/no llegó completa|recuperando|evidencia recuperada|rutas generativas|saturadas/i);
});

test('capabilities prompt from the clip bypasses saturated providers entirely', async () => {
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.46'},body:{message:'Cuales son tus capacidades?',mode:'general'}};
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'deterministic-protocol-v4');
  assert.equal(res.payload?.provider,'universal_core_protocol');
  assert.equal(res.payload?.fast_lane,true);
  assert.equal(Array.isArray(res.payload?.web_sources),true);
  assert.equal(res.payload.web_sources.length,0);
  assert.match(res.payload?.reply||'',/analizar|investigar|programar/i);
  assert.doesNotMatch(res.payload?.reply||'',/evidencia recuperada|rutas generativas|saturadas|cdc|swine|google/i);
});

test('provider fallback no longer converts ordinary generation failure into automatic web recovery', () => {
  const source=readFileSync(new URL('../lib/providers.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/automatic_evidence_rescue/);
  assert.match(source,/for\(const p of ordered\)/);
  assert.match(source,/ALL_PROVIDERS_FAILED/);
  assert.match(source,/REQUEST_CANCELLED/);
});

test('mobile interceptor routes intelligence meta prompts away from irrelevant web recovery', () => {
  const source=readFileSync(new URL('../mobile-v26.js',import.meta.url),'utf8');
  assert.match(source,/que tan inteligente eres/);
  assert.match(source,/como te sientes/);
  assert.match(source,/provider==='web_recovery'/);
  assert.match(source,/protocolPrompt\(body\?\.message\)/);
  assert.match(source,/irrelevant_recovery_blocked/);
});

test('mobile v47 bridges Edge chat to Render with single-attempt backpressure', () => {
  const bridge=readFileSync(new URL('../mobile-runtime-v47.js',import.meta.url),'utf8');
  assert.match(bridge,/\/api\/chat/);
  assert.match(bridge,/delete body\.routing_variant/);
  assert.match(bridge,/v47-long-session-backpressure/);
  assert.match(bridge,/saturation_fallback_rejected/);
  assert.match(bridge,/singleAttempt:true/);
  assert.match(bridge,/x-wae-mobile-attempt':'1'/);
  assert.doesNotMatch(bridge,/routing_variant:'control'/);
  assert.doesNotMatch(bridge,/RETRYABLE_STATUS/);
});

test('mobile boot loads telemetry and v47 backpressure before bootstrap and voice layers', () => {
  const source=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  const fast=source.indexOf("fast-lane-v23.js?v=34");
  const cognitive=source.indexOf("mobile-v26.js?v=34");
  const telemetry=source.indexOf("telemetry-throttle-v47.js?v=47");
  const bridge=source.indexOf("mobile-runtime-v47.js?v=47");
  const bootstrap=source.indexOf("mobile-bootstrap-v45.js?v=45");
  const semantic=source.indexOf("semantic-ux-v32.js?v=46");
  const lifecycle=source.indexOf("speech-lifecycle-v46.js?v=46");
  const voice=source.indexOf("mobile-voice-v46.js?v=46");
  assert.ok(fast>=0 && cognitive>=0 && telemetry>=0 && bridge>=0 && bootstrap>=0 && semantic>=0 && lifecycle>=0 && voice>=0);
  assert.ok(fast<cognitive && cognitive<telemetry && telemetry<bridge && bridge<bootstrap && bootstrap<semantic && semantic<lifecycle && lifecycle<voice);
  assert.match(source,/universal-core-mobile-v47-long-session/);
  assert.match(source,/long-session-backpressure-v47/);
  assert.doesNotMatch(source,/mobile-runtime-v34\.js\?v=44/);
  assert.doesNotMatch(source,/mobile-voice-v27\.js/);
});

test('service worker v34 evicts stale cache and makes navigations network-first', () => {
  const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(source,/wae-universal-v34-adaptive-mesh/);
  assert.match(source,/client\.navigate/);
  assert.match(source,/fetch\(req,\{cache:'no-store'\}\)/);
  assert.doesNotMatch(source,/wae-universal-v23-progressive-boot/);
});
