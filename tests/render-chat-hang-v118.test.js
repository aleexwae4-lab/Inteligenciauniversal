import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {executeMission} from '../lib/runtime.js';
import {coreComparisonFastAnswer} from '../lib/core-comparison-v9.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

function browserFast(){
  const src=read('runtime-client.js');
  const start=src.indexOf('  const quickGoogleComparison=value=>');
  const end=src.indexOf('  const comparisonBrief=',start);
  assert.ok(start>0&&end>start);
  const ctx={};vm.runInNewContext(src.slice(start,end)+'\nthis.quickGoogleComparison=quickGoogleComparison;',ctx);
  return ctx.quickGoogleComparison;
}

test('video repro: Google short question gets a concrete answer without remote inference',async()=>{
  const q='¿Puedes competir contra Google?';
  const answer=coreComparisonFastAnswer(q);
  assert.match(answer,/Universal Core/);
  assert.match(answer,/Google/);
  assert.match(answer,/Search/);
  assert.match(answer,/pruebas comparables/);
  const actual=await executeMission({message:q});
  assert.equal(actual.reply,answer);
  assert.equal(actual.provider,'wae_core');
  assert.equal(actual.grounded,true);
  assert.equal(actual.latencyMs>=0,true);
});

test('client and server narrow fast comparison agree, but nuanced requests remain generative',()=>{
  const browser=browserFast();
  for(const q of ['¿Puedes competir contra Google?','Puedes competir con Google','¿Universal Core puede competir contra Google?']){
    assert.equal(browser(q),true,q);
    assert.ok(coreComparisonFastAnswer(q),q);
  }
  for(const q of ['¿Puedes superar a Google?','Puedes competir contra Google y demostrarlo con benchmarks de esta semana','¿Puedes competir contra Google en buscadores y economía mundial?','Hola','¿Puedes competir contra Gemini?']){
    assert.equal(browser(q),false,q);
    assert.equal(coreComparisonFastAnswer(q),null,q);
  }
});

test('browser interception transfers parent abort to actual Supabase network request',async()=>{
  const client=read('runtime-client.js');
  const from=client.indexOf('  const linkedAbort=(outer,ms)=>');
  const to=client.indexOf('  let bootPromise;',from);
  assert.ok(from>0&&to>from);
  const observed=[];
  const nativeFetch=(_,options)=>new Promise((_resolve,reject)=>{
    observed.push(options.signal);
    options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
  });
  const ctx={AbortController,setTimeout,clearTimeout,nativeFetch,EDGE:'https://edge.invalid',SUPABASE_KEY:'public-key'};
  vm.runInNewContext(client.slice(from,to)+'\nthis.edge=edge;',ctx);
  const outer=new AbortController();
  const pending=ctx.edge({action:'chat',message:'Chat pending'},outer.signal,15000);
  await Promise.resolve();
  assert.equal(observed.length,1);
  assert.equal(observed[0].aborted,false);
  outer.abort();
  await assert.rejects(pending,err=>err.name==='AbortError');
  assert.equal(observed[0].aborted,true);
});

test('chat timeout contracts cannot launch a second invisible request after parent abort',()=>{
  const client=read('runtime-client.js');
  const app=read('app.js');
  assert.match(client,/await bootstrap\(init\.signal\)/);
  assert.match(client,/bootstrap=signal=>\{/);
  assert.match(client,/\},signal,7000\)/);
  assert.match(client,/chatWithSessionRepair\(chatPayload,init\.signal\)/);
  assert.match(client,/if\(init\.signal\?\.aborted\)throw err;/);
  assert.match(client,/if\(init\.signal\?\.aborted\)throw Object\.assign/);
  assert.match(app,/setTimeout\(\(\)=>c\.abort\(\),65000\)/);
  assert.match(app,/finally\{\s*state\.busy=false;hideTyping\(\)/);
  assert.match(app,/i\.value=m;autosizeInput\(\)/);
});

test('preserves visual capabilities, all domain routers, cache contract and separate deploys',()=>{
  const client=read('runtime-client.js'),html=read('index.html'),sw=read('sw.js');
  assert.match(client,/if\(request\.canvas!==true&&worldQuery\(request\.message\)\)return nativeFetch\(input,init\)/);
  assert.match(client,/industrialQuery\(request\.message\)\|\|professionalQuery\(request\.message\)/);
  assert.match(client,/request\.canvas_direct===true\|\|request\.canvas_blueprint===true/);
  assert.match(html,/runtime-client\.js\?v=24&industrial=v115&professional=v116&world=v117&chatfix=v118/);
  assert.match(sw,/runtime-client\.js\?v=24&industrial=v115&professional=v116&world=v117&chatfix=v118/);
  assert.match(sw,/wae-universal-render-waeweb-v44/);
  assert.match(client,/VISUAL_EDGE/);
});
