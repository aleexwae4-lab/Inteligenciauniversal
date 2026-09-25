import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createConversationTrace,CONVERSATION_E2E_VERSION,CONVERSATION_E2E_STAGES} from '../lib/conversation-e2e-v130.js';
import {executeMission} from '../lib/runtime.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('v130 turn contract reports ordered stages and recovered status without user content',()=>{
  const trace=createConversationTrace({route:'render'});
  trace.begin('router');trace.end('router','ok',{mode:'general'});
  trace.begin('memory');trace.end('memory','recovered',{code:'timeout',recalled:0});
  trace.end('tools','skipped',{attempted:0});
  trace.end('provider','ok',{provider:'test-provider',model:'test-model'});
  trace.end('sources','skipped',{count:0});
  trace.end('persistence','ok',{saved:true});
  const out=trace.snapshot();
  assert.equal(out.version,CONVERSATION_E2E_VERSION);
  assert.equal(out.status,'recovered');
  assert.equal(out.recovered,true);
  assert.equal(out.recoveryCount,1);
  assert.deepEqual(out.stages.map(x=>x.id),CONVERSATION_E2E_STAGES);
  assert.equal(JSON.stringify(out).includes('Usuario:'),false);
});

test('v130 deterministic local answers still expose the same E2E envelope',async()=>{
  const result=await executeMission({message:'¿Puedes competir contra Google?'});
  assert.equal(result.e2e.version,'conversation-e2e/v130');
  assert.equal(result.e2e.route,'render');
  assert.equal(result.e2e.stages.find(x=>x.id==='router').status,'ok');
  assert.equal(result.e2e.stages.find(x=>x.id==='provider').status,'skipped');
});

test('v130 real runtime coordinates memory tools provider sources and persistence',()=>{
  const runtime=read('lib/runtime.js'),memory=read('lib/memory.js'),api=read('api/chat.js');
  for(const marker of ["trace.begin('router')","trace.begin('memory')","trace.begin('tools')","trace.begin('provider')","trace.begin('sources')","trace.begin('persistence')"])assert.ok(runtime.includes(marker),marker);
  assert.match(memory,/recallMemoryDetailed/);
  assert.match(memory,/saveTurnDetailed/);
  assert.match(api,/e2eStatus:result\.e2e\?\.status/);
  assert.match(api,/error\.e2e\?\{e2e:error\.e2e\}/);
});

test('v130 browser transport records session repair and Supabase to Render fallback as recovery',()=>{
  const client=read('runtime-client.js');
  assert.match(client,/E2E_VERSION='conversation-e2e\/v130'/);
  assert.match(client,/__waeRecovery:kind/);
  assert.match(client,/route:'browser-fallback\/render'/);
  assert.match(client,/browserRecovery:'supabase_primary_rejected'/);
  assert.match(client,/x-wae-runtime','render-recovery'/);
});

test('v130 UI and voice close the E2E loop with bounded native TTS recovery',()=>{
  const app=read('app.js'),premium=read('premium-render-v1.js');
  assert.match(app,/function applyTurnE2E/);
  assert.match(app,/function markVoiceStage/);
  assert.match(app,/wae:voice-e2e/);
  assert.match(premium,/voice-unavailable\|language-unavailable\|synthesis-unavailable\|synthesis-failed\|text-too-long\|network/);
  assert.match(premium,/voice\.completedChunks===0&&!voice\.fallbackAttempted/);
  assert.match(premium,/WAESpeechChunks\(content,700\)/);
  assert.match(premium,/fallback\?'recovered':'(?:playing|completed)'/);
});

test('v130 PWA cache and shell reference the same E2E assets',()=>{
  const html=read('index.html'),sw=read('sw.js');
  for(const asset of ['./app.js?v=130&e2e=v130','./premium-render-v1.js?v=13&e2e=v130']){
    assert.ok(html.includes(asset),asset);
    assert.ok(sw.includes(asset),asset);
  }
  assert.match(html,/capabilities=v127&e2e=v130/);
  assert.match(sw,/healthui-v129-e2e-v130/);
});