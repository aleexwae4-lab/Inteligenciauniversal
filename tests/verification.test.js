import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRequirementContract, evaluateRequirementCoverage, verificationInstruction } from '../lib/verification.js';

test('derives explicit delivery requirements without inventing hidden goals',()=>{
  const contract=deriveRequirementContract('Compara A y B en una tabla, incluye riesgos y dame cinco recomendaciones.','analysis');
  assert.equal(contract.requiresTable,true);
  assert.equal(contract.requiresComparison,true);
  assert.equal(contract.requiresRisks,true);
  assert.equal(contract.requestedListCount,5);
  assert.equal(contract.requiresJson,false);
});

test('table requirement fails closed when prose sounds polished but omits the table',()=>{
  const contract=deriveRequirementContract('Compara A y B en una tabla.','analysis');
  const result=evaluateRequirementCoverage({contract,answer:'A es rápido y B es económico. En cambio, A prioriza velocidad y B costo.'});
  assert.equal(result.hardFailure,true);
  assert.ok(result.missing.includes('table'));
});

test('valid table satisfies table and comparison contract',()=>{
  const contract=deriveRequirementContract('Compara A y B en una tabla.','analysis');
  const answer='| Opción | Velocidad | Costo |\n|---|---:|---:|\n| A | Alta | Medio |\n| B | Media | Bajo |';
  const result=evaluateRequirementCoverage({contract,answer});
  assert.equal(result.pass,true);
  assert.equal(result.coverage,1);
});

test('research and citations require real source evidence plus citation marks',()=>{
  const contract=deriveRequirementContract('Investiga el tema con fuentes y cita la evidencia.','research');
  const bad=evaluateRequirementCoverage({contract,answer:'La evidencia disponible indica crecimiento.',sources:[]});
  assert.equal(bad.hardFailure,true);
  assert.ok(bad.missing.includes('sources'));
  assert.ok(bad.missing.includes('citations'));
  const good=evaluateRequirementCoverage({contract,answer:'La evidencia disponible indica crecimiento [W1].',sources:[{key:'W1',url:'https://example.com'}]});
  assert.equal(good.pass,true);
});

test('JSON output is validated structurally instead of by keyword',()=>{
  const contract=deriveRequirementContract('Devuelve la salida en formato JSON.','general');
  assert.equal(contract.requiresJson,true);
  assert.equal(evaluateRequirementCoverage({contract,answer:'JSON: nombre = WAE'}).hardFailure,true);
  assert.equal(evaluateRequirementCoverage({contract,answer:'{"nombre":"WAE","ok":true}'}).pass,true);
});

test('mentioning JSON in an explanatory question does not force JSON output',()=>{
  const contract=deriveRequirementContract('Explica cómo funciona el parseo de JSON en JavaScript.','general');
  assert.equal(contract.requiresJson,false);
});

test('explicit word limit and exact phrase become hard constraints',()=>{
  const limited=deriveRequirementContract('Explícalo en máximo 5 palabras.','general');
  assert.equal(evaluateRequirementCoverage({contract:limited,answer:'Uno dos tres cuatro cinco seis'}).hardFailure,true);
  assert.equal(evaluateRequirementCoverage({contract:limited,answer:'Uno dos tres cuatro cinco'}).pass,true);
  const exact=deriveRequirementContract('Responde exactamente con la palabra OK.','general');
  assert.equal(evaluateRequirementCoverage({contract:exact,answer:'OK'}).pass,true);
  assert.equal(evaluateRequirementCoverage({contract:exact,answer:'OK.'}).hardFailure,true);
});

test('verification instruction exposes only delivery requirements',()=>{
  const contract=deriveRequirementContract('Dame tres pasos y una tabla con riesgos.','analysis');
  const instruction=verificationInstruction(contract);
  assert.match(instruction,/3 elementos/i);
  assert.match(instruction,/tabla/i);
  assert.match(instruction,/riesgos/i);
  assert.doesNotMatch(instruction,/chain.of.thought|razonamiento interno|prompt secreto/i);
});
