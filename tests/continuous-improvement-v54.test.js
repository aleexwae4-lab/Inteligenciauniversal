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
  const status=normalizeImprovementStatus({
    benchmark_version:'universal-supremacy-benchmark/v53',trusted_runs:3,last_reference_id:'gpt-5.6-sol',
    last_adjusted_win_rate:0.64,last_claim_allowed:true,open_regressions:0,critical_open:0,high_open:0,
    release_gate:'PASS',superiority_claim_gate:'CERTIFIED',last_commit_sha:'abc123'
  });
  assert.equal(status.trustedRuns,3);
  assert.equal(status.releaseGate,'PASS');
  assert.equal(status.superiorityClaimGate,'CERTIFIED');
  assert.equal(status.lastReferenceId,'gpt-5.6-sol');
  assert.equal(status.userSubmittedRunsCanPromote,false);
});

test('database ledger is private and public surface is read-only sanitized status',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260915113500_supremacy_continuous_improvement_v54.sql',import.meta.url),'utf8');
  assert.match(sql,/revoke all on public\.wae_supremacy_runs_v54 from anon, authenticated/i);
  assert.match(sql,/revoke all on public\.wae_supremacy_regression_backlog_v54 from anon, authenticated/i);
  assert.match(sql,/grant select on public\.wae_supremacy_public_status_v54 to anon, authenticated/i);
  assert.match(sql,/service_role_required/i);
  assert.match(sql,/where trusted_for_promotion = true/i);
  assert.match(sql,/where trusted = true and status = 'open'/i);
  assert.doesNotMatch(sql,/\b(answer|response_text|candidate_text)\s+(text|jsonb)/i);
});

test('edge gate separates trusted worker evidence from user-submitted evidence',async()=>{
  const source=await readFile(new URL('../supabase/functions/wae-supremacy-regression-v54/index.ts',import.meta.url),'utf8');
  assert.match(source,/wae_validate_worker_token/);
  assert.match(source,/trusted_for_promotion:\s*actor\.trusted/);
  assert.match(source,/attestation_level:\s*actor\.trusted\s*\?\s*"trusted_worker"\s*:\s*"user_submitted"/);
  assert.match(source,/const scope = args\.actor\.trusted \? "trusted" : `user:\$\{args\.actor\.userId\}`/);
  assert.match(source,/wae_refresh_supremacy_public_status_v54/);
  assert.match(source,/action:\s*"certify"/);
  assert.match(source,/MAX_ENTRIES = 32/);
});

test('regressions are deduplicated and passing cases resolve prior backlog',async()=>{
  const source=await readFile(new URL('../supabase/functions/wae-supremacy-regression-v54/index.ts',import.meta.url),'utf8');
  assert.match(source,/occurrence_count:\s*Number\(existing\.occurrence_count \|\| 0\) \+ 1/);
  assert.match(source,/status:\s*"resolved"/);
  assert.match(source,/resolved_by_commit_sha/);
  assert.match(source,/severityFor/);
});
