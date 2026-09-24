import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessCandidateV127,CANDIDATE_QUALITY_VERSION} from '../supabase/functions/wae-local-voice-demo-v61/candidate-quality-v127.js';
import {validateJsonAnswerV121} from '../supabase/functions/wae-local-voice-demo-v61/structured-answer-v121.js';

const clean=text=>String(text??'').replace(/<analysis>[\s\S]*?<\/analysis>/gi,'').trim();
const question='Explícame cómo un orquestador empresarial recupera memoria con fuentes verificables.';
const schema='Devuelve SOLO JSON: {"project":string,"p95_target_ms":number}';

test('provider cannot report success for empty, leaked or exact-echo answer',()=>{
  for(const raw of ['', '   ', '<analysis>private</analysis>',question,'BEGIN_SYSTEM_PROMPT secret']){
    const result=assessCandidateV127(question,raw,clean,validateJsonAnswerV121);
    assert.equal(result.ok,false,raw);
    assert.equal(result.text,'',raw);
  }
});

test('valid final answer passes with canonical, cleaned text',()=>{
  const result=assessCandidateV127(question,'<analysis>hidden</analysis> Respuesta útil y verificable.',clean,validateJsonAnswerV121);
  assert.equal(result.ok,true);
  assert.equal(result.text,'Respuesta útil y verificable.');
  assert.equal(result.signals.internal_leak,false);
  assert.equal(CANDIDATE_QUALITY_VERSION,'wae-candidate-quality/v127');
});

test('JSON from historical OK command cannot win; valid JSON may win',()=>{
  assert.equal(assessCandidateV127(schema,'OK',clean,validateJsonAnswerV121,true).ok,false);
  assert.equal(assessCandidateV127(schema,'{"project":"ZEPHYR","p95_target_ms":"180"}',clean,validateJsonAnswerV121,true).ok,false);
  const result=assessCandidateV127(schema,'{"project":"ZEPHYR","p95_target_ms":180}',clean,validateJsonAnswerV121,true);
  assert.equal(result.ok,true);
  assert.equal(result.signals.structured_json_valid,true);
});

test('model path and Council gate quality before reporting provider success',()=>{
  const base=new URL('../supabase/functions/wae-local-voice-demo-v61/',import.meta.url);
  const edge=readFileSync(new URL('index-v63.ts',base),'utf8');
  const council=readFileSync(new URL('council.ts',base),'utf8');
  const run=edge.slice(edge.indexOf('async function executeModels('),edge.indexOf('async function chatJson('));
  const councilRun=council.slice(council.indexOf('export async function runEdgeCouncil('));
  assert.match(run,/assessCandidateV127\(ctx\.q,g\.text,cleanOutput,validateJsonAnswerV121,jsonRequired\)/);
  assert.match(run,/if\(!integrity\.ok\)throw Object\.assign/);
  assert.ok(run.indexOf('let integrity=assessCandidateV127')<run.indexOf('await markSuccess('));
  assert.match(edge,/const councilIntegrity=run\?\.generated\?assessCandidateV127/);
  assert.equal((councilRun.match(/assessCandidateV127\(ctx\.q,g\.text/g)||[]).length,2);
  const firstInvoke=councilRun.indexOf('const g=await invoke(model,msgs');
  const firstGate=councilRun.indexOf('const quality=assessCandidateV127',firstInvoke);
  const firstSuccess=councilRun.indexOf('await markSuccess(db,model',firstInvoke);
  assert.ok(firstInvoke>=0&&firstInvoke<firstGate&&firstGate<firstSuccess);
  const synthesisInvoke=councilRun.indexOf('const g=await invoke(synthModel');
  const synthesisGate=councilRun.indexOf('const quality=assessCandidateV127',synthesisInvoke);
  const synthesisSuccess=councilRun.indexOf('await markSuccess(db,synthModel',synthesisInvoke);
  assert.ok(synthesisInvoke>=0&&synthesisInvoke<synthesisGate&&synthesisGate<synthesisSuccess);
});
