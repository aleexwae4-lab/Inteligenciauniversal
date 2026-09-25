import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {
  createNativeGameStudioProject,
  inspectGameStudioProject,
  GAME_STUDIO_VERSION,
  NPC_SCHEMA,
  LOGIC_SCHEMA
} from '../lib/game-studio-v10.js';
import {inspectFoundryProject,buildDigitalProduct} from '../lib/product-foundry-v5.js';
import {GAME_STUDIO_VERSION as ACTIVE_GAME_STUDIO_VERSION,inspectGameStudioProject as inspectActiveGameStudioProject} from '../lib/game-studio-v12.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Game Studio v10 builds portable NPC characters with local state-machine AI',()=>{
  const project=createNativeGameStudioProject({
    request:'Crea un juego 3D con aliados, enemigos, patrullas, diálogo y objetivos.',
    profile:'game_3d'
  });
  const foundry=inspectFoundryProject(project.files,{profile:'game_3d'});
  const studio=inspectGameStudioProject(project.files);
  assert.equal(foundry.pass,true,foundry.failed.join(','));
  assert.equal(studio.pass,true,studio.failed.join(','));

  const npcs=JSON.parse(project.files.find(file=>file.name==='npc.json').content);
  const logic=JSON.parse(project.files.find(file=>file.name==='logic.json').content);
  const scene=JSON.parse(project.files.find(file=>file.name==='scene.json').content);
  const main=project.files.find(file=>file.name==='main.js').content;
  const html=project.files.find(file=>file.name==='index.html').content;
  const manifest=JSON.parse(project.files.find(file=>file.name==='wae-product.json').content);

  assert.equal(npcs.schema,NPC_SCHEMA);
  assert.equal(logic.schema,LOGIC_SCHEMA);
  assert.equal(scene.engine,GAME_STUDIO_VERSION);
  assert.ok(npcs.characters.length>=3);
  assert.ok(Object.values(npcs.factions).some(faction=>faction.attitude==='hostile'));
  assert.ok(npcs.characters.every(npc=>npc.brain.type==='state_machine'));
  assert.ok(npcs.characters.every(npc=>npc.patrol.length>=1));
  assert.ok(npcs.characters.every(npc=>npc.dialogue.length>=1));
  assert.ok(npcs.characters.every(npc=>npc.goals.length>=1));
  assert.match(main,/^const NPCS=/m);
  assert.match(main,/updateNpcBehavior/);
  assert.match(main,/drawNpcCharacters/);
  assert.match(main,/interactNearestNpc/);
  assert.match(main,/npc_state_changed/);
  assert.match(main,/npc_goal_completed/);
  assert.match(main,/npc_set_state/);
  assert.match(main,/npc_say/);
  assert.match(html,/npcBuilderPanel/);
  assert.match(html,/npcDialogueBox/);
  assert.match(html,/npcFaction/);
  assert.doesNotThrow(()=>new vm.Script(main));
  assert.equal(manifest.studio,GAME_STUDIO_VERSION);
  assert.equal(manifest.npcs,NPC_SCHEMA);

  for(const capability of[
    'npc-engine','npc-state-machine','npc-perception','npc-patrol','npc-chase',
    'npc-interaction','npc-dialogue','npc-factions','npc-goals','npc-logic-events','npc-persistence'
  ])assert.ok(manifest.capabilities.includes(capability),capability);
});

test('legacy v10 NPC Engine remains compatible while active recovery upgrades to v12',async()=>{
  const fail=async()=>{const error=new Error('all providers failed');error.code='all_providers_failed';throw error};
  const result=await buildDigitalProduct({
    request:'Construye un juego 3D con NPCs, facciones, patrullas, percepción, diálogo y reglas.',
    kind:'game_3d',
    generate:fail
  });
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(result.model,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.version,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.qa,'passed');
  assert.equal(result.recovery.mode,'native_game_studio');
  assert.equal(result.project.files.some(file=>file.name==='npc.json'),true);
  assert.equal(inspectActiveGameStudioProject(result.project.files).pass,true);
});

test('NPC Engine v10 persistence validates source iframe, factions, scenes and state machine',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/event\.source!==frame\.contentWindow/);
  assert.match(workspace,/data\.type==='wae-game-studio-npc-save'/);
  assert.match(workspace,/data\.studio==='wae-game-studio\/v10'/);
  assert.match(workspace,/raw\.schema!=='wae-npc\/v10'/);
  assert.match(workspace,/raw\.characters\.length>120/);
  assert.match(workspace,/states=new Set\(\['idle','patrol','chase','interact'\]\)/);
  assert.match(workspace,/attitudes=new Set\(\['friendly','neutral','hostile'\]\)/);
  assert.match(workspace,/NPC apunta a escena inexistente/);
  assert.match(workspace,/npc\.json/);
  assert.match(workspace,/mainFile\.content\.replace\(\/\^const NPCS=/);
  assert.match(workspace,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
  assert.doesNotMatch(workspace,/sandbox','allow-scripts allow-same-origin/);
});

test('Logic Builder v10 accepts NPC events and bounded NPC actions',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/raw\.schema!=='wae-logic\/v10'/);
  assert.match(workspace,/npc_interact/);
  assert.match(workspace,/npc_state_changed/);
  assert.match(workspace,/npc_goal_completed/);
  assert.match(workspace,/npc_set_state/);
  assert.match(workspace,/npc_say/);
  const project=createNativeGameStudioProject({request:'Juego NPC lógico',profile:'game_3d'});
  const logic=JSON.parse(project.files.find(file=>file.name==='logic.json').content);
  assert.ok(logic.rules.some(rule=>rule.event.type==='npc_interact'));
  assert.ok(logic.rules.some(rule=>rule.event.type==='npc_state_changed'));
});

test('v10 QA rejects removal of npc.json',()=>{
  const project=createNativeGameStudioProject({request:'Juego NPC',profile:'game_3d'});
  project.files=project.files.filter(file=>file.name!=='npc.json');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('npcFile'));
});

test('v10 QA rejects removal of NPC persistence channel',()=>{
  const project=createNativeGameStudioProject({request:'Juego NPC',profile:'game_3d'});
  const main=project.files.find(file=>file.name==='main.js');
  main.content=main.content.replace(/window\.parent\.postMessage/g,'void');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('npcPersistence'));
});

test('v10 default NPCs reference valid factions, scenes and bounded behavior',()=>{
  const project=createNativeGameStudioProject({request:'Juego NPC',profile:'game_3d'});
  const npcs=JSON.parse(project.files.find(file=>file.name==='npc.json').content);
  const world=JSON.parse(project.files.find(file=>file.name==='world.json').content);
  const scenes=new Set(world.scenes.map(scene=>scene.id));
  for(const npc of npcs.characters){
    assert.ok(npcs.factions[npc.faction],npc.faction);
    assert.ok(scenes.has(npc.sceneId),npc.sceneId);
    assert.ok(npc.behavior.perceptionRadius>=.5&&npc.behavior.perceptionRadius<=30);
    assert.ok(npc.behavior.interactionRadius>=.5&&npc.behavior.interactionRadius<=10);
    assert.ok(['idle','patrol','chase','interact'].includes(npc.state));
  }
});
