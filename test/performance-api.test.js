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

test('performance endpoint fails closed without any Supabase credential',async()=>{
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
  try{
    const res=responseMock();
    await performanceHandler({method:'GET'},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.payload.success,true);
    assert.equal(res.payload.core,'Universal Core');
    assert.equal(res.payload.performance.available,false);
    assert.equal(res.payload.performance.candidate_promotable,false);
    assert.equal(res.payload.performance.stream_ready,false);
  } finally {
    const restore=(name,value)=>value===undefined?delete process.env[name]:process.env[name]=value;
    restore('SUPABASE_URL',previous.url);
    restore('SUPABASE_SERVICE_ROLE_KEY',previous.service);
    restore('SUPABASE_PUBLISHABLE_KEY',previous.publishable);
    restore('SUPABASE_ANON_KEY',previous.anon);
  }
});
