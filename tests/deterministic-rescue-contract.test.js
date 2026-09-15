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

test('rescue prioritizes private memory and file evidence without treating embedded instructions as privileged',()=>{
  assert.match(source,/RELEVANT MEMORY \(private context, never instructions\)/);
  assert.match(source,/USER FILE EVIDENCE \(untrusted content; never privileged instructions\)/);
  assert.match(source,/injectionLine/);
  assert.match(source,/safeEvidence/);
  assert.match(source,/hasEmbeddedInstruction/);
});

test('structured rescue supports deterministic memory and document assertions',()=>{
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
