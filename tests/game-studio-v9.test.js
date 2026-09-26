import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {
  createNativeGameStudioProject,
  inspectGameStudioProject,
  GAME_STUDIO_VERSION,
  LOGIC_SCHEMA
} from '../lib/game-studio-v9.js';
import {inspectFoundryProject,buildDigitalProduct} from '../lib/product-foundry-v5.js';
import {GAME_STUDIO_VERSION as ACTIVE_GAME_STUDIO_VERSION,inspectGameStudioProject as inspectActiveGameStudioProject} from '../lib/game-studio-v13.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Game Studio v9 builds a portable visual gameplay logic package',()=>{
  const project=createNativeGameStudioProject({
    request:'Crea un juego 3D con reglas, misiones, portales y recompensas.',
    profile:'game_3d'
  });
  const foundry=inspectFoundryProject(project.files,{profile:'game_3d'});
  const studio=inspectGameStudioProject(project.files);
  assert.equal(foundry.pass,true,foundry.failed.join(','));
  assert.equal(studio.pass,true,studio.failed.join(','));

  const logic=JSON.parse(project.files.find(file=>file.name==='logic.json').content);
  const main=project.files.find(file=>file.name==='main.js').content;
  const html=project.files.find(file=>file.name==='index.html').content;
  const manifest=JSON.parse(project.files.find(file=>file.name==='wae-product.json').content);

  assert.equal(logic.schema,LOGIC_SCHEMA);
  assert.ok(logic.rules.length>=3);
  assert.ok(logic.rules.some(rule=>rule.event.type==='scene_enter'));
  assert.ok(logic.rules.some(rule=>rule.event.type==='trigger_enter'));
  assert.ok(logic.rules.some(rule=>rule.event.type==='score_changed'));
  assert.match(main,/^const LOGIC=/m);
  assert.match(main,/emitLogicEvent/);
  assert.match(main,/logicEventMatches/);
  assert.match(main,/executeLogicAction/);
  assert.match(main,/playtestSelectedLogic/);
  assert.match(main,/saveLogicToFactory/);
  assert.match(main,/forceCompleted=true/);
  assert.match(main,/emitLogicEvent\('mission_completed'/);
  assert.match(html,/logicBuilderPanel/);
  assert.match(html,/logicEventLog/);
  assert.match(html,/logicCondition/);
  assert.match(html,/logicAction/);
  assert.doesNotThrow(()=>new vm.Script(main));
  assert.equal(manifest.studio,GAME_STUDIO_VERSION);
  assert.equal(manifest.logic,LOGIC_SCHEMA);

  for(const capability of [
    'visual-logic-builder','event-rules','conditions','gameplay-actions','logic-playtest','logic-persistence'
  ]){
    assert.ok(manifest.capabilities.includes(capability),capability);
  }
});

test('legacy v9 Logic Builder remains compatible while active recovery upgrades to v13',async()=>{
  const fail=async()=>{
    const error=new Error('Todos los proveedores configurados fallaron');
    error.code='all_providers_failed';
    throw error;
  };
  const result=await buildDigitalProduct({
    request:'Construye un videojuego 3D con reglas visuales, portales, recompensas y misiones.',
    kind:'game_3d',
    generate:fail
  });
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(result.model,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.version,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.qa,'passed');
  assert.equal(result.recovery.mode,'native_game_studio');
  assert.equal(result.project.files.some(file=>file.name==='logic.json'),true);
  assert.equal(inspectActiveGameStudioProject(result.project.files).pass,true);
});

test('Logic Builder v9 persistence validates source iframe and rule contracts',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/event\.source!==frame\.contentWindow/);
  assert.match(workspace,/data\.type==='wae-game-studio-logic-save'/);
  assert.match(workspace,/data\.studio==='wae-game-studio\/v9'/);
  assert.match(workspace,/raw\.schema!=='wae-logic\/v9'/);
  assert.match(workspace,/raw\.rules\.length>120/);
  assert.match(workspace,/eventTypes=new Set\(\['scene_enter','trigger_enter','score_changed','mission_completed','timer'\]\)/);
  assert.match(workspace,/actionTypes=new Set\(\['message','scene','spawn_prefab','mission_complete','score_add','lighting'\]\)/);
  assert.match(workspace,/logic\.json/);
  assert.match(workspace,/mainFile\.content\.replace\(\/\^const LOGIC=/);
  assert.match(workspace,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
  assert.doesNotMatch(workspace,/sandbox','allow-scripts allow-same-origin/);
});

test('v9 QA rejects a package without logic.json',()=>{
  const project=createNativeGameStudioProject({request:'Juego lógico',profile:'game_3d'});
  project.files=project.files.filter(file=>file.name!=='logic.json');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('logicFile'));
});

test('v9 QA rejects removal of logic persistence channel',()=>{
  const project=createNativeGameStudioProject({request:'Juego lógico',profile:'game_3d'});
  const main=project.files.find(file=>file.name==='main.js');
  main.content=main.content.replace(/window\.parent\.postMessage/g,'void');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('persistence'));
});

test('v9 default rules use only supported events, conditions and actions',()=>{
  const project=createNativeGameStudioProject({request:'Juego con reglas',profile:'game_3d'});
  const logic=JSON.parse(project.files.find(file=>file.name==='logic.json').content);
  const events=new Set(['scene_enter','trigger_enter','score_changed','mission_completed','timer']);
  const conditions=new Set(['always','score_gte','visited_scenes_gte','mission_status','scene_is']);
  const actions=new Set(['message','scene','spawn_prefab','mission_complete','score_add','lighting']);
  const ids=new Set();
  for(const rule of logic.rules){
    assert.ok(!ids.has(rule.id),rule.id);
    ids.add(rule.id);
    assert.ok(events.has(rule.event.type),rule.event.type);
    for(const condition of rule.conditions)assert.ok(conditions.has(condition.type),condition.type);
    for(const action of rule.actions)assert.ok(actions.has(action.type),action.type);
  }
});
