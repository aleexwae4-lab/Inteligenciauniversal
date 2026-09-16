import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionReceipt, executeCapability, executionPlaneSnapshot, executionReceiptPersistenceState, resolveExecutionAdapter, EXECUTION_AUDIT_LEDGER_VERSION, EXECUTION_PLANE_VERSION } from '../lib/execution-plane.js';

function withEnv(patch,fn){
  const previous=Object.fromEntries(Object.keys(patch).map((key)=>[key,process.env[key]]));
  for(const [key,value] of Object.entries(patch)){if(value===null)delete process.env[key];else process.env[key]=value}
  return Promise.resolve().then(fn).finally(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}});
}

test('execution plane is fail-closed and exposes only read or pure-compute adapters',()=>{
  const snapshot=executionPlaneSnapshot();
  assert.equal(snapshot.version,EXECUTION_PLANE_VERSION);
  assert.equal(snapshot.policy.failClosed,true);
  assert.equal(snapshot.policy.mutationsEnabled,false);
  assert.ok(snapshot.adapters.length>=4);
  assert.ok(snapshot.adapters.every((adapter)=>['read','none'].includes(adapter.sideEffect)));
  assert.ok(snapshot.adapters.every((adapter)=>adapter.approvalRequired===false));
});

test('audit ledger prefers service role and supports a token-guarded write-only fallback',async()=>{
  await withEnv({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'service-test',SUPABASE_PUBLISHABLE_KEY:'public-test',WAE_RUNTIME_BRIDGE_TOKEN:'runtime-test'},()=>{
    const state=executionReceiptPersistenceState();
    assert.equal(state.version,EXECUTION_AUDIT_LEDGER_VERSION);
    assert.equal(state.mode,'service_role');
    assert.equal(state.configured,true);
    assert.equal(state.writeOnlyFallback,false);
  });
  await withEnv({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:null,SUPABASE_PUBLISHABLE_KEY:'public-test',WAE_RUNTIME_BRIDGE_TOKEN:'runtime-test'},()=>{
    const state=executionReceiptPersistenceState();
    assert.equal(state.mode,'token_guarded_rls');
    assert.equal(state.configured,true);
    assert.equal(state.durable,true);
    assert.equal(state.writeOnlyFallback,true);
    assert.equal(state.rawContentStored,false);
    assert.equal(state.identityHashesOnly,true);
  });
});

test('adapter resolution is explicit and unsupported capabilities never fall through',async()=>withEnv({TAVILY_API_KEY:'test-key',IA_GRATIS_API_TOKEN:null},()=>{
  assert.equal(resolveExecutionAdapter('web_search','')?.adapter.id,'web_search_read');
  assert.equal(resolveExecutionAdapter('software_engineering','search_code')?.adapter.id,'github_code_search_read');
  assert.equal(resolveExecutionAdapter('image_generation','generate'),null);
  assert.equal(resolveExecutionAdapter('computer_use','click'),null);
}));

test('ia.gratis can become the governed web-search recovery adapter when the primary search runtime is absent',async()=>withEnv({TAVILY_API_KEY:null,IA_GRATIS_API_TOKEN:'test-token'},()=>{
  const resolved=resolveExecutionAdapter('web_search','');
  assert.equal(resolved?.adapter.id,'ia_gratis_search_read');
  assert.equal(resolved?.tool.externalProcessing,true);
  assert.equal(resolved?.tool.tokenCost,50);
  assert.equal(resolved?.adapter.sideEffect,'read');
}));

test('execution receipts hash identities and payloads instead of storing raw secrets',()=>{
  const receipt=createExecutionReceipt({
    capability:'web_search',adapter:'web_search_read',action:'search',status:'completed',riskLevel:'low',sideEffect:'read',
    request:{task:'consulta sensible'},response:{ok:true},userKey:'raw-user-secret',sessionId:'raw-session-secret',latencyMs:12,
  });
  const serialized=JSON.stringify(receipt);
  assert.equal(receipt.request_hash.length,64);
  assert.equal(receipt.response_hash.length,64);
  assert.equal(receipt.user_key_hash.length,64);
  assert.equal(receipt.session_key_hash.length,64);
  assert.doesNotMatch(serialized,/raw-user-secret|raw-session-secret|consulta sensible/);
});

test('unsupported execution is blocked and still emits an auditable receipt',async()=>{
  const persisted=[];
  const result=await executeCapability({
    capability:'computer_use',action:'click',task:'Haz clic en guardar',userKey:'u1',sessionId:'s1',
    persistReceipt:async(receipt)=>{persisted.push(receipt);return{persisted:true}},
  });
  assert.equal(result.success,false);
  assert.equal(result.status,'blocked');
  assert.equal(result.error,'capability_not_executable');
  assert.equal(result.receipt.status,'blocked');
  assert.equal(result.receipt.error_code,'capability_not_executable');
  assert.equal(persisted.length,1);
});

test('configured read-only adapter executes through injected certified primitive',async()=>withEnv({TAVILY_API_KEY:'test-key',IA_GRATIS_API_TOKEN:null},async()=>{
  const persisted=[];
  const result=await executeCapability({
    capability:'web_search',task:'estado actual del sistema',userKey:'u2',sessionId:'s2',
    executors:{web_search_read:async({task})=>({sources:[{title:'Observed',url:'https://example.com',content:task}]})},
    persistReceipt:async(receipt)=>{persisted.push(receipt);return{persisted:true}},
  });
  assert.equal(result.success,true);
  assert.equal(result.status,'completed');
  assert.equal(result.receipt.side_effect,'read');
  assert.equal(result.receipt.risk_level,'low');
  assert.equal(result.audit.persisted,true);
  assert.equal(persisted.length,1);
}));

test('missing runtime blocks before executor invocation',async()=>withEnv({GITHUB_TOKEN:null},async()=>{
  let invoked=false;
  const result=await executeCapability({
    capability:'software_engineering',action:'search_code',task:'repo:owner/repo function router',
    executors:{github_code_search_read:async()=>{invoked=true;return{}}},
    persistReceipt:async()=>({persisted:true}),
  });
  assert.equal(result.success,false);
  assert.equal(result.error,'runtime_unconfigured');
  assert.equal(invoked,false);
}));
