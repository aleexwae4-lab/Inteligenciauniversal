import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAPABILITY_KERNEL_VERSION,
  TOOL_RECEIPT_VERSION,
  buildToolReceipt,
  planCapabilities,
  publicToolMetadata,
  sha256Evidence,
} from '../lib/capability-kernel.js';
import { evaluateMissionOutput, EVALS_VERSION } from '../lib/evals.js';
import { publicMissionResult, publicRuntimeHealth } from '../lib/runtime.js';

test('capability kernel allows readonly work and blocks writes without explicit approval', () => {
  const registry = [
    { id:'search', configured:true, readonly:true, risk:'low', requiresApproval:false },
    { id:'deploy', configured:true, readonly:false, risk:'high', requiresApproval:true },
  ];
  const plan = planCapabilities({
    agent:{tools:['search']},
    message:'investiga y despliega después',
    requestedTools:['deploy'],
    registry,
  });
  assert.equal(plan.schema, CAPABILITY_KERNEL_VERSION);
  assert.equal(plan.intent, 'action');
  assert.equal(plan.tools.find(x=>x.id==='search').allowed, true);
  assert.equal(plan.tools.find(x=>x.id==='deploy').allowed, false);
  assert.equal(plan.tools.find(x=>x.id==='deploy').reason, 'approval_required');

  const approved = planCapabilities({
    agent:{tools:[]}, message:'deploy', requestedTools:['deploy'], registry, approval:true,
  });
  assert.equal(approved.tools[0].allowed, true);
});

test('tool receipts bind execution evidence to sha256 without exposing evidence payload', () => {
  const payload = {rows:[{id:1,value:'observed'}]};
  const receipt = buildToolReceipt({
    tool:'search', ok:true, status:'completed', readonly:true, risk:'low', durationMs:12, payload,
  });
  assert.equal(receipt.schema, TOOL_RECEIPT_VERSION);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.evidenceSha256, sha256Evidence(payload));
  assert.match(receipt.evidenceSha256, /^[a-f0-9]{64}$/);
  assert.equal('payload' in receipt, false);
});

test('public tool metadata exposes capability state but not internal configuration fields', () => {
  const meta = publicToolMetadata({
    id:'web_search', configured:true, readonly:true, risk:'low', category:'research', description:'Buscar', secret:'never',
  });
  assert.deepEqual(meta, {
    id:'web_search', category:'research', available:true, readonly:true, risk:'low', requiresApproval:false, description:'Buscar',
  });
  assert.equal('configured' in meta, false);
  assert.equal('secret' in meta, false);
});

test('public runtime health and mission result do not expose provider or model internals', () => {
  const health = publicRuntimeHealth();
  assert.equal('providers' in health, false);
  assert.equal('provider' in health.continuity, false);
  assert.equal('model' in health.continuity, false);
  assert.equal(health.capabilityKernel.schema, CAPABILITY_KERNEL_VERSION);

  const result = publicMissionResult({
    reply:'Respuesta verificable', provider:'internal-provider', model:'internal-model', fallbackFailures:[{secret:true}],
    response:{metadata:{provider:'internal-provider',model:'internal-model',requestId:'r1'}},
    tools:[{tool:'web_search',ok:true,data:[{secret:'evidence'}],receipt:{id:'receipt-1'}}],
  });
  assert.equal('provider' in result, false);
  assert.equal('model' in result, false);
  assert.equal('fallbackFailures' in result, false);
  assert.equal('provider' in result.response.metadata, false);
  assert.equal('model' in result.response.metadata, false);
  assert.equal('data' in result.tools[0], false);
  assert.equal(result.tools[0].receipt.id, 'receipt-1');
});

test('deterministic quality gate rewards specialist coverage and receipted evidence', () => {
  const evaluation = evaluateMissionOutput({
    reply:'Universal Core entrega una respuesta suficientemente desarrollada, accionable y basada en evidencia verificable para completar esta prueba determinista sin exponer detalles internos.',
    specialists:[{reply:'analysis'},{reply:'code'}],
    toolResults:[{ok:true,receipt:{status:'completed',evidenceSha256:'a'.repeat(64)}}],
    elapsedMs:250,
  });
  assert.equal(evaluation.schema, EVALS_VERSION);
  assert.equal(evaluation.pass, true);
  assert.equal(evaluation.score, 100);
  assert.equal(evaluation.note.includes('not a benchmark'), true);
});
