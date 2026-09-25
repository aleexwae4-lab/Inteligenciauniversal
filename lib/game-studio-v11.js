import {
  createNativeGameStudioProject as createV10Project,
  supportsNativeGameStudio,
  WORLD_SCHEMA,
  NPC_SCHEMA
} from './game-studio-v10.js';

export const GAME_STUDIO_VERSION='wae-game-studio/v11';
export const COMBAT_SCHEMA='wae-combat/v11';
export const LOGIC_SCHEMA='wae-logic/v11';
export {supportsNativeGameStudio,WORLD_SCHEMA,NPC_SCHEMA};

const byName=files=>new Map((files||[]).map(file=>[file.name,file]));
const replaceOrAdd=(files,name,content)=>{
  const found=files.some(file=>file.name===name);
  return found?files.map(file=>file.name===name?{...file,content}:file):files.concat([{name,content}]);
};
const clone=value=>JSON.parse(JSON.stringify(value));

function combatDefinition(){
  return{
    schema:COMBAT_SCHEMA,
    version:11,
    player:{
      health:100,maxHealth:100,stamina:100,maxStamina:100,
      attackDamage:24,attackRange:2.4,staminaCost:18,regenPerSecond:16,
      inventoryCapacity:12,
      checkpoint:{sceneId:'world-alpha',position:[0,.7,3]},
      inventory:[{itemId:'medkit',quantity:1},{itemId:'energy-cell',quantity:1}]
    },
    items:{
      medkit:{label:'Botiquín',type:'consumable',stackMax:5,material:'itemHealth',effect:{heal:35}},
      'energy-cell':{label:'Celda de energía',type:'consumable',stackMax:8,material:'itemEnergy',effect:{stamina:30}},
      crystal:{label:'Cristal',type:'loot',stackMax:20,material:'itemLoot',effect:{}}
    },
    pickups:[
      {id:'pickup-medkit-alpha',sceneId:'world-alpha',itemId:'medkit',quantity:1,position:[-3,.45,-4],collected:false},
      {id:'pickup-energy-alpha',sceneId:'world-alpha',itemId:'energy-cell',quantity:1,position:[3,.45,-3],collected:false},
      {id:'pickup-crystal-beta',sceneId:'world-beta',itemId:'crystal',quantity:2,position:[1,.45,-5],collected:false}
    ],
    lootTables:{
      'raider-basic':[{itemId:'crystal',min:1,max:2}]
    },
    npcCombat:{
      'npc-sentinel':{damage:12,attackRange:1.35,cooldownMs:900,lootTable:'raider-basic'}
    },
    rules:{respawnDelayMs:450,pickupRadius:1.15}
  };
}

function upgradeLogic(raw){
  const logic=JSON.parse(raw);
  logic.schema=LOGIC_SCHEMA;
  logic.version=11;
  logic.rules.push({
    id:'logic-sentinel-defeated',
    name:'Loot al derrotar Sentinel',
    enabled:true,
    once:true,
    event:{type:'npc_defeated',npcId:'npc-sentinel'},
    conditions:[{type:'always'}],
    actions:[{type:'give_item',itemId:'crystal',quantity:1},{type:'message',text:'Sentinel derrotado. Loot recuperado.'}]
  });
  logic.rules.push({
    id:'logic-player-respawn',
    name:'Confirmar respawn',
    enabled:true,
    once:false,
    event:{type:'player_respawn'},
    conditions:[{type:'always'}],
    actions:[{type:'message',text:'Checkpoint restaurado.'}]
  });
  return logic;
}

function upgradeScene(raw){
  const scene=JSON.parse(raw);
  scene.engine=GAME_STUDIO_VERSION;
  scene.editor={...(scene.editor||{}),combatBuilder:true,inventoryEditor:true,checkpointEditor:true,version:11};
  scene.materials.itemHealth=[.2,1,.55,1];
  scene.materials.itemEnergy=[.25,.65,1,1];
  scene.materials.itemLoot=[1,.78,.22,1];
  scene.materials.checkpoint=[.76,.42,1,1];
  return scene;
}

function combatMarkup(){
  return '<section id="combatBuilderPanel" class="combat-builder">'
    +'<div class="combat-head"><div><p class="eyebrow">GAME STUDIO V11 · COMBAT & INVENTORY</p><h2>Gameplay de supervivencia</h2><p>Vida, stamina, daño, inventario, pickups, loot, checkpoints y respawn conectados al Logic Builder.</p></div><div class="combat-head-actions"><button id="attackCombat" type="button">F · Acción</button><button id="useCombatItem" type="button">Q · Usar</button><button id="saveCombat" type="button" class="save-combat">Guardar sistema</button></div></div>'
    +'<div class="combat-grid"><section class="combat-status"><div class="panel-title">Jugador <span id="combatState">LISTO</span></div><label>Vida <progress id="healthBar" max="100" value="100"></progress><output id="healthValue">100 / 100</output></label><label>Stamina <progress id="staminaBar" max="100" value="100"></progress><output id="staminaValue">100 / 100</output></label><div class="combat-actions"><button id="setCheckpoint" type="button">Guardar checkpoint</button><button id="respawnCombat" type="button">Respawn</button></div></section>'
    +'<section class="combat-inventory"><div class="panel-title">Inventario <span id="inventoryCount">0 / 12</span></div><div id="inventoryList" class="inventory-list"></div><div id="combatPickupInfo" class="combat-note">Acércate a pickups para recogerlos automáticamente.</div></section>'
    +'<section class="combat-runtime"><div class="panel-title">Runtime <span id="combatEventCount">0 eventos</span></div><div id="combatEventLog" class="combat-event-log"></div><button id="clearCombatLog" type="button">Limpiar registro</button></section></div>'
    +'<div id="combatSaveStatus" class="scene-save-status" role="status"></div></section>';
}

function combatCss(){
  return[
    '.combat-builder{margin:14px 16px;padding:15px;border:1px solid #5b4537;border-radius:20px;background:linear-gradient(180deg,#1b110a,#0c0805);box-shadow:0 20px 70px #0007}.combat-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:12px}.combat-head h2{margin:.18rem 0}.combat-head p{margin:.2rem 0;color:#c9b39e}.combat-head-actions{display:flex;gap:8px;flex-wrap:wrap}.save-combat{background:#4b2e18;border-color:#e7a25d}.combat-grid{display:grid;grid-template-columns:.9fr 1.1fr .9fr;gap:10px}.combat-status,.combat-inventory,.combat-runtime{border:1px solid #51402f;border-radius:14px;background:#120c08;padding:11px;min-width:0}.combat-status label{display:grid;grid-template-columns:72px 1fr auto;gap:8px;align-items:center;font-size:.72rem;color:#cdb9a6;margin:9px 0}.combat-status progress{width:100%;height:12px}.combat-status output{font-size:.7rem;color:#f1d6bd}.combat-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.inventory-list{display:grid;gap:5px;max-height:260px;overflow:auto}.inventory-list button{display:flex;justify-content:space-between;gap:8px;width:100%;padding:8px 10px;background:#1b120c}.inventory-list button[aria-pressed="true"]{border-color:#e0a160;background:#322014}.combat-note{font-size:.72rem;color:#a99481;margin-top:9px}.combat-event-log{display:grid;gap:5px;max-height:240px;overflow:auto;margin-bottom:8px}.combat-event-log article{padding:7px 8px;border:1px solid #473729;border-radius:9px;background:#181009;font-size:.72rem}.combat-event-log strong{display:block;color:#eba964}.combat-event-log small{color:#ae9987}',
    '@media(max-width:980px){.combat-grid{grid-template-columns:1fr 1fr}.combat-runtime{grid-column:span 2}}@media(max-width:760px){.combat-builder{margin:10px 8px}.combat-head{align-items:stretch;flex-direction:column}.combat-grid{grid-template-columns:1fr}.combat-runtime{grid-column:auto}.combat-status label{grid-template-columns:62px 1fr}}'
  ].join('');
}

function runtimeV11(){
  return[
    "const combatRuntime={selectedItem:'medkit',events:[],last:performance.now(),lastUi:0,npcCooldowns:new Map(),respawning:false};",
    "function combatPlayer(){return COMBAT.player}",
    "function inventoryCount(){return combatPlayer().inventory.reduce((sum,item)=>sum+Math.max(0,Number(item.quantity)||0),0)}",
    "function addCombatEvent(type,detail){combatRuntime.events.push({type,detail:String(detail||'').slice(0,180),at:Date.now()});combatRuntime.events=combatRuntime.events.slice(-80);renderCombatLog()}",
    "function inventoryEntry(itemId){return combatPlayer().inventory.find(item=>item.itemId===itemId)}",
    "function addInventoryItem(itemId,quantity=1){const def=COMBAT.items[itemId],qty=Math.max(1,Math.floor(Number(quantity)||1));if(!def)return false;const room=Math.max(0,combatPlayer().inventoryCapacity-inventoryCount()),accepted=Math.min(room,qty);if(accepted<=0){addCombatEvent('inventory','Inventario lleno.');return false}let entry=inventoryEntry(itemId);if(!entry){entry={itemId,quantity:0};combatPlayer().inventory.push(entry)}entry.quantity=Math.min(Number(def.stackMax)||99,entry.quantity+accepted);emitLogicEvent('inventory_changed',{itemId,quantity:entry.quantity});renderCombatBuilder();return accepted===qty}",
    "function consumeInventory(itemId){const entry=inventoryEntry(itemId);if(!entry||entry.quantity<=0)return false;entry.quantity--;if(entry.quantity<=0)combatPlayer().inventory=combatPlayer().inventory.filter(item=>item!==entry);emitLogicEvent('inventory_changed',{itemId,quantity:Math.max(0,entry.quantity)});return true}",
    "function useCombatItem(){const id=combatRuntime.selectedItem,def=COMBAT.items[id];if(!def||!inventoryEntry(id)){addCombatEvent('item','No tienes '+String(def?.label||id)+'.');return}if(def.effect?.heal){if(combatPlayer().health>=combatPlayer().maxHealth){addCombatEvent('item','La vida ya está al máximo.');return}if(consumeInventory(id)){combatPlayer().health=Math.min(combatPlayer().maxHealth,combatPlayer().health+Number(def.effect.heal));addCombatEvent('item','Usaste '+def.label);emitLogicEvent('item_used',{itemId:id})}}else if(def.effect?.stamina){if(consumeInventory(id)){combatPlayer().stamina=Math.min(combatPlayer().maxStamina,combatPlayer().stamina+Number(def.effect.stamina));addCombatEvent('item','Usaste '+def.label);emitLogicEvent('item_used',{itemId:id})}}renderCombatBuilder()}",
    "function damagePlayer(amount,source='runtime'){if(combatRuntime.respawning)return;const value=Math.max(0,Number(amount)||0);combatPlayer().health=Math.max(0,combatPlayer().health-value);addCombatEvent('damage','Jugador -'+value+' · '+source);emitLogicEvent('player_damaged',{amount:value,source,health:combatPlayer().health});if(combatPlayer().health<=0)respawnPlayer();renderCombatBuilder()}",
    "function damageNpc(npc,amount){if(!npc||npc.defeated)return false;npc.stats=npc.stats||{health:100,maxHealth:100};const value=Math.max(0,Number(amount)||0);npc.stats.health=Math.max(0,npc.stats.health-value);emitLogicEvent('npc_damaged',{npcId:npc.id,amount:value,health:npc.stats.health});addCombatEvent('attack',npc.name+' -'+value);if(npc.stats.health<=0)defeatNpc(npc);renderNpcBuilder();return true}",
    "function spawnLootForNpc(npc){const profile=COMBAT.npcCombat[npc.id],table=COMBAT.lootTables[profile?.lootTable]||[];for(const row of table){const qty=Math.max(1,Math.floor(Number(row.min)||1));COMBAT.pickups.push({id:'loot-'+npc.id+'-'+Date.now()+'-'+row.itemId,sceneId:npc.sceneId,itemId:row.itemId,quantity:qty,position:[npc.position[0],.42,npc.position[2]],collected:false})}}",
    "function defeatNpc(npc){if(!npc||npc.defeated)return;npc.defeated=true;npc.state='idle';spawnLootForNpc(npc);emitLogicEvent('npc_defeated',{npcId:npc.id,faction:npc.faction});addCombatEvent('npc_defeated',npc.name+' derrotado');renderCombatBuilder()}",
    "function nearestCombatNpc(){const p=player();if(!p)return null;let best=null,distance=Infinity;for(const npc of activeNpcs()){if(npc.defeated)continue;const faction=NPCS.factions[npc.faction];if(faction?.attitude!=='hostile')continue;const d=npcDistance(p.position,npc.position);if(d<distance){distance=d;best=npc}}return best?{npc:best,distance}:null}",
    "function playerCombatAction(){const near=nearestCombatNpc();if(!near){addCombatEvent('attack','No hay objetivo hostil cercano.');return}if(near.distance>combatPlayer().attackRange){addCombatEvent('attack','Objetivo fuera de alcance.');return}if(combatPlayer().stamina<combatPlayer().staminaCost){addCombatEvent('attack','Stamina insuficiente.');return}combatPlayer().stamina-=combatPlayer().staminaCost;damageNpc(near.npc,combatPlayer().attackDamage);tone(180,.05);renderCombatBuilder()}",
    "function collectCombatPickups(){const p=player();if(!p)return;const radius=Number(COMBAT.rules.pickupRadius)||1.1;for(const pickup of COMBAT.pickups){if(pickup.collected||pickup.sceneId!==SCENE.world.activeSceneId)continue;if(npcDistance(p.position,pickup.position)>radius)continue;if(addInventoryItem(pickup.itemId,pickup.quantity)){pickup.collected=true;const label=COMBAT.items[pickup.itemId]?.label||pickup.itemId;addCombatEvent('pickup',label+' ×'+pickup.quantity);emitLogicEvent('item_collected',{itemId:pickup.itemId,quantity:pickup.quantity,pickupId:pickup.id});tone(760,.04)}}}",
    "function drawCombatPickups(vp){for(const pickup of COMBAT.pickups){if(pickup.collected||pickup.sceneId!==SCENE.world.activeSceneId)continue;const def=COMBAT.items[pickup.itemId];drawCube({position:pickup.position,scale:[.22,.22,.22],material:def?.material||'itemLoot'},vp)}}",
    "function setCombatCheckpoint(){const p=player();if(!p)return;combatPlayer().checkpoint={sceneId:SCENE.world.activeSceneId,position:clone(p.position)};addCombatEvent('checkpoint','Checkpoint guardado en '+SCENE.world.activeSceneId);emitLogicEvent('checkpoint_set',{sceneId:SCENE.world.activeSceneId})}",
    "function respawnPlayer(){if(combatRuntime.respawning)return;combatRuntime.respawning=true;addCombatEvent('respawn','Restaurando checkpoint…');setTimeout(()=>{const cp=combatPlayer().checkpoint||{sceneId:SCENE.world.activeSceneId,position:[0,.7,3]};loadWorldScene(cp.sceneId);const p=player();if(p)p.position=clone(cp.position);combatPlayer().health=combatPlayer().maxHealth;combatPlayer().stamina=combatPlayer().maxStamina;combatRuntime.respawning=false;emitLogicEvent('player_respawn',{sceneId:cp.sceneId});addCombatEvent('respawn','Jugador restaurado.');renderCombatBuilder()},Math.max(100,Number(COMBAT.rules.respawnDelayMs)||450))}",
    "function npcCombatAttackTick(now){const p=player();if(!p||combatRuntime.respawning)return;for(const npc of activeNpcs()){if(npc.defeated||npc.state!=='chase')continue;const profile=COMBAT.npcCombat[npc.id];if(!profile)continue;if(npcDistance(npc.position,p.position)>Number(profile.attackRange||1.2))continue;const last=combatRuntime.npcCooldowns.get(npc.id)||0;if(now-last<Number(profile.cooldownMs||900))continue;combatRuntime.npcCooldowns.set(npc.id,now);damagePlayer(profile.damage,'npc:'+npc.id)}}",
    "function renderCombatInventory(){const host=editorEl('inventoryList');if(!host)return;host.replaceChildren();for(const entry of combatPlayer().inventory){const def=COMBAT.items[entry.itemId]||{label:entry.itemId};const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(combatRuntime.selectedItem===entry.itemId));const l=document.createElement('span');l.textContent=def.label;const q=document.createElement('strong');q.textContent='×'+entry.quantity;b.append(l,q);b.addEventListener('click',()=>{combatRuntime.selectedItem=entry.itemId;renderCombatInventory()});host.appendChild(b)}editorEl('inventoryCount').textContent=inventoryCount()+' / '+combatPlayer().inventoryCapacity}",
    "function renderCombatLog(){const host=editorEl('combatEventLog');if(!host)return;host.replaceChildren();for(const event of combatRuntime.events.slice(-30).reverse()){const a=document.createElement('article'),s=document.createElement('strong'),m=document.createElement('small');s.textContent=event.type;m.textContent=event.detail;a.append(s,m);host.appendChild(a)}editorEl('combatEventCount').textContent=combatRuntime.events.length+' eventos'}",
    "function renderCombatBuilder(){const p=combatPlayer();if(editorEl('healthBar')){editorEl('healthBar').max=p.maxHealth;editorEl('healthBar').value=p.health;editorEl('healthValue').textContent=Math.round(p.health)+' / '+p.maxHealth;editorEl('staminaBar').max=p.maxStamina;editorEl('staminaBar').value=p.stamina;editorEl('staminaValue').textContent=Math.round(p.stamina)+' / '+p.maxStamina;editorEl('combatState').textContent=combatRuntime.respawning?'RESPAWN':'ACTIVO'}renderCombatInventory();renderCombatLog()}",
    "function combatTick(now){const dt=Math.min(.05,(now-combatRuntime.last)/1000||0);combatRuntime.last=now;if(state.running&&!state.editor&&!combatRuntime.respawning){combatPlayer().stamina=Math.min(combatPlayer().maxStamina,combatPlayer().stamina+combatPlayer().regenPerSecond*dt);collectCombatPickups();npcCombatAttackTick(now)}if(now-combatRuntime.lastUi>180){combatRuntime.lastUi=now;renderCombatBuilder()}requestAnimationFrame(combatTick)}",
    "function combatPayload(){return clone(COMBAT)}",
    "function saveCombatToFactory(){const status=editorEl('combatSaveStatus');try{window.parent.postMessage({type:'wae-game-studio-combat-save',studio:'"+GAME_STUDIO_VERSION+"',combat:combatPayload()},'*');if(status)status.textContent='Guardando combat.json en la Fábrica…'}catch(error){if(status)status.textContent='No se pudo guardar combate: '+String(error.message||error)}}",
    "addEventListener('message',event=>{const data=event.data;if(!data||data.type!=='wae-game-studio-combat-saved')return;const status=editorEl('combatSaveStatus');if(status)status.textContent=data.ok?'Combat Engine guardado en combat.json y main.js.':'Error al guardar combate: '+String(data.message||'persistencia rechazada')})",
    "addEventListener('keydown',event=>{if(event.repeat)return;if(event.code==='KeyF')playerCombatAction();if(event.code==='KeyQ')useCombatItem();if(event.code==='KeyC')setCombatCheckpoint()})"
  ].join('\n');
}

function wireV11(js){
  js=js.replace(
    "function activeNpcs(){return NPCS.characters.filter(npc=>npc.sceneId===SCENE.world.activeSceneId)}",
    "function activeNpcs(){return NPCS.characters.filter(npc=>npc.sceneId===SCENE.world.activeSceneId&&!npc.defeated)}"
  );
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];",
    runtimeV11()+"\nfunction renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];"
  );
  js=js.replace(
    "for(const e of entities)drawCube(e,vp);drawNpcCharacters(vp);drawEditorGizmo(vp);for(const p of state.particles)drawCube(p,vp)",
    "for(const e of entities)drawCube(e,vp);drawCombatPickups(vp);drawNpcCharacters(vp);drawEditorGizmo(vp);for(const p of state.particles)drawCube(p,vp)"
  );
  const hook="editorEl('saveNpcs')?.addEventListener('click',saveNpcsToFactory);";
  const listeners=[
    "editorEl('attackCombat')?.addEventListener('click',playerCombatAction);",
    "editorEl('useCombatItem')?.addEventListener('click',useCombatItem);",
    "editorEl('setCheckpoint')?.addEventListener('click',setCombatCheckpoint);",
    "editorEl('respawnCombat')?.addEventListener('click',respawnPlayer);",
    "editorEl('saveCombat')?.addEventListener('click',saveCombatToFactory);",
    "editorEl('clearCombatLog')?.addEventListener('click',()=>{combatRuntime.events=[];renderCombatLog()});"
  ].join('');
  js=js.replace(hook,hook+listeners);
  js=js.replace(
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();renderLogicBuilder();renderNpcBuilder();scheduleLogicTimers();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick);requestAnimationFrame(npcTick);queueMicrotask(()=>emitLogicEvent('scene_enter',{sceneId:SCENE.world.activeSceneId}))}}catch(error)",
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();renderLogicBuilder();renderNpcBuilder();renderCombatBuilder();scheduleLogicTimers();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick);requestAnimationFrame(npcTick);requestAnimationFrame(combatTick);queueMicrotask(()=>emitLogicEvent('scene_enter',{sceneId:SCENE.world.activeSceneId}))}}catch(error)"
  );
  const patches=[
    "const logicEventMatchesV10=logicEventMatches;",
    "logicEventMatches=function(rule,event){if(['player_damaged','npc_defeated','item_collected','inventory_changed','player_respawn','checkpoint_set','item_used'].includes(rule.event.type)){if(rule.event.type!==event.type)return false;if(rule.event.npcId&&rule.event.npcId!==event.npcId)return false;if(rule.event.itemId&&rule.event.itemId!==event.itemId)return false;return true}return logicEventMatchesV10(rule,event)};",
    "const actionFromEditorV10=actionFromEditor;",
    "actionFromEditor=function(type,value){if(type==='heal_player')return{type,value:Math.max(0,Number(value)||25)};if(type==='give_item'){const parts=String(value||'').split(':');return{type,itemId:(parts[0]||'medkit').slice(0,60),quantity:Math.max(1,Number(parts[1])||1)}}if(type==='set_checkpoint')return{type};return actionFromEditorV10(type,value)};",
    "const executeLogicActionV10=executeLogicAction;",
    "executeLogicAction=function(action,event){if(action?.type==='heal_player'){combatPlayer().health=Math.min(combatPlayer().maxHealth,combatPlayer().health+Math.max(0,Number(action.value)||0));renderCombatBuilder();return}if(action?.type==='give_item'){addInventoryItem(action.itemId,action.quantity);return}if(action?.type==='set_checkpoint'){setCombatCheckpoint();return}return executeLogicActionV10(action,event)};"
  ].join('');
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();",
    patches+"function renderScene(){if(!gl)return;resize();"
  );
  js=js.replace(
    /window\.WAEGameStudio=\{version:'wae-game-studio\/v10'[^\n]*\};/,
    "window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,logic:LOGIC,npcs:NPCS,combat:COMBAT,state,addEntity,resetLevel,loadWorldScene,emitLogicEvent,interactNearestNpc,setNpcState,playerCombatAction,damagePlayer,damageNpc,useCombatItem,setCombatCheckpoint,respawnPlayer,saveCombatToFactory,combatPayload};"
  );
  return js;
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
  const project=createV10Project({request,profile});
  let files=project.files.map(file=>({...file}));
  const map=byName(files);
  const scene=upgradeScene(map.get('scene.json').content);
  const logic=upgradeLogic(map.get('logic.json').content);
  const combat=combatDefinition();

  let html=map.get('index.html').content
    .replace(/GAME STUDIO V10/g,'GAME STUDIO V11')
    .replace('<option value="npc_goal_completed">Objetivo NPC completado</option></select>','<option value="npc_goal_completed">Objetivo NPC completado</option><option value="player_damaged">Jugador recibe daño</option><option value="npc_defeated">NPC derrotado</option><option value="item_collected">Item recogido</option><option value="inventory_changed">Inventario cambia</option><option value="player_respawn">Respawn jugador</option><option value="checkpoint_set">Checkpoint guardado</option><option value="item_used">Item usado</option></select>')
    .replace('<option value="npc_say">Diálogo NPC</option></select>','<option value="npc_say">Diálogo NPC</option><option value="heal_player">Curar jugador</option><option value="give_item">Dar item</option><option value="set_checkpoint">Guardar checkpoint</option></select>')
    .replace('</section><section class="facts">','</section>'+combatMarkup()+'<section class="facts">');
  let css=map.get('styles.css').content+combatCss();
  let js=map.get('main.js').content
    .replace(/^const SCENE=.*;$/m,'const SCENE='+JSON.stringify(scene)+';')
    .replace(/^const LOGIC=.*;$/m,'const LOGIC='+JSON.stringify(logic)+';')
    .replace(/^const NPCS=.*;$/m,match=>match+'\nconst COMBAT='+JSON.stringify(combat)+';');
  js=wireV11(js).split('wae-game-studio/v10').join(GAME_STUDIO_VERSION);

  const manifest=JSON.parse(map.get('wae-product.json').content);
  manifest.studio=GAME_STUDIO_VERSION;
  manifest.logic=LOGIC_SCHEMA;
  manifest.combat=COMBAT_SCHEMA;
  manifest.capabilities=Array.from(new Set([...(manifest.capabilities||[]),
    'combat-engine','health-system','stamina-system','inventory','consumables','pickups','loot-tables','npc-damage','checkpoints','respawn','combat-logic-events','combat-persistence'
  ]));

  const readme=map.get('README.md').content
    .replace(/wae-game-studio\/v10/g,GAME_STUDIO_VERSION)
    .replace(/Game Studio v10/g,'Game Studio v11')
    +'\n\n## Combat, Health & Inventory v11\ncombat.json define vida, stamina, inventario, consumibles, pickups, loot, daño NPC, checkpoint y respawn. El runtime opera localmente y emite eventos hacia Logic Builder v11.\n';
  const studioDoc='# WAE Game Studio v11 · Combat, Health & Inventory Engine\n\nPipeline: personaje → salud/stamina → interacción de combate → inventario/pickups → loot → checkpoint/respawn → eventos lógicos → persistencia → QA.\n\ncombat.json es portable y se mantiene embebido como COMBAT en main.js. No requiere servicios externos para el loop de gameplay.\n';

  files=replaceOrAdd(files,'index.html',html);
  files=replaceOrAdd(files,'styles.css',css);
  files=replaceOrAdd(files,'main.js',js);
  files=replaceOrAdd(files,'scene.json',JSON.stringify(scene,null,2));
  files=replaceOrAdd(files,'logic.json',JSON.stringify(logic,null,2));
  files=replaceOrAdd(files,'combat.json',JSON.stringify(combat,null,2));
  files=replaceOrAdd(files,'wae-product.json',JSON.stringify(manifest,null,2));
  files=replaceOrAdd(files,'README.md',readme);
  files=replaceOrAdd(files,'GAME-STUDIO.md',studioDoc);

  return{
    plan:'Game Studio v11 añadió Combat, Health & Inventory Engine con vida, stamina, pickups, loot, inventario, checkpoints, respawn y eventos de gameplay.',
    files
  };
}

export function inspectGameStudioProject(files){
  const map=byName(files);
  const js=map.get('main.js')?.content||'';
  const html=map.get('index.html')?.content||'';
  const sceneRaw=map.get('scene.json')?.content||'';
  const worldRaw=map.get('world.json')?.content||'';
  const logicRaw=map.get('logic.json')?.content||'';
  const npcRaw=map.get('npc.json')?.content||'';
  const combatRaw=map.get('combat.json')?.content||'';
  let scene=null,world=null,logic=null,npcs=null,combat=null;
  try{scene=JSON.parse(sceneRaw)}catch{}
  try{world=JSON.parse(worldRaw)}catch{}
  try{logic=JSON.parse(logicRaw)}catch{}
  try{npcs=JSON.parse(npcRaw)}catch{}
  try{combat=JSON.parse(combatRaw)}catch{}
  const player=combat?.player;
  const checks={
    studioScene:Boolean(scene&&scene.engine===GAME_STUDIO_VERSION&&Array.isArray(scene.entities)&&scene.entities.length>=4),
    worldFile:Boolean(world&&world.schema===WORLD_SCHEMA&&Array.isArray(world.scenes)&&world.scenes.length>=2),
    logicFile:Boolean(logic&&logic.schema===LOGIC_SCHEMA&&Array.isArray(logic.rules)&&logic.rules.length>=7),
    npcFile:Boolean(npcs&&npcs.schema===NPC_SCHEMA&&Array.isArray(npcs.characters)&&npcs.characters.length>=3),
    combatFile:Boolean(combat&&combat.schema===COMBAT_SCHEMA&&player&&combat.items&&Array.isArray(combat.pickups)),
    playerStats:Boolean(Number(player?.maxHealth)>0&&Number(player?.maxStamina)>0&&Number(player?.attackDamage)>0&&Number(player?.inventoryCapacity)>0),
    inventory:Boolean(Array.isArray(player?.inventory)&&Object.keys(combat?.items||{}).length>=3),
    pickups:Boolean(Array.isArray(combat?.pickups)&&combat.pickups.length>=3),
    loot:Boolean(combat?.lootTables&&Object.keys(combat.lootTables).length>=1&&combat?.npcCombat),
    checkpoint:Boolean(player?.checkpoint?.sceneId&&Array.isArray(player.checkpoint.position)),
    combatBuilder:/combatBuilderPanel|renderCombatBuilder|inventoryList/i.test(js+html),
    combatRuntime:/damagePlayer|damageNpc|playerCombatAction|combatTick/i.test(js),
    stamina:/staminaCost|regenPerSecond|staminaBar/i.test(js+combatRaw+html),
    pickupRuntime:/collectCombatPickups|drawCombatPickups|item_collected/i.test(js),
    respawn:/respawnPlayer|setCombatCheckpoint|player_respawn/i.test(js),
    logicHooks:/player_damaged|npc_defeated|inventory_changed|give_item|heal_player/i.test(js+logicRaw+html),
    persistence:/wae-game-studio-combat-save/i.test(js)&&/window\.parent\.postMessage/i.test(js)&&/saveCombatToFactory/i.test(js),
    embeddedCombat:/^const COMBAT=/m.test(js),
    input:/KeyF|KeyQ|KeyC/i.test(js)
  };
  const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
  return{pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
