import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { relevanceProfile, visibleFallbackRelevant } from '../lib/visible-answer-relevance-v84.js';
import { runStatelessNativeRecovery, statelessRecoveryEligible } from '../lib/stateless-intelligence-v84.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('v84 blocks the Rayleigh/Blue Sky lexical false positive',()=>{
  const question='Explica en dos oraciones qué es la dispersión de Rayleigh y por qué hace que el cielo se vea azul.';
  const bad={reply:'EL PUÑO DEL CIELO AZUL. Blue Sky (Cielo Azul). Sobre el cielo y el azul: catálogo de obras y títulos relacionados.'};
  const profile=relevanceProfile(question,bad.reply);
  assert.equal(profile.pass,false);
  assert.equal(profile.matchedAnchors.includes('rayleigh'),false);
  assert.equal(visibleFallbackRelevant(question,bad),false);
});

test('v84 accepts a conceptually relevant Rayleigh explanation',()=>{
  const question='Explica en dos oraciones qué es la dispersión de Rayleigh y por qué hace que el cielo se vea azul.';
  const answer='La dispersión de Rayleigh ocurre cuando partículas mucho más pequeñas que la longitud de onda desvían la luz, con mayor intensidad para las longitudes de onda cortas. Por eso la luz azul del Sol se dispersa por la atmósfera mucho más que la roja y el cielo se ve azul desde la superficie.';
  assert.equal(relevanceProfile(question,answer).pass,true);
});

test('stateless intelligence is fail-closed for current, high-risk, sensitive and attachment requests',()=>{
  assert.equal(statelessRecoveryEligible({message:'Explica la dispersión de Rayleigh.'}),true);
  assert.equal(statelessRecoveryEligible({message:'¿Cuál es el precio actual del dólar hoy?'}),false);
  assert.equal(statelessRecoveryEligible({message:'Dime qué dosis médica debo tomar'}),false);
  assert.equal(statelessRecoveryEligible({message:'Mi CURP es ABCD1234, analízala'}),false);
  assert.equal(statelessRecoveryEligible({message:'Resume esto',attachments:[{name:'x.txt',text:'hola'}]}),false);
});

test('v84 native recovery uses server-only Supabase adapter and returns assistant-response/v1 without upstream branding',async()=>{
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
    assert.equal(result.model,'universal-core-native-v84');
    assert.doesNotMatch(result.reply,/gemini|google|provider|fallback/i);
  }finally{
    global.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
  }
});

test('live compatibility chain advances to v84 and v84 wraps v82',()=>{
  const compat=read('api/capacity-chat-v60.js'),v84=read('api/capacity-chat-v84.js');
  assert.match(compat,/capacity-chat-v84\.js/);
  assert.match(v84,/capacity-chat-v82\.js/);
  assert.match(v84,/stateless-intelligence-v84/);
  assert.match(v84,/VISIBLE_ANSWER_RELEVANCE_FAILED/);
});
