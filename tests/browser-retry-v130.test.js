import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';

const runtime=readFileSync(new URL('../runtime-client.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const serverRuntime=readFileSync(new URL('../lib/runtime.js',import.meta.url),'utf8');
const serverAdapter=readFileSync(new URL('../lib/providers.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

function browserHarness({failBootstrap=false}={}){
  const values=new Map(),calls=[],window={},session='11111111-1111-4111-8111-111111111111';
  let edgeChats=0,renderCalls=0;
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
  const nativeFetch=async(input,init={})=>{
    const url=String(input);
    const body=typeof init.body==='string'?JSON.parse(init.body):{};
    calls.push({url,body});
    if(url==='/api/performance')return Response.json({performance:{schema:'universal-performance-gate/v3',available:true,stream_ready:false,candidate_promotable:false}});
    if(url==='/api/chat'){
      renderCalls++;
      return Response.json({success:true,reply:'Respuesta de redundancia.'});
    }
    if(!url.includes('/functions/v1/wae-local-voice-demo-v61'))throw Error('unexpected URL '+url);
    if(body.action==='bootstrap'){
      if(failBootstrap)throw Error('preflight_unavailable');
      return Response.json({success:true,session_id:session,session_secret:'s'.repeat(64)});
    }
    if(body.action==='chat'){
      edgeChats++;
      if(edgeChats===1)throw Error('transport_lost_after_provider_work');
      return Response.json({success:true,reply:'Respuesta verificada.',conversation_id:'33333333-3333-4333-8333-333333333333'});
    }
    throw Error('unexpected edge action '+body.action);
  };
  window.fetch=nativeFetch;
  window.addEventListener=()=>{};window.dispatchEvent=()=>{};
  const context={window,document:{querySelector:()=>null,addEventListener:()=>{},documentElement:{dataset:{}}},location:{href:'https://universal.test/',origin:'https://universal.test'},localStorage:storage,Response,URL,crypto:webcrypto,console:{warn:()=>{}},AbortController,performance,queueMicrotask:()=>{},setInterval:()=>{},setTimeout,clearTimeout};
  runInNewContext(runtime,context,{timeout:3000});
  return{fetch:window.fetch,calls,get renderCalls(){return renderCalls},get edgeChats(){return edgeChats}};
}

test('browser replays one Edge request ID after ambiguous lost response without Render second generation',async()=>{
  const h=browserHarness();
  const key='wae_1234567890abcdef1234567890abcdef';
  const body=JSON.stringify({message:'Misma pregunta',mode:'general',client_request_id:key});
  const first=await h.fetch('/api/chat',{method:'POST',body});
  assert.equal(first.status,503);
  const blocked=await first.json();
  assert.equal(blocked.error,'primary_result_uncertain');
  assert.equal(blocked.client_request_id,key);
  assert.equal(blocked.retry_requires_same_key,true);
  assert.equal(h.renderCalls,0);
  const second=await h.fetch('/api/chat',{method:'POST',body});
  assert.equal(second.status,200);
  assert.equal((await second.json()).reply,'Respuesta verificada.');
  const another=await h.fetch('/api/chat',{method:'POST',body:JSON.stringify({message:'Misma pregunta',mode:'general',client_request_id:'wae_1234567890abcdef1234567890abcdee'})});
  assert.equal(another.status,200);
  const chats=h.calls.filter(c=>c.body.action==='chat');
  assert.deepEqual(chats.map(c=>c.body.client_request_id),[key,key,'wae_1234567890abcdef1234567890abcdee']);
  assert.equal(h.renderCalls,0);
});

test('preflight failure may use Render fallback but forwards original request identity',async()=>{
  const h=browserHarness({failBootstrap:true}),key='wae_1234567890abcdef1234567890abcdef';
  const r=await h.fetch('/api/chat',{method:'POST',body:JSON.stringify({message:'Trabajo',client_request_id:key})});
  assert.equal(r.status,200);
  assert.equal(h.renderCalls,1);
  assert.equal(h.edgeChats,0);
  assert.equal(h.calls.find(c=>c.url==='/api/chat').body.client_request_id,key);
});

test('same pending user bubble and same key are reused by the in-page retry button',()=>{
  assert.match(app,/client_request_id:turn\.clientRequestId/);
  assert.match(app,/state\.pendingTurn=\{message,mode:state\.mode,attachments:/);
  assert.match(app,/button\.addEventListener\('click',\(\)=>\{void runPendingTurn\(\)\}\)/);
  assert.match(app,/const turn=state\.pendingTurn/);
  assert.match(app,/state\.pendingTurn=null;addMessage\('assistant',reply\)/);
  assert.doesNotMatch(app,/Tu conversación sigue segura\. Vuelve a enviar el mensaje/);
  assert.match(runtime,/chatAttempted=true/);
  assert.doesNotMatch(runtime,/client_partial:true/);
  assert.match(sw,/wae-universal-v36-browser-retry-v130/);
});

test('Render forwards the browser key in independent quality phases',()=>{
  assert.match(serverAdapter,/async function waeUniversalEdgeResponse\(\{ message, history, requestKey \}\)/);
  assert.match(serverAdapter,/client_request_id:clientRequestId/);
  assert.match(serverRuntime,/requestKey:requestKeyFor\('primary'\)/);
  assert.match(serverRuntime,/requestKey:requestKeyFor\('challenger'\)/);
  assert.match(serverRuntime,/requestKey:requestKeyFor\('repair'\)/);
  assert.match(serverRuntime,/requestKey:requestKeyFor\('upgrade'\)/);
});
