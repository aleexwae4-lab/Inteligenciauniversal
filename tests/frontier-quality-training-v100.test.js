import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  binomialUpperTailV100,
  buildPremiumCurriculumV100,
  frontierCertificationV100,
  sealFrontierEvidenceV100,
  significanceAuditV100,
} from '../lib/frontier-quality-training-v100.js';

const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const entries=Array.from({length:64},(_,index)=>({caseId:`case-${index+1}`,promptHash:hash(`prompt-${index+1}`)}));

function certification({wins=48,ties=8,losses=8,claimAllowed=true,referenceId='openai:gpt-6-astra',regressions=[]}={}){
  return{
    schema:'verified-paired-benchmark-certification/v1',
    version:'verified-gpt-arena/v93',
    targetId:'universal_core',
    referenceId,
    evaluatedCases:64,
    claimAllowed,
    invalid:[],
    gates:{provenance:true},
    baseCertification:{
      evaluatedCases:64,
      claimAllowed,
      aggregate:{wins,ties,losses,adjustedWinRate:(wins+.5*ties)/64,criticalFailureRate:0},
      metrics:{targetMeanScore:.91,referenceMeanScore:.86,meanScoreDelta:.05},
      regressions,
    },
  };
}

const premium={certified:true,claimAuthorization:{allowed:true}};

test('exact binomial upper tail is conservative and detects clear advantage',()=>{
  assert.equal(binomialUpperTailV100(0,32),1);
  assert.ok(binomialUpperTailV100(32,32)<1e-8);
  assert.ok(binomialUpperTailV100(16,32)>.5);
  assert.equal(binomialUpperTailV100(33,32),0);
});

test('v100 significance audit requires decisive cases, direction and p-value',()=>{
  const strong=significanceAuditV100(certification());
  assert.equal(strong.significant,true);
  assert.equal(strong.decisiveCases,56);
  assert.ok(strong.oneSidedBinomialP<.05);

  const tied=significanceAuditV100(certification({wins:16,ties:32,losses:16,claimAllowed:false}));
  assert.equal(tied.significant,false);
  assert.equal(tied.decisiveCases,32);

  const lowDecisive=significanceAuditV100(certification({wins:20,ties:40,losses:4,claimAllowed:false}));
  assert.equal(lowDecisive.significant,false);
  assert.equal(lowDecisive.decisiveCases,24);
});

test('v100 builds privacy-safe weighted remediation curriculum',()=>{
  const regressions=[
    {caseId:'case-1',targetScore:.5,referenceScore:.9,failureTags:['factual','citation']},
    {caseId:'case-2',targetScore:.7,referenceScore:.8,failureTags:['latency']},
    {caseId:'case-3',targetScore:.2,referenceScore:.9,failureTags:['prompt_injection','secret']},
  ];
  const curriculum=buildPremiumCurriculumV100({certification:certification({regressions}),entries});
  assert.equal(curriculum.counts.total,3);
  assert.equal(curriculum.counts.critical,1);
  assert.equal(curriculum.counts.high,1);
  assert.equal(curriculum.counts.medium,1);
  assert.equal(curriculum.criticalHold,true);
  assert.equal(curriculum.items[0].severity,'critical');
  assert.equal(curriculum.items[0].persistRawPrompt,false);
  assert.equal(curriculum.items[0].persistRawAnswers,false);
  assert.equal(curriculum.items[0].persistChainOfThought,false);
  assert.match(curriculum.items[0].promptHash,/^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(curriculum).includes('prompt-1'),false);
});

test('v100 certifies only a complete exact signed statistically significant premium run',()=>{
  const result=frontierCertificationV100({
    certification:certification(),
    training:{counts:{critical:0,high:2,medium:1,low:0,total:3}},
    premiumCertification:premium,
    entries,
    referenceId:'openai:gpt-6-astra',
  });
  assert.equal(result.certified,true);
  assert.equal(result.state,'CERTIFIED');
  assert.deepEqual(result.failed,[]);
  assert.equal(result.claimAuthorization.allowed,true);
  assert.equal(result.claimAuthorization.globalNumberOneClaimAllowed,false);
  assert.equal(result.training.baseModelWeightsChanged,false);
});

test('v100 fails closed on identity, integrity, premium, significance and critical regressions',()=>{
  const mismatch=frontierCertificationV100({certification:certification({referenceId:'openai:gpt-6-other'}),premiumCertification:premium,entries,referenceId:'openai:gpt-6-other'});
  assert.equal(mismatch.certified,false);
  assert.ok(mismatch.failed.includes('exactReference'));

  const incomplete=frontierCertificationV100({certification:certification(),premiumCertification:premium,entries:entries.slice(0,63),referenceId:'openai:gpt-6-astra'});
  assert.equal(incomplete.certified,false);
  assert.ok(incomplete.failed.includes('entryIntegrity'));

  const premiumHold=frontierCertificationV100({certification:certification(),premiumCertification:{certified:false,claimAuthorization:{allowed:false}},entries,referenceId:'openai:gpt-6-astra'});
  assert.equal(premiumHold.certified,false);
  assert.ok(premiumHold.failed.includes('premiumCertification'));

  const noisy=frontierCertificationV100({certification:certification({wins:20,ties:24,losses:20,claimAllowed:false}),premiumCertification:premium,entries,referenceId:'openai:gpt-6-astra'});
  assert.equal(noisy.certified,false);
  assert.ok(noisy.failed.includes('statisticalSignificance'));

  const regressions=[{caseId:'case-1',targetScore:.1,referenceScore:.9,failureTags:['prompt_injection']}];
  const critical=frontierCertificationV100({certification:certification({regressions}),training:{counts:{critical:1}},premiumCertification:premium,entries,referenceId:'openai:gpt-6-astra'});
  assert.equal(critical.certified,false);
  assert.ok(critical.failed.includes('noCriticalCurrentRegressions'));
});

test('v100 sealed evidence includes frontier decision in the digest and preserves benchmark scope',()=>{
  const frontier=frontierCertificationV100({certification:certification(),premiumCertification:premium,entries,referenceId:'openai:gpt-6-astra'});
  const base={schema:'universal-core-verified-benchmark-public-evidence/v1',evidenceDigest:`sha256:${hash('v99')}`,privacy:{rawPromptsPersisted:false,rawAnswersPersisted:false,chainOfThoughtPersisted:false,secretsPersisted:false}};
  const sealed=sealFrontierEvidenceV100({baseEvidence:base,frontier});
  assert.equal(sealed.schema,'universal-core-frontier-evidence/v100');
  assert.equal(sealed.claimAuthorization.allowed,true);
  assert.equal(sealed.claimAuthorization.globalNumberOneClaimAllowed,false);
  assert.match(sealed.evidenceDigest,/^sha256:[a-f0-9]{64}$/);
  assert.equal(sealed.previousEvidenceDigest,base.evidenceDigest);

  const changed=sealFrontierEvidenceV100({baseEvidence:base,frontier:{...frontier,certified:false,claimAuthorization:{...frontier.claimAuthorization,allowed:false}}});
  assert.notEqual(changed.evidenceDigest,sealed.evidenceDigest);
});
