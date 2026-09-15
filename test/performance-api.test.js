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

const rpcPayload=url=>{
  const path=String(url);
  if(path.endsWith('/iu_performance_gate_v3'))return {schema:'universal-performance-gate/v3',routing_state:'HOLD',candidate_promotable:false,stream_ready:false,fast_lane_ready:true,control:{ok:50,errors:2,p95_ms:5000},candidate:{ok:50,errors:1,p95_ms:7000}};
  if(path.endsWith('/iu_cognitive_scorecard_v1'))return {schema:'universal-cognitive-scorecard/v1',state:'HOLD',blockers:['insufficient_evals'],runtime:{requests:50,ok:48,errors:2},evals:{total:5,passed:4},feedback:{total:3,positive_rate_pct:66.7}};
  if(path.endsWith('/iu_reliability_snapshot_v2'))return {schema:'universal-reliability-plane/v2',runtime:{requests:50,ok:48,errors:2,success_pct:96},models:{healthy:1,closed:1,open:0,half_open:0}};
  if(path.endsWith('/iu_self_improvement_snapshot_v1'))return {contract:'universal-core-self-improvement/v1',router_learning_active:true,base_model_weights_changed:false,raw_content_used:false,signals:{total:120,positive:90,negative:10,neutral:20,learned_routes:2},training_readiness:{explicit_feedback_examples:20,rejected_examples:4}};
  throw new Error(`unexpected_rpc:${path}`);
};

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
  const seen=[];
  globalThis.fetch=async(url,init)=>{
    const path=String(url);seen.push(path);
    assert.match(path,/^https:\/\/pbswcbryxawsmltyromd\.supabase\.co\/rest\/v1\/rpc\/iu_/);
    assert.match(String(init?.headers?.apikey||''),/^sb_publishable_/);
    return new Response(JSON.stringify(rpcPayload(path)),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const res=responseMock();
    await performanceHandler({method:'GET'},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.payload.success,true);
    assert.equal(res.payload.core,'Universal Core');
    assert.equal(res.payload.performance.available,true);
    assert.equal(res.payload.performance.schema,'universal-performance-gate/v3');
    assert.equal(res.payload.performance.routing_state,'HOLD');
    assert.equal(res.payload.performance.candidate_promotable,false);
    assert.equal(res.payload.cognitive.available,true);
    assert.equal(res.payload.reliability.available,true);
    assert.equal(res.payload.self_improvement.available,true);
    assert.equal(res.payload.self_improvement.base_model_weights_changed,false);
    assert.equal(res.payload.public_contract,'universal-performance+quality+reliability+streaming+learning/v6');
    assert.equal(seen.length,4);
    assert.ok(seen.some(x=>x.endsWith('/iu_performance_gate_v3')));
    assert.ok(seen.some(x=>x.endsWith('/iu_cognitive_scorecard_v1')));
    assert.ok(seen.some(x=>x.endsWith('/iu_reliability_snapshot_v2')));
    assert.ok(seen.some(x=>x.endsWith('/iu_self_improvement_snapshot_v1')));
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
    assert.equal(res.payload.cognitive.available,false);
    assert.equal(res.payload.reliability.available,false);
    assert.equal(res.payload.self_improvement.available,false);
    assert.equal(res.payload.production_gate.globally_ready,false);
  } finally { globalThis.fetch=originalFetch; }
});
