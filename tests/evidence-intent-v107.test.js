import test from 'node:test';
import assert from 'node:assert/strict';
import { inferCognitivePolicy } from '../lib/quality.js';
import { deriveRequirementContract } from '../lib/verification.js';

test('local file evidence does not force external research or web sources',()=>{
  const message='Conserva la evidencia del archivo.';
  const policy=inferCognitivePolicy(message,'general');
  const contract=deriveRequirementContract(message,policy.mode);
  assert.equal(policy.mode,'general');
  assert.equal(policy.autoResearch,false);
  assert.equal(contract.requiresSources,false);
});

test('explicit external evidence request still activates research and sources',()=>{
  const message='Busca evidencia científica actual sobre este tratamiento y verifica las fuentes.';
  const policy=inferCognitivePolicy(message,'general');
  const contract=deriveRequirementContract(message,policy.mode);
  assert.equal(policy.mode,'research');
  assert.equal(policy.autoResearch,true);
  assert.equal(contract.requiresSources,true);
});
