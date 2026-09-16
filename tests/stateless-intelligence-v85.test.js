import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runStatelessNativeRecovery, statelessRecoveryEligible, STATELESS_INTELLIGENCE_V85 } from '../lib/stateless-intelligence-v85.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('v85 stateless recovery is fail-closed for current, high-risk, sensitive and attachment requests',()=>{
  assert.equal(STATELESS_INTELLIGENCE_V85,'stateless-intelligence/v85');
  assert.equal(statelessRecoveryEligible({message:'Explica la dispersión de Rayleigh.'}),true);
  assert.equal(statelessRecoveryEligible({message:'¿Cuál es el precio actual del dólar hoy?'}),false);
  assert.equal(statelessRecoveryEligible({message:'Dime qué dosis médica debo tomar'}),false);
  assert.equal(statelessRecoveryEligible({message:'Mi CURP es ABCD1234, analízala'}),false);
  assert.equal(statelessRecoveryEligible({message:'Resume esto',attachments:[{name:'x.txt',text:'hola'}]}),false);
});

test('v85 uses the existing internal native adapter and emits assistant-response/v1 without upstream branding',async()=>{
  const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY,oldFetch=global.fetch;
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='server-secret-test';
  let observed=null;
  global.fetch=async(url,options)=>{
    observed={url:String(url),headers:options.headers,body:JSON.parse(options.body)};
    return new Response(JSON.stringify({choices:[{message:{content:'La dispersión de Rayleigh desvía con mayor intensidad las longitudes de onda cortas cuando la luz atraviesa partículas mucho menores que su longitud de onda. Por eso la componente azul de la luz solar se dispersa en muchas direcciones por la atmósfera y el cielo se percibe azul.'}}]}),{status:200,headers:{'content-type':'application/json'}});
  };
  try{
    const result=await runStatelessNativeRecovery({body:{message:'Explica qué es la dispersión de Rayleigh y por qué el cielo se ve azul.',mode:'general'}});
    assert.ok(result);
    assert.equal(observed.url,'https://example.supabase.co/functions/v1/wae-model-discovery/native/gemini');
    assert.equal(observed.headers.authorization,'Bearer server-secret-test');
    assert.equal(result.degraded,false);
    assert.equal(result.response.schema,'assistant-response/v1');
    assert.equal(result.provider,'universal_core');
    assert.equal(result.model,'universal-core-native-v85');
    assert.equal(result.recovery.path,'stateless-intelligence/v85');
    assert.doesNotMatch(result.reply,/gemini|google|provider|fallback/i);
  }finally{
    global.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
  }
});

test('v85 does not turn a low-quality native draft into a visible success',async()=>{
  const oldUrl=process.env.SUPABASE_URL,oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY,oldFetch=global.fetch;
  process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='server-secret-test';
  global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'No sé.'}}]}),{status:200,headers:{'content-type':'application/json'}});
  try{assert.equal(await runStatelessNativeRecovery({body:{message:'Explica detalladamente cómo funciona una GPU moderna.',mode:'general'}}),null)}
  finally{global.fetch=oldFetch;if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey}
});

test('live compatibility chain puts v85 before focused factual and generic knowledge recovery',()=>{
  const alias=read('api/capacity-chat-v60.js'),v85=read('api/capacity-chat-v85.js');
  assert.match(alias,/capacity-chat-v85\.js/);
  assert.match(v85,/capacity-chat-v81\.js/);
  assert.match(v85,/runStatelessNativeRecovery/);
  assert.match(v85,/runFocusedFactualAnswer/);
  assert.match(v85,/runKnowledgeAnswer/);
  assert.ok(v85.indexOf('runStatelessNativeRecovery')<v85.indexOf('runFocusedFactualAnswer'));
});
