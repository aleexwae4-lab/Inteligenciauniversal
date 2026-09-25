import {
  createNativeGameStudioProject as createV11Project,
  supportsNativeGameStudio,
  WORLD_SCHEMA,
  NPC_SCHEMA,
  COMBAT_SCHEMA
} from './game-studio-v11.js';

export const GAME_STUDIO_VERSION='wae-game-studio/v12';
export const STORY_SCHEMA='wae-story/v12';
export const SAVE_SCHEMA='wae-save/v12';
export const LOGIC_SCHEMA='wae-logic/v12';
export {supportsNativeGameStudio,WORLD_SCHEMA,NPC_SCHEMA,COMBAT_SCHEMA};

const byName=files=>new Map((files||[]).map(file=>[file.name,file]));
const replaceOrAdd=(files,name,content)=>{
  const found=files.some(file=>file.name===name);
  return found?files.map(file=>file.name===name?{...file,content}:file):files.concat([{name,content}]);
};
const clone=value=>JSON.parse(JSON.stringify(value));

function storyDefinition(){
  return{
    schema:STORY_SCHEMA,
    version:12,
    variables:{alphaComplete:false,orionTrust:0,betaUnlocked:false},
    quests:[
      {
        id:'quest-alpha',title:'Energía de Alpha',description:'Recupera cristales y habla con Orion.',status:'active',
        prerequisites:[],next:['quest-beta'],
        objectives:[
          {id:'alpha-crystals',type:'collect_item',itemId:'crystal',target:2,progress:0,status:'active'},
          {id:'alpha-orion',type:'npc_interact',npcId:'npc-orion',target:1,progress:0,status:'active'}
        ],
        rewards:[{type:'set_variable',key:'alphaComplete',value:true},{type:'set_variable',key:'betaUnlocked',value:true}]
      },
      {
        id:'quest-beta',title:'Cruce al Sector Beta',description:'Entra al Sector Beta y encuentra a Lyra.',status:'locked',
        prerequisites:['quest-alpha'],next:[],
        objectives:[
          {id:'beta-visit',type:'visit_scene',sceneId:'world-beta',target:1,progress:0,status:'active'},
          {id:'beta-lyra',type:'npc_interact',npcId:'npc-lyra',target:1,progress:0,status:'active'}
        ],
        rewards:[{type:'set_variable',key:'orionTrust',value:1}]
      }
    ],
    dialogues:{
      'npc-orion':{
        start:'orion-root',
        nodes:{
          'orion-root':{
            speaker:'Orion',
            text:'Los portales dependen de la energía del sector. ¿Quieres ayudar?',
            choices:[
              {id:'orion-accept',label:'Acepto la misión',next:'orion-accepted',effects:[{type:'start_quest',questId:'quest-alpha'}]},
              {id:'orion-info',label:'¿Qué debo hacer?',next:'orion-info-node',effects:[]}
            ]
          },
          'orion-info-node':{
            speaker:'Orion',
            text:'Recupera dos cristales y vuelve a hablar conmigo.',
            choices:[{id:'orion-back',label:'Entendido',next:'orion-root',effects:[]}]
          },
          'orion-accepted':{
            speaker:'Orion',
            text:'Bien. El journal registrará tus objetivos.',
            choices:[{id:'orion-close',label:'Continuar',next:null,effects:[{type:'set_variable',key:'orionTrust',value:1}]}]
          }
        }
      },
      'npc-lyra':{
        start:'lyra-root',
        nodes:{
          'lyra-root':{
            speaker:'Lyra',
            text:'Has llegado a Beta. Tus decisiones anteriores ya forman parte de este mundo.',
            choices:[{id:'lyra-close',label:'Cerrar',next:null,effects:[]}]
          }
        }
      }
    }
  };
}

function saveDefinition(){
  return{
    schema:SAVE_SCHEMA,
    version:12,
    slots:3,
    autosave:true,
    storageKey:'wae.game.v12.save',
    snapshotVersion:1
  };
}

function upgradeLogic(raw){
  const logic=JSON.parse(raw);
  logic.schema=LOGIC_SCHEMA;
  logic.version=12;
  logic.rules.push({
    id:'logic-quest-alpha-complete',
    name:'Quest Alpha completada',
    enabled:true,
    once:true,
    event:{type:'quest_completed',questId:'quest-alpha'},
    conditions:[{type:'always'}],
    actions:[{type:'message',text:'Quest Alpha completada.'},{type:'set_story_variable',key:'betaUnlocked',value:true}]
  });
  logic.rules.push({
    id:'logic-dialogue-choice',
    name:'Registrar decisión de diálogo',
    enabled:true,
    once:false,
    event:{type:'dialogue_choice'},
    conditions:[{type:'always'}],
    actions:[{type:'message',text:'Decisión narrativa registrada.'}]
  });
  return logic;
}

function upgradeScene(raw){
  const scene=JSON.parse(raw);
  scene.engine=GAME_STUDIO_VERSION;
  scene.editor={...(scene.editor||{}),questBuilder:true,dialogueTree:true,journal:true,saveSystem:true,version:12};
  return scene;
}

function storyMarkup(){
  return '<section id="storyBuilderPanel" class="story-builder">'
    +'<div class="story-head"><div><p class="eyebrow">GAME STUDIO V12 · QUEST & SAVE</p><h2>Narrativa y progreso persistente</h2><p>Quests, árboles de diálogo, variables de historia, journal y partidas guardadas/restaurables.</p></div><div class="story-head-actions"><button id="saveStory" type="button">Guardar narrativa</button><button id="saveGameSlot" type="button" class="save-story">Guardar partida</button></div></div>'
    +'<div class="story-grid"><section class="story-journal"><div class="panel-title">Journal <span id="questCount">0 quests</span></div><div id="questJournal" class="quest-journal"></div></section>'
    +'<section class="story-dialogue"><div class="panel-title">Diálogo <span id="dialogueNpc">—</span></div><div id="dialogueText" class="dialogue-text">Habla con un NPC para iniciar un diálogo.</div><div id="dialogueChoices" class="dialogue-choices"></div></section>'
    +'<section class="story-save"><div class="panel-title">Partida <span id="saveRuntimeStatus">Sin guardar</span></div><label>Slot<select id="saveSlot"><option value="1">Slot 1</option><option value="2">Slot 2</option><option value="3">Slot 3</option></select></label><div class="save-actions"><button id="loadGameSlot" type="button">Cargar</button><button id="autosaveGame" type="button">Autosave</button></div><div id="saveSlotInfo" class="story-note">Los saves se almacenan localmente cuando el entorno lo permite.</div></section></div>'
    +'<div id="storySaveStatus" class="scene-save-status" role="status"></div></section>';
}

function storyCss(){
  return[
    '.story-builder{margin:14px 16px;padding:15px;border:1px solid #374e62;border-radius:20px;background:linear-gradient(180deg,#0b141d,#060a0f);box-shadow:0 20px 70px #0007}.story-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:12px}.story-head h2{margin:.18rem 0}.story-head p{margin:.2rem 0;color:#a8bdce}.story-head-actions{display:flex;gap:8px;flex-wrap:wrap}.save-story{background:#16394d;border-color:#62bfe9}.story-grid{display:grid;grid-template-columns:1fr 1.2fr .75fr;gap:10px}.story-journal,.story-dialogue,.story-save{border:1px solid #304659;border-radius:14px;background:#081018;padding:11px;min-width:0}.quest-journal{display:grid;gap:7px;max-height:300px;overflow:auto}.quest-journal article{border:1px solid #2d4354;border-radius:10px;padding:9px;background:#0c1720}.quest-journal strong{display:block}.quest-journal small{display:block;color:#8fa8ba;margin-top:4px}.quest-objective{display:flex;justify-content:space-between;gap:8px;font-size:.7rem;color:#abc0cf;margin-top:5px}.dialogue-text{min-height:88px;padding:12px;border:1px solid #30495d;border-radius:11px;background:#0a151e;color:#e9f6ff}.dialogue-choices{display:grid;gap:6px;margin-top:8px}.dialogue-choices button{text-align:left;padding:8px 10px}.story-save label{display:grid;gap:5px;font-size:.72rem;color:#abc0cf}.story-save select{background:#071019;color:#eef8ff;border:1px solid #30485b;border-radius:9px;padding:8px}.save-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.story-note{margin-top:9px;font-size:.7rem;color:#8ca4b5}',
    '@media(max-width:980px){.story-grid{grid-template-columns:1fr 1fr}.story-save{grid-column:span 2}}@media(max-width:760px){.story-builder{margin:10px 8px}.story-head{align-items:stretch;flex-direction:column}.story-grid{grid-template-columns:1fr}.story-save{grid-column:auto}}'
  ].join('');
}

function runtimeV12(){
  return[
    "const storyRuntime={dialogue:null,memorySaves:new Map(),lastAutoSave:0};",
    "function questById(id){return STORY.quests.find(quest=>quest.id===id)||null}",
    "function setStoryVariable(key,value){if(!(key in STORY.variables))return false;STORY.variables[key]=value;emitLogicEvent('story_variable_changed',{key,value});renderStoryBuilder();return true}",
    "function unlockQuest(quest){if(!quest||quest.status!=='locked')return;const ready=(quest.prerequisites||[]).every(id=>questById(id)?.status==='completed');if(ready){quest.status='available';emitLogicEvent('quest_available',{questId:quest.id})}}",
    "function startQuest(id){const quest=questById(id);if(!quest||['active','completed'].includes(quest.status))return false;const ready=(quest.prerequisites||[]).every(q=>questById(q)?.status==='completed');if(!ready&&quest.prerequisites?.length)return false;quest.status='active';emitLogicEvent('quest_started',{questId:id});renderStoryBuilder();return true}",
    "function completeQuest(id){const quest=questById(id);if(!quest||quest.status==='completed')return false;quest.status='completed';for(const objective of quest.objectives||[])objective.status='completed';for(const reward of quest.rewards||[]){if(reward.type==='set_variable')setStoryVariable(reward.key,reward.value)}for(const nextId of quest.next||[])unlockQuest(questById(nextId));emitLogicEvent('quest_completed',{questId:id});renderStoryBuilder();return true}",
    "function updateQuestProgress(type,payload={}){for(const quest of STORY.quests){if(quest.status!=='active')continue;let changed=false;for(const objective of quest.objectives||[]){if(objective.status==='completed'||objective.type!==type)continue;let match=false;if(type==='collect_item')match=!objective.itemId||objective.itemId===payload.itemId;if(type==='npc_interact')match=!objective.npcId||objective.npcId===payload.npcId;if(type==='visit_scene')match=!objective.sceneId||objective.sceneId===payload.sceneId;if(!match)continue;objective.progress=Math.min(objective.target,objective.progress+Math.max(1,Number(payload.quantity)||1));if(objective.progress>=objective.target)objective.status='completed';changed=true}if(changed){emitLogicEvent('quest_progress',{questId:quest.id});if((quest.objectives||[]).every(o=>o.status==='completed'))completeQuest(quest.id)}}renderStoryBuilder()}",
    "function dialogueTreeForNpc(npcId){return STORY.dialogues[npcId]||null}",
    "function startStoryDialogue(npcId){const tree=dialogueTreeForNpc(npcId);if(!tree)return false;storyRuntime.dialogue={npcId,nodeId:tree.start};renderDialogue();emitLogicEvent('dialogue_started',{npcId});return true}",
    "function dialogueNode(){const current=storyRuntime.dialogue;if(!current)return null;return STORY.dialogues[current.npcId]?.nodes?.[current.nodeId]||null}",
    "function applyDialogueEffect(effect){if(!effect)return;if(effect.type==='start_quest')startQuest(effect.questId);if(effect.type==='set_variable')setStoryVariable(effect.key,effect.value);if(effect.type==='give_item')addInventoryItem(effect.itemId,effect.quantity||1);if(effect.type==='complete_quest')completeQuest(effect.questId)}",
    "function chooseDialogue(choice){const current=storyRuntime.dialogue;if(!current||!choice)return;for(const effect of choice.effects||[])applyDialogueEffect(effect);emitLogicEvent('dialogue_choice',{npcId:current.npcId,choiceId:choice.id});if(choice.next){current.nodeId=choice.next}else{storyRuntime.dialogue=null}renderDialogue();renderStoryBuilder()}",
    "function renderDialogue(){const node=dialogueNode(),host=editorEl('dialogueChoices'),textEl=editorEl('dialogueText'),npcEl=editorEl('dialogueNpc');if(!host||!textEl||!npcEl)return;host.replaceChildren();if(!node){npcEl.textContent='—';textEl.textContent='Habla con un NPC para iniciar un diálogo.';return}npcEl.textContent=node.speaker||storyRuntime.dialogue.npcId;textEl.textContent=node.text||'';for(const choice of node.choices||[]){const b=document.createElement('button');b.type='button';b.textContent=choice.label||choice.id;b.addEventListener('click',()=>chooseDialogue(choice));host.appendChild(b)}}",
    "function renderQuestJournal(){const host=editorEl('questJournal');if(!host)return;host.replaceChildren();for(const quest of STORY.quests){const a=document.createElement('article'),s=document.createElement('strong'),meta=document.createElement('small');s.textContent=quest.title;meta.textContent=quest.status+' · '+quest.description;a.append(s,meta);for(const objective of quest.objectives||[]){const row=document.createElement('div');row.className='quest-objective';const l=document.createElement('span'),p=document.createElement('span');l.textContent=objective.id;p.textContent=objective.progress+' / '+objective.target+(objective.status==='completed'?' ✓':'');row.append(l,p);a.appendChild(row)}host.appendChild(a)}editorEl('questCount').textContent=STORY.quests.length+' quests'}",
    "function renderStoryBuilder(){renderQuestJournal();renderDialogue();renderSaveInfo()}",
    "function snapshotGame(){const p=player();return{schema:'"+SAVE_SCHEMA+"',snapshotVersion:SAVE_CONFIG.snapshotVersion,createdAt:new Date().toISOString(),sceneId:SCENE.world.activeSceneId,playerPosition:p?clone(p.position):[0,.7,0],score:state.score,world:{activeSceneId:SCENE.world.activeSceneId,visitedScenes:clone(SCENE.world.visitedScenes)},combat:clone(COMBAT),npcs:clone(NPCS),story:clone(STORY)}}",
    "function safeStorageGet(key){try{return localStorage.getItem(key)}catch{return null}}",
    "function safeStorageSet(key,value){try{localStorage.setItem(key,value);return true}catch{return false}}",
    "function saveSlotKey(slot){return SAVE_CONFIG.storageKey+'.'+String(slot)}",
    "function saveGame(slot=1){const snapshot=snapshotGame(),key=saveSlotKey(slot);const saved=safeStorageSet(key,JSON.stringify(snapshot));if(!saved)storyRuntime.memorySaves.set(String(slot),snapshot);editorEl('saveRuntimeStatus').textContent='Guardado';emitLogicEvent('game_saved',{slot:Number(slot)});renderSaveInfo();return snapshot}",
    "function readGame(slot=1){const key=saveSlotKey(slot),raw=safeStorageGet(key);if(raw){try{return JSON.parse(raw)}catch{}}return clone(storyRuntime.memorySaves.get(String(slot))||null)}",
    "function restoreGame(snapshot){if(!snapshot||snapshot.schema!=='"+SAVE_SCHEMA+"')return false;COMBAT.player=clone(snapshot.combat?.player||COMBAT.player);COMBAT.pickups=clone(snapshot.combat?.pickups||COMBAT.pickups);NPCS.characters=clone(snapshot.npcs?.characters||NPCS.characters);STORY.variables=clone(snapshot.story?.variables||STORY.variables);STORY.quests=clone(snapshot.story?.quests||STORY.quests);SCENE.world.visitedScenes=clone(snapshot.world?.visitedScenes||SCENE.world.visitedScenes);loadWorldScene(snapshot.sceneId||SCENE.world.activeSceneId);const p=player();if(p&&Array.isArray(snapshot.playerPosition))p.position=clone(snapshot.playerPosition);state.score=Number(snapshot.score)||0;combatRuntime.respawning=false;renderCombatBuilder();renderNpcBuilder();renderStoryBuilder();syncUI();emitLogicEvent('game_loaded',{sceneId:SCENE.world.activeSceneId});return true}",
    "function loadGame(slot=1){const snapshot=readGame(slot);if(!snapshot){editorEl('saveRuntimeStatus').textContent='Slot vacío';return false}const ok=restoreGame(snapshot);editorEl('saveRuntimeStatus').textContent=ok?'Cargado':'Save inválido';return ok}",
    "function renderSaveInfo(){const slot=Number(editorEl('saveSlot')?.value||1),snapshot=readGame(slot),info=editorEl('saveSlotInfo');if(info)info.textContent=snapshot?'Slot '+slot+' · '+String(snapshot.createdAt||'guardado'):'Slot '+slot+' vacío'}",
    "function autosaveStory(){if(!SAVE_CONFIG.autosave)return;saveGame(0)}",
    "function storyPayload(){return clone(STORY)}",
    "function saveStoryToFactory(){const status=editorEl('storySaveStatus');try{window.parent.postMessage({type:'wae-game-studio-story-save',studio:'"+GAME_STUDIO_VERSION+"',story:storyPayload()},'*');if(status)status.textContent='Guardando story.json en la Fábrica…'}catch(error){if(status)status.textContent='No se pudo guardar narrativa: '+String(error.message||error)}}",
    "addEventListener('message',event=>{const data=event.data;if(!data||data.type!=='wae-game-studio-story-saved')return;const status=editorEl('storySaveStatus');if(status)status.textContent=data.ok?'Narrativa guardada en story.json y main.js.':'Error al guardar narrativa: '+String(data.message||'persistencia rechazada')})"
  ].join('\n');
}

function wireV12(js){
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];",
    runtimeV12()+"\nfunction renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];"
  );
  const hook="editorEl('saveCombat')?.addEventListener('click',saveCombatToFactory);";
  const listeners=[
    "editorEl('saveStory')?.addEventListener('click',saveStoryToFactory);",
    "editorEl('saveGameSlot')?.addEventListener('click',()=>saveGame(Number(editorEl('saveSlot').value)||1));",
    "editorEl('loadGameSlot')?.addEventListener('click',()=>loadGame(Number(editorEl('saveSlot').value)||1));",
    "editorEl('autosaveGame')?.addEventListener('click',autosaveStory);",
    "editorEl('saveSlot')?.addEventListener('change',renderSaveInfo);"
  ].join('');
  js=js.replace(hook,hook+listeners);
  js=js.replace(
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();renderLogicBuilder();renderNpcBuilder();renderCombatBuilder();scheduleLogicTimers();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick);requestAnimationFrame(npcTick);requestAnimationFrame(combatTick);queueMicrotask(()=>emitLogicEvent('scene_enter',{sceneId:SCENE.world.activeSceneId}))}}catch(error)",
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();renderLogicBuilder();renderNpcBuilder();renderCombatBuilder();renderStoryBuilder();scheduleLogicTimers();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick);requestAnimationFrame(npcTick);requestAnimationFrame(combatTick);queueMicrotask(()=>emitLogicEvent('scene_enter',{sceneId:SCENE.world.activeSceneId}));queueMicrotask(()=>updateQuestProgress('visit_scene',{sceneId:SCENE.world.activeSceneId}))}}catch(error)"
  );
  const patches=[
    "const loadWorldSceneV11=loadWorldScene;",
    "loadWorldScene=function(id){const ok=loadWorldSceneV11(id);if(ok){updateQuestProgress('visit_scene',{sceneId:id});if(SAVE_CONFIG.autosave)saveGame(0)}return ok};",
    "const interactNearestNpcV11=interactNearestNpc;",
    "interactNearestNpc=function(){const near=nearestNpc();const npcId=near?.npc?.id;interactNearestNpcV11();if(npcId){updateQuestProgress('npc_interact',{npcId});startStoryDialogue(npcId);if(SAVE_CONFIG.autosave)saveGame(0)}};",
    "const addInventoryItemV11=addInventoryItem;",
    "addInventoryItem=function(itemId,quantity=1){const before=inventoryEntry(itemId)?.quantity||0;const ok=addInventoryItemV11(itemId,quantity);const after=inventoryEntry(itemId)?.quantity||0;if(after>before)updateQuestProgress('collect_item',{itemId,quantity:after-before});return ok};",
    "const logicEventTargetV11=logicEventTarget;",
    "logicEventTarget=function(rule){if(['quest_started','quest_completed','quest_progress'].includes(rule.event.type))return rule.event.questId||'';return logicEventTargetV11(rule)};",
    "const logicEventMatchesV11=logicEventMatches;",
    "logicEventMatches=function(rule,event){if(['quest_started','quest_completed','quest_progress','dialogue_choice','story_variable_changed','game_saved','game_loaded'].includes(rule.event.type)){if(rule.event.type!==event.type)return false;if(rule.event.questId&&rule.event.questId!==event.questId)return false;return true}return logicEventMatchesV11(rule,event)};",
    "const actionFromEditorV11=actionFromEditor;",
    "actionFromEditor=function(type,value){if(type==='start_quest'||type==='complete_quest')return{type,questId:String(value||'').slice(0,60)};if(type==='set_story_variable'){const parts=String(value||'').split(':');return{type,key:(parts.shift()||'').slice(0,60),value:parts.join(':').slice(0,120)}}if(type==='save_game')return{type,slot:Math.max(0,Math.min(3,Number(value)||0))};return actionFromEditorV11(type,value)};",
    "const executeLogicActionV11=executeLogicAction;",
    "executeLogicAction=function(action,event){if(action?.type==='start_quest'){startQuest(action.questId);return}if(action?.type==='complete_quest'){completeQuest(action.questId);return}if(action?.type==='set_story_variable'){setStoryVariable(action.key,action.value);return}if(action?.type==='save_game'){saveGame(action.slot||0);return}return executeLogicActionV11(action,event)};"
  ].join('');
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();",
    patches+"function renderScene(){if(!gl)return;resize();"
  );
  js=js.replace(
    /window\.WAEGameStudio=\{version:'wae-game-studio\/v11'[^\n]*\};/,
    "window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,logic:LOGIC,npcs:NPCS,combat:COMBAT,story:STORY,saveConfig:SAVE_CONFIG,state,loadWorldScene,emitLogicEvent,interactNearestNpc,startQuest,completeQuest,startStoryDialogue,saveGame,loadGame,snapshotGame,saveStoryToFactory};"
  );
  return js;
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
  const project=createV11Project({request,profile});
  let files=project.files.map(file=>({...file}));
  const map=byName(files);
  const scene=upgradeScene(map.get('scene.json').content);
  const logic=upgradeLogic(map.get('logic.json').content);
  const story=storyDefinition();
  const saveConfig=saveDefinition();

  let html=map.get('index.html').content
    .replace(/GAME STUDIO V11/g,'GAME STUDIO V12')
    .replace('<option value="item_used">Item usado</option></select>','<option value="item_used">Item usado</option><option value="quest_started">Quest iniciada</option><option value="quest_progress">Progreso quest</option><option value="quest_completed">Quest completada</option><option value="dialogue_choice">Decisión diálogo</option><option value="story_variable_changed">Variable narrativa</option><option value="game_saved">Partida guardada</option><option value="game_loaded">Partida cargada</option></select>')
    .replace('<option value="set_checkpoint">Guardar checkpoint</option></select>','<option value="set_checkpoint">Guardar checkpoint</option><option value="start_quest">Iniciar quest</option><option value="complete_quest">Completar quest</option><option value="set_story_variable">Variable narrativa</option><option value="save_game">Guardar partida</option></select>')
    .replace('</section><section class="facts">','</section>'+storyMarkup()+'<section class="facts">');
  let css=map.get('styles.css').content+storyCss();
  let js=map.get('main.js').content
    .replace(/^const SCENE=.*;$/m,'const SCENE='+JSON.stringify(scene)+';')
    .replace(/^const LOGIC=.*;$/m,'const LOGIC='+JSON.stringify(logic)+';')
    .replace(/^const COMBAT=.*;$/m,match=>match+'\nconst STORY='+JSON.stringify(story)+';\nconst SAVE_CONFIG='+JSON.stringify(saveConfig)+';');
  js=wireV12(js).split('wae-game-studio/v11').join(GAME_STUDIO_VERSION);

  const manifest=JSON.parse(map.get('wae-product.json').content);
  manifest.studio=GAME_STUDIO_VERSION;
  manifest.logic=LOGIC_SCHEMA;
  manifest.story=STORY_SCHEMA;
  manifest.save=SAVE_SCHEMA;
  manifest.capabilities=Array.from(new Set([...(manifest.capabilities||[]),
    'quest-engine','quest-objectives','quest-chains','dialogue-trees','dialogue-choices','story-variables','journal','save-slots','autosave','game-state-restore','story-logic-events','story-persistence'
  ]));

  const readme=map.get('README.md').content
    .replace(/wae-game-studio\/v11/g,GAME_STUDIO_VERSION)
    .replace(/Game Studio v11/g,'Game Studio v12')
    +'\n\n## Quest, Dialogue & Save v12\nstory.json define quests, objetivos, árboles de diálogo y variables narrativas. savegame.json define slots/autosave; el runtime serializa mundo, jugador, combate, NPCs y narrativa para restauración local.\n';
  const studioDoc='# WAE Game Studio v12 · Quest, Dialogue & Save System\n\nPipeline: narrativa → quests/objetivos → diálogo/decisiones → variables globales → journal → snapshot → save/load → eventos lógicos → persistencia → QA.\n\nstory.json es portable; savegame.json define el contrato de guardado y el runtime usa almacenamiento local cuando está disponible con fallback en memoria dentro de previews aisladas.\n';

  files=replaceOrAdd(files,'index.html',html);
  files=replaceOrAdd(files,'styles.css',css);
  files=replaceOrAdd(files,'main.js',js);
  files=replaceOrAdd(files,'scene.json',JSON.stringify(scene,null,2));
  files=replaceOrAdd(files,'logic.json',JSON.stringify(logic,null,2));
  files=replaceOrAdd(files,'story.json',JSON.stringify(story,null,2));
  files=replaceOrAdd(files,'savegame.json',JSON.stringify(saveConfig,null,2));
  files=replaceOrAdd(files,'wae-product.json',JSON.stringify(manifest,null,2));
  files=replaceOrAdd(files,'README.md',readme);
  files=replaceOrAdd(files,'GAME-STUDIO.md',studioDoc);

  return{
    plan:'Game Studio v12 añadió quests encadenadas, diálogo con decisiones, variables narrativas, journal y save/load restaurable.',
    files
  };
}

export function inspectGameStudioProject(files){
  const map=byName(files);
  const js=map.get('main.js')?.content||'';
  const html=map.get('index.html')?.content||'';
  const sceneRaw=map.get('scene.json')?.content||'';
  const logicRaw=map.get('logic.json')?.content||'';
  const npcRaw=map.get('npc.json')?.content||'';
  const combatRaw=map.get('combat.json')?.content||'';
  const storyRaw=map.get('story.json')?.content||'';
  const saveRaw=map.get('savegame.json')?.content||'';
  let scene=null,logic=null,npcs=null,combat=null,story=null,saveConfig=null;
  try{scene=JSON.parse(sceneRaw)}catch{}
  try{logic=JSON.parse(logicRaw)}catch{}
  try{npcs=JSON.parse(npcRaw)}catch{}
  try{combat=JSON.parse(combatRaw)}catch{}
  try{story=JSON.parse(storyRaw)}catch{}
  try{saveConfig=JSON.parse(saveRaw)}catch{}
  const checks={
    studioScene:Boolean(scene&&scene.engine===GAME_STUDIO_VERSION),
    logicFile:Boolean(logic&&logic.schema===LOGIC_SCHEMA&&Array.isArray(logic.rules)&&logic.rules.length>=9),
    npcFile:Boolean(npcs&&npcs.schema===NPC_SCHEMA&&Array.isArray(npcs.characters)),
    combatFile:Boolean(combat&&combat.schema===COMBAT_SCHEMA),
    storyFile:Boolean(story&&story.schema===STORY_SCHEMA&&Array.isArray(story.quests)&&story.quests.length>=2),
    saveFile:Boolean(saveConfig&&saveConfig.schema===SAVE_SCHEMA&&saveConfig.slots>=1),
    questChains:Boolean(story?.quests?.some(q=>q.next?.length)&&story.quests.every(q=>Array.isArray(q.objectives)&&q.objectives.length>=1)),
    dialogues:Boolean(story?.dialogues&&Object.keys(story.dialogues).length>=2),
    storyVariables:Boolean(story?.variables&&Object.keys(story.variables).length>=2),
    storyBuilder:/storyBuilderPanel|questJournal|dialogueChoices/i.test(js+html),
    questRuntime:/updateQuestProgress|startQuest|completeQuest|renderQuestJournal/i.test(js),
    dialogueRuntime:/startStoryDialogue|chooseDialogue|dialogueNode/i.test(js),
    saveRuntime:/snapshotGame|saveGame|loadGame|restoreGame|safeStorageSet/i.test(js),
    saveCoverage:/combat:clone\(COMBAT\)|npcs:clone\(NPCS\)|story:clone\(STORY\)/i.test(js),
    logicHooks:/quest_completed|dialogue_choice|story_variable_changed|game_saved|game_loaded/i.test(js+logicRaw+html),
    persistence:/wae-game-studio-story-save/i.test(js)&&/window\.parent\.postMessage/i.test(js)&&/saveStoryToFactory/i.test(js),
    embeddedStory:/^const STORY=/m.test(js)&&/^const SAVE_CONFIG=/m.test(js),
    autosave:/autosaveStory|SAVE_CONFIG\.autosave/i.test(js)
  };
  const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
  return{pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
