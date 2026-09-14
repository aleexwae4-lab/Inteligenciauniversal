import test from 'node:test';
import assert from 'node:assert/strict';
import performanceHandler from '../api/performance.js';

function responseMock(){
  return {
    statusCode:200,headers:{},payload:null,
    setHeader(k,v){this.headers[k]=v},
    status(code){this.statusCode=code;return this},
    json(payload){this.payload=payload;return this}
  };
}

test('performance endpoint rejects non-GET requests',async()=>{
  const res=responseMock();
  await performanceHandler({method:'POST'},res);
  assert.equal(res.statusCode,405);
  assert.equal(res.payload.error,'method_not_allowed');
});

test('performance endpoint can use public Supabase defaults without privileged credentials',async()=>{
  const originalFetch=globalThis.fetch;
  const previous={
    url:process.env.SUPABASE_URL,
    service:process.env.SUPABASE_SERVICE_ROLE_KEY,
    publishable:process.env.SUPABASE_PUBLISHABLE_KEY,
    anon:process.env.SUPABASE_ANON_KEY,
  };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  globalThis.fetch=async(url,init)=>{
    assert.match(String(url),/^https:\/\/pbswcbryxawsmltyromd\.supabase\.co\/rest\/v1\/rpc\/iu_performance_gate_v2$/);
    assert.match(String(init?.headers?.apikey||''),/^sb_publishable_/);
    return new Response(JSON.stringify({schema:'universal-performance-gate/v2',routing_state:'HOLD',candidate_promotable:false,stream_ready:false,fast_lane_ready:true,control:{ok:50,errors:2,p95_ms:5000},candidate:{ok:50,errors:1,p95_ms:7000}}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const res=responseMock();
    await performanceHandler({method:'GET'},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.payload.success,true);
    assert.equal(res.payload.core,'Universal Core');
    assert.equal(res.payload.performance.available,true);
    assert.equal(res.payload.performance.routing_state,'HOLD');
    assert.equal(res.payload.performance.candidate_promotable,false);
  } finally {
    globalThis.fetch=originalFetch;
    const restore=(name,value)=>value===undefined?delete process.env[name]:process.env[name]=value;
    restore('SUPABASE_URL',previous.url);
    restore('SUPABASE_SERVICE_ROLE_KEY',previous.service);
    restore('SUPABASE_PUBLISHABLE_KEY',previous.publishable);
    restore('SUPABASE_ANON_KEY',previous.anon);
  }
});

test('performance endpoint still fails closed on telemetry transport failure',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('offline')};
  try{
    const res=responseMock();
    await performanceHandler({method:'GET'},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.payload.performance.available,false);
    assert.equal(res.payload.performance.routing_state,'HOLD');
    assert.equal(res.payload.performance.candidate_promotable,false);
    assert.equal(res.payload.performance.stream_ready,false);
  } finally { globalThis.fetch=originalFetch; }
});
