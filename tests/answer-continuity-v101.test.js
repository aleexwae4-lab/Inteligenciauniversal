import test from 'node:test';
import assert from 'node:assert/strict';
import { answerIsUsableV101, shouldRecoverAnswerV101, classifyContinuityIntentV101, localContinuityReplyV101, continuityEnvelopeV101, answerContinuityCapabilitiesV101, ANSWER_CONTINUITY_V101 } from '../lib/answer-continuity-v101.js';

test('v101 continuity capabilities block empty terminal answers',()=>{
  const caps=answerContinuityCapabilitiesV101();
  assert.equal(caps.version,ANSWER_CONTINUITY_V101);
  assert.equal(caps.emptyTerminalAnswersBlocked,true);
  assert.equal(caps.securityAndAuthorizationFailuresRemainFailClosed,true);
  assert.equal(caps.rateLimitsRemainFailClosed,true);
});

test('normal quality answer is accepted',()=>{
  assert.equal(answerIsUsableV101(200,{reply:'Una respuesta útil, concreta y verificable.'}),true);
  assert.equal(shouldRecoverAnswerV101(200,{reply:'Una respuesta útil, concreta y verificable.'}),false);
});

test('empty and generic provider failures trigger recovery',()=>{
  assert.equal(answerIsUsableV101(200,{reply:''}),false);
  assert.equal(shouldRecoverAnswerV101(200,{reply:''}),true);
  assert.equal(answerIsUsableV101(200,{reply:'No pude completar la respuesta con los proveedores disponibles. Intenta nuevamente.'}),false);
  assert.equal(shouldRecoverAnswerV101(200,{reply:'No pude completar la respuesta con los proveedores disponibles. Intenta nuevamente.'}),true);
  assert.equal(shouldRecoverAnswerV101(503,{error:'CAPACITY_BUSY',recoverable:true}),true);
});

test('security, method and rate limiting never enter recovery bypass',()=>{
  assert.equal(shouldRecoverAnswerV101(401,{error:'UNAUTHORIZED'}),false);
  assert.equal(shouldRecoverAnswerV101(403,{error:'ORIGIN_NOT_ALLOWED'}),false);
  assert.equal(shouldRecoverAnswerV101(405,{error:'METHOD_NOT_ALLOWED'}),false);
  assert.equal(shouldRecoverAnswerV101(429,{error:'RATE_LIMITED'}),false);
  assert.equal(shouldRecoverAnswerV101(429,{error:'SPECIALIST_RATE_LIMITED'}),false);
});

test('continuity intent classifier separates factual, engineering and transformation tasks',()=>{
  assert.equal(classifyContinuityIntentV101({message:'¿Cuál es el precio actual del dólar?'}),'current_factual');
  assert.equal(classifyContinuityIntentV101({message:'Debug este backend TypeScript'}),'engineering');
  assert.equal(classifyContinuityIntentV101({message:'Reescribe este correo'}),'transformation');
  assert.equal(classifyContinuityIntentV101({message:'¿Qué capacidades tienes Universal Core?'}),'self_awareness');
});

test('local arithmetic remains useful even with every generator unavailable',()=>{
  const reply=localContinuityReplyV101({message:'100 x 200'});
  assert.equal(reply,'100 x 200 = **20000**');
});

test('current factual degradation refuses fabrication',()=>{
  const reply=localContinuityReplyV101({message:'Dame las noticias actuales de hoy'});
  assert.match(reply,/no inventar/i);
  assert.match(reply,/fuentes verificadas/i);
});

test('continuity envelope is a non-empty degraded response with traceability',()=>{
  const envelope=continuityEnvelopeV101({body:{message:'Analiza esta arquitectura backend'},failure:{error:'ALL_PROVIDERS_FAILED'}});
  assert.equal(envelope.success,true);
  assert.equal(envelope.degraded,true);
  assert.equal(typeof envelope.reply,'string');
  assert.ok(envelope.reply.length>60);
  assert.equal(envelope.answer_continuity.version,ANSWER_CONTINUITY_V101);
  assert.equal(envelope.answer_continuity.terminal_empty_state_prevented,true);
  assert.equal(envelope.response.metadata.answerContinuity.terminalEmptyStatePrevented,true);
});
