import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const networkSource=readFileSync(new URL('../lib/network-deadlines-v46.js',import.meta.url),'utf8');
const serverSource=readFileSync(new URL('../server.js',import.meta.url),'utf8');

test('v116 isolates cold bootstrap from the chat circuit and warms providers on startup',()=>{
  assert.match(networkSource,/action === 'bootstrap'[\s\S]*circuit:null/);
  assert.match(networkSource,/action === 'chat'[\s\S]*supabase-edge-chat/);
  assert.match(serverSource,/warmProviderConnections/);
  assert.match(serverSource,/void warmProviderConnections\(\)/);
});

test('v116 reuses one Edge session across consecutive answers',async()=>{
  const originalFetch=globalThis.fetch;
  const originalEnv={
    SUPABASE_URL:process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY,
    WAE_SUPABASE_EDGE_URL:process.env.WAE_SUPABASE_EDGE_URL,
    WAE_SUPABASE_MACHINE_KEY:process.env.WAE_SUPABASE_MACHINE_KEY,
    OPENAI_API_KEY:process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY:process.env.GEMINI_API_KEY,
    XAI_API_KEY:process.env.XAI_API_KEY,
    OPENROUTER_API_KEY:process.env.OPENROUTER_API_KEY,
    OPENROUTER_MODEL:process.env.OPENROUTER_MODEL,
  };
  let bootstrapCalls=0,chatCalls=0;

  process.env.SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='test-publishable-key';
  delete process.env.WAE_SUPABASE_EDGE_URL;
  delete process.env.WAE_SUPABASE_MACHINE_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.XAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;

  globalThis.fetch=async(_url,options={})=>{
    const body=JSON.parse(String(options.body||'{}'));
    if(body.action==='bootstrap'){
      bootstrapCalls++;
      return new Response(JSON.stringify({success:true,session_id:'11111111-1111-4111-8111-111111111111',session_secret:'session-secret'}),{status:200,headers:{'content-type':'application/json'}});
    }
    if(body.action==='chat'){
      chatCalls++;
      return new Response(JSON.stringify({success:true,reply:`Respuesta completa ${chatCalls} desde Universal Core.`,provider:'wae_edge',model:'test-model'}),{status:200,headers:{'content-type':'application/json'}});
    }
    return new Response(JSON.stringify({error:'unexpected_action'}),{status:500,headers:{'content-type':'application/json'}});
  };

  try{
    const providers=await import(`../lib/providers.js?v116=${Date.now()}`);
    const first=await providers.generateWithFallback({provider:'wae_edge',system:'Responde directamente.',message:'Primera consulta',history:[]});
    const second=await providers.generateWithFallback({provider:'wae_edge',system:'Responde directamente.',message:'Segunda consulta',history:[]});
    assert.match(first.text,/Respuesta completa 1/);
    assert.match(second.text,/Respuesta completa 2/);
    assert.equal(bootstrapCalls,1);
    assert.equal(chatCalls,2);
  }finally{
    globalThis.fetch=originalFetch;
    for(const [key,value] of Object.entries(originalEnv)){
      if(value===undefined)delete process.env[key]; else process.env[key]=value;
    }
  }
});
