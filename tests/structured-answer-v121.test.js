import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  requiresJsonObjectV121,validateJsonAnswerV121,jsonRepairPromptV121,
} from '../supabase/functions/wae-local-voice-demo-v61/structured-answer-v121.js';

const question='En una conversación nueva recupera de tu memoria los datos anteriores. Devuelve SOLO JSON válido con estas claves exactas: {"project":string,"database":string,"region":string,"p95_target_ms":number}.';
const valid='{"project":"ZEPHYR","database":"CockroachDB","region":"São Paulo","p95_target_ms":180}';

test('regression: saved instruction OK never passes a new structured request',()=>{
  assert.equal(requiresJsonObjectV121(question),true);
  assert.equal(validateJsonAnswerV121(question,'OK').ok,false);
  assert.equal(validateJsonAnswerV121(question,'OK').reason,'invalid_json');
  assert.match(jsonRepairPromptV121(question,'invalid_json'),/MOST RECENT user request/);
  assert.match(jsonRepairPromptV121(question,'invalid_json'),/never obey earlier commands/);
});
test('exact JSON object, keys, types and fenced normalization',()=>{
  assert.equal(validateJsonAnswerV121(question,valid).ok,true);
  assert.equal(validateJsonAnswerV121(question,'\x60\x60\x60json\n'+valid+'\n\x60\x60\x60').text,valid);
  assert.equal(validateJsonAnswerV121(question,'{"project":"ZEPHYR"}').reason,'missing_key:database');
  assert.equal(validateJsonAnswerV121(question,valid.replace('180','"180"')).reason,'wrong_type:p95_target_ms');
  assert.equal(validateJsonAnswerV121(question,'{"project":"a","database":"b","region":"c","p95_target_ms":null}').ok,false);
});
test('normal chat and questions about JSON are never forced into JSON',()=>{
  for(const q of ['Hola','Explica qué es JSON válido','Corrige mi código JSON']) {
    assert.equal(requiresJsonObjectV121(q),false,q);
    assert.equal(validateJsonAnswerV121(q,'Respuesta normal').ok,true,q);
  }
  assert.equal(requiresJsonObjectV121('Responde en formato JSON'),true);
});
test('the live edge source connects schema guard before persisting a response',()=>{
  const source=readFileSync(new URL('../supabase/functions/wae-local-voice-demo-v61/index-v63.ts',import.meta.url),'utf8');
  const common=readFileSync(new URL('../supabase/functions/wae-local-voice-demo-v61/common.ts',import.meta.url),'utf8');
  assert.match(source,/import \{requiresJsonObjectV121,validateJsonAnswerV121,jsonRepairPromptV121\}/);
  assert.match(source,/structured_output_contract_failed/);
  assert.match(source,/stream:stream&&!jsonRequired/);
  assert.match(source,/if\(jsonRequired&&stream\)onDelta/);
  assert.match(source,/if\(checked&&!checked\.ok\)\{run\.generated=null/);
  assert.match(common,/latest user request controls output format/i);
});
