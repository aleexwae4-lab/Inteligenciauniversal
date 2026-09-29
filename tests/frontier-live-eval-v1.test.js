import test from 'node:test';
import assert from 'node:assert/strict';
import { liveEvalContract, runLiveFrontierEvaluation } from '../lib/frontier-live-eval-v1.js';

test('live evaluation is bounded and policy controlled',()=>{
  const c=liveEvalContract();
  assert.equal(c.probeCount,8);
  assert.equal(c.policy.maxCases,8);
  assert.equal(c.policy.realRuntimeOnly,true);
});

test('runs against the supplied real-runtime adapter without synthetic scores',async()=>{
  const execute=async input=>({reply:input.message.includes('JSON')?'{"status":"PASS","action":"verify"}':'respuesta con latencia rendimiento disponibilidad',provider:'test-adapter',model:'test-runtime'});
  const r=await runLiveFrontierEvaluation({execute,maxCases:1,probes:[{id:'x',domain:'test',prompt:'JSON',grader:{type:'jsonEquals',expected:{status:'PASS',action:'verify'}}}]});
  assert.equal(r.status,'MEASURED');
  assert.equal(r.score,1);
  assert.equal(r.cases[0].provider,'test-adapter');
});

test('errors remain evidence and do not become zero scores',async()=>{
  const execute=async()=>{throw Object.assign(new Error('x'),{code:'provider_timeout'});};
  const r=await runLiveFrontierEvaluation({execute,maxCases:1,probes:[{id:'x',domain:'test',prompt:'x',grader:{type:'contains',terms:['x']}}]});
  assert.equal(r.status,'UNMEASURED');
  assert.equal(r.score,null);
  assert.equal(r.evidence.errors,1);
});
