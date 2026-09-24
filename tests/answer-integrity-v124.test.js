import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {acceptAnswerV124,ANSWER_INTEGRITY_VERSION} from '../supabase/functions/wae-local-voice-demo-v61/answer-integrity-v124.js';
import {validateJsonAnswerV121} from '../supabase/functions/wae-local-voice-demo-v61/structured-answer-v121.js';

const scrub=text=>String(text??'').replace(/<analysis>[\s\S]*?<\/analysis>/gi,'').trim();
const question='Devuelve SOLO JSON válido con estas claves: {"project":string,"p95_target_ms":number}';
const valid='{"project":"ZEPHYR","p95_target_ms":180}';

test('zero-length, whitespace and rejected outputs cannot count as success',()=>{
  for(const answer of [null,undefined,'','  \n  ']){
    assert.equal(acceptAnswerV124('Hola',answer,scrub,validateJsonAnswerV121).ok,false);
  }
  assert.equal(acceptAnswerV124('Hola','<analysis>secret</analysis>',scrub,validateJsonAnswerV121).reason,'rejected_or_empty_answer');
  assert.equal(acceptAnswerV124('Hola','private',()=>'',validateJsonAnswerV121).ok,false);
});
test('canonical reply removes internal analysis without blanking the user answer',()=>{
  const output=acceptAnswerV124('Hola','<analysis>hidden</analysis> Respuesta verificable.',scrub,validateJsonAnswerV121);
  assert.equal(output.ok,true);
  assert.equal(output.text,'Respuesta verificable.');
  assert.equal(output.text.includes('hidden'),false);
});
test('previous OK response does not satisfy the current JSON contract',()=>{
  assert.equal(acceptAnswerV124(question,'OK',scrub,validateJsonAnswerV121).ok,false);
  assert.match(acceptAnswerV124(question,'OK',scrub,validateJsonAnswerV121).reason,/structured_output_contract_failed/);
  assert.equal(acceptAnswerV124(question,valid,scrub,validateJsonAnswerV121).text,valid);
  assert.equal(acceptAnswerV124(question,'{"project":"ZEPHYR","p95_target_ms":"180"}',scrub,validateJsonAnswerV121).ok,false);
});
test('active Edge source enforces one text for replay, storage, JSON and SSE completion',()=>{
  const edge=readFileSync(new URL('../supabase/functions/wae-local-voice-demo-v61/index-v63.ts',import.meta.url),'utf8');
  assert.match(edge,/import \{acceptAnswerV124\} from '\.\/answer-integrity-v124\.js'/);
  assert.match(edge,/if\(!integrity\.ok\)throw Object\.assign/);
  assert.match(edge,/generated\.text=integrity\.text/);
  assert.match(edge,/content:generated\.text,content_json:response/);
  assert.match(edge,/if\(!replayed\.ok\|\|response\.content!==replayed\.text\)continue/);
  assert.equal((edge.match(/reply:fin\.response\.content,response:fin\.response/g)||[]).length,2);
  assert.equal(ANSWER_INTEGRITY_VERSION,'wae-answer-integrity/v124');
});
