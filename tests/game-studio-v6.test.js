import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createNativeGameStudioProject,inspectGameStudioProject,GAME_STUDIO_VERSION} from '../lib/game-studio-v6.js';
import {inspectFoundryProject,buildDigitalProduct} from '../lib/product-foundry-v5.js';
import {GAME_STUDIO_VERSION as ACTIVE_GAME_STUDIO_VERSION,inspectGameStudioProject as inspectActiveGameStudioProject} from '../lib/game-studio-v6.js';

test('Game Studio v6 native scaffold is a real self-contained 3D product',()=>{
  const project=createNativeGameStudioProject({request:'Crea un juego 3D divertido con obstáculos y energía.',profile:'game_3d'});
  assert.ok(project.files.length>=7);
  const foundry=inspectFoundryProject(project.files,{profile:'game_3d'});
  const studio=inspectGameStudioProject(project.files);
  assert.equal(foundry.pass,true,foundry.failed.join(','));
  assert.equal(studio.pass,true,studio.failed.join(','));
  const main=project.files.find(f=>f.name==='main.js').content;
  assert.doesNotThrow(()=>new vm.Script(main));
  assert.match(main,/createShader/);
  assert.match(main,/AudioContext|webkitAudioContext/);
  assert.match(main,/emitParticles/);
  assert.match(main,/aabb|overlaps/);
  assert.match(main,/toggleEditor|addEntity/);
  const manifest=JSON.parse(project.files.find(f=>f.name==='wae-product.json').content);
  assert.equal(manifest.studio,GAME_STUDIO_VERSION);
  assert.ok(manifest.capabilities.includes('scene-editor'));
});

test('legacy v6 remains compatible while active recovery upgrades first 3D build to v14',async()=>{
  const fail=async()=>{const e=new Error('Todos los proveedores configurados fallaron');e.code='all_providers_failed';throw e};
  const result=await buildDigitalProduct({
    request:'Crea un juego 3D jugable con WebGL, cámara, controles, físicas y HUD.',
    kind:'game_3d',
    generate:fail
  });
  assert.equal(result.quality.structural,'passed');
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(result.model,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.recovery.mode,'native_game_studio');
  assert.equal(result.recovery.providerIndependent,true);
  assert.equal(result.studio.version,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.qa,'passed');
  assert.equal(result.project.files.some(f=>f.name==='scene.json'),true);
});

test('active Game Studio replaces an incomplete AI 3D scaffold with audited v14 output',async()=>{
  const weak={
    plan:'3D incompleto',
    files:[
      {name:'index.html',content:'<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="styles.css"></head><body><main><h1>Demo 3D</h1><canvas></canvas><p>Escena.</p></main><script src="main.js"></script></body></html>'},
      {name:'styles.css',content:'body{margin:0;background:#000;color:#fff}canvas{width:100%;height:60vh}@media(max-width:600px){canvas{height:50vh}}'},
      {name:'main.js',content:"const c=document.querySelector('canvas');const gl=c.getContext('webgl');function render(){requestAnimationFrame(render)}render();"},
      {name:'README.md',content:'# Demo\nSalida incompleta.'},
      {name:'wae-product.json',content:JSON.stringify({schema:'wae-product/v5',name:'Demo',profile:'game_3d',targets:['web-preview'],entry:'index.html'})}
    ]
  };
  const generate=async()=>({text:JSON.stringify(weak),provider:'test',model:'weak'});
  const result=await buildDigitalProduct({request:'Crea un juego 3D premium y completo.',kind:'game_3d',generate});
  assert.equal(result.recovery.mode,'native_game_studio');
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(inspectActiveGameStudioProject(result.project.files).pass,true);
});

test('Game Studio v6 does not overwrite an existing project when providers fail during a revision',async()=>{
  const existing=createNativeGameStudioProject({request:'Juego base',profile:'game_3d'}).files;
  const fail=async()=>{const e=new Error('provider down');e.code='all_providers_failed';throw e};
  await assert.rejects(
    ()=>buildDigitalProduct({request:'Cambia todo el nivel y agrega un jefe.',kind:'game_3d',files:existing,generate:fail}),
    /provider down/
  );
});
