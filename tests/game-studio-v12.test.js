import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {
  createNativeGameStudioProject,
  inspectGameStudioProject,
  GAME_STUDIO_VERSION,
  STORY_SCHEMA,
  SAVE_SCHEMA,
  LOGIC_SCHEMA
} from '../lib/game-studio-v14.js';
import {inspectFoundryProject,buildDigitalProduct} from '../lib/product-foundry-v5.js';
import {GAME_STUDIO_VERSION as ACTIVE_GAME_STUDIO_VERSION,inspectGameStudioProject as inspectActiveGameStudioProject} from '../lib/game-studio-v14.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Game Studio v12 builds quests dialogue variables journal and save contracts',()=>{
  const project=createNativeGameStudioProject({
    request:'Crea un juego 3D con quests encadenadas, decisiones de diálogo y partidas guardadas.',
    profile:'game_3d'
  });
  const foundry=inspectFoundryProject(project.files,{profile:'game_3d'});
  const studio=inspectGameStudioProject(project.files);
  assert.equal(foundry.pass,true,foundry.failed.join(','));
  assert.equal(studio.pass,true,studio.failed.join(','));

  const story=JSON.parse(project.files.find(file=>file.name==='story.json').content);
  const save=JSON.parse(project.files.find(file=>file.name==='savegame.json').content);
  const logic=JSON.parse(project.files.find(file=>file.name==='logic.json').content);
  const main=project.files.find(file=>file.name==='main.js').content;
  const html=project.files.find(file=>file.name==='index.html').content;
  const manifest=JSON.parse(project.files.find(file=>file.name==='wae-product.json').content);

  assert.equal(story.schema,STORY_SCHEMA);
  assert.equal(save.schema,SAVE_SCHEMA);
  assert.equal(logic.schema,LOGIC_SCHEMA);
  assert.equal(manifest.studio,GAME_STUDIO_VERSION);
  assert.equal(manifest.story,STORY_SCHEMA);
  assert.equal(manifest.save,SAVE_SCHEMA);
  assert.ok(story.quests.length>=2);
  assert.ok(story.quests.some(quest=>quest.next.length>=1));
  assert.ok(Object.keys(story.dialogues).length>=2);
  assert.ok(Object.keys(story.variables).length>=2);
  assert.match(main,/^const STORY=/m);
  assert.match(main,/^const SAVE_CONFIG=/m);
  assert.match(main,/startQuest/);
  assert.match(main,/completeQuest/);
  assert.match(main,/startStoryDialogue/);
  assert.match(main,/chooseDialogue/);
  assert.match(main,/snapshotGame/);
  assert.match(main,/saveGame/);
  assert.match(main,/loadGame/);
  assert.match(main,/restoreGame/);
  assert.match(html,/storyBuilderPanel/);
  assert.match(html,/questJournal/);
  assert.match(html,/dialogueChoices/);
  assert.match(html,/saveSlot/);
  assert.doesNotThrow(()=>new vm.Script(main));

  for(const capability of[
    'quest-engine','quest-objectives','quest-chains','dialogue-trees','dialogue-choices',
    'story-variables','journal','save-slots','autosave','game-state-restore','story-logic-events','story-persistence'
  ])assert.ok(manifest.capabilities.includes(capability),capability);
});

test('Game Studio v12 native recovery survives total provider failure',async()=>{
  const fail=async()=>{const error=new Error('all providers failed');error.code='all_providers_failed';throw error};
  const result=await buildDigitalProduct({
    request:'Construye un juego 3D con quests, diálogo, decisiones, journal y save/load.',
    kind:'game_3d',
    generate:fail
  });
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(result.model,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.version,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.qa,'passed');
  assert.equal(result.recovery.mode,'native_game_studio');
  assert.equal(result.project.files.some(file=>file.name==='story.json'),true);
  assert.equal(result.project.files.some(file=>file.name==='savegame.json'),true);
  assert.equal(inspectActiveGameStudioProject(result.project.files).pass,true);
});

test('Story Engine v12 persistence validates iframe quest and dialogue contracts',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/event\.source!==frame\.contentWindow/);
  assert.match(workspace,/data\.type==='wae-game-studio-story-save'/);
  assert.match(workspace,/data\.studio==='wae-game-studio\/v12'/);
  assert.match(workspace,/raw\.schema!=='wae-story\/v12'/);
  assert.match(workspace,/raw\.quests\.length>120/);
  assert.match(workspace,/allowedObjective=new Set\(\['collect_item','npc_interact','visit_scene'\]\)/);
  assert.match(workspace,/Cadena de quests inválida/);
  assert.match(workspace,/Diálogo apunta a nodo inexistente/);
  assert.match(workspace,/Story Engine supera el límite de 220 KB/);
  assert.match(workspace,/story\.json/);
  assert.match(workspace,/mainFile\.content\.replace\(\/\^const STORY=/);
  assert.match(workspace,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
  assert.doesNotMatch(workspace,/sandbox','allow-scripts allow-same-origin/);
});

test('Logic Builder v12 accepts narrative events and quest actions',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/raw\.schema!=='wae-logic\/v12'/);
  assert.match(workspace,/quest_started/);
  assert.match(workspace,/quest_progress/);
  assert.match(workspace,/quest_completed/);
  assert.match(workspace,/dialogue_choice/);
  assert.match(workspace,/game_saved/);
  assert.match(workspace,/game_loaded/);
  assert.match(workspace,/start_quest/);
  assert.match(workspace,/complete_quest/);
  assert.match(workspace,/set_story_variable/);
  assert.match(workspace,/save_game/);
});

test('v12 snapshot covers player world combat NPCs and story state',()=>{
  const project=createNativeGameStudioProject({request:'Juego narrativo',profile:'game_3d'});
  const main=project.files.find(file=>file.name==='main.js').content;
  assert.match(main,/sceneId:SCENE\.world\.activeSceneId/);
  assert.match(main,/playerPosition:p\?clone\(p\.position\)/);
  assert.match(main,/combat:clone\(COMBAT\)/);
  assert.match(main,/npcs:clone\(NPCS\)/);
  assert.match(main,/story:clone\(STORY\)/);
  assert.match(main,/visitedScenes:clone\(SCENE\.world\.visitedScenes\)/);
  assert.match(main,/state\.score=Number\(snapshot\.score\)/);
});

test('v12 save runtime has localStorage fallback for sandbox preview',()=>{
  const project=createNativeGameStudioProject({request:'Juego guardable',profile:'game_3d'});
  const main=project.files.find(file=>file.name==='main.js').content;
  assert.match(main,/function safeStorageGet/);
  assert.match(main,/function safeStorageSet/);
  assert.match(main,/storyRuntime\.memorySaves/);
  assert.match(main,/if\(!saved\)storyRuntime\.memorySaves\.set/);
});

test('v12 QA rejects removal of story.json or savegame.json',()=>{
  const project=createNativeGameStudioProject({request:'Juego narrativo',profile:'game_3d'});
  const withoutStory={...project,files:project.files.filter(file=>file.name!=='story.json')};
  let audit=inspectGameStudioProject(withoutStory.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('storyFile'));
  const withoutSave={...project,files:project.files.filter(file=>file.name!=='savegame.json')};
  audit=inspectGameStudioProject(withoutSave.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('saveFile'));
});

test('v12 preserves scene world NPC and combat persistence for active studio version',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/wae-game-studio\/v12/);
  assert.match(workspace,/persistWorldStudioV8\(data\.scene,data\.scene\?\.world\)/);
  assert.match(workspace,/persistNpcStudioV10\(data\.npcs\)/);
  assert.match(workspace,/persistCombatStudioV11\(data\.combat\)/);
});
