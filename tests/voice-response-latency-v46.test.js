import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import chatHandler from '../api/chat.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

function fakeResponse(){
  const headers={};
  return {headers,res:{statusCode:200,setHeader(name,value){headers[String(name).toLowerCase()]=String(value)},status(code){this.statusCode=code;return this},json(payload){this.payload=payload;return this}}};
}

test('v46 automatic voice has a sub-two-second cloud deadline and immediate browser fallback',()=>{
  const source=read('mobile-voice-v46.js');
  assert.match(source,/CLOUD_BUDGET_MS=1100/);
  assert.match(source,/setTimeout\(\(\)=>controller\.abort[\s\S]*CLOUD_BUDGET_MS/);
  assert.match(source,/voice_fallback/);
  assert.match(source,/browserSpeak/);
  assert.match(source,/CLOUD_BACKOFF_MS=60000/);
  assert.doesNotMatch(source,/CLOUD_BUDGET_MS=(?:20000|60000|70000)/);
});

test('v46 preserves speech lifecycle after semantic normalization',()=>{
  const source=read('speech-lifecycle-v46.js');
  assert.match(source,/utterance\.text=next/);
  assert.match(source,/return downstream\(utterance\)/);
  assert.match(source,/callbacksPreserved:true/);
});

test('new v46 runtime files are syntactically valid JavaScript',()=>{
  for(const path of ['mobile-voice-v46.js','speech-lifecycle-v46.js','lib/network-deadlines-v46.js']){
    const file=fileURLToPath(new URL(`../${path}`,import.meta.url));
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${path}: ${result.stderr||result.stdout}`);
  }
});

test('server loads semantic cleanup, lifecycle guard and v46 voice in deterministic order',()=>{
  const server=read('server.js');
  const semantic=server.indexOf('semantic-ux-v32.js?v=46');
  const lifecycle=server.indexOf('speech-lifecycle-v46.js?v=46');
  const voice=server.indexOf('mobile-voice-v46.js?v=46');
  assert.ok(semantic>=0&&lifecycle>semantic&&voice>lifecycle);
  assert.doesNotMatch(server,/mobile-voice-v27\.js/);
  assert.match(server,/voice-chat-deadline-v46/);
  assert.match(server,/universal-core-mobile-v46-responsive-voice/);
});

test('server network layer bounds flaky Supabase Edge before provider fallback',()=>{
  const source=read('lib/network-deadlines-v46.js');
  assert.match(source,/1_800/);
  assert.match(source,/12_000/);
  assert.match(source,/8_000/);
  assert.match(source,/CIRCUIT_MS = 15_000/);
  assert.match(source,/NETWORK_DEADLINE/);
  assert.match(source,/NETWORK_CIRCUIT_OPEN/);
});

test('exact help prompt from clip is answered locally without provider latency',async()=>{
  const {headers,res}=fakeResponse();
  const req={method:'POST',headers:{},socket:{remoteAddress:'127.0.0.46'},body:{message:'Me puedes ayudar con la presidencia de mi universidad?',mode:'general'}};
  const started=Date.now();
  await chatHandler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(headers['x-wae-fast-path'],'conversational-help-v46');
  assert.equal(res.payload?.provider,'universal_core');
  assert.match(res.payload?.reply||'',/presidencia de tu universidad/i);
  assert.ok(Date.now()-started<500,'clip prompt must not wait on an external provider');
});

test('chat enforces finite budgets instead of a 67-second interactive stall',()=>{
  const source=read('api/chat.js');
  assert.match(source,/return 18_000/);
  assert.match(source,/return 24_000/);
  assert.match(source,/return 30_000/);
  assert.match(source,/RUNTIME_DEADLINE/);
  assert.match(source,/X-WAE-Response-Budget-Ms/);
});