import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safeProgressEvent,TURN_PROGRESS_VERSION,TURN_PROGRESS_STAGES,progressiveContract} from '../lib/progressive-intelligence-v133.js';
import {createConversationTrace} from '../lib/conversation-e2e-v130.js';
import {executeMission,runtimeHealth} from '../lib/runtime.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('v133 progress events expose only safe operational metadata',()=>{
  const event=safeProgressEvent({
    phase:'end',stage:'provider',status:'ok',latencyMs:321,
    details:{provider:'wae_edge',model:'model-x',fallbackCount:1,message:'secret prompt',system:'private',session_secret:'nope'}
  });
  assert.equal(event.version,TURN_PROGRESS_VERSION);
  assert.equal(event.stage,'provider');
  assert.equal(event.details.provider,'wae_edge');
  assert.equal(event.details.model,'model-x');
  assert.equal(event.details.fallbackCount,1);
  assert.equal('message' in event.details,false);
  assert.equal('system' in event.details,false);
  assert.equal('session_secret' in event.details,false);
});

test('v133 existing E2E trace emits begin/end progress without changing final trace',()=>{
  const events=[];
  const trace=createConversationTrace({route:'render',onProgress:event=>events.push(event)});
  trace.begin('router');
  trace.end('router','ok',{mode:'general'});
  trace.begin('memory');
  trace.end('memory','recovered',{recalled:2,code:'cache'});
  const out=trace.snapshot();
  assert.deepEqual(events.map(x=>[x.stage,x.phase]),[
    ['router','begin'],['router','end'],['memory','begin'],['memory','end']
  ]);
  assert.equal(out.stages.find(x=>x.id==='memory').status,'recovered');
  assert.equal(JSON.stringify(events).includes('prompt'),false);
});

test('v133 deterministic Universal Core turn publishes real stage events and still returns v2 envelope',async()=>{
  const events=[];
  const result=await executeMission(
    {message:'Cuáles son tus capacidades?',history:[]},
    {onProgress:event=>events.push(event)}
  );
  assert.equal(result.response.schema,'assistant-response/v2');
  assert.match(result.model,/^runtime_capabilities\/v\d+$/);
  const completed=new Set(events.filter(x=>x.phase==='end').map(x=>x.stage));
  for(const stage of TURN_PROGRESS_STAGES)assert.equal(completed.has(stage),true,stage);
  assert.equal(events.some(x=>x.stage==='provider'&&x.status==='skipped'),true);
});

test('v133 runtime health advertises truthful progressive transport without claiming token streaming',()=>{
  const contract=runtimeHealth().progressiveIntelligence;
  assert.deepEqual(contract,progressiveContract());
  assert.equal(contract.transport,'server-sent-events');
  assert.equal(contract.contentRelease,'after-quality-and-persistence');
  assert.equal(contract.tokenStreaming,false);
});

test('v133 stream endpoint is authoritative, safe and wired to server',()=>{
  const api=read('api/chat-stream.js'),server=read('server.js');
  assert.match(server,/\['\/api\/chat-stream', chatStreamHandler\]/);
  assert.match(api,/text\/event-stream/);
  assert.match(api,/onProgress:event=>sse\(res,'progress',event\)/);
  assert.match(api,/progressiveContract\(\)/);
  assert.doesNotMatch(api,/sse\(res,'progress',[^\n]*body\.message/);
  assert.doesNotMatch(api,/error\.message/);
});

test('v133 client uses SSE first, shows real stages and avoids duplicate inference after stream start',()=>{
  const app=read('app.js');
  assert.match(app,/fetch\('\/api\/chat-stream'/);
  assert.match(app,/Accept':'text\/event-stream/);
  assert.match(app,/wae:turn-progress/);
  assert.match(app,/turnStageLabels=\{router:'Interpretando'/);
  assert.match(app,/if\(streamError\?\.safeFallback===true\)/);
  assert.match(app,/error\.safeFallback=!ready/);
  assert.match(app,/if\(!result\)throw Object\.assign\(new Error\('stream_without_result'\),\{safeFallback:!ready\}\)/);
});

test('v133 PWA publishes matching progressive assets',()=>{
  const html=read('index.html'),sw=read('sw.js');
  const appAsset=html.match(/\.\/app\.js\?[^"'<>\s]+/)?.[0];
  const cssAsset=html.match(/\.\/styles\.css\?[^"'<>\s]+/)?.[0];
  assert.ok(appAsset&&cssAsset);
  assert.match(appAsset,/progress=v133/);
  assert.match(cssAsset,/v=133/);
  assert.ok(sw.includes(appAsset),appAsset);
  assert.ok(sw.includes(cssAsset),cssAsset);
  assert.match(sw,/progress-v133/);
});
