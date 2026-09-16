import test from 'node:test';
import assert from 'node:assert/strict';
import { EXECUTIVE_LOCAL_RECOVERY_VERSION, localExecutiveRecoveryEligible, publicOrchestrationResult, runLocalExecutiveRecovery } from '../api/orchestrate.js';

test('executive local recovery is restricted to deterministic protocol prompts',()=>{
  assert.equal(localExecutiveRecoveryEligible({mode:'analysis'},'Responde exactamente con la palabra OK.'),true);
  assert.equal(localExecutiveRecoveryEligible({mode:'analysis'},'Hola'),true);
  assert.equal(localExecutiveRecoveryEligible({mode:'analysis'},'Analiza mi empresa completa y crea una estrategia de 12 meses.'),false);
  assert.equal(localExecutiveRecoveryEligible({web_enabled:true},'Hola'),false);
  assert.equal(localExecutiveRecoveryEligible({attachments:[{name:'secret.pdf'}]},'Hola'),false);
});

test('local executive recovery returns a real degraded orchestration envelope without external calls',async()=>{
  const result=await runLocalExecutiveRecovery({
    body:{mode:'analysis'},
    message:'Responde exactamente con la palabra OK.',
    userKey:'smoke-local',
    reason:'provider_unavailable',
  });
  assert.ok(result);
  assert.equal(result.success,true);
  assert.equal(result.reply,'OK');
  assert.equal(result.deep,true);
  assert.equal(result.degraded,true);
  assert.equal(result.orchestration.db_backed,false);
  assert.equal(result.orchestration.version,EXECUTIVE_LOCAL_RECOVERY_VERSION);
  assert.equal(result.orchestration.specialists.length,1);
  assert.equal(result.orchestration.specialists[0].ok,true);
  assert.equal(result.response.metadata.recovery,'universal-core-local-v85.2');
  assert.equal(result.resilience.path,'deterministic_protocol');
});

test('public executive recovery contract strips provider and model identity',async()=>{
  const result=await runLocalExecutiveRecovery({body:{mode:'analysis'},message:'Responde exactamente con la palabra OK.',userKey:'public-local'});
  const payload=publicOrchestrationResult(result,{});
  assert.equal(payload.deep,true);
  assert.equal(payload.orchestration.schema,'universal-orchestrator/v1');
  assert.equal(payload.orchestration.synthesis,'executive');
  assert.equal(payload.orchestration.specialists.length,1);
  assert.equal('provider' in payload,false);
  assert.equal('model' in payload,false);
  assert.equal('provider' in payload.response.metadata,false);
  assert.equal('model' in payload.response.metadata,false);
});
