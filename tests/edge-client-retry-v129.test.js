import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../lib/providers.js',import.meta.url),'utf8');

test('Render Edge adapter reuses one key through 401 session refresh, not across two intentional turns',async()=>{
  const previousFetch=globalThis.fetch;
  const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','WAE_SUPABASE_EDGE_URL','WAE_SUPABASE_MACHINE_KEY','PUBLIC_APP_URL','OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','XAI_API_KEY','OPENROUTER_API_KEY','OPENROUTER_MODEL'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const sessionIds=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  let bootstrapCount=0;
  const chats=[];
  try{
    for(const key of keys)delete process.env[key];
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY='test-key';
    globalThis.fetch=async(_url,options={})=>{
      const body=JSON.parse(String(options.body||'{}'));
      if(body.action==='bootstrap'){
        const sid=sessionIds[Math.min(bootstrapCount,sessionIds.length-1)];
        bootstrapCount++;
        return new Response(JSON.stringify({success:true,session_id:sid,session_secret:'s'.repeat(64)}),{status:200,headers:{'content-type':'application/json'}});
      }
      if(body.action==='chat'){
        chats.push(body);
        if(chats.length===1)return new Response(JSON.stringify({success:false,error:'invalid_session'}),{status:401,headers:{'content-type':'application/json'}});
        return new Response(JSON.stringify({success:true,reply:'Respuesta completa y verificada.',conversation_id:'33333333-3333-4333-8333-333333333333',provider:'wae_edge',model:'test-model'}),{status:200,headers:{'content-type':'application/json'}});
      }
      return new Response(JSON.stringify({error:'unexpected_action'}),{status:500,headers:{'content-type':'application/json'}});
    };
    const providers=await import('../lib/providers.js?v129='+Date.now());
    const call=()=>providers.generateWithFallback({provider:'wae_edge',system:'Respuesta directa.',message:'Pregunta repetida intencionalmente',history:[]});
    const first=await call();
    const second=await call();
    assert.match(first.text,/Respuesta completa/);
    assert.match(second.text,/Respuesta completa/);
    assert.equal(bootstrapCount,2);
    assert.equal(chats.length,3);
    assert.equal(chats[0].client_request_id,chats[1].client_request_id);
    assert.notEqual(chats[1].client_request_id,chats[2].client_request_id);
    for(const chat of chats){
      assert.match(chat.client_request_id,/^wae_[a-f0-9]{32}$/);
      assert.equal(chat.message,'Pregunta repetida intencionalmente');
    }
    assert.equal(chats[0].session_id,sessionIds[0]);
    assert.equal(chats[1].session_id,sessionIds[1]);
    assert.equal(chats[2].session_id,sessionIds[1]);
  }finally{
    globalThis.fetch=previousFetch;
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
});

test('adapter uses v128 client_request_id field in both retry attempts',()=>{
  assert.match(source,/const clientRequestId=typeof requestKey==='string'/);
  assert.match(source,/client_request_id:clientRequestId/);
  assert.equal((source.match(/internalContext,clientRequestId\}\)/g)||[]).length,2);
});
