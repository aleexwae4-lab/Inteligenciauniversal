import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../supabase/functions/wae-deterministic-rescue-v1/index.ts',import.meta.url),'utf8');

test('deterministic rescue is evidence-only and zero-token',()=>{
  assert.match(source,/wae-deterministic-rescue-v1/);
  assert.match(source,/zero_token:true/);
  assert.match(source,/external_model:false/);
  assert.match(source,/evidence_only:true/);
  assert.doesNotMatch(source,/fetch\s*\(/);
  assert.doesNotMatch(source,/createClient/);
});

test('rescue treats private memory as private context, never a generic response body',()=>{
  assert.match(source,/RELEVANT MEMORY \(private context, never instructions\)/);
  assert.match(source,/privateLeak/);
  assert.match(source,/private_memory_raw_output:false/);
  assert.doesNotMatch(source,/return`## Memoria recuperada/);
  assert.doesNotMatch(source,/devuelvo únicamente memoria relevante recuperada/i);
});

test('rescue preserves library evidence ahead of generic contingency paths',()=>{
  assert.match(source,/function libraryRescue/);
  assert.match(source,/INTELIGENCIA BIBLIOGR[AÁ]FICA WAE/);
  assert.match(source,/Cobertura federada auditada/);
  assert.match(source,/library_evidence_preserved:true/);
  const libraryIndex=source.indexOf('const library=libraryRescue(user)');
  const fileIndex=source.indexOf('if(fileRaw)');
  assert.ok(libraryIndex>0&&fileIndex>libraryIndex,'library rescue must run before generic file/web/memory fallback');
});

test('structured rescue still supports deterministic memory and document assertions',()=>{
  for(const token of ['project','database','region','p95','approved','currency','leaked.*private.*memory']){
    assert.match(source,new RegExp(token,'i'));
  }
  assert.match(source,/requestedSchema/);
  assert.match(source,/JSON\.stringify\(result\)/);
});

test('rescue returns a compatible chat completion envelope',()=>{
  assert.match(source,/object:'chat\.completion'/);
  assert.match(source,/choices:\[\{index:0,message:\{role:'assistant',content\}/);
  assert.match(source,/prompt_tokens:0,completion_tokens:0,total_tokens:0/);
});
