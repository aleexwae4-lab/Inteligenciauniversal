import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyCompletedAnswerV125,RESPONSE_VERIFIER_VERSION} from '../supabase/functions/wae-local-voice-demo-v61/response-verifier-v125.js';

test('final verifier rejects blank, internal analysis and exact question echo',()=>{
  assert.equal(verifyCompletedAnswerV125('Hola','').reason,'empty_answer');
  assert.equal(verifyCompletedAnswerV125('Explica esto con detalle','<analysis>secret</analysis> respuesta').reason,'internal_leak');
  const q='Explica la arquitectura completa del sistema Universal Core';
  assert.equal(verifyCompletedAnswerV125(q,q).reason,'question_echo');
});
test('structured mode requires an object and ordinary prose stays accepted',()=>{
  assert.equal(verifyCompletedAnswerV125('JSON','{"ok":true}',{structured:true}).ok,true);
  assert.equal(verifyCompletedAnswerV125('JSON','[1,2]',{structured:true}).ok,false);
  assert.equal(verifyCompletedAnswerV125('JSON','no es json',{structured:true}).reason,'invalid_structured_answer');
  assert.equal(verifyCompletedAnswerV125('Hola','Respuesta útil.').ok,true);
});
test('refusal is observable but is not automatically rewritten or fabricated',()=>{
  const v=verifyCompletedAnswerV125('Petición','No puedo ayudar con eso.');
  assert.equal(v.ok,true);
  assert.equal(v.signals.refusal_like,true);
  assert.equal(Object.hasOwn(v,'text'),false);
});
test('edge verifies before assistant persistence and telemetry stores signals only',()=>{
  const edge=readFileSync(new URL('../supabase/functions/wae-local-voice-demo-v61/index-v63.ts',import.meta.url),'utf8');
  const verifyPos=edge.indexOf('const verification=verifyCompletedAnswerV125');
  const persistPos=edge.indexOf("db.from('iu_messages').insert");
  assert.ok(verifyPos>0&&persistPos>verifyPos);
  assert.match(edge,/response_verification:\{version:'wae-response-verifier\/v125',\.\.\.verification\.signals\}/);
  assert.doesNotMatch(edge,/response_verification:\{[^}]*text:/);
  assert.equal(RESPONSE_VERIFIER_VERSION,'wae-response-verifier/v125');
});
