import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import chatHandler from '../api/chat.js';
import { extractCoreUserQuery, adaptiveResponseContract, shouldEvidenceRescue, edgeRequestPolicy } from '../lib/providers.js';
import { researchRescueEligible, rescueMission } from '../lib/intelligence-rescue.js';
import { answerAssuranceEligibleV101, assuranceRecoveryPlanV101, boundedContinuityTextV101, buildBoundedContinuityV101 } from '../lib/answer-assurance-v101.js';
import { contextualFollowupV103, contextIntegrityInstructionV103, identityGroundingReportV103, contextualCoherenceReportV103 } from '../lib/context-integrity-v103.js';

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

test('chat serves grounded intelligence self-awareness before provider routing', async () => {
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.44'},body:{message:'¿Qué tan inteligente eres?',mode:'general'}};
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'grounded-self-awareness-v103');
  assert.equal(headers['x-wae-answer-assurance'],'v101');
  assert.equal(headers['x-wae-context-integrity'],'v103');
  assert.equal(res.payload?.provider,'universal_core');
  assert.equal(res.payload?.fast_lane,true);
  assert.match(res.payload?.reply||'',/pruebas|mide|competitivo/i);
  assert.equal(res.payload?.self_awareness?.answerAssurance?.version,'answer-assurance/v101');
  assert.equal(res.payload?.self_awareness?.contextIntegrity?.version,'context-integrity/v103');
  assert.equal(res.payload?.self_awareness?.claimPolicy?.globalNumberOneClaimAllowed,false);
  assert.equal(Array.isArray(res.payload?.web_sources),true);
  assert.equal(res.payload.web_sources.length,0);
});

test('hardware self-awareness never adopts provider identity', async () => {
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.49'},body:{message:'Tu tienes GPUs?',mode:'general'}};
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'grounded-self-awareness-v103');
  assert.equal(res.payload?.provider,'universal_core');
  assert.match(res.payload?.reply||'',/Universal Core|WAE OS Enterprise/i);
  assert.doesNotMatch(res.payload?.reply||'',/soy.*Google|soy.*NVIDIA|pertenezco.*Google|pertenezco.*NVIDIA/i);
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

test('capabilities prompt uses grounded self-awareness and exposes verified continuity capability', async () => {
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.46'},body:{message:'Cuales son tus capacidades?',mode:'general'}};
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'grounded-self-awareness-v103');
  assert.equal(res.payload?.provider,'universal_core');
  assert.equal(res.payload?.fast_lane,true);
  assert.equal(Array.isArray(res.payload?.web_sources),true);
  assert.equal(res.payload.web_sources.length,0);
  assert.match(res.payload?.reply||'',/Razonamiento|Investigación|Ingeniería|Continuidad v101|Context Integrity v103/i);
  assert.equal(res.payload?.self_awareness?.capabilities?.answerAssurance,true);
  assert.equal(res.payload?.self_awareness?.answerAssurance?.absoluteQualityGuarantee,false);
  assert.doesNotMatch(res.payload?.reply||'',/cdc|swine|google/i);
});

test('competitor comparison is fail-closed and benchmark-scoped', async () => {
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.48'},body:{message:'¿Universal Core supera a GPT Astra?',mode:'general'}};
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'grounded-self-awareness-v103');
  assert.equal(res.payload?.self_awareness?.claimPolicy?.benchmarkScopedEvidenceOnly,true);
  assert.match(res.payload?.reply||'',/no debo afirmar|CERTIFIED|pruebas medibles/i);
});

test('v103 recognizes short dependent turns and anchors them to the last assistant message', () => {
  const history=[
    {role:'user',text:'Tu tienes GPUs?'},
    {role:'assistant',text:'No poseo GPUs físicas propias. Puedo usar infraestructura de cómputo habilitada por el runtime.'}
  ];
  assert.equal(contextualFollowupV103('Sí',history),true);
  const instruction=contextIntegrityInstructionV103({message:'Sí',history});
  assert.match(instruction,/continuación dependiente del contexto/i);
  assert.match(instruction,/GPUs físicas propias/i);
  const drift=contextualCoherenceReportV103({message:'Sí',history,answer:'Entendido. Ajustaré la extensión de mis respuestas.'});
  assert.equal(drift.required,true);
  assert.equal(drift.pass,false);
});

test('v103 blocks provider-brand identity drift on infrastructure questions', () => {
  const report=identityGroundingReportV103({question:'Tu tienes GPUs?',answer:'Como modelo, soy software que se ejecuta en centros de datos de Google.'});
  assert.equal(report.selfQuestion,true);
  assert.equal(report.providerIdentityDrift,true);
  assert.equal(report.pass,false);
});

test('answer assurance v101 treats runtime deadline as recoverable without research tail', () => {
  const error={code:'RUNTIME_DEADLINE',statusCode:504};
  assert.equal(answerAssuranceEligibleV101(error),true);
  const plan=assuranceRecoveryPlanV101(error);
  assert.equal(plan.deadline,true);
  assert.deepEqual(plan.stages,['local_rescue','emergency_generation','bounded_continuity']);
  assert.equal(plan.rescueBudgetMs,1500);
  assert.equal(plan.emergencyBudgetMs,6000);
});

test('answer assurance v101 treats provider collapse and low quality as recoverable', () => {
  for(const code of ['NO_PROVIDER','ALL_PROVIDERS_FAILED','LOW_QUALITY']){
    const plan=assuranceRecoveryPlanV101({code});
    assert.equal(plan.eligible,true,code);
    assert.equal(plan.deadline,false,code);
    assert.deepEqual(plan.stages,['specialized_rescue','emergency_generation','bounded_continuity']);
  }
});

test('bounded continuity never fabricates current or high-stakes facts', () => {
  const text=boundedContinuityTextV101({message:'Dime el precio actual y la ley vigente hoy para esta operación legal.'},{code:'ALL_PROVIDERS_FAILED'});
  assert.match(text,/evidencia verificable|No voy a completar datos actuales/i);
  assert.doesNotMatch(text,/\$\d|artículo \d|según la ley/i);
});

test('bounded continuity produces a valid non-empty assistant envelope instead of a transport error', () => {
  const result=buildBoundedContinuityV101({body:{message:'Diseña una estrategia completa para mi producto.',mode:'executive'},userKey:'test',error:{code:'RUNTIME_DEADLINE'}});
  assert.equal(result?.success,true);
  assert.equal(result?.provider,'universal_core');
  assert.equal(result?.model,'universal-core-assurance-v101');
  assert.equal(result?.answer_assurance?.version,'answer-assurance/v101');
  assert.equal(result?.answer_assurance?.finalSafeFallback,true);
  assert.ok(String(result?.reply||'').length>80);
});

test('chat edge wires timeout recovery to emergency generation and bounded continuity', () => {
  const source=readFileSync(new URL('../api/chat.js',import.meta.url),'utf8');
  assert.match(source,/assuranceRecoveryPlanV101/);
  assert.match(source,/allowResearch:!assurance\.deadline/);
  assert.match(source,/emergencyGenerate/);
  assert.match(source,/bounded-continuity-v101/);
  assert.match(source,/X-WAE-Answer-Assurance/);
  assert.match(source,/contextualFollowupV103/);
  assert.doesNotMatch(source,/error\?\.code !== 'RUNTIME_DEADLINE' && recoverableRuntimeError/);
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

test('mobile canonical v103 preserves explicit history and stable conversation identity', () => {
  const source=readFileSync(new URL('../mobile-canonical-chat-v80.js',import.meta.url),'utf8');
  assert.match(source,/mobile-canonical-chat\/v103-context/);
  assert.match(source,/history,/);
  assert.match(source,/wae\.contextSession\.v103/);
  assert.match(source,/wae\.conversationId\.v103/);
  assert.match(source,/storedHistory/);
  assert.match(source,/rotateConversation/);
});

test('native mobile shell boots the real same-origin chat and independent Canvas adapter', () => {
  const server=readFileSync(new URL('../server.js',import.meta.url),'utf8');
  const mobile=readFileSync(new URL('../api/mobile.js',import.meta.url),'utf8');
  const canvas=readFileSync(new URL('../canvas-native-mobile-v1.js',import.meta.url),'utf8');
  assert.match(server,/return mobileHandler\(req,res\)/);
  assert.match(server,/same-origin-native-first-v115/);
  assert.match(server,/visible-answer-commit\/v114/);
  assert.match(mobile,/id="composer"/);
  assert.match(mobile,/\/api\/chat/);
  assert.match(mobile,/canvas-native-mobile-v1\.js\?v=1/);
  assert.match(canvas,/\/api\/canvas/);
  assert.match(canvas,/wncPreview/);
  assert.match(canvas,/wncRefine/);
});

test('service worker v34 evicts stale cache and makes navigations network-first', () => {
  const source=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(source,/wae-universal-v34-adaptive-mesh/);
  assert.match(source,/client\.navigate/);
  assert.match(source,/fetch\(req,\{cache:'no-store'\}\)/);
  assert.doesNotMatch(source,/wae-universal-v23-progressive-boot/);
});
