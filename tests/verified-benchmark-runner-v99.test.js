import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildPublicEvidenceV99,
  publicEvidenceIsSanitizedV99,
  readinessGateV99,
  validateAttestedEntriesV99,
  validateSuiteV99,
} from '../lib/verified-benchmark-runner-v99.js';

const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const suite=Array.from({length:64},(_,index)=>({id:`case-${String(index+1).padStart(2,'0')}`,promptHash:hash(`prompt-${index+1}`)}));
const attestation=(item,candidateId)=>({
  signed:true,
  caseId:item.id,
  promptHash:item.promptHash,
  candidateId,
  signature:hash(`${item.id}:${candidateId}`),
  responseId:`resp-${item.id}-${candidateId}`,
});
const entries=suite.map(item=>({
  caseId:item.id,
  promptHash:item.promptHash,
  candidates:[
    {id:'universal_core',answer:'target answer',latencyMs:100,attestation:attestation(item,'universal_core')},
    {id:'openai:gpt-6-astra',answer:'reference answer',latencyMs:120,attestation:attestation(item,'openai:gpt-6-astra')},
  ],
}));

test('v99 requires exactly 64 unique immutable cases',()=>{
  assert.equal(validateSuiteV99(suite).ok,true);
  assert.equal(validateSuiteV99(suite.slice(0,63)).ok,false);
  assert.equal(validateSuiteV99([...suite.slice(0,63),suite[0]]).ok,false);
});

test('v99 requires paired signed entries with exact target and Astra identity',()=>{
  const result=validateAttestedEntriesV99({entries,suite,targetId:'universal_core',referenceId:'openai:gpt-6-astra'});
  assert.equal(result.ok,true);
  assert.equal(result.count,64);
  assert.equal(result.uniqueCases,64);

  const tampered=structuredClone(entries);
  tampered[7].candidates[1].attestation.signed=false;
  const rejected=validateAttestedEntriesV99({entries:tampered,suite,targetId:'universal_core',referenceId:'openai:gpt-6-astra'});
  assert.equal(rejected.ok,false);
  assert.match(rejected.invalid[0].reason,/attestation/);
});

test('v99 readiness fails closed unless comparator, attestation and trusted-runtime policy are present',()=>{
  const arenaStatus={success:true,comparator:{executable:true,referenceId:'openai:gpt-6-astra'},attestation:{configured:true},policy:{candidateExecutionMustOccurInsideTrustedRuntime:true,simulatedGptForbidden:true}};
  const premiumStatus={success:true,readiness:{expectedReferenceId:'openai:gpt-6-astra',signedAttestationReady:true}};
  assert.equal(readinessGateV99({arenaStatus,premiumStatus}).ready,true);
  arenaStatus.comparator.referenceId='openai:gpt-other';
  assert.equal(readinessGateV99({arenaStatus,premiumStatus}).ready,false);
});

test('public v99 artifact is privacy-safe and never contains raw prompts or answers',()=>{
  const evidence=buildPublicEvidenceV99({
    suiteHash:hash('suite'),
    targetId:'universal_core',
    referenceId:'openai:gpt-6-astra',
    commitSha:'abc123',
    startedAt:'2026-09-16T18:00:00.000Z',
    completedAt:'2026-09-16T18:10:00.000Z',
    entryValidation:{ok:true,complete:true,count:64,uniqueCases:64,invalid:[]},
    readiness:{ready:true,checks:{}},
    arenaResult:{certification:{version:'verified-gpt-arena/v93',evaluatedCases:64,verdict:'NOT_PROVEN',claimAllowed:false,baseCertification:{aggregate:{wins:20,ties:10,losses:34},metrics:{targetMeanScore:.8}}},training:{version:'eval-training-loop/v95',mode:'benchmark_loss_to_regression_curriculum',counts:{total:2},promotionBlocked:true,baseModelWeightsChanged:false}},
    premiumResult:{premiumCertification:{version:'premium-superiority-gate/v98',verdict:'NOT_PROVEN',claimAllowed:false,gates:{}},claimAuthorization:{allowed:false,scope:'No superiority claim authorized.'}},
    executionSummary:{executedCases:64,failedCases:0,targetLatencyMs:{samples:64,p95Ms:1000},referenceLatencyMs:{samples:64,p95Ms:900}},
  });
  assert.equal(publicEvidenceIsSanitizedV99(evidence),true);
  assert.equal(evidence.privacy.rawAnswersPersisted,false);
  assert.equal(evidence.claimAuthorization.globalNumberOneClaimAllowed,false);
  assert.match(evidence.evidenceDigest,/^sha256:[a-f0-9]{64}$/);
});
