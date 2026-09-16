import test from 'node:test';
import assert from 'node:assert/strict';
import { EXECUTION_LEDGER_VERSION, executionLedgerState, persistExecutionReceipt } from '../lib/execution-ledger-v75.js';

const receipt={
  id:'11111111-1111-4111-8111-111111111111',
  created_at:'2026-09-16T00:00:00.000Z',
  finished_at:'2026-09-16T00:00:00.010Z',
  capability_id:'computer_use',
  domain_id:'computer_use',
  adapter:'none',
  action:'unsupported',
  status:'blocked',
  risk_level:'high',
  side_effect:'none',
  approval_required:false,
  approved:false,
  request_hash:'a'.repeat(64),
  response_hash:null,
  user_key_hash:'b'.repeat(64),
  session_key_hash:'c'.repeat(64),
  latency_ms:10,
  error_code:'capability_not_executable',
  metadata:{failClosed:true},
};

test('ledger fails closed when no persistence transport is configured',async()=>{
  const result=await persistExecutionReceipt(receipt,{env:{},fetchImpl:async()=>{throw new Error('should_not_call')},rpcCaller:async()=>{throw new Error('should_not_call')}});
  assert.equal(result.persisted,false);
  assert.equal(result.reason,'receipt_bridge_unconfigured');
});

test('service-role direct persistence remains the preferred path',async()=>{
  let calledUrl='';
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret',WAE_RUNTIME_BRIDGE_TOKEN:'bridge-secret'};
  const result=await persistExecutionReceipt(receipt,{
    env,
    fetchImpl:async(url,options)=>{calledUrl=url;assert.match(options.headers.Authorization,/^Bearer /);return{ok:true,status:201}},
    rpcCaller:async()=>{throw new Error('bridge_should_not_run')},
  });
  assert.equal(result.persisted,true);
  assert.equal(result.transport,'service_role_direct');
  assert.match(calledUrl,/universal_execution_receipts_v37$/);
});

test('publishable transport uses the private-token v75 bridge',async()=>{
  let call=null;
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable-value',WAE_RUNTIME_BRIDGE_TOKEN:'private-bridge-token'};
  const result=await persistExecutionReceipt(receipt,{
    env,
    rpcCaller:async(args)=>{call=args;return{ok:true,payload:{ok:true,persisted:true,receipt_id:receipt.id}}},
  });
  assert.equal(result.persisted,true);
  assert.equal(result.transport,'token_bridge_v75');
  assert.equal(result.version,EXECUTION_LEDGER_VERSION);
  assert.equal(call.functionName,'wae_record_execution_receipt_v75');
  assert.equal(call.body.p_token,'private-bridge-token');
  assert.equal(call.body.p_receipt.request_hash,'a'.repeat(64));
});

test('bridge rejection never becomes a false persisted receipt',async()=>{
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'publishable-value',WAE_RUNTIME_BRIDGE_TOKEN:'wrong-token'};
  const result=await persistExecutionReceipt(receipt,{
    env,
    rpcCaller:async()=>({ok:true,payload:{ok:false,error:'receipt_persist_failed'}}),
  });
  assert.equal(result.persisted,false);
  assert.equal(result.reason,'receipt_persist_failed');
});

test('ledger state exposes posture but never credential material',()=>{
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-secret',SUPABASE_PUBLISHABLE_KEY:'publishable-secret',WAE_RUNTIME_BRIDGE_TOKEN:'bridge-secret'};
  const state=executionLedgerState(env);
  const encoded=JSON.stringify(state);
  assert.equal(state.configured,true);
  assert.equal(state.directServiceRole,true);
  assert.equal(state.bridgeReady,true);
  assert.equal(state.rlsBypassExposed,false);
  assert.equal(encoded.includes('service-secret'),false);
  assert.equal(encoded.includes('publishable-secret'),false);
  assert.equal(encoded.includes('bridge-secret'),false);
});
