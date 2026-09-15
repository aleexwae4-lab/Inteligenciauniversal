import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { continuousImprovementCapabilities, normalizeImprovementStatus, CONTINUOUS_IMPROVEMENT_VERSION } from '../lib/continuous-improvement-v54.js';

test('continuous improvement fails closed before a trusted benchmark exists',()=>{
  const status=normalizeImprovementStatus({});
  const caps=continuousImprovementCapabilities(status);
  assert.equal(status.version,CONTINUOUS_IMPROVEMENT_VERSION);
  assert.equal(status.releaseGate,'HOLD');
  assert.equal(status.superiorityClaimGate,'HOLD');
  assert.equal(status.trustedRuns,0);
  assert.equal(caps.userSubmittedRunsCanPromote,false);
  assert.equal(caps.claimPolicy.universalSuperiorityClaimAllowed,false);
});

test('only a sanitized trusted snapshot can expose a certified benchmark gate',()=>{
  const status=normalizeImprovementStatus({benchmark_version:'universal-supremacy-benchmark/v53',trusted_runs:3,last_reference_id:'gpt-5.6-sol',last_adjusted_win_rate:0.64,last_claim_allowed:true,open_regressions:0,critical_open:0,high_open:0,release_gate:'PASS',superiority_claim_gate:'CERTIFIED',last_commit_sha:'abc123'});
  assert.equal(status.trustedRuns,3);
  assert.equal(status.releaseGate,'PASS');
  assert.equal(status.superiorityClaimGate,'CERTIFIED');
  assert.equal(status.lastReferenceId,'gpt-5.6-sol');
});

test('database ledger is private and public surface is read-only sanitized status',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260915113500_supremacy_continuous_improvement_v54.sql',import.meta.url),'utf8');
  assert.match(sql,/revoke all on public\.wae_supremacy_runs_v54 from anon, authenticated/i);
  assert.match(sql,/revoke all on public\.wae_supremacy_regression_backlog_v54 from anon, authenticated/i);
  assert.match(sql,/grant select on public\.wae_supremacy_public_status_v54 to anon, authenticated/i);
  assert.doesNotMatch(sql,/\b(answer|response_text|candidate_text)\s+(text|jsonb)/i);
});

test('trusted recorder is fail-closed behind existing worker token validation',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260915114500_trusted_supremacy_recorder_v54.sql',import.meta.url),'utf8');
  assert.match(sql,/wae_validate_worker_token\(p_worker_token\)/);
  assert.match(sql,/raise exception 'worker_auth_required'/);
  assert.match(sql,/'trusted_worker',true/);
  assert.match(sql,/universal-supremacy-benchmark\/v53/);
  assert.match(sql,/extensions\.digest/);
  assert.match(sql,/occurrence_count=public\.wae_supremacy_regression_backlog_v54\.occurrence_count\+1/);
  assert.match(sql,/status='resolved'/);
  assert.match(sql,/superiority_claim_gate/);
});

test('Render certifies locally then sends only hashes and certification to the trusted recorder',async()=>{
  const source=await readFile(new URL('../api/evals.js',import.meta.url),'utf8');
  assert.match(source,/certify_and_record/);
  assert.match(source,/x-wae-worker-token/);
  assert.match(source,/wae_record_trusted_supremacy_v54/);
  assert.match(source,/const safeEntries=entries\.slice\(0,MAX_TRUSTED_ENTRIES\)\.map\(\(\{caseId,promptHash\}\)=>\(\{caseId,promptHash\}\)\)/);
  assert.match(source,/MAX_TRUSTED_ENTRIES=32/);
  assert.doesNotMatch(source,/p_entries:entries/);
});
