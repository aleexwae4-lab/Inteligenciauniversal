import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('v95 benchmark API records only after trusted 64-case certification readiness',async()=>{
  const source=await readFile(new URL('../api/benchmark-v93.js',import.meta.url),'utf8');
  assert.match(source,/certify_attested_and_record/);
  assert.match(source,/verifiedTrainingReadinessV95/);
  assert.match(source,/buildRegressionCurriculumV95/);
  assert.match(source,/wae_record_verified_gpt_arena_v95/);
  assert.match(source,/WAE_RUNTIME_BRIDGE_TOKEN/);
  assert.match(source,/hashEntriesOnly\(entries\)/);
  assert.match(source,/recorderCertificationV95\(certification\)/);
  assert.match(source,/superiority_claim_gate === 'CERTIFIED'/);
});

test('v95 recorder certification strips raw regression prompts and candidate answers before persistence',async()=>{
  const source=await readFile(new URL('../api/benchmark-v93.js',import.meta.url),'utf8');
  const start=source.indexOf('function recorderCertificationV95');
  const end=source.indexOf('function hashEntriesOnly',start);
  const sanitizer=source.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(sanitizer,/regressions:/);
  assert.match(sanitizer,/sanitizeRegression/);
  assert.doesNotMatch(sanitizer,/answer:/);
  assert.doesNotMatch(sanitizer,/prompt:/);
});

test('v95 SQL recorder requires signed provenance and sanitized hash-only entries',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260916174800_verified_gpt_training_v95.sql',import.meta.url),'utf8');
  assert.match(sql,/verified-paired-benchmark-certification\/v1/);
  assert.match(sql,/verified-gpt-arena\/v93/);
  assert.match(sql,/complete_64_case_suite_required/);
  assert.match(sql,/verified_provenance_required/);
  assert.match(sql,/full_paired_suite_required/);
  assert.match(sql,/sanitized_hash_entries_required/);
  assert.match(sql,/case_id_plus_sha256_prompt_hash_only/);
  assert.match(sql,/raw_prompts_persisted',false/);
  assert.match(sql,/raw_answers_persisted',false/);
  assert.doesNotMatch(sql,/certification\)\s*values\([^;]*p_certification/is);
});

test('v95 ledger cannot certify superiority while critical or high regressions remain',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260916174800_verified_gpt_training_v95.sql',import.meta.url),'utf8');
  assert.match(sql,/when v_critical>0 then 'BLOCK'/);
  assert.match(sql,/when v_high>0 then 'CAUTION'/);
  assert.match(sql,/v_claim and v_critical=0 and v_high=0 then 'CERTIFIED'/);
});
