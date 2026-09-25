import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createNativeGameStudioProject,inspectGameStudioProject,GAME_STUDIO_VERSION,WORLD_SCHEMA} from '../lib/game-studio-v8.js';
import {inspectFoundryProject,buildDigitalProduct} from '../lib/product-foundry-v5.js';
import {GAME_STUDIO_VERSION as ACTIVE_GAME_STUDIO_VERSION,inspectGameStudioProject as inspectActiveGameStudioProject} from '../lib/game-studio-v9.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Game Studio v8 creates a real multi-scene World Builder package',()=>{
  const project=createNativeGameStudioProject({request:'Crea un mundo 3D con dos zonas, misiones y prefabs.',profile:'game_3d'});
  const foundry=inspectFoundryProject(project.files,{profile:'game_3d'});
  const studio=inspectGameStudioProject(project.files);
  assert.equal(foundry.pass,true,foundry.failed.join(','));
  assert.equal(studio.pass,true,studio.failed.join(','));
  const world=JSON.parse(project.files.find(f=>f.name==='world.json').content);
  const scene=JSON.parse(project.files.find(f=>f.name==='scene.json').content);
  const manifest=JSON.parse(project.files.find(f=>f.name==='wae-product.json').content);
  const main=project.files.find(f=>f.name==='main.js').content;
  assert.equal(world.schema,WORLD_SCHEMA);
  assert.equal(scene.engine,GAME_STUDIO_VERSION);
  assert.ok(world.scenes.length>=2);
  assert.ok(Object.keys(world.prefabs).length>=3);
  assert.ok(world.scenes.every(s=>s.spawnPoints.length>=1));
  assert.ok(world.scenes.some(s=>s.triggers.length>=1));
  assert.ok(world.missions.length>=2);
  assert.doesNotThrow(()=>new vm.Script(main));
  for(const token of ['loadWorldScene','spawnWorldPrefab','processWorldTriggers','renderMissions','applyCameraEditor','applyLightingEditor','saveWorldToFactory']){
    assert.match(main,new RegExp(token),token);
  }
  for(const capability of ['multi-scene-worlds','prefab-library','spawn-points','zone-triggers','scene-transitions','mission-system','camera-editor','lighting-editor','world-persistence']){
    assert.ok(manifest.capabilities.includes(capability),capability);
  }
});

test('legacy v8 World Builder remains compatible while active recovery upgrades to v9',async()=>{
  const fail=async()=>{const e=new Error('all providers failed');e.code='all_providers_failed';throw e};
  const result=await buildDigitalProduct({
    request:'Construye un videojuego 3D con mundo, mapas, prefabs, misiones y triggers.',
    kind:'game_3d',
    generate:fail
  });
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(result.model,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.version,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.qa,'passed');
  assert.equal(result.recovery.mode,'native_game_studio');
  assert.equal(result.project.files.some(f=>f.name==='world.json'),true);
  assert.equal(inspectActiveGameStudioProject(result.project.files).pass,true);
});

test('World Builder v8 persistence validates source iframe and portable world contract',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/event\.source!==frame\.contentWindow/);
  assert.match(workspace,/data\.type==='wae-game-studio-world-save'/);
  assert.match(workspace,/\['wae-game-studio\/v8','wae-game-studio\/v9'\]\.includes\(data\.studio\)/);
  assert.match(workspace,/raw\.schema!=='wae-world\/v8'/);
  assert.match(workspace,/raw\.scenes/);
  assert.match(workspace,/scenes\.length>40/);
  assert.match(workspace,/triggers\.length>100/);
  assert.match(workspace,/world\.json/);
  assert.match(workspace,/scene\.json/);
  assert.match(workspace,/mainFile\.content\.replace\(\/\^const SCENE=/);
  assert.match(workspace,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
  assert.doesNotMatch(workspace,/allow-same-origin/);
});

test('v8 QA rejects a package without portable world.json',()=>{
  const project=createNativeGameStudioProject({request:'Mundo editable',profile:'game_3d'});
  project.files=project.files.filter(file=>file.name!=='world.json');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('worldFile'));
});

test('v8 QA rejects removal of world persistence channel',()=>{
  const project=createNativeGameStudioProject({request:'Mundo editable',profile:'game_3d'});
  const main=project.files.find(file=>file.name==='main.js');
  main.content=main.content.replace(/window\.parent\.postMessage/g,'void');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('persistence'));
});

test('v8 world schema keeps player and floor in every scene',()=>{
  const project=createNativeGameStudioProject({request:'Juego por sectores',profile:'game_3d'});
  const world=JSON.parse(project.files.find(file=>file.name==='world.json').content);
  for(const scene of world.scenes){
    assert.ok(scene.entities.some(entity=>entity.type==='player'),scene.id+' player');
    assert.ok(scene.entities.some(entity=>entity.type==='floor'),scene.id+' floor');
  }
});
