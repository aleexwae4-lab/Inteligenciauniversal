import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CAPACITY_CERTIFICATION_VERSION,
  CAPACITY_STAGES,
  architectureEvidenceForPrincipals,
  certifyCapacityEvidence,
  capacityAutopilotDecision,
  capacityEvidenceFingerprint
} from '../lib/capacity-certification-v65.js';

function balancedArchitecture(){
  const counts=Array.from({length:64},()=>312);
  for(let i=0;i<32;i++)counts[i]++;
  return architectureEvidenceForPrincipals({subscriberSamples:20_000,shardCounts:counts});
}

function stage(id,overrides={}){
  const policy=CAPACITY_STAGES.find(item=>item.id===id);
  return {
    id,
    concurrency:policy.minConcurrency,
    requests:policy.minRequests,
    durationSeconds:policy.minDurationSeconds,
    successRate:1,
    errorRate:0,
    p95Ms:Math.min(5_000,policy.maxP95Ms),
    p99Ms:Math.min(8_000,policy.maxP99Ms),
    lifecycleFalseFailureRate:0,
    overloadReplayViolations:0,
    unexpected5xx:0,
    ...overrides
  };
}

test('v65 requires architecture evidence and all four sequential load stages before certification',()=>{
  const evidence={architecture:balancedArchitecture(),stages:CAPACITY_STAGES.map(item=>stage(item.id)),environment:'production',commit:'abc123'};
  const diagnostic=certifyCapacityEvidence(evidence,{trusted:false});
  assert.equal(CAPACITY_CERTIFICATION_VERSION,'capacity-certification/v65');
  assert.equal(diagnostic.allRequiredStagesPass,true);
  assert.equal(diagnostic.technicalVerdict,'PEAK_THRESHOLDS_PASS');
  assert.equal(diagnostic.certificationVerdict,'NOT_CERTIFIED');
  assert.equal(diagnostic.currentInfrastructureLoadCertified,false);
  const trusted=certifyCapacityEvidence(evidence,{trusted:true});
  assert.equal(trusted.certificationVerdict,'PRODUCTION_PEAK_CERTIFIED');
  assert.equal(trusted.claimEligible,true);
});

test('a missing intermediate stage prevents peak certification even when peak itself passes',()=>{
  const evidence={architecture:balancedArchitecture(),stages:[stage('canary'),stage('scale'),stage('peak')]};
  const result=certifyCapacityEvidence(evidence,{trusted:true});
  assert.equal(result.allRequiredStagesPass,false);
  assert.equal(result.highestPassedStage,'canary');
  assert.equal(result.currentInfrastructureLoadCertified,false);
});

test('false UI failures and overload replay amplification are zero-tolerance gates',()=>{
  const base={architecture:balancedArchitecture(),stages:CAPACITY_STAGES.map(item=>stage(item.id))};
  const falseFailure=structuredClone(base);
  falseFailure.stages[3].lifecycleFalseFailureRate=0.0001;
  assert.equal(certifyCapacityEvidence(falseFailure,{trusted:true}).currentInfrastructureLoadCertified,false);
  const replay=structuredClone(base);
  replay.stages[3].overloadReplayViolations=1;
  assert.equal(certifyCapacityEvidence(replay,{trusted:true}).currentInfrastructureLoadCertified,false);
});

test('evidence fingerprint is deterministic and excludes raw prompts by contract',()=>{
  const evidence={architecture:balancedArchitecture(),stages:[stage('canary')],environment:'production',commit:'abc'};
  assert.equal(capacityEvidenceFingerprint(evidence),capacityEvidenceFingerprint(structuredClone(evidence)));
  assert.match(capacityEvidenceFingerprint(evidence),/^[a-f0-9]{64}$/);
});

test('capacity autopilot escalates from normal to throttle, degrade and shed',()=>{
  assert.equal(capacityAutopilotDecision({active:100,target:512,p95Ms:4000,errorRate:0}).mode,'NORMAL');
  assert.equal(capacityAutopilotDecision({active:350,target:512,p95Ms:4000,errorRate:0}).mode,'THROTTLE');
  assert.equal(capacityAutopilotDecision({active:430,target:512,p95Ms:4000,errorRate:0}).mode,'DEGRADE');
  const shed=capacityAutopilotDecision({active:500,target:512,p95Ms:4000,errorRate:0});
  assert.equal(shed.mode,'SHED');
  assert.equal(shed.allowNewExpensiveWork,false);
});

test('v65 migration stores only sanitized load evidence behind the runtime bridge token',async()=>{
  const sql=await readFile(new URL('../supabase/migrations/20260915202000_universal_core_v65_capacity_certification.sql',import.meta.url),'utf8');
  assert.match(sql,/wae_capacity_certifications_v65/);
  assert.match(sql,/wae_capacity_control_bridge_v65/);
  assert.match(sql,/universal_core_runtime_v63/);
  assert.match(sql,/evidence_hash/);
  assert.match(sql,/revoke all on public\.wae_capacity_certifications_v65 from anon, authenticated/i);
  assert.match(sql,/stores_prompt_content.*false/i);
  assert.match(sql,/concurrency.*>=.*512/is);
  assert.match(sql,/requests.*>=.*5000/is);
});

test('v65 is wired into chat admission, capabilities and the explicit API route',async()=>{
  const [chat,capabilities,server,api]=await Promise.all([
    readFile(new URL('../api/capacity-chat-v63.js',import.meta.url),'utf8'),
    readFile(new URL('../api/capabilities.js',import.meta.url),'utf8'),
    readFile(new URL('../server.js',import.meta.url),'utf8'),
    readFile(new URL('../api/capacity-certification.js',import.meta.url),'utf8')
  ]);
  assert.match(chat,/capacityAutopilotDecision/);
  assert.match(chat,/X-WAE-Capacity-Mode/);
  assert.match(chat,/CAPACITY_BUSY/);
  assert.match(capabilities,/capacityCertificationCapabilities/);
  assert.match(server,/\/api\/capacity-certification/);
  assert.match(api,/x-wae-worker-token/);
  assert.match(api,/trusted_worker_required/);
});
