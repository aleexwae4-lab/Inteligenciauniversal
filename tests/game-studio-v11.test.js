import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {
  createNativeGameStudioProject,
  inspectGameStudioProject,
  GAME_STUDIO_VERSION,
  COMBAT_SCHEMA,
  LOGIC_SCHEMA
} from '../lib/game-studio-v11.js';
import {inspectFoundryProject,buildDigitalProduct} from '../lib/product-foundry-v5.js';
import {GAME_STUDIO_VERSION as ACTIVE_GAME_STUDIO_VERSION,inspectGameStudioProject as inspectActiveGameStudioProject} from '../lib/game-studio-v11.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Game Studio v11 builds portable health stamina inventory loot checkpoint and respawn systems',()=>{
  const project=createNativeGameStudioProject({
    request:'Crea un juego 3D con vida, stamina, inventario, pickups, loot y checkpoints.',
    profile:'game_3d'
  });
  const foundry=inspectFoundryProject(project.files,{profile:'game_3d'});
  const studio=inspectGameStudioProject(project.files);
  assert.equal(foundry.pass,true,foundry.failed.join(','));
  assert.equal(studio.pass,true,studio.failed.join(','));

  const combat=JSON.parse(project.files.find(file=>file.name==='combat.json').content);
  const logic=JSON.parse(project.files.find(file=>file.name==='logic.json').content);
  const main=project.files.find(file=>file.name==='main.js').content;
  const html=project.files.find(file=>file.name==='index.html').content;
  const manifest=JSON.parse(project.files.find(file=>file.name==='wae-product.json').content);

  assert.equal(combat.schema,COMBAT_SCHEMA);
  assert.equal(logic.schema,LOGIC_SCHEMA);
  assert.equal(manifest.studio,GAME_STUDIO_VERSION);
  assert.equal(manifest.combat,COMBAT_SCHEMA);
  assert.ok(combat.player.maxHealth>0);
  assert.ok(combat.player.maxStamina>0);
  assert.ok(combat.player.inventoryCapacity>=1);
  assert.ok(Object.keys(combat.items).length>=3);
  assert.ok(combat.pickups.length>=3);
  assert.ok(Object.keys(combat.lootTables).length>=1);
  assert.match(main,/^const COMBAT=/m);
  assert.match(main,/damagePlayer/);
  assert.match(main,/damageNpc/);
  assert.match(main,/playerCombatAction/);
  assert.match(main,/collectCombatPickups/);
  assert.match(main,/setCombatCheckpoint/);
  assert.match(main,/respawnPlayer/);
  assert.match(main,/combatTick/);
  assert.match(html,/combatBuilderPanel/);
  assert.match(html,/healthBar/);
  assert.match(html,/inventoryList/);
  assert.doesNotThrow(()=>new vm.Script(main));

  for(const capability of[
    'combat-engine','health-system','stamina-system','inventory','consumables','pickups',
    'loot-tables','npc-damage','checkpoints','respawn','combat-logic-events','combat-persistence'
  ])assert.ok(manifest.capabilities.includes(capability),capability);
});

test('legacy v11 Combat Engine remains compatible while active recovery upgrades to v14',async()=>{
  const fail=async()=>{const error=new Error('all providers failed');error.code='all_providers_failed';throw error};
  const result=await buildDigitalProduct({
    request:'Construye un juego 3D con combate abstracto, vida, stamina, inventario, loot y respawn.',
    kind:'game_3d',
    generate:fail
  });
  assert.equal(result.provider,'wae_native_game_studio');
  assert.equal(result.model,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.version,ACTIVE_GAME_STUDIO_VERSION);
  assert.equal(result.studio.qa,'passed');
  assert.equal(result.recovery.mode,'native_game_studio');
  assert.equal(result.project.files.some(file=>file.name==='combat.json'),true);
  assert.equal(inspectActiveGameStudioProject(result.project.files).pass,true);
});

test('Combat Engine v11 persistence validates source iframe and bounded contracts',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/event\.source!==frame\.contentWindow/);
  assert.match(workspace,/data\.type==='wae-game-studio-combat-save'/);
  assert.match(workspace,/data\.studio==='wae-game-studio\/v11'/);
  assert.match(workspace,/raw\.schema!=='wae-combat\/v11'/);
  assert.match(workspace,/clean\.pickups\.length>300/);
  assert.match(workspace,/p\.inventoryCapacity=Math\.max\(1,Math\.min\(200/);
  assert.match(workspace,/Combat Engine supera el límite de 220 KB/);
  assert.match(workspace,/combat\.json/);
  assert.match(workspace,/mainFile\.content\.replace\(\/\^const COMBAT=/);
  assert.match(workspace,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
  assert.doesNotMatch(workspace,/sandbox','allow-scripts allow-same-origin/);
});

test('Logic Builder v11 accepts combat events and bounded gameplay actions',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/raw\.schema!=='wae-logic\/v11'/);
  assert.match(workspace,/player_damaged/);
  assert.match(workspace,/npc_defeated/);
  assert.match(workspace,/item_collected/);
  assert.match(workspace,/player_respawn/);
  assert.match(workspace,/heal_player/);
  assert.match(workspace,/give_item/);
  assert.match(workspace,/set_checkpoint/);
  const project=createNativeGameStudioProject({request:'Juego combate lógico',profile:'game_3d'});
  const logic=JSON.parse(project.files.find(file=>file.name==='logic.json').content);
  assert.ok(logic.rules.some(rule=>rule.event.type==='npc_defeated'));
  assert.ok(logic.rules.some(rule=>rule.event.type==='player_respawn'));
});

test('v11 QA rejects removal of combat.json',()=>{
  const project=createNativeGameStudioProject({request:'Juego combate',profile:'game_3d'});
  project.files=project.files.filter(file=>file.name!=='combat.json');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('combatFile'));
});

test('v11 QA rejects removal of combat persistence channel',()=>{
  const project=createNativeGameStudioProject({request:'Juego combate',profile:'game_3d'});
  const main=project.files.find(file=>file.name==='main.js');
  main.content=main.content.replace(/window\.parent\.postMessage/g,'void');
  const audit=inspectGameStudioProject(project.files);
  assert.equal(audit.pass,false);
  assert.ok(audit.failed.includes('persistence'));
});

test('v11 default combat references valid scenes items NPCs and loot tables',()=>{
  const project=createNativeGameStudioProject({request:'Juego combate',profile:'game_3d'});
  const combat=JSON.parse(project.files.find(file=>file.name==='combat.json').content);
  const world=JSON.parse(project.files.find(file=>file.name==='world.json').content);
  const npcs=JSON.parse(project.files.find(file=>file.name==='npc.json').content);
  const scenes=new Set(world.scenes.map(scene=>scene.id));
  const npcIds=new Set(npcs.characters.map(npc=>npc.id));
  const itemIds=new Set(Object.keys(combat.items));
  assert.ok(scenes.has(combat.player.checkpoint.sceneId));
  for(const entry of combat.player.inventory)assert.ok(itemIds.has(entry.itemId),entry.itemId);
  for(const pickup of combat.pickups){
    assert.ok(scenes.has(pickup.sceneId),pickup.sceneId);
    assert.ok(itemIds.has(pickup.itemId),pickup.itemId);
  }
  for(const [npcId,profile] of Object.entries(combat.npcCombat)){
    assert.ok(npcIds.has(npcId),npcId);
    if(profile.lootTable)assert.ok(combat.lootTables[profile.lootTable],profile.lootTable);
  }
});

test('v11 preserves NPC persistence while project studio version advances',()=>{
  const workspace=read('factory-projects-render-v2.js');
  assert.match(workspace,/data\.type==='wae-game-studio-npc-save'&&data\.studio==='wae-game-studio\/v11'/);
  assert.match(workspace,/persistNpcStudioV10\(data\.npcs\)/);
});
