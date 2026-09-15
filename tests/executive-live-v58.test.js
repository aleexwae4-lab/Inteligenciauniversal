import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldUseExecutiveOrchestrator, EXECUTIVE_ORCHESTRATION_VERSION } from '../lib/executive-orchestration-v58.js';

test('v58 mantiene comité ejecutivo disponible aun con web_enabled explícito',()=>{
  const body={
    message:'Analiza la estrategia actual de inteligencia artificial, riesgos legales, inversión y arquitectura tecnológica con datos recientes.',
    mode:'executive',web_enabled:true,multiagent:true
  };
  assert.equal(shouldUseExecutiveOrchestrator(body),true);
  assert.match(EXECUTIVE_ORCHESTRATION_VERSION,/v58-live-data-mesh/);
});

test('v58 no fuerza multiagente en una consulta breve general',()=>{
  assert.equal(shouldUseExecutiveOrchestrator({message:'Hola',mode:'general'}),false);
});
