import {
  createNativeGameStudioProject as createV8Project,
  supportsNativeGameStudio,
  WORLD_SCHEMA
} from './game-studio-v8.js';

export const GAME_STUDIO_VERSION='wae-game-studio/v9';
export const LOGIC_SCHEMA='wae-logic/v9';
export { supportsNativeGameStudio, WORLD_SCHEMA };

const byName=files=>new Map((files||[]).map(file=>[file.name,file]));
const replaceOrAdd=(files,name,content)=>{
  const found=files.some(file=>file.name===name);
  return found?files.map(file=>file.name===name?{...file,content}:file):files.concat([{name,content}]);
};
const clone=value=>JSON.parse(JSON.stringify(value));

function logicDefinition(){
  return {
    schema:LOGIC_SCHEMA,
    version:9,
    rules:[
      {
        id:'logic-scene-welcome',
        name:'Bienvenida al mundo',
        enabled:true,
        once:true,
        event:{type:'scene_enter',sceneId:'world-alpha'},
        conditions:[{type:'always'}],
        actions:[{type:'message',text:'Explora el sector y reúne energía.'}]
      },
      {
        id:'logic-energy-reward',
        name:'Recompensa de energía',
        enabled:true,
        once:true,
        event:{type:'score_changed'},
        conditions:[{type:'score_gte',value:3}],
        actions:[
          {type:'message',text:'Energía suficiente. Recompensa desbloqueada.'},
          {type:'spawn_prefab',prefab:'energy'},
          {type:'mission_complete',missionId:'mission-energy'}
        ]
      },
      {
        id:'logic-beta-portal',
        name:'Portal al Sector Beta',
        enabled:true,
        once:false,
        event:{type:'trigger_enter',triggerId:'trigger-alpha-exit'},
        conditions:[{type:'visited_scenes_gte',value:1}],
        actions:[{type:'scene',target:'world-beta'}]
      }
    ]
  };
}

function upgradeScene(raw){
  const scene=JSON.parse(raw);
  scene.engine=GAME_STUDIO_VERSION;
  scene.editor={...(scene.editor||{}),logicBuilder:true,visualRules:true,playtestEvents:true,version:9};
  return scene;
}

function logicMarkup(){
  return '<section id="logicBuilderPanel" class="logic-builder">'
    +'<div class="logic-head"><div><p class="eyebrow">GAME STUDIO V9 · LOGIC BUILDER</p><h2>Gameplay visual</h2><p>Conecta eventos, condiciones y acciones sin editar código.</p></div><div class="logic-head-actions"><button id="playtestLogic" type="button">▶ Probar regla</button><button id="saveLogic" type="button" class="save-logic">Guardar lógica</button></div></div>'
    +'<div class="logic-grid"><aside class="logic-rules"><div class="panel-title">Reglas <strong id="logicRuleCount">0</strong></div><div id="logicRuleList" class="logic-rule-list" role="listbox" aria-label="Reglas de gameplay"></div><div class="logic-actions"><button id="addLogicRule" type="button">＋ Regla</button><button id="duplicateLogicRule" type="button">Duplicar</button><button id="deleteLogicRule" type="button">Eliminar</button></div></aside>'
    +'<section class="logic-inspector"><div class="panel-title">Regla seleccionada <span id="logicSelected">Sin selección</span></div>'
    +'<div class="logic-two"><label>Nombre<input id="logicName" maxlength="80"></label><label>Estado<select id="logicEnabled"><option value="true">Activa</option><option value="false">Desactivada</option></select></label></div>'
    +'<div class="logic-two"><label>Evento<select id="logicEvent"><option value="scene_enter">Entrar escena</option><option value="trigger_enter">Entrar trigger</option><option value="score_changed">Cambiar puntuación</option><option value="mission_completed">Completar misión</option><option value="timer">Temporizador</option></select></label><label>Evento objetivo<input id="logicEventTarget" placeholder="world-alpha / trigger-id"></label></div>'
    +'<div class="logic-two"><label>Condición<select id="logicCondition"><option value="always">Siempre</option><option value="score_gte">Puntuación ≥</option><option value="visited_scenes_gte">Escenas visitadas ≥</option><option value="mission_status">Estado de misión</option><option value="scene_is">Escena actual</option></select></label><label>Valor condición<input id="logicConditionValue" placeholder="3 / completed / world-alpha"></label></div>'
    +'<div class="logic-two"><label>Acción<select id="logicAction"><option value="message">Mostrar mensaje</option><option value="scene">Cambiar escena</option><option value="spawn_prefab">Instanciar prefab</option><option value="mission_complete">Completar misión</option><option value="score_add">Sumar puntuación</option><option value="lighting">Cambiar ambiente</option></select></label><label>Valor acción<input id="logicActionValue" placeholder="Texto / scene / prefab / mission"></label></div>'
    +'<div class="logic-two"><label>Una sola vez<select id="logicOnce"><option value="true">Sí</option><option value="false">No</option></select></label><button id="applyLogicRule" type="button">Aplicar cambios</button></div>'
    +'</section><section class="logic-playtest"><div class="panel-title">Playtest <span id="logicEventCount">0 eventos</span></div><div id="logicEventLog" class="logic-event-log" aria-live="polite"></div><button id="clearLogicLog" type="button">Limpiar registro</button></section></div>'
    +'<div id="logicSaveStatus" class="scene-save-status" role="status"></div></section>';
}

function logicCss(){
  return [
    '.logic-builder{margin:14px 16px;padding:15px;border:1px solid #334f61;border-radius:20px;background:linear-gradient(180deg,#07131a,#040a0e);box-shadow:0 20px 70px #0007}.logic-head{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:12px}.logic-head h2{margin:.18rem 0}.logic-head p{margin:.2rem 0;color:#97b5c5}.logic-head-actions{display:flex;gap:8px;flex-wrap:wrap}.save-logic{background:#173e4b;border-color:#58cde5}.logic-grid{display:grid;grid-template-columns:.85fr 1.3fr .9fr;gap:10px}.logic-rules,.logic-inspector,.logic-playtest{border:1px solid #234657;border-radius:14px;background:#061016;padding:11px;min-width:0}.logic-rule-list{display:grid;gap:5px;max-height:300px;overflow:auto}.logic-rule-list button{display:grid;gap:3px;text-align:left;width:100%;padding:8px 10px;background:#0a1820}.logic-rule-list button[aria-selected="true"]{border-color:#61d8ef;background:#10303a}.logic-rule-list small{color:#7999a8}.logic-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.logic-actions button{padding:7px 9px}.logic-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:8px}.logic-inspector label{display:grid;gap:5px;font-size:.72rem;color:#9ab9c8}.logic-inspector input,.logic-inspector select{width:100%;min-width:0;background:#03090d;color:#effcff;border:1px solid #294b5c;border-radius:9px;padding:8px}.logic-event-log{display:grid;gap:5px;max-height:270px;overflow:auto;margin-bottom:8px}.logic-event-log article{padding:7px 8px;border:1px solid #1e3c4b;border-radius:9px;background:#08161d;font-size:.72rem}.logic-event-log strong{display:block;color:#6ed9ed}.logic-event-log small{color:#7896a5}.logic-playtest>button{padding:7px 9px}',
    '@media(max-width:1000px){.logic-grid{grid-template-columns:1fr 1fr}.logic-playtest{grid-column:span 2}}@media(max-width:760px){.logic-builder{margin:10px 8px}.logic-head{align-items:stretch;flex-direction:column}.logic-grid{grid-template-columns:1fr}.logic-playtest{grid-column:auto}.logic-two{grid-template-columns:1fr}}'
  ].join('');
}

function runtimeV9(){
  return [
    "const logicState={selectedId:LOGIC.rules[0]?.id||'',fired:new Set(),events:[],timers:new Map()};",
    "function logicRule(){return LOGIC.rules.find(rule=>rule.id===logicState.selectedId)||null}",
    "function logicUniqueId(base='logic'){let n=1,id=base+'-'+n;const ids=new Set(LOGIC.rules.map(rule=>rule.id));while(ids.has(id)){n++;id=base+'-'+n}return id}",
    "function logicEventTarget(rule){if(rule.event.type==='scene_enter')return rule.event.sceneId||'';if(rule.event.type==='trigger_enter')return rule.event.triggerId||'';if(rule.event.type==='mission_completed')return rule.event.missionId||'';if(rule.event.type==='timer')return String(rule.event.seconds||1);return''}",
    "function renderLogicRules(){const host=editorEl('logicRuleList');if(!host)return;host.replaceChildren();for(const rule of LOGIC.rules){const b=document.createElement('button');b.type='button';b.setAttribute('aria-selected',String(rule.id===logicState.selectedId));const s=document.createElement('strong');s.textContent=rule.name||rule.id;const meta=document.createElement('small');meta.textContent=(rule.enabled?'ACTIVA':'OFF')+' · '+rule.event.type;b.append(s,meta);b.addEventListener('click',()=>{logicState.selectedId=rule.id;renderLogicBuilder()});host.appendChild(b)}editorEl('logicRuleCount').textContent=String(LOGIC.rules.length)}",
    "function renderLogicInspector(){const rule=logicRule(),ids=['logicName','logicEnabled','logicEvent','logicEventTarget','logicCondition','logicConditionValue','logicAction','logicActionValue','logicOnce','applyLogicRule','duplicateLogicRule','deleteLogicRule','playtestLogic'];for(const id of ids){const el=editorEl(id);if(el)el.disabled=!rule}editorEl('logicSelected').textContent=rule?(rule.name||rule.id):'Sin selección';if(!rule)return;const condition=rule.conditions?.[0]||{type:'always'},action=rule.actions?.[0]||{type:'message',text:''};editorEl('logicName').value=rule.name||'';editorEl('logicEnabled').value=String(rule.enabled!==false);editorEl('logicEvent').value=rule.event.type;editorEl('logicEventTarget').value=logicEventTarget(rule);editorEl('logicCondition').value=condition.type;editorEl('logicConditionValue').value=String(condition.value??condition.status??condition.sceneId??'');editorEl('logicAction').value=action.type;editorEl('logicActionValue').value=String(action.text??action.target??action.prefab??action.missionId??action.value??action.ambient??'');editorEl('logicOnce').value=String(Boolean(rule.once))}",
    "function renderLogicLog(){const host=editorEl('logicEventLog');if(!host)return;host.replaceChildren();for(const item of logicState.events.slice(-40).reverse()){const a=document.createElement('article'),s=document.createElement('strong'),m=document.createElement('small');s.textContent=item.type;m.textContent=item.detail;a.append(s,m);host.appendChild(a)}editorEl('logicEventCount').textContent=logicState.events.length+' eventos'}",
    "function renderLogicBuilder(){renderLogicRules();renderLogicInspector();renderLogicLog()}",
    "function addLogicLog(type,detail){logicState.events.push({type,detail:String(detail||'').slice(0,180),at:Date.now()});logicState.events=logicState.events.slice(-80);renderLogicLog()}",
    "function createLogicRule(){const id=logicUniqueId('logic-rule');LOGIC.rules.push({id,name:'Nueva regla',enabled:true,once:false,event:{type:'scene_enter',sceneId:SCENE.world.activeSceneId},conditions:[{type:'always'}],actions:[{type:'message',text:'Regla activada'}]});logicState.selectedId=id;renderLogicBuilder()}",
    "function duplicateLogicRule(){const rule=logicRule();if(!rule)return;const copy=clone(rule);copy.id=logicUniqueId(rule.id+'-copy');copy.name=(rule.name||rule.id)+' copia';LOGIC.rules.push(copy);logicState.selectedId=copy.id;renderLogicBuilder()}",
    "function deleteLogicRule(){if(LOGIC.rules.length<=1){addLogicLog('editor','Debe existir al menos una regla.');return}LOGIC.rules=LOGIC.rules.filter(rule=>rule.id!==logicState.selectedId);logicState.selectedId=LOGIC.rules[0]?.id||'';renderLogicBuilder()}",
    "function conditionFromEditor(type,value){if(type==='always')return{type:'always'};if(type==='score_gte'||type==='visited_scenes_gte')return{type,value:Math.max(0,Number(value)||0)};if(type==='mission_status')return{type,status:String(value||'completed').slice(0,30)};if(type==='scene_is')return{type,sceneId:String(value||SCENE.world.activeSceneId).slice(0,60)};return{type:'always'}}",
    "function actionFromEditor(type,value){if(type==='message')return{type,text:String(value||'Regla activada').slice(0,160)};if(type==='scene')return{type,target:String(value||SCENE.world.activeSceneId).slice(0,60)};if(type==='spawn_prefab')return{type,prefab:String(value||'crate').slice(0,60)};if(type==='mission_complete')return{type,missionId:String(value||'mission-energy').slice(0,60)};if(type==='score_add')return{type,value:Number(value)||1};if(type==='lighting')return{type,ambient:Math.max(.2,Math.min(1.4,Number(value)||.8))};return{type:'message',text:'Regla activada'}}",
    "function applyLogicRule(){const rule=logicRule();if(!rule)return;rule.name=editorEl('logicName').value.trim().slice(0,80)||rule.id;rule.enabled=editorEl('logicEnabled').value==='true';rule.once=editorEl('logicOnce').value==='true';const eventType=editorEl('logicEvent').value,target=editorEl('logicEventTarget').value.trim();rule.event={type:eventType};if(eventType==='scene_enter')rule.event.sceneId=target||SCENE.world.activeSceneId;if(eventType==='trigger_enter')rule.event.triggerId=target;if(eventType==='mission_completed')rule.event.missionId=target;if(eventType==='timer')rule.event.seconds=Math.max(.2,Math.min(3600,Number(target)||1));rule.conditions=[conditionFromEditor(editorEl('logicCondition').value,editorEl('logicConditionValue').value)];rule.actions=[actionFromEditor(editorEl('logicAction').value,editorEl('logicActionValue').value)];scheduleLogicTimers();renderLogicBuilder();addLogicLog('editor','Regla actualizada: '+rule.name)}",
    "function logicEventMatches(rule,event){if(rule.event.type!==event.type)return false;if(event.type==='scene_enter'&&rule.event.sceneId&&rule.event.sceneId!==event.sceneId)return false;if(event.type==='trigger_enter'&&rule.event.triggerId&&rule.event.triggerId!==event.triggerId)return false;if(event.type==='mission_completed'&&rule.event.missionId&&rule.event.missionId!==event.missionId)return false;return true}",
    "function logicConditionPass(condition){if(!condition||condition.type==='always')return true;if(condition.type==='score_gte')return state.score>=Number(condition.value||0);if(condition.type==='visited_scenes_gte')return SCENE.world.visitedScenes.length>=Number(condition.value||0);if(condition.type==='scene_is')return SCENE.world.activeSceneId===condition.sceneId;if(condition.type==='mission_status'){const mission=SCENE.world.missions.find(m=>m.status===condition.status);return Boolean(mission)}return false}",
    "function executeLogicAction(action,event){if(!action)return;if(action.type==='message'){ui.status.textContent=action.text||'Evento ejecutado';addLogicLog('action:message',action.text||'')}else if(action.type==='scene'&&action.target){loadWorldScene(action.target);addLogicLog('action:scene',action.target)}else if(action.type==='spawn_prefab'&&action.prefab&&SCENE.world.prefabs[action.prefab]){const previous=worldState.selectedPrefab;worldState.selectedPrefab=action.prefab;spawnWorldPrefab();worldState.selectedPrefab=previous;addLogicLog('action:spawn',action.prefab)}else if(action.type==='mission_complete'&&action.missionId){const mission=SCENE.world.missions.find(m=>m.id===action.missionId);if(mission){mission.forceCompleted=true;mission.status='completed';addLogicLog('action:mission',mission.id);emitLogicEvent('mission_completed',{missionId:mission.id})}}else if(action.type==='score_add'){state.score+=Number(action.value)||0;syncUI();addLogicLog('action:score','+'+String(action.value||0))}else if(action.type==='lighting'){SCENE.world.lighting.ambient=Math.max(.2,Math.min(1.4,Number(action.ambient)||.8));applyWorldLighting();renderWorldBuilder();addLogicLog('action:lighting',String(SCENE.world.lighting.ambient))}}",
    "function emitLogicEvent(type,payload={}){const event={type,...payload};addLogicLog('event:'+type,JSON.stringify(payload));for(const rule of LOGIC.rules){if(!rule.enabled)continue;if(rule.once&&logicState.fired.has(rule.id))continue;if(!logicEventMatches(rule,event))continue;if(!(rule.conditions||[]).every(logicConditionPass))continue;if(rule.once)logicState.fired.add(rule.id);for(const action of rule.actions||[])executeLogicAction(action,event)}}",
    "function scheduleLogicTimers(){for(const handle of logicState.timers.values())clearInterval(handle);logicState.timers.clear();for(const rule of LOGIC.rules){if(!rule.enabled||rule.event.type!=='timer')continue;const ms=Math.max(200,Math.min(3600000,Number(rule.event.seconds||1)*1000));const handle=setInterval(()=>emitLogicEvent('timer',{ruleId:rule.id}),ms);logicState.timers.set(rule.id,handle)}}",
    "function playtestSelectedLogic(){const rule=logicRule();if(!rule)return;const event=clone(rule.event);emitLogicEvent(event.type,event);addLogicLog('playtest','Ejecutada '+rule.name)}",
    "function logicPayload(){return clone(LOGIC)}",
    "function saveLogicToFactory(){const status=editorEl('logicSaveStatus');try{window.parent.postMessage({type:'wae-game-studio-logic-save',studio:'"+GAME_STUDIO_VERSION+"',logic:logicPayload()},'*');if(status)status.textContent='Guardando logic.json en la Fábrica…'}catch(error){if(status)status.textContent='No se pudo guardar lógica: '+String(error.message||error)}}",
    "addEventListener('message',event=>{const data=event.data;if(!data||data.type!=='wae-game-studio-logic-saved')return;const status=editorEl('logicSaveStatus');if(status)status.textContent=data.ok?'Gameplay guardado en logic.json y main.js.':'Error al guardar lógica: '+String(data.message||'persistencia rechazada')})"
  ].join('\n');
}

function wireV9(js){
  js=js.replace(
    "function renderMissions(){const host=editorEl('missionList');if(!host)return;host.replaceChildren();for(const mission of SCENE.world.missions){const a=document.createElement('article');const strong=document.createElement('strong');strong.textContent=mission.title;const small=document.createElement('small');let progress=mission.type==='score'?Math.min(state.score,mission.target):Math.min(SCENE.world.visitedScenes.length,mission.target);mission.status=progress>=mission.target?'completed':'active';small.textContent=progress+' / '+mission.target+' · '+mission.status;a.append(strong,small);host.appendChild(a)}}",
    "function renderMissions(){const host=editorEl('missionList');if(!host)return;host.replaceChildren();for(const mission of SCENE.world.missions){const a=document.createElement('article');const strong=document.createElement('strong');strong.textContent=mission.title;const small=document.createElement('small');let progress=mission.type==='score'?Math.min(state.score,mission.target):Math.min(SCENE.world.visitedScenes.length,mission.target);const before=mission.status;mission.status=mission.forceCompleted||progress>=mission.target?'completed':'active';if(before!=='completed'&&mission.status==='completed')queueMicrotask(()=>emitLogicEvent('mission_completed',{missionId:mission.id}));small.textContent=progress+' / '+mission.target+' · '+mission.status;a.append(strong,small);host.appendChild(a)}}"
  );
  js=js.replace(
    "function loadWorldScene(id){syncEntitiesIntoWorld();const next=SCENE.world.scenes.find(scene=>scene.id===id);if(!next)return false;SCENE.world.activeSceneId=next.id;entities=clone(next.entities);const spawn=next.spawnPoints?.[0];const p=player();if(spawn&&p)p.position=clone(spawn.position);if(!SCENE.world.visitedScenes.includes(next.id))SCENE.world.visitedScenes.push(next.id);worldState.triggered.clear();studioEditor.selectedId='';renderStudioEditor();renderWorldBuilder();syncUI();tone(520,.07);return true}",
    "function loadWorldScene(id){syncEntitiesIntoWorld();const next=SCENE.world.scenes.find(scene=>scene.id===id);if(!next)return false;SCENE.world.activeSceneId=next.id;entities=clone(next.entities);const spawn=next.spawnPoints?.[0];const p=player();if(spawn&&p)p.position=clone(spawn.position);if(!SCENE.world.visitedScenes.includes(next.id))SCENE.world.visitedScenes.push(next.id);worldState.triggered.clear();studioEditor.selectedId='';renderStudioEditor();renderWorldBuilder();syncUI();tone(520,.07);queueMicrotask(()=>emitLogicEvent('scene_enter',{sceneId:next.id}));return true}"
  );
  js=js.replace(
    "worldState.triggered.add(t.id);if(t.action?.type==='message')ui.status.textContent=t.action.text||'Trigger activado';if(t.action?.type==='scene'&&t.action.target)loadWorldScene(t.action.target)",
    "worldState.triggered.add(t.id);emitLogicEvent('trigger_enter',{triggerId:t.id,sceneId:scene.id});if(t.action?.type==='message')ui.status.textContent=t.action.text||'Trigger activado';if(t.action?.type==='scene'&&t.action.target)loadWorldScene(t.action.target)"
  );
  js=js.replace(
    "function collect(){const p=player();entities=entities.filter(e=>{if(e.type!=='collectible')return true;const dx=e.position[0]-p.position[0],dy=e.position[1]-p.position[1],dz=e.position[2]-p.position[2];if(Math.hypot(dx,dy,dz)<1.15){state.score++;emitParticles(e.position,'collectible');tone(620+state.score*35,.07);return false}return true});if(state.score>=level().goal){ui.status.textContent='Objetivo completado · siguiente nivel';setTimeout(()=>resetLevel(true),650)}syncUI()}",
    "function collect(){const p=player();let changed=false;entities=entities.filter(e=>{if(e.type!=='collectible')return true;const dx=e.position[0]-p.position[0],dy=e.position[1]-p.position[1],dz=e.position[2]-p.position[2];if(Math.hypot(dx,dy,dz)<1.15){state.score++;changed=true;emitParticles(e.position,'collectible');tone(620+state.score*35,.07);return false}return true});if(changed)emitLogicEvent('score_changed',{score:state.score});if(state.score>=level().goal){ui.status.textContent='Objetivo completado · siguiente nivel';setTimeout(()=>resetLevel(true),650)}syncUI()}"
  );
  js=js.replace(
    "function renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];",
    runtimeV9()+"\nfunction renderScene(){if(!gl)return;resize();const sky=SCENE.world?.lighting?.sky||[.015,.025,.055,1];"
  );
  const hook="editorEl('saveWorld')?.addEventListener('click',saveWorldToFactory);";
  const listeners=[
    "editorEl('addLogicRule')?.addEventListener('click',createLogicRule);",
    "editorEl('duplicateLogicRule')?.addEventListener('click',duplicateLogicRule);",
    "editorEl('deleteLogicRule')?.addEventListener('click',deleteLogicRule);",
    "editorEl('applyLogicRule')?.addEventListener('click',applyLogicRule);",
    "editorEl('playtestLogic')?.addEventListener('click',playtestSelectedLogic);",
    "editorEl('saveLogic')?.addEventListener('click',saveLogicToFactory);",
    "editorEl('clearLogicLog')?.addEventListener('click',()=>{logicState.events=[];renderLogicLog()});"
  ].join('');
  js=js.replace(hook,hook+listeners);
  js=js.replace(
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick)}}catch(error)",
    "try{if(initGL()){applyWorldLighting();renderWorldBuilder();renderLogicBuilder();scheduleLogicTimers();syncUI();requestAnimationFrame(frame);requestAnimationFrame(worldTick);queueMicrotask(()=>emitLogicEvent('scene_enter',{sceneId:SCENE.world.activeSceneId}))}}catch(error)"
  );
  js=js.replace(
    /window\.WAEGameStudio=\{version:'wae-game-studio\/v8'[^\n]*\};/,
    "window.WAEGameStudio={version:'"+GAME_STUDIO_VERSION+"',scene:SCENE,logic:LOGIC,state,addEntity,resetLevel,selectEntity,duplicateSelected,deleteSelected,nudgeSelected,saveSceneToFactory,scenePayload,loadWorldScene,spawnWorldPrefab,saveWorldToFactory,worldPayload,emitLogicEvent,saveLogicToFactory,logicPayload};"
  );
  return js;
}

export function createNativeGameStudioProject({request='',profile='game_3d'}={}){
  const project=createV8Project({request,profile});
  let files=project.files.map(file=>({...file}));
  const map=byName(files);
  const scene=upgradeScene(map.get('scene.json').content);
  const logic=logicDefinition();

  let html=map.get('index.html').content
    .replace(/GAME STUDIO V8/g,'GAME STUDIO V9')
    .replace('</section><section class="facts">','</section>'+logicMarkup()+'<section class="facts">');
  let css=map.get('styles.css').content+logicCss();
  let js=map.get('main.js').content
    .replace(/^const SCENE=.*;$/m,'const SCENE='+JSON.stringify(scene)+';')
    .replace(/^const state=/m,'const LOGIC='+JSON.stringify(logic)+';\nconst state=');
  js=wireV9(js).replace(/wae-game-studio\\/v8/g,GAME_STUDIO_VERSION);

  const manifest=JSON.parse(map.get('wae-product.json').content);
  manifest.studio=GAME_STUDIO_VERSION;
  manifest.logic=LOGIC_SCHEMA;
  manifest.capabilities=Array.from(new Set([...(manifest.capabilities||[]),
    'visual-logic-builder','event-rules','conditions','gameplay-actions','logic-playtest','logic-persistence'
  ]));

  const readme=map.get('README.md').content
    .replace(/wae-game-studio\/v8/g,GAME_STUDIO_VERSION)
    .replace(/Game Studio v8/g,'Game Studio v9')
    +'\n\n## Logic Builder v9\nlogic.json define reglas visuales de eventos, condiciones y acciones. El runtime interpreta scene_enter, trigger_enter, score_changed, mission_completed y timer; soporta mensajes, cambio de escena, instanciación de prefabs, completar misiones, sumar puntuación e iluminación.\n';
  const studioDoc='# WAE Game Studio v9 · Gameplay Logic Builder\n\nPipeline: mundo → eventos → condiciones → acciones → playtest → persistencia → QA.\n\nlogic.json es portable y la preview mantiene una copia embebida en la constante LOGIC de main.js. Guardar lógica usa postMessage validado por la Fábrica.\n';

  files=replaceOrAdd(files,'index.html',html);
  files=replaceOrAdd(files,'styles.css',css);
  files=replaceOrAdd(files,'main.js',js);
  files=replaceOrAdd(files,'scene.json',JSON.stringify(scene,null,2));
  files=replaceOrAdd(files,'logic.json',JSON.stringify(logic,null,2));
  files=replaceOrAdd(files,'wae-product.json',JSON.stringify(manifest,null,2));
  files=replaceOrAdd(files,'README.md',readme);
  files=replaceOrAdd(files,'GAME-STUDIO.md',studioDoc);

  return{
    plan:'Game Studio v9 añadió Gameplay Logic Builder visual con eventos, condiciones, acciones, playtest y persistencia portable.',
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
  let scene=null,world=null,logic=null;
  try{scene=JSON.parse(sceneRaw)}catch{}
  try{world=JSON.parse(worldRaw)}catch{}
  try{logic=JSON.parse(logicRaw)}catch{}
  const rules=logic?.rules||[];
  const checks={
    studioScene:Boolean(scene&&scene.engine===GAME_STUDIO_VERSION&&Array.isArray(scene.entities)&&scene.entities.length>=4),
    worldFile:Boolean(world&&world.schema===WORLD_SCHEMA&&Array.isArray(world.scenes)&&world.scenes.length>=2),
    logicFile:Boolean(logic&&logic.schema===LOGIC_SCHEMA&&Array.isArray(rules)&&rules.length>=3),
    logicIds:Boolean(rules.length&&new Set(rules.map(rule=>rule.id)).size===rules.length&&rules.every(rule=>/^[a-zA-Z0-9_-]{1,60}$/.test(rule.id||''))),
    logicEvents:Boolean(rules.some(rule=>rule.event?.type==='scene_enter')&&rules.some(rule=>rule.event?.type==='trigger_enter')&&rules.some(rule=>rule.event?.type==='score_changed')),
    logicConditions:Boolean(rules.every(rule=>Array.isArray(rule.conditions)&&rule.conditions.length>=1)),
    logicActions:Boolean(rules.every(rule=>Array.isArray(rule.actions)&&rule.actions.length>=1)),
    sceneGraph:/entities|scene/i.test(js)&&/entity/i.test(js),
    physics:/gravity/i.test(js)&&/velocity/i.test(js)&&/aabb|overlaps/i.test(js),
    worldBuilder:/worldBuilderPanel|renderWorldBuilder|worldSceneSelect/i.test(js+html),
    logicBuilder:/logicBuilderPanel|renderLogicBuilder|logicRuleList/i.test(js+html),
    logicRuntime:/emitLogicEvent|logicEventMatches|executeLogicAction/i.test(js),
    logicHooks:/scene_enter|trigger_enter|score_changed|mission_completed|timer/i.test(js),
    actionRuntime:/spawn_prefab|mission_complete|score_add|lighting/i.test(js),
    playtest:/playtestSelectedLogic|logicEventLog/i.test(js+html),
    persistence:/wae-game-studio-logic-save/i.test(js)&&/window\.parent\.postMessage/i.test(js)&&/saveLogicToFactory/i.test(js),
    embeddedLogic:/^const LOGIC=/m.test(js),
    input:/keydown/i.test(js)&&/pointerdown/i.test(js)
  };
  const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([name])=>name);
  return{pass:failed.length===0,checks,failed,version:GAME_STUDIO_VERSION};
}
