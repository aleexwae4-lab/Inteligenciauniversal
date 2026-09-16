import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVAL_TRAINING_LOOP_V95,
  buildRegressionCurriculumV95,
  evalTrainingCapabilitiesV95,
  promotionDecisionV95,
  verifiedTrainingReadinessV95,
} from '../lib/eval-training-loop-v95.js';

const certification={
  schema:'verified-paired-benchmark-certification/v1',
  version:'verified-gpt-arena/v93',
  evaluatedCases:64,
  gates:{provenance:true},
  baseCertification:{
    evaluatedCases:64,
    invalid:[],
    gates:{fullPairedSuite:true},
    regressions:[
      {caseId:'research-1',failureTags:['assertion:minimum_sources','evidence:missing'],targetScore:.71,referenceScore:.92},
      {caseId:'efficiency-1',failureTags:['performance:latency_budget'],targetScore:.80,referenceScore:.89},
    ]
  }
};
const entries=[
  {caseId:'research-1',promptHash:'a'.repeat(64),candidates:[{answer:'secret target'},{answer:'secret reference'}]},
  {caseId:'efficiency-1',promptHash:'b'.repeat(64),candidates:[{answer:'secret target 2'},{answer:'secret reference 2'}]},
];

test('v95 training requires a complete signed 64-case v93 provenance gate',()=>{
  const ready=verifiedTrainingReadinessV95(certification);
  assert.equal(ready.ready,true);
  assert.equal(ready.baseModelWeightsChanged,false);
  assert.equal(verifiedTrainingReadinessV95({...certification,evaluatedCases:63}).ready,false);
  assert.equal(verifiedTrainingReadinessV95({...certification,gates:{provenance:false}}).ready,false);
  assert.equal(verifiedTrainingReadinessV95({...certification,baseCertification:{...certification.baseCertification,gates:{fullPairedSuite:false}}}).ready,false);
});

test('benchmark losses become privacy-safe regression curriculum items without raw answers',()=>{
  const curriculum=buildRegressionCurriculumV95({certification,entries});
  assert.equal(curriculum.version,EVAL_TRAINING_LOOP_V95);
  assert.equal(curriculum.ready,true);
  assert.equal(curriculum.items.length,2);
  assert.equal(curriculum.items[0].remediationLane,'retrieval_grounding');
  assert.equal(curriculum.items[0].severity,'high');
  assert.equal(curriculum.items[1].remediationLane,'routing_latency');
  const serialized=JSON.stringify(curriculum);
  assert.doesNotMatch(serialized,/secret target|secret reference/);
  assert.equal(curriculum.privacy.rawPromptPersisted,false);
  assert.equal(curriculum.privacy.rawAnswersPersisted,false);
});

test('high regressions block promotion even when latency improves',()=>{
  const curriculum=buildRegressionCurriculumV95({certification,entries});
  const decision=promotionDecisionV95({
    baseline:{p95_ms:10000,error_rate:0,quality_score:.90},
    candidate:{p95_ms:7000,error_rate:0,quality_score:.93,samples:50},
    curriculum,
    qualityGate:true,factualityGate:true,securityGate:true,
  });
  assert.equal(decision.gates.latencyGate,true);
  assert.equal(decision.gates.regressionGate,false);
  assert.equal(decision.promote,false);
});

test('promotion requires >=5% P95 improvement, no error increase, no quality regression and zero critical/high regressions',()=>{
  const cleanCurriculum={ready:true,counts:{critical:0,high:0,medium:1,low:0,total:1}};
  const decision=promotionDecisionV95({
    baseline:{p95_ms:10000,error_rate:.01,quality_score:.90},
    candidate:{p95_ms:9000,error_rate:.005,quality_score:.92,samples:40},
    curriculum:cleanCurriculum,
    qualityGate:true,factualityGate:true,securityGate:true,
  });
  assert.equal(decision.promote,true);
  assert.equal(decision.state,'PROMOTE');
  assert.equal(decision.measured.p95ImprovementPct,10);
  assert.equal(promotionDecisionV95({baseline:{p95_ms:10000,error_rate:0,quality_score:.9},candidate:{p95_ms:9800,error_rate:0,quality_score:.95,samples:40},curriculum:cleanCurriculum}).promote,false);
});

test('v95 capabilities never pretend base-weight training or global number-one proof',()=>{
  const caps=evalTrainingCapabilitiesV95();
  assert.equal(caps.trainingMode,'eval_driven_shadow_training');
  assert.equal(caps.baseModelWeightsChanged,false);
  assert.equal(caps.claimPolicy.globalNumberOneClaimAllowed,false);
  assert.equal(caps.claimPolicy.externalReferenceMustBeExactAndExecuted,true);
});
