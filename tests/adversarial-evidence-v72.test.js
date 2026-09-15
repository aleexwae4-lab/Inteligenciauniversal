import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { adversarialEvidenceSuite, adversarialEvidenceManifest, adversarialSuiteHash, certifyAdversarialEvidenceRun, ADVERSARIAL_EVIDENCE_VERSION } from '../lib/adversarial-evidence-v72.js';

const versionedReference='gpt-5.6-sol-2026-09-15';

function pairedEntries(targetAnswer='respuesta control',referenceAnswer='respuesta control'){
  return adversarialEvidenceSuite().map(item=>({caseId:item.id,promptHash:item.promptHash,candidates:[{id:'universal_core',answer:targetAnswer},{id:versionedReference,answer:referenceAnswer}]}));
}

test('v72 adversarial suite extends v71 to exactly 64 immutable cases',()=>{
  const suite=adversarialEvidenceSuite();
  assert.equal(suite.length,64);
  assert.equal(new Set(suite.map(x=>x.id)).size,64);
  assert.ok(suite.every(x=>/^[0-9a-f]{64}$/.test(x.promptHash)));
  assert.equal(suite.filter(x=>x.id.startsWith('attack-')).length,16);
});

test('v72 manifest is hash-addressed and forbids unversioned superiority claims',()=>{
  const manifest=adversarialEvidenceManifest();
  assert.equal(manifest.version,ADVERSARIAL_EVIDENCE_VERSION);
  assert.equal(manifest.holdoutCases,64);
  assert.equal(manifest.suiteHash,adversarialSuiteHash());
  assert.match(manifest.suiteHash,/^[0-9a-f]{64}$/);
  assert.match(manifest.claimPolicy.forbidden,/unversioned/i);
  assert.equal(manifest.versionedReferenceRequired,true);
});

test('v72 complete paired run evaluates all 64 cases but does not manufacture an advantage from ties',()=>{
  const certification=certifyAdversarialEvidenceRun({entries:pairedEntries(),targetId:'universal_core',referenceId:versionedReference});
  assert.equal(certification.evaluatedCases,64);
  assert.equal(certification.gates.fullPairedSuite,true);
  assert.equal(certification.gates.noInvalidEntries,true);
  assert.equal(certification.gates.versionedReference,true);
  assert.equal(certification.claimAllowed,false);
  assert.equal(certification.verdict,'NOT_PROVEN');
});

test('v72 rejects generic model-family references even with the full suite',()=>{
  const entries=adversarialEvidenceSuite().map(item=>({caseId:item.id,promptHash:item.promptHash,candidates:[{id:'universal_core',answer:'x'},{id:'gpt',answer:'x'}]}));
  const certification=certifyAdversarialEvidenceRun({entries,targetId:'universal_core',referenceId:'gpt'});
  assert.equal(certification.evaluatedCases,64);
  assert.equal(certification.gates.versionedReference,false);
  assert.equal(certification.claimAllowed,false);
});

test('v72 refuses partial suites for trusted comparative certification',()=>{
  const certification=certifyAdversarialEvidenceRun({entries:pairedEntries().slice(0,63),targetId:'universal_core',referenceId:versionedReference});
  assert.equal(certification.evaluatedCases,63);
  assert.equal(certification.gates.fullPairedSuite,false);
  assert.equal(certification.claimAllowed,false);
});

test('v72 attack surface covers prompt injection, licensing, tenant isolation, retractions, ranking and claim governance',()=>{
  const ids=new Set(adversarialEvidenceSuite().map(x=>x.id));
  for(const id of ['attack-injection-01','attack-license-01','attack-tenant-01','attack-retraction-01','attack-ranking-01','attack-claim-01'])assert.equal(ids.has(id),true);
});

test('v72 API exposes trusted 64-case recording and never stores raw answers in database migration',()=>{
  const api=fs.readFileSync(new URL('../api/evals.js',import.meta.url),'utf8');
  const migration=fs.readFileSync(new URL('../supabase/migrations/20260915235500_trusted_evidence_certification_v72.sql',import.meta.url),'utf8');
  assert.match(api,/adversarial_certify_and_record/);
  assert.match(api,/wae_record_trusted_evidence_v72/);
  assert.match(api,/targetAnswerHash/);
  assert.match(migration,/complete_64_case_suite_required/);
  assert.match(migration,/target_answer_hash/);
  assert.match(migration,/reference_answer_hash/);
  assert.doesNotMatch(migration,/target_answer\s+text/i);
  assert.doesNotMatch(migration,/reference_answer\s+text/i);
  assert.match(migration,/enable row level security/i);
});

test('v72 hardened recorder recomputes outcomes and fails closed on forged comparative claims',()=>{
  const hardening=fs.readFileSync(new URL('../supabase/migrations/20260916000100_trusted_evidence_certification_v72_hardening.sql',import.meta.url),'utf8');
  for(const contract of ['benchmark_threshold_contract_mismatch','aggregate_outcome_mismatch','adjusted_win_rate_mismatch','critical_failure_rate_mismatch','complete_case_scores_required','target_mean_score_mismatch','reference_mean_score_mismatch','mean_score_delta_mismatch','claim_gate_inconsistency','claim_metric_threshold_failure','claim_with_open_regressions_forbidden'])assert.match(hardening,new RegExp(contract));
  assert.match(hardening,/v_calc_wins/);
  assert.match(hardening,/v_calc_target_mean/);
  assert.match(hardening,/pg_column_size\(p_entries\)>2097152/);
  assert.match(hardening,/versioned_external_reference_required/);
  assert.doesNotMatch(hardening,/target_answer\s+text/i);
  assert.doesNotMatch(hardening,/reference_answer\s+text/i);
});
