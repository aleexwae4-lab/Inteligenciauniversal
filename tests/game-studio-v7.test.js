import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createNativeGameStudioProject,inspectGameStudioProject,GAME_STUDIO_VERSION} from '../lib/game-studio-v7.js';
import {inspectFoundryProject,buildDigitalProduct} from '../lib/product-foundry-v5.js';
import {GAME_STUDIO_VERSION as ACTIVE_GAME_STUDIO_VERSION,inspectGameStudioProject as inspectActiveGameStudioProject} from '../lib/game-studio-v11.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Game Studio v7 scaffold includes visual editor, hierarchy, inspector and persistence',()=>{
  const project=createNativeGameStudioProject({request:'Crea un juego 3D premium editable.',profile:'game_3d'});
  const foundry=inspectFoundryProject(project.files,{profile:'game_3d'});
  const studio=inspectGameStudioProject(project.files);
  assert.equal(foundry.pass,true,foundry.failed.join(','));
  assert.equal(studio.pass,true,studio.failed.join(','));
  const html=project.files.find(f=>f.name==='index.html').content;
  const main=project.files.find(f=>f.name==='main.js').content;
  const scene=JSON.parse(project.files.find(f=>f.name==='scene.json').content);
  const manifest=JSON.parse(project.files.find(f=>f.name==='wae-product.json').content);
  assert.equal(scene.engine,GAME_STUDIO_VERSION);
  assert.equal(scene.editor.hierarchy,true);
  assert.equal(scene.editor.inspector,true);
  assert.match(html,/entityHierarchy/);
  assert.match(html,/selectedEntity/);
  assert.match(html,/materialColor/);
  assert.match(html,/data-nudge="x,-0\.25"/);
  assert.match(main,/duplicateSelected/);
  assert.match(main,/deleteSelected/);
  assert.match(main,/drawEditorGizmo/);
  assert.match(main,/saveSceneToFactory/);
  assert.match(main,/wae-game-studio-scene-save/);
  assert.doesNotThrow(()=>new vm.Script(main));
  assert.equal(manifest.studio,GAME_STUDIO_VERSION);
  for(const capability of ['scene-hierarchy','entity-inspector','transform-xyz','transform-gizmo','duplicate-delete','material-editor','scene-undo','scene-persistence']){
    assert.ok(manifest.capabilities.includes(capability),capability);
  }
});

test('legacy v7 editor remains compatible while active recovery upgrades first build to v11',async()=>{
  const fail=async()=>{const e=new Error('Todos los proveedores configurados fallaron');e.code='all_providers_failed';throw e};
  const result=await buildDigitalProduct({
    request:'Construye un juego 3D con editor visual y físicas.',
    kind:'game_3d',
    generate:fail
  });
  assert.equal(result.quality.structural,'passed');
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(result.model,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.version,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.qa,'passed');
  assert.equal(result.recovery.mode,'native_game_studio');
  assert.equal(inspectActiveGameStudioProject(result.project.files).pass,true);
});

test('Factory persists only validated v7 scene messages without weakening preview sandbox',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/event\.source!==frame\.contentWindow/);
  assert.match(workspace,/data\.type!=='wae-game-studio-scene-save'/);
  assert.match(workspace,/data\.studio!=='wae-game-studio\/v7'/);
  assert.match(workspace,/raw\.engine!=='wae-game-studio\/v7'/);
  assert.match(workspace,/entities\.length>240/);
  assert.match(workspace,/scene\.json/);
  assert.match(workspace,/mainFile\.content\.replace\(\/\^const SCENE=/);
  assert.match(workspace,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
  assert.doesNotMatch(workspace,/sandbox','allow-scripts allow-same-origin/);
});

test('v7 QA rejects a package that removes the visual editor persistence contract',()=>{
  const project=createNativeGameStudioProject({request:'Juego editable',profile:'game_3d'});
  const main=project.files.find(f=>f.name==='main.js');
  main.content=main.content.replace(/window\.parent\.postMessage/g,'void');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('persistence'));
});
