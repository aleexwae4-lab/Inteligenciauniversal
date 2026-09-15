import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTruthSpeedPolicy, planRuntimeTools, auditGrounding, truthSpeedCapabilities } from '../lib/truth-speed.js';
import { evaluateAnswer, inferCognitivePolicy } from '../lib/quality.js';

test('stable factual questions stay on the fast policy without mandatory web evidence',()=>{
  const policy=deriveTruthSpeedPolicy({message:'¿Qué es un diodo?',mode:'general'});
  assert.equal(policy.complexity,'fast');
  assert.equal(policy.evidenceRequired,false);
  assert.equal(policy.timeoutMs,22000);
});

test('local document evidence is not mistaken for a web research request',()=>{
  const policy=deriveTruthSpeedPolicy({message:'Conserva la evidencia del archivo.',mode:'general'});
  const cognitive=inferCognitivePolicy('Conserva la evidencia del archivo.','general');
  assert.equal(policy.evidenceRequired,false);
  assert.equal(policy.research,false);
  assert.equal(cognitive.mode,'general');
  assert.equal(cognitive.autoResearch,false);
  const quality=evaluateAnswer({question:'Conserva la evidencia del archivo.',answer:'Conservé la evidencia: 4200 MXN.',mode:'general',sources:[]});
  assert.equal(quality.critical,false);
});

test('current and high-risk questions require evidence and fail closed',()=>{
  const current=deriveTruthSpeedPolicy({message:'¿Cuál es la reforma fiscal más reciente en México?',mode:'general'});
  const medical=deriveTruthSpeedPolicy({message:'¿Qué dosis de este medicamento debo tomar?',mode:'general'});
  assert.equal(current.evidenceRequired,true);
  assert.equal(medical.evidenceRequired,true);
  assert.equal(medical.highRisk,true);
  const quality=evaluateAnswer({question:'¿Qué dosis de este medicamento debo tomar?',answer:'Toma 20 mg cada ocho horas.',mode:'general',sources:[]});
  assert.equal(quality.critical,true);
  assert.equal(quality.pass,false);
  assert.ok(quality.reasons.includes('grounding:missing_required_evidence'));
});

test('unsupported links are rejected even when an answer sounds plausible',()=>{
  const policy=deriveTruthSpeedPolicy({message:'Investiga el mercado actual de IA',mode:'research'});
  const grounding=auditGrounding({
    answer:'La cifra está confirmada en https://inventado.example/reporte [W1].',
    sources:[{url:'https://real.example/reporte'}],
    policy
  });
  assert.equal(grounding.hardFailure,true);
  assert.ok(grounding.reasons.includes('unsupported_url'));
});

test('citation indexes cannot point to nonexistent sources',()=>{
  const policy=deriveTruthSpeedPolicy({message:'Investiga datos actuales',mode:'research'});
  const grounding=auditGrounding({answer:'El dato aparece en [W2].',sources:[{url:'https://example.com/a'}],policy});
  assert.equal(grounding.invalidCitation,true);
  assert.equal(grounding.hardFailure,true);
});

test('default Edge path avoids duplicate web preflight while explicit tools are preserved',()=>{
  const auto=planRuntimeTools({agentTools:['web_search','github_search'],requestedTools:[],message:'Investiga el precio actual del producto',mode:'executive',provider:'auto'});
  assert.deepEqual(auto.tools,[]);
  const explicit=planRuntimeTools({agentTools:['web_search'],requestedTools:['web_search'],message:'Investiga el precio actual del producto',mode:'research',provider:'auto'});
  assert.deepEqual(explicit.tools,['web_search']);
});

test('GitHub search only runs when repository context is relevant',()=>{
  const irrelevant=planRuntimeTools({agentTools:['github_search'],message:'Escribe una función para sumar dos números',mode:'code',provider:'auto'});
  const relevant=planRuntimeTools({agentTools:['github_search'],message:'Revisa el archivo del repo en GitHub y corrige el bug',mode:'code',provider:'auto'});
  assert.deepEqual(irrelevant.tools,[]);
  assert.deepEqual(relevant.tools,['github_search']);
});

test('capabilities expose fail-closed grounding and adaptive budgets',()=>{
  const caps=truthSpeedCapabilities();
  assert.equal(caps.version,'truth-speed-governor/v36');
  assert.equal(caps.evidenceFailClosed,true);
  assert.equal(caps.unsupportedUrlFailClosed,true);
  assert.equal(caps.baseModelTraining,false);
});
