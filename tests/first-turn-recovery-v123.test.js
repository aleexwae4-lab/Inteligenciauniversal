import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {generateWithFallback} from '../lib/providers.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const envKeys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','WAE_SUPABASE_MACHINE_KEY','WAE_SUPABASE_GATEWAY_URL','OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','XAI_API_KEY','OPENROUTER_API_KEY','OPENROUTER_MODEL'];
const sandbox=async(fn)=>{
 const fetchBefore=globalThis.fetch,environment=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 for(const k of envKeys)delete process.env[k];
 process.env.SUPABASE_URL='https://mock-supabase.test';
 process.env.SUPABASE_PUBLISHABLE_KEY='test-public-key';
 try{return await fn()}finally{
  globalThis.fetch=fetchBefore;
  for(const [k,v] of Object.entries(environment)){if(v===undefined)delete process.env[k];else process.env[k]=v}
 }
};
function storage(initial={}){
 const data=new Map(Object.entries(initial));
 return {getItem:key=>data.has(key)?data.get(key):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:key=>data.delete(key)};
}
function browserSession(localStorage,edge){
 const client=read('runtime-client.js');
 const start=client.indexOf('  let bootPromise;'),end=client.indexOf('  // Reuse the IU custom session;',start);
 assert.ok(start>0&&end>start);
 const ctx={localStorage,edge,SESSION_ID:'iu.sessionId',SESSION_SECRET:'iu.sessionSecret',CONVERSATION_ID:'iu.conversationId'};
 vm.runInNewContext(client.slice(start,end)+'\nthis.bootstrap=bootstrap;this.refreshBootstrap=refreshBootstrap;this.sessionPayload=sessionPayload;',ctx);
 return ctx;
}
function browserRecovery(context){
 const client=read('runtime-client.js');
 const start=client.indexOf('  const recoverableChatFailure='),end=client.indexOf('  window.fetch=async(',start);
 assert.ok(start>0&&end>start);
 vm.runInNewContext(client.slice(start,end)+'\nthis.chatWithSessionRepair=chatWithSessionRepair;this.recoverableChatFailure=recoverableChatFailure;',context);
 return context;
}

test('first cold Edge chat times out, then succeeds transparently on warm retry in SAME prompt',async()=>{
 await sandbox(async()=>{
  let chatCalls=0,bootCalls=0,firstAborted=false;
  globalThis.fetch=async(_url,opts)=>{
   const body=JSON.parse(opts.body);
   if(body.action==='bootstrap'){bootCalls++;return {ok:true,text:async()=>JSON.stringify({session_id:'s-'+bootCalls,session_secret:'safe-secret'})}}
   assert.equal(body.action,'chat');chatCalls++;
   if(chatCalls===1)return new Promise((_resolve,reject)=>{
    opts.signal.addEventListener('abort',()=>{firstAborted=true;reject(Object.assign(new Error('aborted'),{name:'AbortError'}))},{once:true});
   });
   return {ok:true,text:async()=>JSON.stringify({reply:'Respuesta útil en la misma conversación',provider:'groq'})};
  };
  const result=await generateWithFallback({provider:'wae_edge',system:'Respuesta útil',message:'¿Qué es recursión?',retryColdStart:true,attemptTimeoutMs:40,budgetMs:6000});
  assert.equal(firstAborted,true);
  assert.equal(bootCalls,2);assert.equal(chatCalls,2);
  assert.equal(result.text,'Respuesta útil en la misma conversación');
  assert.equal(result.provider,'groq');
  assert.equal(result.failures.length,1);
  assert.equal(result.failures[0].error,'provider_timeout');
 });
});
test('no silent warm replay after explicit degraded reply, and non-retry route remains single-attempt',async()=>{
 await sandbox(async()=>{
  let chatCalls=0;
  globalThis.fetch=async(_url,opts)=>{
   const body=JSON.parse(opts.body);
   if(body.action==='bootstrap')return {ok:true,text:async()=>JSON.stringify({session_id:'session',session_secret:'secret'})};
   chatCalls++;return {ok:true,text:async()=>JSON.stringify({reply:'No existe evidencia pública suficiente para responder sin inventar.'})};
  };
  await assert.rejects(generateWithFallback({provider:'wae_edge',system:'x',message:'x',retryColdStart:true,attemptTimeoutMs:30}),e=>e.code==='ALL_PROVIDERS_FAILED');
  assert.equal(chatCalls,1);
 });
});
test('cached session skips cold bootstrap, but explicit invalid credentials can be renewed once',async()=>{
 const localStorage=storage({'iu.sessionId':'old','iu.sessionSecret':'old-secret','iu.conversationId':'previous'});
 let bootstrapCalls=0;
 const ctx=browserSession(localStorage,async payload=>{
  assert.equal(payload.action,'bootstrap');bootstrapCalls++;
  return {session_id:'new-session',session_secret:'new-secret'};
 });
 const session=await ctx.bootstrap();
 assert.equal(session.session_id,'old');assert.equal(bootstrapCalls,0);
 const renewed=await ctx.refreshBootstrap();
 assert.equal(renewed.session_id,'new-session');
 assert.equal(bootstrapCalls,1);
 assert.equal(localStorage.getItem('iu.conversationId'),null);
 assert.equal(ctx.sessionPayload().session_secret,'new-secret');
});
test('invalid remote conversation is repaired within the same visible turn, not by creating a new chat',async()=>{
 const localStorage=storage({'iu.conversationId':'obsolete'});
 const invalidated=[],calls=[];
 const ctx={localStorage,CONVERSATION_ID:'iu.conversationId',
  window:{WAENavigation:{remoteInvalidated:id=>invalidated.push(id)}},
  edge:async payload=>{
   calls.push(payload);
   if(calls.length===1)throw Object.assign(new Error('conversation_not_found'),{data:{error:'conversation_not_found'},status:404});
   return {reply:'Ahora sí, en este mismo chat'};
  },
  refreshBootstrap:async()=>{throw Error('must not bootstrap for remote pointer')},
  sessionPayload:()=>({session_id:'same-session',session_secret:'secret'})
 };
 browserRecovery(ctx);
 const reply=await ctx.chatWithSessionRepair({action:'chat',session_id:'same-session',session_secret:'secret',conversation_id:'obsolete',message:'la misma pregunta'},new AbortController().signal);
 assert.equal(reply.reply,'Ahora sí, en este mismo chat');
 assert.equal(calls.length,2);
 assert.equal(calls[0].message,calls[1].message);
 assert.equal(calls[1].conversation_id,null);
 assert.equal(localStorage.getItem('iu.conversationId'),null);
 assert.deepEqual(invalidated,['obsolete']);
});
test('invalid session renews pre-inference; aborted/unknown failures never replay a chat',async()=>{
 const localStorage=storage({'iu.conversationId':'old-id'});
 const calls=[],invalidated=[];
 let refreshes=0;
 const ctx={localStorage,CONVERSATION_ID:'iu.conversationId',
  window:{WAENavigation:{remoteInvalidated:id=>invalidated.push(id)}},
  edge:async payload=>{
   calls.push(payload);
   if(calls.length===1)throw Object.assign(new Error('iu_invalid_session'),{data:{error:'iu_invalid_session'},status:401});
   return {reply:'same turn'};
  },
  refreshBootstrap:async()=>{refreshes++;localStorage.removeItem('iu.conversationId')},
  sessionPayload:()=>({session_id:'new-session',session_secret:'renewed-secret'})
 };
 browserRecovery(ctx);
 const result=await ctx.chatWithSessionRepair({action:'chat',conversation_id:'old-id',message:'prueba'},new AbortController().signal);
 assert.equal(result.reply,'same turn');assert.equal(refreshes,1);
 assert.equal(calls[1].session_id,'new-session');assert.equal(calls[1].conversation_id,null);
 assert.deepEqual(invalidated,['old-id']);
 const unknown={...ctx,edge:async()=>{throw Object.assign(new Error('provider_timeout'),{status:504})}};
 browserRecovery(unknown);
 await assert.rejects(unknown.chatWithSessionRepair({action:'chat',conversation_id:'old-id',message:'prueba'},new AbortController().signal),/provider_timeout/);
 assert.equal(refreshes,1);
});
test('regression contracts keep existing UI, abort timing and Android cache coherent',()=>{
 const client=read('runtime-client.js'),nav=read('navigation-premium-v1.js'),runtime=read('lib/runtime.js');
 const html=read('index.html'),sw=read('sw.js'),pkg=JSON.parse(read('package.json'));
 assert.match(client,/chatWithSessionRepair\(chatPayload,init\.signal\)/);
 assert.match(client,/retryColdStart/); // only backend runtime owns the retry option, not public UI
 assert.match(nav,/remoteInvalidated:id/);
 assert.match(runtime,/retryColdStart:attachments\.length===0&&requestedTools\.length===0/);
 assert.match(sw,/wae-universal-render-firstturn-v42/);
 assert.match(html,/firstturn=v123/);assert.match(sw,/firstturn=v123/);
 assert.match(html,/navigation-premium-v1\.js\?v=10/);
 assert.match(pkg.scripts.check,/tests\/first-turn-recovery-v123\.test\.js/);
});
