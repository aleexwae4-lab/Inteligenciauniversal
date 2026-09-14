import test from 'node:test';
import assert from 'node:assert/strict';
import { planMission, specialistPrompt, synthesisPrompt, ORCHESTRATOR_VERSION } from '../lib/orchestrator.js';

test('deep planner selects relevant specialists and stays bounded',()=>{
  const plan=planMission('Audita la interfaz móvil, revisa el código de GitHub y compara riesgos de producto con evidencia reciente.');
  assert.equal(plan.schema,ORCHESTRATOR_VERSION);
  assert.equal(plan.parallel,true);
  assert.ok(plan.specialists.includes('code'));
  assert.ok(plan.specialists.includes('design'));
  assert.ok(plan.specialists.includes('analysis')||plan.specialists.includes('research'));
  assert.ok(plan.specialists.length<=3);
  assert.equal(plan.synthesis,'executive');
});

test('deep planner falls back to analysis for generic missions',()=>{
  const plan=planMission('Ayúdame a resolver esta misión compleja.');
  assert.deepEqual(plan.specialists,['analysis']);
});

test('specialist and synthesis contracts forbid fabricated execution claims',()=>{
  const specialist=specialistPrompt('research','Investiga X');
  const synthesis=synthesisPrompt('Investiga X',planMission('Investiga X'),[{agent:'research',reply:'Hallazgo observado'}]);
  assert.match(specialist,/No inventes fuentes ni acciones/i);
  assert.match(synthesis,/prioriza evidencia observable/i);
  assert.match(synthesis,/No menciones proveedores, modelos/i);
});
