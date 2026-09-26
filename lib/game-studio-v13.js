import {
  createNativeGameStudioProject as createV12Project,
  inspectGameStudioProject as inspectV12Project,
  supportsNativeGameStudio,
  WORLD_SCHEMA,
  NPC_SCHEMA,
  COMBAT_SCHEMA,
  STORY_SCHEMA,
  SAVE_SCHEMA,
  LOGIC_SCHEMA
} from './game-studio-v12.js';

export const GAME_STUDIO_VERSION='wae-game-studio/v13';
export const ASSET_SCHEMA='wae-assets/v13';
export const ANIMATION_SCHEMA='wae-animation/v13';
export const CHARACTER_SCHEMA='wae-character/v13';
export {supportsNativeGameStudio,WORLD_SCHEMA,NPC_SCHEMA,COMBAT_SCHEMA,STORY_SCHEMA,SAVE_SCHEMA,LOGIC_SCHEMA};

const clone=value=>JSON.parse(JSON.stringify(value));
const byName=files=>new Map((files||[]).map(file=>[file.name,file]));
const replaceOrAdd=(files,name,content)=>{
 const found=files.some(file=>file.name===name);
 return found?files.map(file=>file.name===name?{...file,content}:file):files.concat([{name,content}]);
};

function assetDefinition(){
 return{
  schema:ASSET_SCHEMA,version:13,
  coordinateSystem:'right-handed-y-up',
  sourcePolicy:'native-first',
  assets:[
   {id:'hero-body',type:'procedural_mesh',kind:'character',generator:'humanoid',material:'hero',scale:[1,1,1]},
   {id:'hero-rig',type:'procedural_rig',kind:'skeleton',generator:'humanoid-basic',joints:['root','hips','spine','head','arm_l','arm_r','leg_l','leg_r']},
   {id:'orion-body',type:'procedural_mesh',kind:'character',generator:'humanoid',material:'npcHero',scale:[.9,.9,.9]},
   {id:'crystal',type:'procedural_mesh',kind:'prop',generator:'gem',material:'itemLoot',scale:[.4,.4,.4]}
  ],
  materials:{
   hero:{base:[.18,.55,1,1],metallic:.15,roughness:.48},
   npcHero:{base:[.68,.35,1,1],metallic:.1,roughness:.52}
  },
  prefabs:[
   {id:'hero-player',asset:'hero-body',rig:'hero-rig',character:'player'},
   {id:'orion-npc',asset:'orion-body',rig:'hero-rig',character:'npc'}
  ]
 };
}

function animationDefinition(){
 return{
  schema:ANIMATION_SCHEMA,version:13,
  clips:[
   {id:'idle',duration:1.8,loop:true,rootMotion:false},
   {id:'walk',duration:.9,loop:true,rootMotion:false},
   {id:'run',duration:.65,loop:true,rootMotion:false},
   {id:'jump',duration:.72,loop:false,rootMotion:false},
   {id:'attack',duration:.55,loop:false,rootMotion:false},
   {id:'hit',duration:.42,loop:false,rootMotion:false},
   {id:'interact',duration:.9,loop:false,rootMotion:false}
  ],
  transitions:[
   {from:'idle',to:'walk',when:'speed>0.05'},
   {from:'walk',to:'run',when:'speed>2.4'},
   {from:'run',to:'walk',when:'speed<=2.4'},
   {from:'walk',to:'idle',when:'speed<=0.05'},
   {from:'run',to:'idle',when:'speed<=0.05'},
   {from:'*',to:'jump',when:'jumpPressed'},
   {from:'*',to:'attack',when:'attackPressed'},
   {from:'*',to:'interact',when:'interactPressed'},
   {from:'*',to:'hit',when:'damageTaken'}
  ]
 };
}

function characterDefinition(){
 return{
  schema:CHARACTER_SCHEMA,version:13,
  controller:{
   type:'third_person',moveSpeed:2.4,runSpeed:4.6,acceleration:18,deceleration:22,
   jumpVelocity:5.6,gravity:-14,turnRate:14,cameraDistance:5.8,cameraHeight:2.4,
   coyoteTimeMs:120,airControl:.45
  },
  bindings:{forward:['KeyW','ArrowUp'],back:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],run:['ShiftLeft','ShiftRight'],jump:['Space'],attack:['KeyF'],interact:['KeyE']},
  locomotion:{idle:'idle',walk:'walk',run:'run',jump:'jump'},
  actors:[
   {id:'player',prefab:'hero-player',animationSet:'hero-default'},
   {id:'npc-orion',prefab:'orion-npc',animationSet:'hero-default'}
  ]
 };
}

function upgradeHtml(html){
 return html
  .replace(/GAME STUDIO V12/g,'GAME STUDIO V13 · CHARACTER & ANIMATION')
  .replace('</section><section class="facts">',characterMarkup()+'</section><section class="facts">');
}

function characterMarkup(){
 return '<section id="characterStudioPanel" class="character-studio"><div class="character-head"><div><p class="eyebrow">GAME STUDIO V13 · CHARACTER & ANIMATION</p><h2>Character & Asset Pipeline</h2><p>Controlador third-person, locomoción, estados de animación, rigs procedurales, prefabs y catálogo de assets nativos.</p></div><div class="character-head-actions"><button id="resetCharacterRig" type="button">Recentrar</button><button id="saveCharacterStudio" type="button" class="save-character">Guardar pipeline</button></div></div><div class="character-grid"><section class="character-preview"><div class="panel-title">Actor <span id="characterActorState">IDLE</span></div><div class="character-meter"><span>Velocidad</span><strong id="characterSpeed">0.00</strong></div><div class="character-meter"><span>Animación</span><strong id="characterAnimation">idle</strong></div><div class="character-meter"><span>Rig</span><strong id="characterRigStatus">READY</strong></div></section><section class="animation-panel"><div class="panel-title">Animation State Machine <span id="animationClipCount">0 clips</span></div><div id="animationStateList" class="animation-state-list"></div></section><section class="asset-panel"><div class="panel-title">Assets nativos <span id="assetCount">0</span></div><div id="assetCatalog" class="asset-catalog"></div></section></div><div id="characterSaveStatus" class="scene-save-status" role="status"></div></section>';
}

function characterCss(){
 return[
  '.character-studio{margin:14px 16px;padding:15px;border:1px solid #315a68;border-radius:20px;background:linear-gradient(180deg,#071820,#050b10);box-shadow:0 20px 70px #0008}.character-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:12px}.character-head h2{margin:.18rem 0}.character-head p{margin:.2rem 0;color:#a9c6d2}.character-head-actions{display:flex;gap:8px;flex-wrap:wrap}.save-character{background:#123c45;border-color:#62d5dc}.character-grid{display:grid;grid-template-columns:.8fr 1.2fr 1fr;gap:10px}.character-preview,.animation-panel,.asset-panel{border:1px solid #294b57;border-radius:14px;background:#071219;padding:11px;min-width:0}.character-meter{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #18333d;color:#9eb8c3;font-size:.72rem}.character-meter strong{color:#ecfbff}.animation-state-list,.asset-catalog{display:grid;gap:6px;max-height:190px;overflow:auto}.animation-state,.asset-entry{display:flex;justify-content:space-between;gap:8px;padding:8px;border:1px solid #23424d;border-radius:9px;background:#0a1820;font-size:.7rem}.animation-state.active{border-color:#6adbe2;box-shadow:0 0 18px #48cbd522}.asset-entry small{color:#82a6b3}.asset-entry strong{font-size:.7rem}.character-save-status{min-height:18px}@media(max-width:980px){.character-grid{grid-template-columns:1fr 1fr}.character-preview{grid-column:span 2}}@media(max-width:760px){.character-studio{margin:10px 8px}.character-head{align-items:stretch;flex-direction:column}.character-grid{grid-template-columns:1fr}.character-preview{grid-column:auto}}'
 ].join('');
}

function runtimeV13(){
 return[
  "const characterRuntime={state:'idle',clip:'idle',speed:0,verticalVelocity:0,grounded:true,jumpPressed:false,attackPressed:false,interactPressed:false,damageTaken:false,last:performance.now(),yaw:0};",
  "function animationClip(id){return ANIMATIONS.clips.find(clip=>clip.id===id)||ANIMATIONS.clips[0]}",
  "function chooseAnimation(){const speed=characterRuntime.speed;if(characterRuntime.damageTaken)return'hit';if(characterRuntime.attackPressed)return'attack';if(characterRuntime.interactPressed)return'interact';if(!characterRuntime.grounded)return'jump';if(speed>2.4)return'run';if(speed>.05)return'walk';return'idle'}",
  "function setCharacterAnimation(next){if(!animationClip(next))next='idle';characterRuntime.clip=next;characterRuntime.state=next;}",
  "function updateCharacterAnimation(now){const dt=Math.min(.05,(now-characterRuntime.last)/1000||0);characterRuntime.last=now;const p=player();if(!p)return;const target=chooseAnimation();if(target!==characterRuntime.clip)setCharacterAnimation(target);const dx=Number(p.velocity?.[0]||0),dz=Number(p.velocity?.[2]||0);characterRuntime.speed=Math.hypot(dx,dz);characterRuntime.damageTaken=false;characterRuntime.attackPressed=false;characterRuntime.interactPressed=false;if(characterRuntime.grounded)characterRuntime.verticalVelocity=0;renderCharacterStudio();}",
  "function characterPayload(){return{schema:CHARACTER_SCHEMA,version:13,controller:clone(CHARACTER.controller),bindings:clone(CHARACTER.bindings),locomotion:clone(CHARACTER.locomotion),actors:clone(CHARACTER.actors)}}",
  "function saveCharacterStudio(){const status=editorEl('characterSaveStatus');try{window.parent.postMessage({type:'wae-game-studio-character-save',studio:'"+GAME_STUDIO_VERSION+"',character:characterPayload(),assets:clone(ASSETS),animations:clone(ANIMATIONS)},'*');if(status)status.textContent='Guardando character.json, assets.json y animation.json…'}catch(error){if(status)status.textContent='No se pudo guardar pipeline: '+String(error.message||error)}}",
  "function renderCharacterStudio(){const speed=editorEl('characterSpeed'),clip=editorEl('characterAnimation'),state=editorEl('characterActorState'),rig=editorEl('characterRigStatus');if(speed)speed.textContent=characterRuntime.speed.toFixed(2);if(clip)clip.textContent=characterRuntime.clip;if(state)state.textContent=characterRuntime.state.toUpperCase();if(rig)rig.textContent=CHARACTER.actors.length+' ACTORS · RIG OK';const list=editorEl('animationStateList');if(list){list.replaceChildren();for(const c of ANIMATIONS.clips){const row=document.createElement('div');row.className='animation-state'+(c.id===characterRuntime.clip?' active':'');row.innerHTML='<strong></strong><small></small>';row.firstChild.textContent=c.id;row.lastChild.textContent=(c.loop?'LOOP':'ONESHOT')+' · '+c.duration+'s';list.appendChild(row)}}const assets=editorEl('assetCatalog');if(assets){assets.replaceChildren();for(const a of ASSETS.assets){const row=document.createElement('div');row.className='asset-entry';row.innerHTML='<strong></strong><small></small>';row.firstChild.textContent=a.id;row.lastChild.textContent=a.type+' · '+a.generator;assets.appendChild(row)}editorEl('assetCount').textContent=ASSETS.assets.length+' assets'}editorEl('animationClipCount').textContent=ANIMATIONS.clips.length+' clips'}",
  "function resetCharacterRig(){const p=player();if(p){p.position=[0,.7,3];if(p.velocity)p.velocity=[0,0,0]}characterRuntime.yaw=0;setCharacterAnimation('idle');renderCharacterStudio()}",
  "function characterTick(now){updateCharacterAnimation(now);requestAnimationFrame(characterTick)}",
  "addEventListener('keydown',event=>{if(event.repeat)return;if(event.code==='Space')characterRuntime.jumpPressed=true;if(event.code==='KeyF')characterRuntime.attackPressed=true;if(event.code==='KeyE')characterRuntime.interactPressed=true});"
 ].join('\n');
}

function wireV13(js){
 js=runtimeV13()+"\n"+js;
 js=js.replace(
  "const COMBAT=",
  "const ASSETS="+JSON.stringify(assetDefinition())+";\nconst ANIMATIONS="+JSON.stringify(animationDefinition())+";\nconst CHARACTER="+JSON.stringify(characterDefinition())+";\nconst COMBAT="
 );
 js=js.replace(/function renderScene(){if(!gl)return;/,"function renderScene(){updateCharacterAnimation(performance.now());if(!gl)return;");
 js=js.replace(
  "requestAnimationFrame(combatTick);",
  "requestAnimationFrame(combatTick);requestAnimationFrame(characterTick);"
 );
 js=js.replace(
  "editorEl('saveCombat')?.addEventListener('click',saveCombatToFactory);",
  "editorEl('saveCombat')?.addEventListener('click',saveCombatToFactory);editorEl('resetCharacterRig')?.addEventListener('click',resetCharacterRig);editorEl('saveCharacterStudio')?.addEventListener('click',saveCharacterStudio);"
 );
 js=js.replace(
  /window\\.WAEGameStudio=\\{version:'wae-game-studio\\/v12'[\\s\\S]*?\\};/,
  "window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,logic:LOGIC,npcs:NPCS,combat:COMBAT,story:STORY,saveConfig:SAVE_CONFIG,assets:ASSETS,animations:ANIMATIONS,character:CHARACTER,state,loadWorldScene,emitLogicEvent,interactNearestNpc,startQuest,completeQuest,startStoryDialogue,saveGame,loadGame,snapshotGame,saveCharacterStudio};"
 );
 return js;
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
 const project=createV12Project({request,profile});
 let files=project.files.map(file=>({...file}));
 const map=byName(files);
 const asset=assetDefinition(),animation=animationDefinition(),character=characterDefinition();
 const html=upgradeHtml(map.get('index.html').content);
 const css=map.get('styles.css').content+characterCss();
 let js=map.get('main.js').content;
 js=wireV13(js);
 const manifest=JSON.parse(map.get('wae-product.json').content);
 manifest.studio=GAME_STUDIO_VERSION;
 manifest.assets=ASSET_SCHEMA;
 manifest.animations=ANIMATION_SCHEMA;
 manifest.character=CHARACTER_SCHEMA;
 manifest.capabilities=Array.from(new Set([...(manifest.capabilities||[]),
  'native-asset-pipeline','procedural-assets','character-controller','third-person-controller','animation-state-machine','procedural-rig','animation-clips','animation-transitions','character-prefabs'
 ]));
 const readme=map.get('README.md').content
  .replace(/Game Studio v12/g,'Game Studio v13')
  .replace(/wae-game-studio/v12/g,GAME_STUDIO_VERSION)
  +'

## Character, Animation & Asset Pipeline v13
assets.json define assets/prefabs/materiales nativos; animation.json define clips y transiciones; character.json define controlador third-person, bindings, locomoción, rigs y actores. El runtime usa generación procedural y no requiere CDN, API de assets ni proveedor externo.
';
 const studioDoc='# WAE Game Studio v13 · Character, Animation & Asset Pipeline

Pipeline: personaje → rig → clips → state machine → controlador third-person → prefabs → catálogo de assets → runtime → QA.

La ruta nativa genera personajes y props procedurales y mantiene los contratos assets.json, animation.json y character.json portables. No presupone proveedores externos ni descarga assets durante la construcción.
';
 files=replaceOrAdd(files,'index.html',html);
 files=replaceOrAdd(files,'styles.css',css);
 files=replaceOrAdd(files,'main.js',js);
 files=replaceOrAdd(files,'assets.json',JSON.stringify(asset,null,2));
 files=replaceOrAdd(files,'animation.json',JSON.stringify(animation,null,2));
 files=replaceOrAdd(files,'character.json',JSON.stringify(character,null,2));
 files=replaceOrAdd(files,'wae-product.json',JSON.stringify(manifest,null,2));
 files=replaceOrAdd(files,'README.md',readme);
 files=replaceOrAdd(files,'GAME-STUDIO.md',studioDoc);
 return{plan:'Game Studio v13 añade Character, Animation & Asset Pipeline con generación procedural, controlador third-person, state machine, rigs, clips, prefabs y catálogo nativo.',files};
}

export function inspectGameStudioProject(files){
 const base=inspectV12Project(files);
 const map=byName(files),js=map.get('main.js')?.content||'',html=map.get('index.html')?.content||'';
 let assets=null,animations=null,character=null;
 try{assets=JSON.parse(map.get('assets.json')?.content||'')}catch{}
 try{animations=JSON.parse(map.get('animation.json')?.content||'')}catch{}
 try{character=JSON.parse(map.get('character.json')?.content||'')}catch{}
 const checks={
  ...base.checks,
  assetFile:Boolean(assets?.schema===ASSET_SCHEMA&&Array.isArray(assets.assets)&&assets.assets.length>=4),
  animationFile:Boolean(animations?.schema===ANIMATION_SCHEMA&&Array.isArray(animations.clips)&&animations.clips.length>=6&&Array.isArray(animations.transitions)),
  characterFile:Boolean(character?.schema===CHARACTER_SCHEMA&&character?.controller?.type==='third_person'&&Array.isArray(character.actors)&&character.actors.length>=2),
  proceduralAssets:Boolean(assets?.sourcePolicy==='native-first'&&assets?.assets?.some(a=>a.generator==='humanoid')),
  animationStateMachine:Boolean(animations?.transitions?.some(t=>t.to==='run')&&animations?.transitions?.some(t=>t.to==='attack')),
  controllerBindings:Boolean(character?.bindings?.forward?.includes('KeyW')&&character?.bindings?.jump?.includes('Space')),
  characterBuilder:/characterStudioPanel|animationStateList|assetCatalog/i.test(js+html),
  characterRuntime:/updateCharacterAnimation|characterTick|setCharacterAnimation/i.test(js),
  nativeRuntime:/const ASSETS=|const ANIMATIONS=|const CHARACTER=/i.test(js),
  characterPersistence:/wae-game-studio-character-save|saveCharacterStudio/i.test(js),
  publicStudioVersion:new RegExp("version:'"+GAME_STUDIO_VERSION.replace('/','\\/')+"'").test(js),
  assetManifest:/native-asset-pipeline|character-controller|animation-state-machine/i.test(JSON.stringify(JSON.parse(map.get('wae-product.json')?.content||'{}')))
 };
 const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
 return{pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
