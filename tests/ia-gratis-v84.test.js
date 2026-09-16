import test from 'node:test';
import assert from 'node:assert/strict';
import { callIaGratisChat, iaGratisConfigured } from '../lib/ia-gratis-v84.js';

function withEnv(values,fn){
  const previous={};
  for(const [key,value] of Object.entries(values)){
    previous[key]=process.env[key];
    if(value===undefined)delete process.env[key]; else process.env[key]=value;
  }
  return Promise.resolve(fn()).finally(()=>{
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined)delete process.env[key]; else process.env[key]=value;
    }
  });
}

test('ia.gratis stays disabled without a server token',async()=>{
  await withEnv({IA_GRATIS_API_TOKEN:undefined},async()=>{
    assert.equal(iaGratisConfigured(),false);
    await assert.rejects(()=>callIaGratisChat({message:'hola',fetchImpl:async()=>{throw new Error('should not run')}}),error=>error.code==='IA_GRATIS_UNCONFIGURED');
  });
});

test('ia.gratis chat sends bearer auth and returns reply',async()=>{
  await withEnv({IA_GRATIS_API_TOKEN:'test-secret',IA_GRATIS_CHAT_MODEL:'test/model',IA_GRATIS_API_BASE:'https://ia.gratis/api/tools'},async()=>{
    let captured;
    const fetchImpl=async(url,options)=>{
      captured={url,options};
      return new Response(JSON.stringify({reply:'Respuesta premium',model:'test/model'}),{status:200,headers:{'content-type':'application/json'}});
    };
    const result=await callIaGratisChat({system:'Sistema',message:'Pregunta',history:[{role:'assistant',content:'Contexto'}],fetchImpl});
    assert.equal(result.reply,'Respuesta premium');
    assert.equal(result.provider,'ia_gratis');
    assert.equal(captured.url,'https://ia.gratis/api/tools/chat/');
    assert.equal(captured.options.headers.Authorization,'Bearer test-secret');
    const body=JSON.parse(captured.options.body);
    assert.equal(body.model,'test/model');
    assert.equal(body.messages.at(-1).content,'Pregunta');
  });
});

test('ia.gratis does not include a model when none is configured',async()=>{
  await withEnv({IA_GRATIS_API_TOKEN:'test-secret',IA_GRATIS_CHAT_MODEL:undefined},async()=>{
    const fetchImpl=async(_url,options)=>{
      const body=JSON.parse(options.body);
      assert.equal(Object.hasOwn(body,'model'),false);
      return new Response(JSON.stringify({reply:'OK'}),{status:200});
    };
    const result=await callIaGratisChat({message:'hola',fetchImpl});
    assert.equal(result.reply,'OK');
  });
});
