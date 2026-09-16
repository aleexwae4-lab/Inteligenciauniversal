import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PREMIUM_SUPERIORITY_GATE_V98,
  PREMIUM_DEFAULT_REFERENCE,
  pairedPerformanceV98,
  premiumSuperiorityGateV98,
  premiumSuperiorityCapabilitiesV98,
} from '../lib/premium-superiority-gate-v98.js';

const targetId='universal_core';
const referenceId='openai:gpt-6-astra';
const entries=({targetLatency=800,referenceLatency=1000}={})=>Array.from({length:64},(_,index)=>({
  caseId:`case-${index+1}`,
  candidates:[
    {id:targetId,latencyMs:targetLatency+index},
    {id:referenceId,latencyMs:referenceLatency+index},
  ]
}));

const certification=()=>({
  schema:'verified-paired-benchmark-certification/v1',
  version:'verified-gpt-arena/v93',
  evaluatedCases:64,
  referenceId,
  claimAllowed:true,
  invalid:[],
  gates:{provenance:true},
  baseCertification:{
    evaluatedCases:64,
    claimAllowed:true,
    aggregate:{adjustedWinRate:.75,criticalFailureRate:0},
    metrics:{targetMeanScore:.91,referenceMeanScore:.86},
  }
});

const regressionStatus={critical_open:0,high_open:0,release_gate:'PASS'};

test('v98 certifies only a complete signed quality and latency win with clean regression backlog',()=>{
  const result=premiumSuperiorityGateV98({certification:certification(),entries:entries(),targetId,referenceId,regressionStatus});
  assert.equal(result.version,PREMIUM_SUPERIORITY_GATE_V98);
  assert.equal(result.certified,true);
  assert.equal(result.state,'CERTIFIED');
  assert.equal(result.claimAuthorization.allowed,true);
  assert.equal(result.gates.complete64,true);
  assert.equal(result.gates.exactReference,true);
  assert.equal(result.gates.qualityCertification,true);
  assert.equal(result.gates.p95NonInferior,true);
  assert.equal(result.gates.noHighRegressions,true);
});

test('v98 refuses a non-Astra comparator for the current premium campaign',()=>{
  const cert=certification();
  cert.referenceId='openai:gpt-5.6-sol';
  const result=premiumSuperiorityGateV98({certification:cert,entries:entries().map(row=>({...row,candidates:[row.candidates[0],{...row.candidates[1],id:'openai:gpt-5.6-sol'}]})),targetId,referenceId:'openai:gpt-5.6-sol',regressionStatus});
  assert.equal(result.certified,false);
  assert.equal(result.gates.exactReference,false);
  assert.ok(result.failed.includes('exactReference'));
});

test('v98 refuses promotion when target p95 is slower than the exact reference',()=>{
  const result=premiumSuperiorityGateV98({certification:certification(),entries:entries({targetLatency:1400,referenceLatency:900}),targetId,referenceId,regressionStatus});
  assert.equal(result.certified,false);
  assert.equal(result.gates.p95NonInferior,false);
  assert.ok(result.performance.target.p95_ms>result.performance.reference.p95_ms);
});

test('v98 fails closed when regression evidence has not been recorded',()=>{
  const result=premiumSuperiorityGateV98({certification:certification(),entries:entries(),targetId,referenceId});
  assert.equal(result.certified,false);
  assert.equal(result.gates.regressionEvidence,false);
  assert.equal(result.claimAuthorization.allowed,false);
});

test('v98 paired performance requires valid latency for both candidates across all 64 cases',()=>{
  const rows=entries();
  rows[7].candidates[0].latencyMs=null;
  const perf=pairedPerformanceV98({entries:rows,targetId,referenceId});
  assert.equal(perf.paired,64);
  assert.equal(perf.target.samples,63);
  assert.equal(perf.invalidTargetLatency,1);
  const result=premiumSuperiorityGateV98({certification:certification(),entries:rows,targetId,referenceId,regressionStatus});
  assert.equal(result.gates.latencyCoverage,false);
  assert.equal(result.certified,false);
});

test('v98 capabilities explicitly forbid global number-one claims and raw benchmark persistence',()=>{
  const cap=premiumSuperiorityCapabilitiesV98();
  assert.equal(cap.defaultExactReference,PREMIUM_DEFAULT_REFERENCE);
  assert.equal(cap.globalNumberOneClaimAllowed,false);
  const result=premiumSuperiorityGateV98({certification:certification(),entries:entries(),targetId,referenceId,regressionStatus});
  assert.equal(result.policy.globalNumberOneClaimAllowed,false);
  assert.equal(result.policy.rawPromptPersistence,false);
  assert.equal(result.policy.rawAnswerPersistence,false);
  assert.equal(result.policy.chainOfThoughtPersistence,false);
});
