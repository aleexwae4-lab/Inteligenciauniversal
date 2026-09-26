import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createNativeGameStudioProject,inspectGameStudioProject,GAME_STUDIO_VERSION,ASSET_SCHEMA,ANIMATION_SCHEMA,CHARACTER_SCHEMA} from '../lib/game-studio-v13.js';
import {buildDigitalProduct} from '../lib/product-foundry-v5.js';
import {GAME_STUDIO_VERSION as ACTIVE_GAME_STUDIO_VERSION,inspectGameStudioProject as inspectActiveGameStudioProject} from '../lib/game-studio-v14.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Game Studio v13 builds native character animation and asset contracts',()=>{
 const project=createNativeGameStudioProject({request:'Crea un juego 3D premium con personaje third-person, animaciones y assets nativos.',profile:'game_3d'});
 const audit=inspectGameStudioProject(project.files);
 assert.equal(audit.pass,true,audit.failed.join(','));
 const map=new Map(project.files.map(f=>[f.name,f.content]));
 const assets=JSON.parse(map.get('assets.json')),animations=JSON.parse(map.get('animation.json')),character=JSON.parse(map.get('character.json')),manifest=JSON.parse(map.get('wae-product.json'));
 assert.equal(assets.schema,ASSET_SCHEMA);
 assert.equal(animations.schema,ANIMATION_SCHEMA);
 assert.equal(character.schema,CHARACTER_SCHEMA);
 assert.equal(manifest.studio,GAME_STUDIO_VERSION);
 assert.ok(assets.assets.some(a=>a.generator==='humanoid'));
 assert.ok(assets.prefabs.length>=2);
 assert.ok(animations.clips.some(c=>c.id==='idle')&&animations.clips.some(c=>c.id==='run'));
 assert.ok(animations.transitions.some(t=>t.to==='attack'));
 assert.equal(character.controller.type,'third_person');
 assert.ok(character.bindings.forward.includes('KeyW'));
 assert.ok(character.bindings.jump.includes('Space'));
 assert.match(map.get('main.js'),/^const ASSETS=/m);
 assert.match(map.get('main.js'),/^const ANIMATIONS=/m);
 assert.match(map.get('main.js'),/^const CHARACTER=/m);
 assert.match(map.get('main.js'),/updateCharacterAnimation/);
 assert.match(map.get('main.js'),/characterTick/);
 assert.match(map.get('index.html'),/characterStudioPanel/);
 assert.doesNotThrow(()=>new vm.Script(map.get('main.js')));
});

test('native recovery promotes directly to Game Studio v13 when providers fail',async()=>{
 const fail=async()=>{throw Object.assign(new Error('all providers failed'),{code:'all_providers_failed'})};
 const result=await buildDigitalProduct({request:'Juego 3D con personajes, animaciones, rigs y prefabs.',kind:'game_3d',generate:fail});
 assert.equal(result.provider,'wae_native_game_studio');
 assert.equal(result.model,ACTIVE_GAME_STUDIO_VERSION);
 assert.equal(result.studio.version,ACTIVE_GAME_STUDIO_VERSION);
 assert.equal(result.studio.qa,'passed');
 assert.equal(result.recovery.mode,'native_game_studio');
 assert.ok(result.project.files.some(f=>f.name==='assets.json'));
 assert.ok(result.project.files.some(f=>f.name==='animation.json'));
 assert.ok(result.project.files.some(f=>f.name==='character.json'));
});

test('character pipeline is portable and has no external asset dependency',()=>{
 const project=createNativeGameStudioProject({request:'character',profile:'game_3d'});
 const map=new Map(project.files.map(f=>[f.name,f.content]));
 const manifest=JSON.parse(map.get('wae-product.json'));
 assert.ok(manifest.capabilities.includes('native-asset-pipeline'));
 assert.ok(manifest.capabilities.includes('procedural-assets'));
 assert.ok(manifest.capabilities.includes('procedural-rig'));
 assert.ok(manifest.capabilities.includes('third-person-controller'));
 assert.ok(manifest.capabilities.includes('animation-state-machine'));
 assert.doesNotMatch(map.get('main.js'),/https?:\/\//);
 assert.doesNotMatch(map.get('main.js'),/fetch\s*\(/);
});

test('factory persistence validates v13 character contracts and sandbox boundary',()=>{
 const workspace=read('factory-projects-render-v2.js');
 assert.match(workspace,/wae-game-studio-character-save/);
 assert.match(workspace,/data\.studio==='wae-game-studio\/v13'/);
 assert.match(workspace,/wae-character\/v13/);
 assert.match(workspace,/wae-assets\/v13/);
 assert.match(workspace,/wae-animation\/v13/);
 assert.match(workspace,/character\.json/);
 assert.match(workspace,/assets\.json/);
 assert.match(workspace,/animation\.json/);
 assert.match(workspace,/frame\.setAttribute\('sandbox','allow-scripts'\)/);
 assert.doesNotMatch(workspace,/sandbox','allow-scripts allow-same-origin/);
});

test('v13 active studio preserves v12 narrative save contracts',()=>{
 const project=createNativeGameStudioProject({request:'Juego 3D narrativo',profile:'game_3d'});
 const map=new Map(project.files.map(f=>[f.name,f.content]));
 const manifest=JSON.parse(map.get('wae-product.json'));
 assert.ok(manifest.capabilities.includes('quest-engine'));
 assert.ok(manifest.capabilities.includes('save-slots'));
 assert.ok(manifest.capabilities.includes('character-controller'));
 assert.ok(map.has('story.json')&&map.has('savegame.json'));
});

test('v13 inspector rejects missing animation or character contracts',()=>{
 const project=createNativeGameStudioProject({request:'Juego 3D',profile:'game_3d'});
 let files=project.files.filter(f=>f.name!=='animation.json');
 let audit=inspectGameStudioProject(files);
 assert.equal(audit.pass,false);
 assert.ok(audit.failed.includes('animationFile'));
 files=project.files.filter(f=>f.name!=='character.json');
 audit=inspectGameStudioProject(files);
 assert.equal(audit.pass,false);
 assert.ok(audit.failed.includes('characterFile'));
});

test('v13 animation machine contains locomotion and action transitions',()=>{
 const project=createNativeGameStudioProject({request:'Juego 3D',profile:'game_3d'});
 const animations=JSON.parse(project.files.find(f=>f.name==='animation.json').content);
 const transitions=animations.transitions;
 assert.ok(transitions.some(t=>t.from==='idle'&&t.to==='walk'));
 assert.ok(transitions.some(t=>t.from==='walk'&&t.to==='run'));
 assert.ok(transitions.some(t=>t.from==='*'&&t.to==='jump'));
 assert.ok(transitions.some(t=>t.from==='*'&&t.to==='attack'));
 assert.ok(transitions.some(t=>t.from==='*'&&t.to==='interact'));
});

test('v13 character snapshot remains covered by the v12 save system',()=>{
 const project=createNativeGameStudioProject({request:'Juego 3D',profile:'game_3d'});
 const main=project.files.find(f=>f.name==='main.js').content;
 assert.match(main,/function snapshotGame/);
 assert.match(main,/combat:clone\(COMBAT\)/);
 assert.match(main,/npcs:clone\(NPCS\)/);
 assert.match(main,/story:clone\(STORY\)/);
 assert.match(main,/const CHARACTER=/);
});
