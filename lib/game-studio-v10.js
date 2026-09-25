import {
  createNativeGameStudioProject as createV9Project,
  supportsNativeGameStudio,
  WORLD_SCHEMA,
  LOGIC_SCHEMA as LEGACY_LOGIC_SCHEMA
} from './game-studio-v9.js';

export const GAME_STUDIO_VERSION='wae-game-studio/v10';
export const NPC_SCHEMA='wae-npc/v10';
export const LOGIC_SCHEMA='wae-logic/v10';
export {supportsNativeGameStudio,WORLD_SCHEMA};

const byName=files=>new Map((files||[]).map(file=>[file.name,file]));
const replaceOrAdd=(files,name,content)=>{
  const found=files.some(file=>file.name===name);
  return found?files.map(file=>file.name===name?{...file,content}:file):files.concat([{name,content}]);
};
const clone=value=>JSON.parse(JSON.stringify(value));

function npcDefinition(){
  return{
    schema:NPC_SCHEMA,
    version:10,
    factions:{
      allies:{label:'Aliados',attitude:'friendly',material:'npcFriendly'},
      neutral:{label:'Neutral',attitude:'neutral',material:'npcNeutral'},
      raiders:{label:'Raiders',attitude:'hostile',material:'npcHostile'}
    },
    characters:[
      {
        id:'npc-orion',name:'Orion',sceneId:'world-alpha',faction:'allies',state:'patrol',
        behavior:{defaultState:'patrol',moveSpeed:1.25,chaseSpeed:2.15,perceptionRadius:5.5,interactionRadius:2.25},
        stats:{health:100,maxHealth:100},
        position:[-2,.75,-2],rotation:0,patrolIndex:0,
        patrol:[[-2,.75,-2],[2,.75,-2],[2,.75,1],[-2,.75,1]],
        dialogue:[
          {id:'orion-hello',text:'La energía del sector mantiene abiertos los portales.'},
          {id:'orion-goal',text:'Explora ambos sectores y vuelve cuando estés listo.'}
        ],
        goals:[{id:'orion-guard',type:'patrol',label:'Vigilar Órbita Alpha',status:'active'}],
        brain:{type:'state_machine',states:['idle','patrol','chase','interact'],transitions:['perception','distance','interaction','goal']}
      },
      {
        id:'npc-sentinel',name:'Sentinel',sceneId:'world-alpha',faction:'raiders',state:'patrol',
        behavior:{defaultState:'patrol',moveSpeed:1.0,chaseSpeed:1.9,perceptionRadius:4.8,interactionRadius:1.7},
        stats:{health:120,maxHealth:120},
        position:[4,.75,-5],rotation:0,patrolIndex:0,
        patrol:[[4,.75,-5],[6,.75,-5],[6,.75,-2],[4,.75,-2]],
        dialogue:[{id:'sentinel-warning',text:'Zona restringida.'}],
        goals:[{id:'sentinel-patrol',type:'patrol',label:'Custodiar el portal Alpha',status:'active'}],
        brain:{type:'state_machine',states:['idle','patrol','chase','interact'],transitions:['perception','distance','interaction','goal']}
      },
      {
        id:'npc-lyra',name:'Lyra',sceneId:'world-beta',faction:'neutral',state:'idle',
        behavior:{defaultState:'idle',moveSpeed:.9,chaseSpeed:1.6,perceptionRadius:4.2,interactionRadius:2.4},
        stats:{health:90,maxHealth:90},
        position:[-1,.75,-4],rotation:0,patrolIndex:0,
        patrol:[[-1,.75,-4],[1,.75,-4]],
        dialogue:[{id:'lyra-hello',text:'Sector Beta responde a las decisiones tomadas en Alpha.'}],
        goals:[{id:'lyra-talk',type:'interact',label:'Hablar con el explorador',status:'active'}],
        brain:{type:'state_machine',states:['idle','patrol','chase','interact'],transitions:['perception','distance','interaction','goal']}
      }
    ]
  };
}

function upgradeLogic(raw){
  const logic=JSON.parse(raw);
  logic.schema=LOGIC_SCHEMA;
  logic.version=10;
  logic.rules.push({
    id:'logic-npc-orion-interact',
    name:'Interacción con Orion',
    enabled:true,
    once:false,
    event:{type:'npc_interact',npcId:'npc-orion'},
    conditions:[{type:'always'}],
    actions:[{type:'message',text:'Orion registró la interacción.'}]
  });
  logic.rules.push({
    id:'logic-sentinel-chase',
    name:'Alerta del Sentinel',
    enabled:true,
    once:false,
    event:{type:'npc_state_changed',npcId:'npc-sentinel',state:'chase'},
    conditions:[{type:'scene_is',sceneId:'world-alpha'}],
    actions:[{type:'message',text:'Sentinel te ha detectado.'}]
  });
  return logic;
}

function upgradeScene(raw){
  const scene=JSON.parse(raw);
  scene.engine=GAME_STUDIO_VERSION;
  scene.editor={...(scene.editor||{}),npcBuilder:true,characterInspector:true,dialogueEditor:true,factions:true,behaviorStateMachine:true,version:10};
  scene.materials.npcFriendly=[.18,.88,.66,1];
  scene.materials.npcNeutral=[.72,.78,.88,1];
  scene.materials.npcHostile=[.95,.28,.32,1];
  return scene;
}

function npcMarkup(){
  return '<section id="npcBuilderPanel" class="npc-builder">'
    +'<div class="npc-head"><div><p class="eyebrow">GAME STUDIO V10 · NPC ENGINE</p><h2>Personajes y comportamiento</h2><p>Facciones, percepción, estados, patrullaje, objetivos e interacción conectados al Logic Builder.</p></div><div class="npc-head-actions"><button id="interactNpc" type="button">E · Interactuar</button><button id="saveNpcs" type="button" class="save-npc">Guardar NPCs</button></div></div>'
    +'<div class="npc-grid"><aside class="npc-list-card"><div class="panel-title">Personajes <strong id="npcCount">0</strong></div><div id="npcList" class="npc-list" role="listbox" aria-label="Personajes"></div><div class="npc-actions"><button id="addNpc" type="button">＋ NPC</button><button id="duplicateNpc" type="button">Duplicar</button><button id="deleteNpc" type="button">Eliminar</button></div></aside>'
    +'<section class="npc-inspector"><div class="panel-title">Inspector <span id="npcSelected">Sin selección</span></div>'
    +'<div class="npc-two"><label>Nombre<input id="npcName" maxlength="80"></label><label>Escena<select id="npcScene"></select></label></div>'
    +'<div class="npc-two"><label>Facción<select id="npcFaction"></select></label><label>Estado<select id="npcState"><option value="idle">Idle</option><option value="patrol">Patrol</option><option value="chase">Chase</option><option value="interact">Interact</option></select></label></div>'
    +'<div class="npc-three"><label>Percepción<input id="npcPerception" type="number" min=".5" max="30" step=".25"></label><label>Velocidad<input id="npcSpeed" type="number" min=".1" max="10" step=".1"></label><label>Interacción<input id="npcInteraction" type="number" min=".5" max="10" step=".1"></label></div>'
    +'<div class="npc-three"><label>X<input id="npcX" type="number" step=".25"></label><label>Y<input id="npcY" type="number" step=".25"></label><label>Z<input id="npcZ" type="number" step=".25"></label></div>'
    +'<label>Diálogo principal<textarea id="npcDialogue" rows="3" maxlength="240"></textarea></label><label>Objetivo<input id="npcGoal" maxlength="100"></label>'
    +'<button id="applyNpc" type="button">Aplicar personaje</button></section>'
    +'<section class="npc-runtime"><div class="panel-title">Runtime <span id="npcRuntimeState">—</span></div><div id="npcDialogueBox" class="npc-dialogue">Acércate a un personaje y pulsa E.</div><div id="npcEventLog" class="npc-event-log"></div><button id="clearNpcLog" type="button">Limpiar registro</button></section></div>'
    +'<div id="npcSaveStatus" class="scene-save-status" role="status"></div></section>';
}

function npcCss(){
  return[
    '.npc-builder{margin:14px 16px;padding:15px;border:1px solid #51446a;border-radius:20px;background:linear-gradient(180deg,#130d1c,#08060d);box-shadow:0 20px 70px #0007}.npc-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:12px}.npc-head h2{margin:.18rem 0}.npc-head p{margin:.2rem 0;color:#b4a7c7}.npc-head-actions{display:flex;gap:8px;flex-wrap:wrap}.save-npc{background:#33234b;border-color:#a678e8}.npc-grid{display:grid;grid-template-columns:.85fr 1.3fr .85fr;gap:10px}.npc-list-card,.npc-inspector,.npc-runtime{border:1px solid #413653;border-radius:14px;background:#0d0913;padding:11px;min-width:0}.npc-list{display:grid;gap:5px;max-height:320px;overflow:auto}.npc-list button{display:grid;gap:3px;text-align:left;width:100%;padding:8px 10px;background:#17101f}.npc-list button[aria-selected="true"]{border-color:#b48aed;background:#2a1b3a}.npc-list small{color:#9a87ad}.npc-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.npc-actions button{padding:7px 9px}.npc-two,.npc-three{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px}.npc-three{grid-template-columns:repeat(3,minmax(0,1fr))}.npc-inspector label{display:grid;gap:5px;font-size:.72rem;color:#b3a5c5;margin-bottom:8px}.npc-inspector input,.npc-inspector select,.npc-inspector textarea{width:100%;min-width:0;background:#09060e;color:#fff;border:1px solid #493a5e;border-radius:9px;padding:8px;resize:vertical}.npc-dialogue{min-height:76px;border:1px solid #4a3a60;border-radius:11px;background:#130d1c;padding:10px;color:#dccbf1}.npc-event-log{display:grid;gap:5px;max-height:220px;overflow:auto;margin:9px 0}.npc-event-log article{padding:7px 8px;border:1px solid #3e3150;border-radius:9px;background:#120c19;font-size:.72rem}.npc-event-log strong{display:block;color:#bd91ef}.npc-event-log small{color:#9d8caf}',
    '@media(max-width:1000px){.npc-grid{grid-template-columns:1fr 1fr}.npc-runtime{grid-column:span 2}}@media(max-width:760px){.npc-builder{margin:10px 8px}.npc-head{align-items:stretch;flex-direction:column}.npc-grid{grid-template-columns:1fr}.npc-runtime{grid-column:auto}.npc-two,.npc-three{grid-template-columns:1fr}}'
  ].join('');
}

function runtimeV10(){
  return[
    "const npcRuntime={selectedId:NPCS.characters[0]?.id||'',events:[],last:performance.now(),interactionUntil:new Map()};",
    "function activeNpcs(){return NPCS.characters.filter(npc=>npc.sceneId===SCENE.world.activeSceneId)}",
    "function selectedNpc(){return NPCS.characters.find(npc=>npc.id===npcRuntime.selectedId)||null}",
    "function npcUniqueId(base='npc'){let n=1,id=base+'-'+n;const ids=new Set(NPCS.characters.map(npc=>npc.id));while(ids.has(id)){n++;id=base+'-'+n}return id}",
    "function npcDistance(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])}",
    "function addNpcEvent(type,detail){npcRuntime.events.push({type,detail:String(detail||'').slice(0,180),at:Date.now()});npcRuntime.events=npcRuntime.events.slice(-60);renderNpcEventLog()}",
    "function setNpcState(npc,next,reason='runtime'){if(!npc||!['idle','patrol','chase','interact'].includes(next)||npc.state===next)return false;const previous=npc.state;npc.state=next;addNpcEvent('state',npc.name+': '+previous+' → '+next);emitLogicEvent('npc_state_changed',{npcId:npc.id,previous,state:next,reason});return true}",
    "function moveNpcToward(npc,target,speed,dt){const dx=target[0]-npc.position[0],dz=target[2]-npc.position[2],d=Math.hypot(dx,dz);if(d<.05)return true;const step=Math.min(d,Math.max(0,speed)*dt);npc.position[0]+=dx/d*step;npc.position[2]+=dz/d*step;npc.rotation=Math.atan2(dx,dz);return d<=.12}",
    "function updateNpcBehavior(npc,dt,now){const p=player();if(!p)return;const behavior=npc.behavior||{},dist=npcDistance(npc.position,p.position),faction=NPCS.factions[npc.faction]||NPCS.factions.neutral;if(npc.state==='interact'){if(now>(npcRuntime.interactionUntil.get(npc.id)||0))setNpcState(npc,behavior.defaultState||'idle','interaction_end');return}if(faction.attitude==='hostile'&&dist<=Number(behavior.perceptionRadius||4)){setNpcState(npc,'chase','perception')}else if(npc.state==='chase'&&dist>Number(behavior.perceptionRadius||4)*1.5){setNpcState(npc,behavior.defaultState||'patrol','lost_target')}if(npc.state==='chase'){moveNpcToward(npc,p.position,Number(behavior.chaseSpeed||2),dt);return}if(npc.state==='patrol'&&Array.isArray(npc.patrol)&&npc.patrol.length){const target=npc.patrol[npc.patrolIndex%npc.patrol.length];if(moveNpcToward(npc,target,Number(behavior.moveSpeed||1),dt))npc.patrolIndex=(npc.patrolIndex+1)%npc.patrol.length}}",
    "function npcTick(now){const dt=Math.min(.04,(now-npcRuntime.last)/1000||0);npcRuntime.last=now;if(state.running&&!state.editor)for(const npc of activeNpcs())updateNpcBehavior(npc,dt,now);requestAnimationFrame(npcTick)}",
    "function drawNpcCharacters(vp){for(const npc of activeNpcs()){const faction=NPCS.factions[npc.faction]||NPCS.factions.neutral;drawCube({position:npc.position,scale:[.42,.72,.42],rotation:npc.rotation||0,material:faction.material||'npcNeutral'},vp)}}",
    "function nearestNpc(){const p=player();if(!p)return null;let best=null,bestDistance=Infinity;for(const npc of activeNpcs()){const d=npcDistance(npc.position,p.position);if(d<bestDistance){best=npc;bestDistance=d}}return best?{npc:best,distance:bestDistance}:null}",
    "function interactNearestNpc(){const near=nearestNpc();if(!near){addNpcEvent('interact','No hay personajes en esta escena.');return}const radius=Number(near.npc.behavior?.interactionRadius||2);if(near.distance>radius){addNpcEvent('interact','Acércate más a '+near.npc.name+'.');return}npcRuntime.selectedId=near.npc.id;setNpcState(near.npc,'interact','player_interaction');npcRuntime.interactionUntil.set(near.npc.id,performance.now()+2200);const line=near.npc.dialogue?.[0]?.text||near.npc.name+' no tiene diálogo.';const box=editorEl('npcDialogueBox');if(box)box.textContent=near.npc.name+': '+line;const goal=near.npc.goals?.find(g=>g.type==='interact'&&g.status!=='completed');if(goal){goal.status='completed';emitLogicEvent('npc_goal_completed',{npcId:near.npc.id,goalId:goal.id})}emitLogicEvent('npc_interact',{npcId:near.npc.id,faction:near.npc.faction});addNpcEvent('interact',near.npc.name+': '+line);renderNpcBuilder()}",
    "function renderNpcList(){const host=editorEl('npcList');if(!host)return;host.replaceChildren();for(const npc of NPCS.characters){const b=document.createElement('button');b.type='button';b.setAttribute('aria-selected',String(npc.id===npcRuntime.selectedId));const s=document.createElement('strong');s.textContent=npc.name;const m=document.createElement('small');m.textContent=npc.sceneId+' · '+npc.faction+' · '+npc.state;b.append(s,m);b.addEventListener('click',()=>{npcRuntime.selectedId=npc.id;renderNpcBuilder()});host.appendChild(b)}editorEl('npcCount').textContent=String(NPCS.characters.length)}",
    "function fillNpcSelects(npc){const scene=editorEl('npcScene'),faction=editorEl('npcFaction');scene.replaceChildren();for(const item of SCENE.world.scenes){const o=document.createElement('option');o.value=item.id;o.textContent=item.name;scene.appendChild(o)}faction.replaceChildren();for(const [id,item] of Object.entries(NPCS.factions)){const o=document.createElement('option');o.value=id;o.textContent=item.label;faction.appendChild(o)}if(npc){scene.value=npc.sceneId;faction.value=npc.faction}}",
    "function renderNpcInspector(){const npc=selectedNpc(),ids=['npcName','npcScene','npcFaction','npcState','npcPerception','npcSpeed','npcInteraction','npcX','npcY','npcZ','npcDialogue','npcGoal','applyNpc','duplicateNpc','deleteNpc'];for(const id of ids){const el=editorEl(id);if(el)el.disabled=!npc}editorEl('npcSelected').textContent=npc?(npc.name||npc.id):'Sin selección';fillNpcSelects(npc);if(!npc)return;editorEl('npcName').value=npc.name;editorEl('npcState').value=npc.state;editorEl('npcPerception').value=npc.behavior.perceptionRadius;editorEl('npcSpeed').value=npc.behavior.moveSpeed;editorEl('npcInteraction').value=npc.behavior.interactionRadius;editorEl('npcX').value=npc.position[0];editorEl('npcY').value=npc.position[1];editorEl('npcZ').value=npc.position[2];editorEl('npcDialogue').value=npc.dialogue?.[0]?.text||'';editorEl('npcGoal').value=npc.goals?.[0]?.label||'';editorEl('npcRuntimeState').textContent=npc.state}",
    "function renderNpcEventLog(){const host=editorEl('npcEventLog');if(!host)return;host.replaceChildren();for(const item of npcRuntime.events.slice(-30).reverse()){const a=document.createElement('article'),s=document.createElement('strong'),m=document.createElement('small');s.textContent=item.type;m.textContent=item.detail;a.append(s,m);host.appendChild(a)}}",
    "function renderNpcBuilder(){renderNpcList();renderNpcInspector();renderNpcEventLog()}",
    "function applyNpcEditor(){const npc=selectedNpc();if(!npc)return;npc.name=editorEl('npcName').value.trim().slice(0,80)||npc.id;npc.sceneId=editorEl('npcScene').value;npc.faction=editorEl('npcFaction').value;npc.state=editorEl('npcState').value;npc.behavior.perceptionRadius=Math.max(.5,Math.min(30,Number(editorEl('npcPerception').value)||4));npc.behavior.moveSpeed=Math.max(.1,Math.min(10,Number(editorEl('npcSpeed').value)||1));npc.behavior.interactionRadius=Math.max(.5,Math.min(10,Number(editorEl('npcInteraction').value)||2));npc.position=[Number(editorEl('npcX').value)||0,Number(editorEl('npcY').value)||.75,Number(editorEl('npcZ').value)||0];if(!npc.dialogue?.length)npc.dialogue=[{id:npc.id+'-dialogue',text:''}];npc.dialogue[0].text=editorEl('npcDialogue').value.trim().slice(0,240);if(!npc.goals?.length)npc.goals=[{id:npc.id+'-goal',type:'interact',label:'Interactuar',status:'active'}];npc.goals[0].label=editorEl('npcGoal').value.trim().slice(0,100)||'Objetivo del personaje';renderNpcBuilder();addNpcEvent('editor','Actualizado '+npc.name)}",
    "function createNpc(){const id=npcUniqueId('npc'),scene=SCENE.world.activeSceneId;NPCS.characters.push({id,name:'Nuevo NPC',sceneId:scene,faction:'neutral',state:'idle',behavior:{defaultState:'idle',moveSpeed:1,chaseSpeed:1.7,perceptionRadius:4,interactionRadius:2},stats:{health:100,maxHealth:100},position:[0,.75,0],rotation:0,patrolIndex:0,patrol:[[0,.75,0],[2,.75,0]],dialogue:[{id:id+'-hello',text:'Hola.'}],goals:[{id:id+'-goal',type:'interact',label:'Interactuar con el jugador',status:'active'}],brain:{type:'state_machine',states:['idle','patrol','chase','interact'],transitions:['perception','distance','interaction','goal']}});npcRuntime.selectedId=id;renderNpcBuilder()}",
    "function duplicateNpc(){const npc=selectedNpc();if(!npc)return;const copy=clone(npc);copy.id=npcUniqueId(npc.id+'-copy');copy.name=npc.name+' copia';copy.position=[npc.position[0]+1,npc.position[1],npc.position[2]+1];copy.dialogue=(copy.dialogue||[]).map((d,i)=>({...d,id:copy.id+'-dialogue-'+(i+1)}));copy.goals=(copy.goals||[]).map((g,i)=>({...g,id:copy.id+'-goal-'+(i+1)}));NPCS.characters.push(copy);npcRuntime.selectedId=copy.id;renderNpcBuilder()}",
    "function deleteNpc(){if(NPCS.characters.length<=1){addNpcEvent('editor','Debe existir al menos un NPC.');return}NPCS.characters=NPCS.characters.filter(npc=>npc.id!==npcRuntime.selectedId);npcRuntime.selectedId=NPCS.characters[0]?.id||'';renderNpcBuilder()}",
    "function npcPayload(){return clone(NPCS)}",
    "function saveNpcsToFactory(){const status=editorEl('npcSaveStatus');try{window.parent.postMessage({type:'wae-game-studio-npc-save',studio:'"+GAME_STUDIO_VERSION+"',npcs:npcPayload()},'*');if(status)status.textContent='Guardando npc.json en la Fábrica…'}catch(error){if(status)status.textContent='No se pudieron guardar NPCs: '+String(error.message||error)}}",
    "addEventListener('message',event=>{const data=event.data;if(!data||data.type!=='wae-game-studio-npc-saved')return;const status=editorEl('npcSaveStatus');if(status)status.textContent=data.ok?'NPCs guardados en npc.json y main.js.':'Error al guardar NPCs: '+String(data.message||'persistencia rechazada')})",
    "addEventListener('keydown',event=>{if(event.code==='KeyE'&&!event.repeat)interactNearestNpc()})"
  ].join('\n');
}

function wireV10(js){
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];",
    runtimeV10()+"\nfunction renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];"
  );
  js=js.replace(
    "for(const e of entities)drawCube(e,vp);drawEditorGizmo(vp);for(const p of state.particles)drawCube(p,vp)",
    "for(const e of entities)drawCube(e,vp);drawNpcCharacters(vp);drawEditorGizmo(vp);for(const p of state.particles)drawCube(p,vp)"
  );
  const logicTarget="function logicEventTarget(rule){if(rule.event.type==='scene_enter')return rule.event.sceneId||'';if(rule.event.type==='trigger_enter')return rule.event.triggerId||'';if(rule.event.type==='mission_completed')return rule.event.missionId||'';if(rule.event.type==='timer')return String(rule.event.seconds||1);return''}";
  const logicTargetV10=logicTarget+"\nconst logicEventTargetV9=logicEventTarget;logicEventTarget=function(rule){if(['npc_interact','npc_state_changed','npc_goal_completed'].includes(rule.event.type))return rule.event.npcId||'';return logicEventTargetV9(rule)}";
  js=js.replace(logicTarget,logicTargetV10);
  const hook="editorEl('saveLogic')?.addEventListener('click',saveLogicToFactory);";
  const listeners=[
    "editorEl('addNpc')?.addEventListener('click',createNpc);",
    "editorEl('duplicateNpc')?.addEventListener('click',duplicateNpc);",
    "editorEl('deleteNpc')?.addEventListener('click',deleteNpc);",
    "editorEl('applyNpc')?.addEventListener('click',applyNpcEditor);",
    "editorEl('interactNpc')?.addEventListener('click',interactNearestNpc);",
    "editorEl('saveNpcs')?.addEventListener('click',saveNpcsToFactory);",
    "editorEl('clearNpcLog')?.addEventListener('click',()=>{npcRuntime.events=[];renderNpcEventLog()});"
  ].join('');
  js=js.replace(hook,hook+listeners);
  js=js.replace(
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();renderLogicBuilder();scheduleLogicTimers();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick);queueMicrotask(()=>emitLogicEvent('scene_enter',{sceneId:SCENE.world.activeSceneId}))}}catch(error)",
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();renderLogicBuilder();renderNpcBuilder();scheduleLogicTimers();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick);requestAnimationFrame(npcTick);queueMicrotask(()=>emitLogicEvent('scene_enter',{sceneId:SCENE.world.activeSceneId}))}}catch(error)"
  );
  const runtimePatch=[
    "const logicEventMatchesV9=logicEventMatches;",
    "logicEventMatches=function(rule,event){if(['npc_interact','npc_state_changed','npc_goal_completed'].includes(rule.event.type)){if(rule.event.type!==event.type)return false;if(rule.event.npcId&&rule.event.npcId!==event.npcId)return false;if(rule.event.type==='npc_state_changed'&&rule.event.state&&rule.event.state!==event.state)return false;return true}return logicEventMatchesV9(rule,event)};",
    "const actionFromEditorV9=actionFromEditor;",
    "actionFromEditor=function(type,value){if(type==='npc_set_state'){const parts=String(value||'').split(':');return{type,npcId:(parts[0]||'').slice(0,60),state:(parts[1]||'idle').slice(0,20)}}if(type==='npc_say'){const parts=String(value||'').split(':');return{type,npcId:(parts.shift()||'').slice(0,60),text:parts.join(':').slice(0,160)}}return actionFromEditorV9(type,value)};",
    "const executeLogicActionV9=executeLogicAction;",
    "executeLogicAction=function(action,event){if(action?.type==='npc_set_state'){const npc=NPCS.characters.find(item=>item.id===action.npcId);if(npc)setNpcState(npc,action.state,'logic');return}if(action?.type==='npc_say'){const npc=NPCS.characters.find(item=>item.id===action.npcId);if(npc){const box=editorEl('npcDialogueBox');if(box)box.textContent=npc.name+': '+String(action.text||'');addNpcEvent('logic-dialogue',npc.name+': '+String(action.text||''))}return}return executeLogicActionV9(action,event)};",
    "const applyLogicRuleV9=applyLogicRule;",
    "applyLogicRule=function(){applyLogicRuleV9();const rule=logicRule();if(!rule)return;const type=rule.event.type,target=editorEl('logicEventTarget').value.trim();if(['npc_interact','npc_state_changed','npc_goal_completed'].includes(type)){rule.event.npcId=target.slice(0,60);if(type==='npc_state_changed')rule.event.state='chase'}renderLogicBuilder()};"
  ].join('');
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();",
    runtimePatch+"function renderScene(){if(!gl)return;resize();"
  );
  js=js.replace(
    /window\.WAEGameStudio=\{version:'wae-game-studio\/v9'[^\n]*\};/,
    "window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,logic:LOGIC,npcs:NPCS,state,addEntity,resetLevel,selectEntity,duplicateSelected,deleteSelected,nudgeSelected,saveSceneToFactory,scenePayload,loadWorldScene,spawnWorldPrefab,saveWorldToFactory,worldPayload,emitLogicEvent,saveLogicToFactory,logicPayload,interactNearestNpc,setNpcState,saveNpcsToFactory,npcPayload};"
  );
  return js;
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
  const project=createV9Project({request,profile});
  let files=project.files.map(file=>({...file}));
  const map=byName(files);
  const scene=upgradeScene(map.get('scene.json').content);
  const logic=upgradeLogic(map.get('logic.json').content);
  const npcs=npcDefinition();

  let html=map.get('index.html').content
    .replace(/GAME STUDIO V9/g,'GAME STUDIO V10')
    .replace('<option value="timer">Temporizador</option></select>','<option value="timer">Temporizador</option><option value="npc_interact">Interactuar NPC</option><option value="npc_state_changed">Cambio estado NPC</option><option value="npc_goal_completed">Objetivo NPC completado</option></select>')
    .replace('<option value="lighting">Cambiar ambiente</option></select>','<option value="lighting">Cambiar ambiente</option><option value="npc_set_state">Cambiar estado NPC</option><option value="npc_say">Diálogo NPC</option></select>')
    .replace('</section><section class="facts">','</section>'+npcMarkup()+'<section class="facts">');
  let css=map.get('styles.css').content+npcCss();
  let js=map.get('main.js').content
    .replace(/^const SCENE=.*;$/m,'const SCENE='+JSON.stringify(scene)+';')
    .replace(/^const LOGIC=.*;$/m,'const LOGIC='+JSON.stringify(logic)+';')
    .replace(/^const state=/m,'const NPCS='+JSON.stringify(npcs)+';\nconst state=');
  js=wireV10(js).split('wae-game-studio/v9').join(GAME_STUDIO_VERSION);

  const manifest=JSON.parse(map.get('wae-product.json').content);
  manifest.studio=GAME_STUDIO_VERSION;
  manifest.logic=LOGIC_SCHEMA;
  manifest.npcs=NPC_SCHEMA;
  manifest.capabilities=Array.from(new Set([...(manifest.capabilities||[]),
    'npc-engine','npc-state-machine','npc-perception','npc-patrol','npc-chase','npc-interaction','npc-dialogue','npc-factions','npc-goals','npc-logic-events','npc-persistence'
  ]));

  const readme=map.get('README.md').content
    .replace(/wae-game-studio\/v9/g,GAME_STUDIO_VERSION)
    .replace(/Game Studio v9/g,'Game Studio v10')
    +'\n\n## NPC Engine v10\nnpc.json define personajes, facciones, percepción, estados, rutas de patrulla, diálogo y objetivos. El runtime usa máquinas de estado deterministas y emite eventos NPC hacia Logic Builder v10.\n';
  const studioDoc='# WAE Game Studio v10 · AI Character & NPC Engine\n\nPipeline: mundo → personajes → facciones → percepción → máquina de estados → patrullaje/persecución/interacción → diálogo/objetivos → eventos lógicos → persistencia → QA.\n\nEl motor NPC local es determinista y no requiere inferencia externa para operar. npc.json es portable y se mantiene embebido como NPCS en main.js.\n';

  files=replaceOrAdd(files,'index.html',html);
  files=replaceOrAdd(files,'styles.css',css);
  files=replaceOrAdd(files,'main.js',js);
  files=replaceOrAdd(files,'scene.json',JSON.stringify(scene,null,2));
  files=replaceOrAdd(files,'logic.json',JSON.stringify(logic,null,2));
  files=replaceOrAdd(files,'npc.json',JSON.stringify(npcs,null,2));
  files=replaceOrAdd(files,'wae-product.json',JSON.stringify(manifest,null,2));
  files=replaceOrAdd(files,'README.md',readme);
  files=replaceOrAdd(files,'GAME-STUDIO.md',studioDoc);

  return{
    plan:'Game Studio v10 añadió NPC Engine con facciones, percepción, máquinas de estado, patrullaje, persecución, interacción, diálogo, objetivos y eventos para Logic Builder.',
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
  let scene=null,world=null,logic=null,npcs=null;
  try{scene=JSON.parse(sceneRaw)}catch{}
  try{world=JSON.parse(worldRaw)}catch{}
  try{logic=JSON.parse(logicRaw)}catch{}
  try{npcs=JSON.parse(npcRaw)}catch{}
  const chars=npcs?.characters||[];
  const rules=logic?.rules||[];
  const checks={
    studioScene:Boolean(scene&&scene.engine===GAME_STUDIO_VERSION&&Array.isArray(scene.entities)&&scene.entities.length>=4),
    worldFile:Boolean(world&&world.schema===WORLD_SCHEMA&&Array.isArray(world.scenes)&&world.scenes.length>=2),
    logicFile:Boolean(logic&&logic.schema===LOGIC_SCHEMA&&Array.isArray(rules)&&rules.length>=5),
    npcFile:Boolean(npcs&&npcs.schema===NPC_SCHEMA&&Array.isArray(chars)&&chars.length>=3),
    npcIds:Boolean(chars.length&&new Set(chars.map(npc=>npc.id)).size===chars.length&&chars.every(npc=>/^[a-zA-Z0-9_-]{1,60}$/.test(npc.id||''))),
    npcFactions:Boolean(npcs?.factions&&Object.keys(npcs.factions).length>=3&&chars.every(npc=>npcs.factions[npc.faction])),
    npcBrains:Boolean(chars.every(npc=>npc.brain?.type==='state_machine'&&Array.isArray(npc.brain.states)&&npc.brain.states.includes('patrol')&&npc.brain.states.includes('interact'))),
    npcPerception:Boolean(chars.every(npc=>Number(npc.behavior?.perceptionRadius)>0&&Number(npc.behavior?.interactionRadius)>0)),
    npcPatrol:Boolean(chars.every(npc=>Array.isArray(npc.patrol)&&npc.patrol.length>=1)),
    npcDialogue:Boolean(chars.every(npc=>Array.isArray(npc.dialogue)&&npc.dialogue.length>=1)),
    npcGoals:Boolean(chars.every(npc=>Array.isArray(npc.goals)&&npc.goals.length>=1)),
    npcBuilder:/npcBuilderPanel|renderNpcBuilder|npcList/i.test(js+html),
    npcRuntime:/updateNpcBehavior|npcTick|drawNpcCharacters|setNpcState/i.test(js),
    npcInteraction:/interactNearestNpc|npcDialogueBox|KeyE/i.test(js+html),
    npcLogic:/npc_interact|npc_state_changed|npc_goal_completed|npc_set_state|npc_say/i.test(js+logicRaw+html),
    npcPersistence:/wae-game-studio-npc-save/i.test(js)&&/window\.parent\.postMessage/i.test(js)&&/saveNpcsToFactory/i.test(js),
    embeddedNpc:/^const NPCS=/m.test(js),
    input:/keydown/i.test(js)&&/pointerdown/i.test(js)
  };
  const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
  return{pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
