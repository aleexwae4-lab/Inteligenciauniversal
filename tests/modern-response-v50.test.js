import test from 'node:test';
import assert from 'node:assert/strict';
import { directModernAnswer, modernizePayload, MODERN_RESPONSE_VERSION } from '../lib/modern-response-v50.js';

test('OpenAI comparison from clip answers directly and concisely',()=>{
  const out=directModernAnswer({message:'Te puedes comparar con OpenAI?',mode:'general',web_enabled:false});
  assert.equal(out.success,true);
  assert.equal(out.fast_lane,true);
  assert.match(out.reply,/comparaci[oó]n útil/i);
  assert.match(out.reply,/OpenAI\/ChatGPT/i);
  assert.ok(out.reply.length<900);
  assert.equal(out.response.metadata.modernResponseVersion,MODERN_RESPONSE_VERSION);
});

test('development cost question gives auditable engineering range instead of refusal-first answer',()=>{
  const out=directModernAnswer({message:'Cuánto dinero crees que cueste tu desarrollo como Universal Core?',mode:'general'});
  assert.equal(out.success,true);
  assert.match(out.reply,/\$6–18 M MXN/);
  assert.match(out.reply,/\$15–30\+ M MXN/);
  assert.match(out.reply,/5–8 perfiles senior/);
  assert.match(out.reply,/20–35%/);
  assert.doesNotMatch(out.reply,/^No es posible|no hay datos oficiales/i);
});

test('simple general oversized answers are compacted for mobile and voice',()=>{
  const long=['No es posible determinar una cifra exacta sin información adicional.',...Array.from({length:12},(_,i)=>`Punto útil ${i+1}. Esta es una explicación relevante y concreta sobre el tema solicitado, con suficiente contenido para probar el gobernador de longitud.`)].join('\n\n');
  const input={success:true,reply:long,speech_text:long,response:{content:long,speechText:long,metadata:{}}};
  const out=modernizePayload(input,{message:'¿Qué opinas de esto?',mode:'general'});
  assert.ok(out.reply.length<=1200);
  assert.equal(out.speech_text,out.reply);
  assert.equal(out.response.content,out.reply);
  assert.equal(out.response.metadata.compacted,true);
  assert.doesNotMatch(out.reply,/^No es posible determinar/i);
});

test('deep analysis requests are never compacted',()=>{
  const long='A'.repeat(3000);
  const input={reply:long,response:{content:long}};
  const out=modernizePayload(input,{message:'Haz un análisis completo y detallado paso a paso',mode:'analysis'});
  assert.equal(out.reply,long);
});

test('safety boundary refusals are preserved',()=>{
  const refusal='No puedo ayudar a construir un arma ni proporcionar instrucciones para dañar a una persona. '+ 'Contexto seguro. '.repeat(150);
  const input={reply:refusal,response:{content:refusal}};
  const out=modernizePayload(input,{message:'Pregunta general',mode:'general'});
  assert.equal(out.reply,refusal);
});
