import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

function tools(){
  const events=[],window={dispatchEvent:e=>events.push(e.detail)};
  const context=vm.createContext({window,CustomEvent:class{constructor(_name,options){this.detail=options.detail}},Map,Date,Object,Error,String});
  vm.runInContext(read('universal-tools-v1.js'),context);
  return {core:window.WAECoreTools,events};
}
test('Universal Core natively registers visual.inspect and dispatches through a normal chat turn',async()=>{
  const {core,events}=tools();
  let pending=true,calls=0;
  core.register({id:'visual.inspect',label:'WAE Visual Scan',kind:'multimodal',canHandle:()=>pending,run:async ctx=>{
    calls++;
    assert.equal(ctx.message,'¿Qué ves?');
    assert.equal(ctx.mode,'analysis');
    assert.equal(ctx.history[0].text,'Contexto previo');
    pending=false;
    return {reply:'La fotografía muestra un cable junto al piso.',metadata:{mediaKind:'photo'}};
  }});
  assert.deepEqual(Array.from(core.list(),t=>t.id),['visual.inspect']);
  const result=await core.runTurn({message:'¿Qué ves?',mode:'analysis',history:[{text:'Contexto previo'}]});
  assert.equal(result.handled,true);assert.equal(result.tool,'visual.inspect');assert.equal(calls,1);
  assert.match(result.reply,/cable/);
  assert.equal(core.status().last.ok,true);
  assert.equal((await core.runTurn({message:'Una pregunta de texto'})).handled,false);
  assert.equal(calls,1);
  assert.ok(events.some(e=>e.kind==='success'&&e.id==='visual.inspect'));
});
test('native tool failure never marks the analysis successful and permits retry',async()=>{
  const {core}=tools();let attempts=0;
  core.register({id:'visual.inspect',label:'Visual',kind:'multimodal',canHandle:()=>true,run:async()=>{
    if(++attempts===1)throw Object.assign(Error('proveedor no disponible'),{code:'visual_provider_unavailable'});
    return{reply:'Resultado real'};
  }});
  await assert.rejects(core.runTurn({message:'Describe'}),/proveedor no disponible/);
  assert.equal(core.status().last.ok,false);
  assert.equal(core.status().last.code,'visual_provider_unavailable');
  assert.equal(core.status().active,null);
  assert.equal((await core.runTurn({message:'Reintenta'})).reply,'Resultado real');
  assert.equal(attempts,2);
});
test('native image/video path is shared by camera and ordinary Adjuntar, not tied to a button special-case',()=>{
  const app=read('app.js'),camera=read('camera-v1.js'),runtime=read('runtime-client.js'),html=read('index.html'),sw=read('sw.js');
  assert.match(app,/window\.WAECoreTools\?\.runTurn\(/);
  assert.match(app,/window\.WAECoreTools\?\.defaultQuestion/);
  assert.doesNotMatch(app,/if\(window\.WAECamera\?\.hasPending/);
  assert.match(app,/window\.WAECamera\?\.clear\?\.\(\)/);
  assert.match(camera,/id:'visual.inspect'/);
  assert.match(camera,/window\.WAECoreTools\?\.register\(/);
  assert.match(camera,/function prepareFile\(file\)/);
  assert.match(camera,/#fileInput'\)\?\.addEventListener\('change'/);
  assert.match(camera,/if\(preparation\)await preparation/);
  assert.match(camera,/const result=await window\.WAECamera\.analyze\(context\)/);
  assert.ok(camera.includes("/\\.(?:mp4|webm|mov|m4v)$/i.test(file.name)"));
  assert.match(camera,/clear\(\);\s*return \{reply:result\.reply/);
  assert.match(runtime,/const media=\[\.\.\.files\]\.some/);
  assert.match(html,/universal-tools-v1\.js\?v=1/);
  assert.match(sw,/universal-tools-v1\.js\?v=1/);
  assert.match(sw,/wae-universal-render-canvas-factory-v31/);
 assert.match(sw,/canvas-render-factory-v1\.js\?v=1/);
});