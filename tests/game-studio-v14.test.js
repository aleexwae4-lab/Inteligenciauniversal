import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createNativeGameStudioProject,inspectGameStudioProject,GAME_STUDIO_VERSION,CAMERA_SCHEMA,VFX_SCHEMA,AUDIO_SCHEMA,CINEMATIC_SCHEMA} from '../lib/game-studio-v14.js';
import {buildDigitalProduct} from '../lib/product-foundry-v5.js';

test('Game Studio v14 builds a native cinematic presentation pipeline',()=>{
  const project=createNativeGameStudioProject({request:'Crea un juego 3D premium con cámara cinematográfica, VFX, audio y cinemáticas.',profile:'game_3d'});
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,true,audit.failed.join(','));
  const names=new Set(project.files.map(file=>file.name));
  for(const name of ['camera.json','vfx.json','audio.json','cinematic.json'])assert.ok(names.has(name),name);
  const main=project.files.find(file=>file.name==='main.js').content;
  assert.doesNotThrow(()=>new vm.Script(main));
  assert.match(main,/triggerPresentation/);
  assert.match(main,/cinematicStudioPanel|cinematicCameraMode/);
  const manifest=JSON.parse(project.files.find(file=>file.name==='wae-product.json').content);
  assert.equal(manifest.studio,GAME_STUDIO_VERSION);
  assert.equal(manifest.camera,CAMERA_SCHEMA);
  assert.equal(manifest.vfx,VFX_SCHEMA);
  assert.equal(manifest.audio,AUDIO_SCHEMA);
  assert.equal(manifest.cinematic,CINEMATIC_SCHEMA);
});

test('v14 native recovery remains provider-independent',async()=>{
  const fail=async()=>{const error=new Error('all providers failed');error.code='all_providers_failed';throw error};
  const result=await buildDigitalProduct({request:'Construye un videojuego 3D premium con presentación cinematográfica.',kind:'game_3d',generate:fail});
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(result.model,GAME_STUDIO_VERSION);
  assert.equal(result.studio.version,GAME_STUDIO_VERSION);
  assert.equal(result.recovery.providerIndependent,true);
  assert.equal(inspectGameStudioProject(result.project.files).pass,true);
});

test('v14 pipeline contracts stay native and portable',()=>{
  const project=createNativeGameStudioProject({request:'Juego 3D',profile:'game_3d'});
  for(const name of ['camera.json','vfx.json','audio.json','cinematic.json']){
    const file=project.files.find(item=>item.name===name);
    assert.ok(file);
    assert.doesNotMatch(file.content,/https?:\/\//);
  }
});
