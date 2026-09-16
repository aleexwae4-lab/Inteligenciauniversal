import test from 'node:test';
import assert from 'node:assert/strict';
import { callIaGratisTool, iaGratisTools, IA_GRATIS_TOOL_FABRIC_VERSION } from '../lib/ia-gratis-v84.js';

function withToken(fn){
  const previous=process.env.IA_GRATIS_API_TOKEN;
  process.env.IA_GRATIS_API_TOKEN='test-token';
  return Promise.resolve().then(fn).finally(()=>{
    if(previous===undefined)delete process.env.IA_GRATIS_API_TOKEN;
    else process.env.IA_GRATIS_API_TOKEN=previous;
  });
}

function fakeFetch(payload={reply:'ok'}){
  return async(url,options)=>({
    ok:true,
    status:200,
    async text(){
      assert.match(String(url),/https:\/\/ia\.gratis\/api\/tools\//);
      assert.match(String(options?.headers?.Authorization||''),/^Bearer test-token$/);
      return JSON.stringify(payload);
    },
  });
}

test('governed ia.gratis text tool uses server token and returns sanitized output',async()=>withToken(async()=>{
  const result=await callIaGratisTool('summarize',{text:'uno dos tres',api_key:'must-not-leak'},{fetchImpl:fakeFetch({reply:'resumen'})});
  assert.equal(result.tool,'summarize');
  assert.equal(result.tokenCost,20);
  assert.equal(result.reply,'resumen');
  assert.equal(result.version,IA_GRATIS_TOOL_FABRIC_VERSION);
}));

test('ia.gratis tool fabric refuses unregistered expensive endpoints',async()=>withToken(async()=>{
  await assert.rejects(()=>callIaGratisTool('video',{prompt:'x'},{fetchImpl:fakeFetch()}),(error)=>error.code==='IA_GRATIS_TOOL_NOT_ALLOWED');
}));

test('ia.gratis per-call token ceiling can fail closed',async()=>withToken(async()=>{
  const previous=process.env.IA_GRATIS_MAX_TOOL_TOKENS_PER_CALL;
  process.env.IA_GRATIS_MAX_TOOL_TOKENS_PER_CALL='20';
  try{
    await assert.rejects(()=>callIaGratisTool('search',{query:'latest'},{fetchImpl:fakeFetch()}),(error)=>error.code==='IA_GRATIS_TOOL_BUDGET_BLOCKED');
  }finally{
    if(previous===undefined)delete process.env.IA_GRATIS_MAX_TOOL_TOKENS_PER_CALL;
    else process.env.IA_GRATIS_MAX_TOOL_TOKENS_PER_CALL=previous;
  }
}));

test('tool wrappers normalize translation inputs without exposing credentials',async()=>withToken(async()=>{
  let sent=null;
  const fetchImpl=async(_url,options)=>{
    sent=JSON.parse(options.body);
    return{ok:true,status:200,text:async()=>JSON.stringify({translation:'hola'})};
  };
  const result=await iaGratisTools.translate({text:'hello',target:'es'},{fetchImpl});
  assert.equal(result.reply,'hola');
  assert.equal(sent.text,'hello');
  assert.equal(sent.target,'es');
  assert.equal(sent.target_language,'es');
  assert.equal('token' in sent,false);
}));
