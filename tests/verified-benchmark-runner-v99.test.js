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
const clonedEntries=()=>structuredClone(entries);
const validate=value=>validateAttestedEntriesV99({entries:value,suite,targetId:'universal_core',referenceId:'openai:gpt-6-astra'});

function expectedFailure(mutator,reason){
  const rows=clonedEntries();
  mutator(rows);
  const result=validate(rows);
  assert.equal(result.ok,false);
  assert.equal(result.invalid.some(item=>item.reason===reason),true,JSON.stringify(result.invalid));
  return result;
}

test('v99 requires exactly 64 unique immutable cases',()=>{
  assert.equal(validateSuiteV99(suite).ok,true);
  assert.equal(validateSuiteV99(suite.slice(0,63)).ok,false);
  assert.equal(validateSuiteV99([...suite.slice(0,63),suite[0]]).ok,false);
  assert.equal(validateSuiteV99(null).ok,false);

  const missingId=structuredClone(suite);
  missingId[0].id='';
  assert.equal(validateSuiteV99(missingId).invalid[0].reason,'missing_case_id');

  const badHash=structuredClone(suite);
  badHash[0].promptHash='not-a-sha256';
  assert.equal(validateSuiteV99(badHash).invalid[0].reason,'invalid_prompt_hash');
});

test('v99 accepts complete paired signed entries with exact target and Astra identity',()=>{
  const result=validate(entries);
  assert.equal(result.ok,true);
  assert.equal(result.complete,true);
  assert.equal(result.count,64);
  assert.equal(result.uniqueCases,64);
  assert.deepEqual(result.invalid,[]);
});

test('v99 rejects unknown duplicate and hash-tampered benchmark cases',()=>{
  expectedFailure(rows=>{ rows[0].caseId='case-does-not-exist'; },'unknown_case');
  expectedFailure(rows=>{ rows[1].caseId=rows[0].caseId; rows[1].promptHash=rows[0].promptHash; },'duplicate_case');
  expectedFailure(rows=>{ rows[2].promptHash=hash('tampered'); },'prompt_hash_mismatch');
});

test('v99 rejects missing or empty candidates before certification',()=>{
  expectedFailure(rows=>{ rows[3].candidates=rows[3].candidates.filter(candidate=>candidate.id!=='openai:gpt-6-astra'); },'missing_target_or_reference');
  expectedFailure(rows=>{ rows[4].candidates[0].answer=''; },'empty_target_answer');
  expectedFailure(rows=>{ rows[5].candidates[1].answer=''; },'empty_reference_answer');

  const textFallback=clonedEntries();
  textFallback[6].candidates[0].answer=undefined;
  textFallback[6].candidates[0].text='target via text';
  textFallback[6].candidates[1].answer=undefined;
  textFallback[6].candidates[1].text='reference via text';
  assert.equal(validate(textFallback).ok,true);
});

test('v99 rejects malformed target and reference latency',()=>{
  expectedFailure(rows=>{ rows[7].candidates[0].latencyMs='not-finite'; },'invalid_target_latency');
  expectedFailure(rows=>{ rows[8].candidates[0].latencyMs=-1; },'invalid_target_latency');
  expectedFailure(rows=>{ rows[9].candidates[1].latencyMs='NaN'; },'invalid_reference_latency');
  expectedFailure(rows=>{ rows[10].candidates[1].latencyMs=-4; },'invalid_reference_latency');
});

test('v99 validates attestation identity hash and proof material for both sides',()=>{
  expectedFailure(rows=>{ rows[11].candidates[0].attestation=null; },'invalid_target_attestation');
  expectedFailure(rows=>{ rows[12].candidates[0].attestation.signed=false; },'invalid_target_attestation');
  expectedFailure(rows=>{ rows[13].candidates[0].attestation.caseId='wrong-case'; },'invalid_target_attestation');
  expectedFailure(rows=>{ rows[14].candidates[0].attestation.promptHash=hash('wrong-prompt'); },'invalid_target_attestation');
  expectedFailure(rows=>{ rows[15].candidates[0].attestation.signature=''; rows[15].candidates[0].attestation.responseId=''; },'invalid_target_attestation');
  expectedFailure(rows=>{ rows[16].candidates[1].attestation=null; },'invalid_reference_attestation');
  expectedFailure(rows=>{ rows[17].candidates[1].attestation.signed=false; },'invalid_reference_attestation');

  const proofAliases=clonedEntries();
  proofAliases[18].candidates[0].attestation.signature='';
  proofAliases[18].candidates[0].attestation.responseId='';
  proofAliases[18].candidates[0].attestation.signatureHash=hash('signature-hash');
  proofAliases[18].candidates[1].attestation.signature='';
  proofAliases[18].candidates[1].attestation.responseId='';
  proofAliases[18].candidates[1].attestation.requestId='request-proof';
  assert.equal(validate(proofAliases).ok,true);
});

test('v99 completeness and identity gates fail closed',()=>{
  const incomplete=validate(entries.slice(0,63));
  assert.equal(incomplete.ok,false);
  assert.equal(incomplete.complete,false);

  assert.equal(validateAttestedEntriesV99({entries,suite,targetId:'universal_core',referenceId:''}).ok,false);
  assert.equal(validateAttestedEntriesV99({entries,suite,targetId:'universal_core',referenceId:'universal_core'}).ok,false);
  assert.equal(validateAttestedEntriesV99({entries:null,suite,targetId:'universal_core',referenceId:'openai:gpt-6-astra'}).count,0);

  const invalidSuite=structuredClone(suite);
  invalidSuite.pop();
  assert.equal(validateAttestedEntriesV99({entries:entries.slice(0,63),suite:invalidSuite,targetId:'universal_core',referenceId:'openai:gpt-6-astra'}).suite.ok,false);
});

const healthyArena=()=>({
  success:true,
  comparator:{executable:true,referenceId:'openai:gpt-6-astra'},
  attestation:{configured:true},
  policy:{candidateExecutionMustOccurInsideTrustedRuntime:true,simulatedGptForbidden:true},
});
const healthyPremium=()=>({success:true,readiness:{expectedReferenceId:'openai:gpt-6-astra',signedAttestationReady:true}});

test('v99 readiness passes only when every trusted-runtime prerequisite passes',()=>{
  assert.equal(readinessGateV99({arenaStatus:healthyArena(),premiumStatus:healthyPremium()}).ready,true);
  const mutations=[
    arena=>{arena.success=false;},
    (_arena,premium)=>{premium.success=false;},
    arena=>{arena.comparator.executable=false;},
    arena=>{arena.comparator.referenceId='openai:gpt-other';},
    (_arena,premium)=>{premium.readiness.expectedReferenceId='openai:gpt-other';},
    arena=>{arena.attestation.configured=false;},
    (_arena,premium)=>{premium.readiness.signedAttestationReady=false;},
    arena=>{arena.policy.candidateExecutionMustOccurInsideTrustedRuntime=false;},
    arena=>{arena.policy.simulatedGptForbidden=false;},
  ];
  for(const mutate of mutations){
    const arena=healthyArena();
    const premium=healthyPremium();
    mutate(arena,premium);
    assert.equal(readinessGateV99({arenaStatus:arena,premiumStatus:premium}).ready,false);
  }
  const defaults=readinessGateV99();
  assert.equal(defaults.ready,false);
  assert.equal(defaults.observedReferenceId,null);
});

test('public v99 artifact emits quality training premium and latency evidence without raw content',()=>{
  const evidence=buildPublicEvidenceV99({
    suiteHash:hash('suite'),
    targetId:'universal_core',
    referenceId:'openai:gpt-6-astra',
    commitSha:'abc123',
    startedAt:'2026-09-16T18:00:00.000Z',
    completedAt:'2026-09-16T18:10:00.000Z',
    entryValidation:{ok:true,complete:true,count:64,uniqueCases:64,invalid:[]},
    readiness:{ready:true,checks:{}},
    arenaResult:{
      certification:{version:'verified-gpt-arena/v93',evaluatedCases:64,verdict:'NOT_PROVEN',claimAllowed:false,gates:{coverage:true},baseCertification:{aggregate:{wins:20,ties:10,losses:34},metrics:{targetMeanScore:.8}}},
      training:{version:'eval-training-loop/v95',mode:'benchmark_loss_to_regression_curriculum',counts:{total:2},promotionBlocked:true,baseModelWeightsChanged:false},
      claimAuthorization:{scope:'Arena fallback scope'},
    },
    premiumResult:{premiumCertification:{version:'premium-superiority-gate/v98',verdict:'NOT_PROVEN',claimAllowed:false,gates:{quality:false}},claimAuthorization:{allowed:false,scope:'No superiority claim authorized.'}},
    executionSummary:{executedCases:64,failedCases:0,targetLatencyMs:{samples:64,p95Ms:1000},referenceLatencyMs:{samples:64,p95Ms:900}},
  });
  assert.equal(publicEvidenceIsSanitizedV99(evidence),true);
  assert.equal(evidence.privacy.rawPromptsPersisted,false);
  assert.equal(evidence.privacy.rawAnswersPersisted,false);
  assert.equal(evidence.privacy.chainOfThoughtPersisted,false);
  assert.equal(evidence.privacy.secretsPersisted,false);
  assert.equal(evidence.claimAuthorization.globalNumberOneClaimAllowed,false);
  assert.equal(evidence.claimAuthorization.benchmarkScopedOnly,true);
  assert.equal(evidence.quality.aggregate.wins,20);
  assert.equal(evidence.training.promotionBlocked,true);
  assert.match(evidence.evidenceDigest,/^sha256:[a-f0-9]{64}$/);
});

test('public v99 artifact supports quality fallbacks and conservative defaults',()=>{
  const directQuality=buildPublicEvidenceV99({
    arenaResult:{qualityCertification:{version:'direct-quality',aggregate:{wins:64},metrics:{targetMeanScore:1},claimAllowed:true},premiumCertification:{version:'arena-premium',verdict:'PASS',claimAllowed:true,gates:{quality:true}},claimAuthorization:{scope:'arena scoped'}},
    premiumResult:{claimAuthorization:{allowed:true}},
    entryValidation:{invalid:[{reason:'x'}]},
    executionSummary:{targetLatencyMs:{p95Ms:500},referenceLatencyMs:{p95Ms:700},failedCases:1},
  });
  assert.equal(directQuality.quality.version,'direct-quality');
  assert.equal(directQuality.quality.aggregate.wins,64);
  assert.equal(directQuality.quality.metrics.targetMeanScore,1);
  assert.equal(directQuality.premium.version,'arena-premium');
  assert.equal(directQuality.claimAuthorization.allowed,true);
  assert.equal(directQuality.claimAuthorization.scope,'arena scoped');
  assert.equal(directQuality.validation.invalidCount,1);

  const defaults=buildPublicEvidenceV99();
  assert.equal(defaults.quality.verdict,'NOT_PROVEN');
  assert.equal(defaults.premium.verdict,'NOT_PROVEN');
  assert.equal(defaults.claimAuthorization.allowed,false);
  assert.equal(defaults.claimAuthorization.scope,'No superiority claim authorized.');
  assert.equal(defaults.suite.executedCases,0);
  assert.equal(defaults.execution.failedCases,0);
  assert.equal(defaults.training.baseModelWeightsChanged,false);
});

test('public evidence sanitizer rejects raw answers prompts secrets and chain-of-thought markers',()=>{
  assert.equal(publicEvidenceIsSanitizedV99({safe:'hash-only'}),true);
  assert.equal(publicEvidenceIsSanitizedV99({answer:'raw'}),false);
  assert.equal(publicEvidenceIsSanitizedV99({prompt:'raw'}),false);
  assert.equal(publicEvidenceIsSanitizedV99({chainOfThought:'private'}),false);
  assert.equal(publicEvidenceIsSanitizedV99({api_key:'secret'}),false);
  assert.equal(publicEvidenceIsSanitizedV99({authorization:'Bearer secret'}),false);
  assert.equal(publicEvidenceIsSanitizedV99({'x-wae-worker-token':'secret'}),false);
  assert.equal(publicEvidenceIsSanitizedV99(null),true);
});
