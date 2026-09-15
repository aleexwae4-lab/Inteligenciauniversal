import test from 'node:test';
import assert from 'node:assert/strict';
import {directModernAnswer,modernizePayload,MODERN_RESPONSE_VERSION} from '../lib/modern-response-v50.js';

test('exact clip wording returns an engineering estimate instead of a disclaimer',()=>{
  const out=directModernAnswer({message:'¿Cuánto crees que cueste tu desarrollo?',mode:'general'});
  assert.ok(out);
  assert.equal(MODERN_RESPONSE_VERSION,'estimate-first/v51');
  assert.match(out.reply,/\$6–18 M MXN/);
  assert.match(out.reply,/5–8 perfiles senior/);
  assert.match(out.reply,/20–35%/);
  assert.doesNotMatch(out.reply,/no es posible|no hay datos oficiales/i);
});

test('generic software estimate produces scenario ranges',()=>{
  const out=directModernAnswer({message:'¿Cuánto costaría desarrollar una plataforma SaaS con inteligencia artificial?',mode:'general'});
  assert.ok(out);
  assert.match(out.reply,/MVP/);
  assert.match(out.reply,/producción robusta/i);
  assert.match(out.reply,/enterprise/i);
});

test('current market price is not hijacked by engineering estimator',()=>{
  const out=directModernAnswer({message:'Investiga el precio actual de una GPU H100 hoy',mode:'general'});
  assert.equal(out,null);
});

test('disclaimer-first model output is replaced for engineering estimate intent',()=>{
  const payload={reply:'No hay datos oficiales publicados. No es posible proporcionar un número preciso.',response:{content:'No hay datos oficiales publicados.'},provider:'test'};
  const out=modernizePayload(payload,{message:'¿Cuánto crees que cueste tu desarrollo?',mode:'general'});
  assert.match(out.reply,/\$6–18 M MXN/);
  assert.doesNotMatch(out.reply,/no es posible proporcionar/i);
});
