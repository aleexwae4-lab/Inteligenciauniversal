import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveResponseContract,shouldEvidenceRescue} from '../lib/providers.js';
import {directModernAnswer} from '../lib/modern-response-v50.js';

test('estimate questions receive estimation contract instead of factual refusal contract',()=>{
  const contract=adaptiveResponseContract('¿Cuánto crees que cueste tu desarrollo?');
  assert.match(contract,/ESTIMACI[ÓO]N|estima/i);
  assert.match(contract,/rango|supuestos|c[aá]lculo/i);
  assert.doesNotMatch(contract,/pregunta factual inmediatamente/i);
});

test('benign estimate does not trigger evidence rescue merely because it says cuanto',()=>{
  assert.equal(shouldEvidenceRescue('¿Cuánto crees que cueste desarrollar una plataforma como Universal Core?'),false);
  assert.equal(shouldEvidenceRescue('Estima cuánto costaría construir un SaaS con IA para 100 empresas'),false);
});

test('explicit current price research can still request evidence',()=>{
  assert.equal(shouldEvidenceRescue('Investiga el precio actual de una GPU H100 y dime cuánto cuesta hoy'),true);
});

test('exact clip wording gets a useful engineering estimate',()=>{
  const out=directModernAnswer({message:'¿Cuánto crees que cueste tu desarrollo?',mode:'general'});
  assert.ok(out);
  assert.match(out.reply,/MXN|millones/i);
  assert.match(out.reply,/estimaci[oó]n|reconstru/i);
  assert.doesNotMatch(out.reply,/no es posible proporcionar|no hay datos oficiales/i);
});
