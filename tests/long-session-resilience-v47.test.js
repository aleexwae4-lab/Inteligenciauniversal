import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {councilEligible} from '../lib/deliberation-plane.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

function route(task={}){
  return {
    applied:true,
    task:{category:'reasoning',path:'STANDARD',risk:'low',complexity:'medium',...task},
    fallbackOrder:['wae_edge','wae_supabase','gemini']
  };
}

test('v47 propagates request cancellation into every network fetch',()=>{
  const network=read('lib/network-deadlines-v46.js');
  const chat=read('api/chat.js');
  const providers=read('lib/providers.js');
  assert.match(network,/AsyncLocalStorage/);
  assert.match(network,/runWithRequestSignal/);
  assert.match(network,/currentRequestSignal/);
  assert.match(network,/REQUEST_CANCELLED/);
  assert.match(chat,/withAbortableDeadline/);
  assert.match(chat,/req\.once\?\.\('aborted'/);
  assert.match(chat,/res\.once\?\.\('close'/);
  assert.match(chat,/runWithRequestSignal/);
  assert.doesNotMatch(chat,/Promise\.race\(\[promise,deadline\]\)/);
  assert.match(providers,/if\(error\?\.code==='REQUEST_CANCELLED'\)throw error/);
});

test('ordinary long conversational reasoning does not fan out into Universal Council',()=>{
  const body={
    message:'Tu crees que una universidad suba de prestigio al tener al desarrollador de Universal Core con ellos?',
    mode:'general',
    provider:'auto'
  };
  assert.equal(councilEligible({route:route(),body}),false);
  assert.equal(councilEligible({route:route({path:'DEEP'}),body}),false);
});

test('Council remains available for explicit or truly deep analytical work',()=>{
  const explicit={message:'Compara dos arquitecturas y decide la mejor.',mode:'general',provider:'auto',council_mode:true};
  assert.equal(councilEligible({route:route(),body:explicit}),true);
  const deep={message:'Analiza esta arquitectura empresarial compleja y sus trade-offs.',mode:'analysis',provider:'auto'};
  assert.equal(councilEligible({route:route({category:'analysis',path:'DEEP',complexity:'high'}),body:deep}),true);
});

test('mobile v47 performs one backend attempt and deduplicates retries',()=>{
  const runtime=read('mobile-runtime-v47.js');
  assert.match(runtime,/singleAttempt:true/);
  assert.match(runtime,/RECENT_TTL_MS=45000/);
  assert.match(runtime,/const inflight=new Map\(\)/);
  assert.match(runtime,/const recent=new Map\(\)/);
  assert.match(runtime,/x-wae-mobile-attempt':'1'/);
  assert.match(runtime,/activeTurn\.controller\.abort/);
  assert.match(runtime,/directChatRequest/);
  assert.match(runtime,/direct-replay/);
  assert.doesNotMatch(runtime,/attempt<=2/);
  assert.doesNotMatch(runtime,/RETRYABLE_STATUS/);
});

test('production telemetry drops per-key and pointer request storms',()=>{
  const telemetry=read('telemetry-throttle-v47.js');
  assert.match(telemetry,/new Set\(\['input','pointerdown','touchstart','focus'\]\)/);
  assert.match(telemetry,/throttled:true/);
  assert.match(telemetry,/x-wae-telemetry/);
  assert.match(telemetry,/page_loaded/);
  assert.match(telemetry,/sw_state/);
});

test('server loads telemetry guard before v47 runtime and advertises long-session release',()=>{
  const server=read('server.js');
  const telemetry=server.indexOf('telemetry-throttle-v47.js?v=47');
  const runtime=server.indexOf('mobile-runtime-v47.js?v=47');
  const bootstrap=server.indexOf('mobile-bootstrap-v45.js?v=45');
  assert.ok(telemetry>=0&&runtime>telemetry&&bootstrap>runtime);
  assert.match(server,/universal-core-mobile-v47-long-session/);
  assert.match(server,/long-session-backpressure-v47/);
  assert.doesNotMatch(server,/mobile-runtime-v34\.js\?v=44/);
});

test('new v47 browser and network files are syntactically valid',()=>{
  for(const path of ['telemetry-throttle-v47.js','mobile-runtime-v47.js','lib/network-deadlines-v46.js']){
    const file=fileURLToPath(new URL(`../${path}`,import.meta.url));
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    assert.equal(result.status,0,`${path}: ${result.stderr||result.stdout}`);
  }
});
