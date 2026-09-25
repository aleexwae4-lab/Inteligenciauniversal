/* WAE Factory v1: isolated, browser-local product project workspace. */
(()=>{
'use strict';
if(window.__waeFactoryV1)return;
const KEY='wae.render.factory.projects.v1',ACTIVE='wae.render.factory.active.v1',LIMIT=200000,MAX_FILES=30;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const notify=s=>window.toast?.(s);
const id=()=>crypto.randomUUID?.()||'p-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const starter={
'index.html':'<!doctype html>\n<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Producto WAE</title><link rel="stylesheet" href="styles.css"></head><body><main id="app"><h1>Tu producto comienza aquí</h1><p>Construye, prueba y exporta.</p><button id="action">Comenzar</button></main><script src="main.js"><\/script></body></html>',
'styles.css':':root{font-family:Inter,system-ui;color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080d18;color:#f5f7fb}main{padding:36px;border:1px solid #253246;border-radius:20px}button{padding:12px 22px;border:0;border-radius:10px;background:#38e8b1;color:#06120e;font-weight:700}',
'main.js':'document.querySelector("#action")?.addEventListener("click",()=>{document.querySelector("#action").textContent="¡Funciona!";});',
'README.md':'# Producto WAE\n\nProyecto web autocontenido. Abre index.html después de exportar los archivos o publica los tres archivos juntos en un hosting estático.'
};
let projects=[],current=null,selected='index.html',timer=null,root=null;
function validName(name){return /^(?!\.)(?!.*\.\.)[a-zA-Z0-9_\-./]{1,100}$/.test(name)&&!name.startsWith('/')&&!name.split('/').includes('..')&&!name.includes('//')}
function cleanProject(p){if(!p||typeof p!=='object'||!Array.isArray(p.files)||p.files.length>MAX_FILES||p.files.length<1)throw Error('Proyecto inválido');const seen=new Set();const files=p.files.map(f=>{if(!f||typeof f.content!=='string'||!validName(f.name)||f.content.length>LIMIT||seen.has(f.name))throw Error('Archivo inválido o duplicado');seen.add(f.name);return{name:f.name,content:f.content}});return{id:typeof p.id==='string'&&p.id.length<90?p.id:id(),name:String(p.name||'Producto digital').slice(0,80),createdAt:String(p.createdAt||new Date().toISOString()),updatedAt:new Date().toISOString(),files}}
function createProject(name='Nuevo producto'){return cleanProject({id:id(),name,files:Object.entries(starter).map(([name,content])=>({name,content}))})}
function load(){try{const saved=JSON.parse(localStorage.getItem(KEY)||'[]');projects=Array.isArray(saved)?saved.slice(0,25).map(cleanProject):[]}catch{projects=[]}if(!projects.length)projects=[createProject('Mi primer producto')];current=projects.find(p=>p.id===localStorage.getItem(ACTIVE))||projects[0];selected=current.files[0].name;persist()}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(projects));localStorage.setItem(ACTIVE,current.id);$('#saveState')?.replaceChildren(document.createTextNode('Guardado en este dispositivo'));return true}catch{notify('Almacenamiento lleno: exporta una copia del proyecto');return false}}
function file(){return current.files.find(f=>f.name===selected)}
function saveEditor(){const editor=$('#wfEditor');if(!editor||!file())return;file().content=editor.value;current.updatedAt=new Date().toISOString();$('#saveState')?.replaceChildren(document.createTextNode('Cambios sin guardar'))}
function save(){saveEditor();if(persist())notify('Proyecto guardado en este dispositivo')}
function download(name,content,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function bundle(){const html=current.files.find(f=>f.name==='index.html')?.content||'<!doctype html><html><head></head><body></body></html>';const css=current.files.find(f=>f.name==='styles.css')?.content||'';const js=current.files.find(f=>f.name==='main.js')?.content||'';return html.replace(/<link\b[^>]*href=["']styles\.css["'][^>]*>/gi,'').replace(/<script\b[^>]*src=["']main\.js["'][^>]*><\/script>/gi,'').replace(/<\/head>/i,'<style>'+css.replace(/<\/style/gi,'<\\/style')+'</style></head>').replace(/<\/body>/i,'<script>'+js.replace(/<\/script/gi,'<\\/script')+'<\/script></body>')}
function diagnostics(){saveEditor();const names=new Set(current.files.map(f=>f.name));const errors=[];if(!names.has('index.html'))errors.push('Falta index.html.');if(!names.has('styles.css'))errors.push('Falta styles.css.');if(!names.has('main.js'))errors.push('Falta main.js.');const html=current.files.find(f=>f.name==='index.html')?.content||'';if(!/<html[\s>]/i.test(html)||!/<\/html>/i.test(html))errors.push('HTML: estructura <html> incompleta.');if(!/<meta[^>]+viewport/i.test(html))errors.push('HTML: falta viewport móvil.');if(/<script[^>]+src=["']https?:/i.test(html))errors.push('Atención: el HTML carga JavaScript externo.');const total=current.files.reduce((n,f)=>n+f.content.length,0);$('#wfDiagnostics').textContent=(errors.length?errors.join('\n'):'Comprobaciones estructurales básicas sin alertas.')+'\n'+current.files.length+' archivos · '+total+' caracteres.\nEsto no sustituye pruebas automatizadas, análisis de dependencias ni build de producción.';return errors}
function preview(){saveEditor();const frame=$('#wfPreview');frame.setAttribute('sandbox','allow-scripts');const html=bundle();frame.srcdoc=typeof window.WAECanvasPreparePreview==='function'?window.WAECanvasPreparePreview(html):html;diagnostics()}
function normalizeStudioScene(raw){
 if(!raw||typeof raw!=='object'||raw.engine!=='wae-game-studio/v7'||!Array.isArray(raw.entities)||raw.entities.length<2||raw.entities.length>240)throw Error('Escena Game Studio v7 inválida');
 const clean=JSON.parse(JSON.stringify(raw));
 const finite3=value=>Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(Number(n)));
 const ids=new Set();
 for(const entity of clean.entities){
  if(!entity||typeof entity!=='object'||typeof entity.id!=='string'||!/^[a-zA-Z0-9_-]{1,60}$/.test(entity.id)||ids.has(entity.id))throw Error('Entidad inválida o duplicada');
  ids.add(entity.id);
  if(!finite3(entity.position)||!finite3(entity.scale)||entity.scale.some(n=>Number(n)<=0||Number(n)>50))throw Error('Transformación de entidad inválida');
  entity.position=entity.position.map(n=>Math.max(-100,Math.min(100,Number(n))));
  entity.scale=entity.scale.map(n=>Math.max(.05,Math.min(50,Number(n))));
  entity.rotation=Math.max(-Math.PI*8,Math.min(Math.PI*8,Number(entity.rotation)||0));
  entity.type=String(entity.type||'entity').slice(0,40);
  entity.material=String(entity.material||'accent').slice(0,40);
  entity.label=String(entity.label||entity.id).slice(0,80);
  entity.dynamic=Boolean(entity.dynamic);
 }
 if(!clean.entities.some(e=>e.type==='player')||!clean.entities.some(e=>e.type==='floor'))throw Error('La escena debe conservar jugador y suelo');
 if(!clean.materials||typeof clean.materials!=='object'||Object.keys(clean.materials).length>40)throw Error('Materiales inválidos');
 for(const [name,color] of Object.entries(clean.materials)){
  if(!/^[a-zA-Z0-9_-]{1,40}$/.test(name)||!Array.isArray(color)||color.length!==4||color.some(v=>!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1))throw Error('Material inválido');
  clean.materials[name]=color.map(Number);
 }
 const encoded=JSON.stringify(clean);
 if(encoded.length>90000)throw Error('La escena supera el límite de 90 KB');
 return clean;
}
function persistStudioScene(scene){
 saveEditor();
 const clean=normalizeStudioScene(scene),sceneJson=JSON.stringify(clean,null,2);
 const sceneFile=current.files.find(f=>f.name==='scene.json'),mainFile=current.files.find(f=>f.name==='main.js');
 if(!sceneFile||!mainFile)throw Error('El proyecto no contiene scene.json y main.js');
 if(!/^const SCENE=.*;$/m.test(mainFile.content))throw Error('No se encontró el contrato SCENE en main.js');
 sceneFile.content=sceneJson;
 mainFile.content=mainFile.content.replace(/^const SCENE=.*;$/m,'const SCENE='+JSON.stringify(clean)+';');
 current.updatedAt=new Date().toISOString();
 if(!persist())throw Error('No se pudo persistir la escena');
 if(selected==='scene.json'||selected==='main.js')$('#wfEditor').value=file()?.content||'';
 diagnostics();
 notify('Escena Game Studio v7 guardada en scene.json y main.js');
 return true;
}
function normalizeWorldV8(raw){
 if(!raw||typeof raw!=='object'||raw.schema!=='wae-world/v8'||!Array.isArray(raw.scenes)||raw.scenes.length<1||raw.scenes.length>40)throw Error('Mundo Game Studio v8 inválido');
 const clean=JSON.parse(JSON.stringify(raw)),finite3=value=>Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(Number(n)));
 const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value);
 const sanitizeEntities=list=>{
  if(!Array.isArray(list)||list.length<2||list.length>240)throw Error('Entidades de escena inválidas');
  const ids=new Set();
  for(const entity of list){
   if(!entity||typeof entity!=='object'||!validId(entity.id)||ids.has(entity.id))throw Error('Entidad inválida o duplicada');
   ids.add(entity.id);
   if(!finite3(entity.position)||!finite3(entity.scale)||entity.scale.some(n=>Number(n)<=0||Number(n)>50))throw Error('Transformación inválida');
   entity.position=entity.position.map(n=>Math.max(-100,Math.min(100,Number(n))));
   entity.scale=entity.scale.map(n=>Math.max(.05,Math.min(50,Number(n))));
   entity.rotation=Math.max(-Math.PI*8,Math.min(Math.PI*8,Number(entity.rotation)||0));
   entity.type=String(entity.type||'entity').slice(0,40);entity.material=String(entity.material||'accent').slice(0,40);entity.label=String(entity.label||entity.id).slice(0,80);entity.dynamic=Boolean(entity.dynamic);
  }
  if(!list.some(e=>e.type==='player')||!list.some(e=>e.type==='floor'))throw Error('Cada escena debe conservar jugador y suelo');
 };
 const sceneIds=new Set();
 for(const scene of clean.scenes){
  if(!scene||!validId(scene.id)||sceneIds.has(scene.id))throw Error('Escena inválida o duplicada');
  sceneIds.add(scene.id);scene.name=String(scene.name||scene.id).slice(0,80);sanitizeEntities(scene.entities);
  if(!Array.isArray(scene.spawnPoints)||scene.spawnPoints.length<1||scene.spawnPoints.length>30)throw Error('Spawn points inválidos');
  for(const spawn of scene.spawnPoints){if(!validId(spawn.id)||!finite3(spawn.position))throw Error('Spawn point inválido');spawn.position=spawn.position.map(Number)}
  if(!Array.isArray(scene.triggers)||scene.triggers.length>100)throw Error('Triggers inválidos');
  for(const trigger of scene.triggers){
   if(!validId(trigger.id)||trigger.type!=='zone'||!finite3(trigger.position)||!finite3(trigger.size))throw Error('Trigger inválido');
   trigger.position=trigger.position.map(Number);trigger.size=trigger.size.map(n=>Math.max(.1,Math.min(50,Number(n))));trigger.once=Boolean(trigger.once);
   const type=String(trigger.action?.type||'message');if(!['message','scene'].includes(type))throw Error('Acción de trigger inválida');
   trigger.action={type,text:String(trigger.action?.text||'').slice(0,160),target:String(trigger.action?.target||'').slice(0,60)};
  }
 }
 if(!sceneIds.has(clean.activeSceneId))clean.activeSceneId=clean.scenes[0].id;
 if(!clean.prefabs||typeof clean.prefabs!=='object'||Object.keys(clean.prefabs).length<1||Object.keys(clean.prefabs).length>50)throw Error('Prefabs inválidos');
 for(const [name,prefab] of Object.entries(clean.prefabs)){
  if(!validId(name)||!prefab||typeof prefab!=='object'||!finite3(prefab.scale))throw Error('Prefab inválido');
  prefab.label=String(prefab.label||name).slice(0,80);prefab.type=String(prefab.type||'obstacle').slice(0,40);prefab.scale=prefab.scale.map(n=>Math.max(.05,Math.min(50,Number(n))));prefab.material=String(prefab.material||'accent').slice(0,40);prefab.dynamic=Boolean(prefab.dynamic);
 }
 if(!Array.isArray(clean.missions)||clean.missions.length>100)throw Error('Misiones inválidas');
 clean.missions=clean.missions.map(m=>({id:validId(m?.id)?m.id:'mission-'+id(),title:String(m?.title||'Misión').slice(0,100),type:['score','scenes'].includes(m?.type)?m.type:'score',target:Math.max(1,Math.min(999,Number(m?.target)||1)),status:m?.status==='completed'?'completed':'active'}));
 if(!clean.lighting||typeof clean.lighting!=='object'||!Array.isArray(clean.lighting.sky)||clean.lighting.sky.length!==4)throw Error('Iluminación inválida');
 clean.lighting.ambient=Math.max(.2,Math.min(1.4,Number(clean.lighting.ambient)||.78));clean.lighting.sky=clean.lighting.sky.map(v=>Math.max(0,Math.min(1,Number(v)||0)));
 clean.visitedScenes=Array.from(new Set((Array.isArray(clean.visitedScenes)?clean.visitedScenes:[]).filter(v=>sceneIds.has(v)))).slice(0,40);
 if(!clean.visitedScenes.includes(clean.activeSceneId))clean.visitedScenes.push(clean.activeSceneId);
 if(JSON.stringify(clean).length>160000)throw Error('El mundo supera el límite de 160 KB');
 return clean;
}
function persistWorldStudioV8(sceneRaw,worldRaw){
 saveEditor();
 if(!sceneRaw||typeof sceneRaw!=='object'||!['wae-game-studio/v8','wae-game-studio/v9','wae-game-studio/v10','wae-game-studio/v11'].includes(sceneRaw.engine))throw Error('Escena Game Studio v8/v9/v10 inválida');
 const world=normalizeWorldV8(worldRaw),clean=JSON.parse(JSON.stringify(sceneRaw));
 if(!clean.materials||typeof clean.materials!=='object'||Object.keys(clean.materials).length>40)throw Error('Materiales inválidos');
 for(const [name,color] of Object.entries(clean.materials)){if(!/^[a-zA-Z0-9_-]{1,40}$/.test(name)||!Array.isArray(color)||color.length!==4||color.some(v=>!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1))throw Error('Material inválido');clean.materials[name]=color.map(Number)}
 clean.world=world;const active=world.scenes.find(scene=>scene.id===world.activeSceneId)||world.scenes[0];clean.entities=JSON.parse(JSON.stringify(active.entities));
 if(!clean.camera||!Array.isArray(clean.camera.offset)||clean.camera.offset.length!==3)throw Error('Cámara inválida');
 clean.camera.offset=clean.camera.offset.map(n=>Math.max(-100,Math.min(100,Number(n)||0)));clean.camera.fov=Math.max(35,Math.min(95,Number(clean.camera.fov)||62));
 const sceneJson=JSON.stringify(clean,null,2),worldJson=JSON.stringify(world,null,2);
 const sceneFile=current.files.find(f=>f.name==='scene.json'),mainFile=current.files.find(f=>f.name==='main.js');let worldFile=current.files.find(f=>f.name==='world.json');
 if(!sceneFile||!mainFile)throw Error('El proyecto no contiene scene.json y main.js');if(!worldFile){if(current.files.length>=MAX_FILES)throw Error('No hay espacio para world.json');worldFile={name:'world.json',content:''};current.files.push(worldFile)}
 if(!/^const SCENE=.*;$/m.test(mainFile.content))throw Error('No se encontró el contrato SCENE en main.js');
 sceneFile.content=sceneJson;worldFile.content=worldJson;mainFile.content=mainFile.content.replace(/^const SCENE=.*;$/m,'const SCENE='+JSON.stringify(clean)+';');current.updatedAt=new Date().toISOString();
 if(!persist())throw Error('No se pudo persistir el mundo');if(['scene.json','world.json','main.js'].includes(selected))$('#wfEditor').value=file()?.content||'';renderFiles();diagnostics();notify('Mundo Game Studio v8 guardado en world.json, scene.json y main.js');return true;
}
function normalizeLogicV9(raw){
 if(!raw||typeof raw!=='object'||raw.schema!=='wae-logic/v9'||!Array.isArray(raw.rules)||raw.rules.length<1||raw.rules.length>120)throw Error('Logic Builder v9 inválido');
 const clean=JSON.parse(JSON.stringify(raw)),validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value);
 const eventTypes=new Set(['scene_enter','trigger_enter','score_changed','mission_completed','timer']);
 const conditionTypes=new Set(['always','score_gte','visited_scenes_gte','mission_status','scene_is']);
 const actionTypes=new Set(['message','scene','spawn_prefab','mission_complete','score_add','lighting']);
 const ids=new Set();
 for(const rule of clean.rules){
  if(!rule||typeof rule!=='object'||!validId(rule.id)||ids.has(rule.id))throw Error('Regla lógica inválida o duplicada');
  ids.add(rule.id);rule.name=String(rule.name||rule.id).slice(0,80);rule.enabled=rule.enabled!==false;rule.once=Boolean(rule.once);
  if(!rule.event||!eventTypes.has(rule.event.type))throw Error('Evento lógico no permitido');
  const event={type:rule.event.type};
  if(event.type==='scene_enter')event.sceneId=String(rule.event.sceneId||'').slice(0,60);
  if(event.type==='trigger_enter')event.triggerId=String(rule.event.triggerId||'').slice(0,60);
  if(event.type==='mission_completed')event.missionId=String(rule.event.missionId||'').slice(0,60);
  if(event.type==='timer')event.seconds=Math.max(.2,Math.min(3600,Number(rule.event.seconds)||1));
  rule.event=event;
  if(!Array.isArray(rule.conditions)||rule.conditions.length<1||rule.conditions.length>8)throw Error('Condiciones lógicas inválidas');
  rule.conditions=rule.conditions.map(condition=>{
   const type=conditionTypes.has(condition?.type)?condition.type:'always';
   if(type==='always')return{type};
   if(type==='score_gte'||type==='visited_scenes_gte')return{type,value:Math.max(0,Math.min(999999,Number(condition?.value)||0))};
   if(type==='mission_status')return{type,status:String(condition?.status||'completed').slice(0,30)};
   return{type,sceneId:String(condition?.sceneId||'').slice(0,60)};
  });
  if(!Array.isArray(rule.actions)||rule.actions.length<1||rule.actions.length>12)throw Error('Acciones lógicas inválidas');
  rule.actions=rule.actions.map(action=>{
   const type=actionTypes.has(action?.type)?action.type:'message';
   if(type==='message')return{type,text:String(action?.text||'').slice(0,160)};
   if(type==='scene')return{type,target:String(action?.target||'').slice(0,60)};
   if(type==='spawn_prefab')return{type,prefab:String(action?.prefab||'').slice(0,60)};
   if(type==='mission_complete')return{type,missionId:String(action?.missionId||'').slice(0,60)};
   if(type==='score_add')return{type,value:Math.max(-99999,Math.min(99999,Number(action?.value)||0))};
   return{type,ambient:Math.max(.2,Math.min(1.4,Number(action?.ambient)||.8))};
  });
 }
 clean.version=9;
 if(JSON.stringify(clean).length>120000)throw Error('La lógica supera el límite de 120 KB');
 return clean;
}
function persistLogicStudioV9(raw){
 saveEditor();
 const logic=normalizeLogicV9(raw),logicJson=JSON.stringify(logic,null,2);
 const mainFile=current.files.find(f=>f.name==='main.js');let logicFile=current.files.find(f=>f.name==='logic.json');
 if(!mainFile)throw Error('El proyecto no contiene main.js');
 if(!logicFile){if(current.files.length>=MAX_FILES)throw Error('No hay espacio para logic.json');logicFile={name:'logic.json',content:''};current.files.push(logicFile)}
 if(!/^const LOGIC=.*;$/m.test(mainFile.content))throw Error('No se encontró el contrato LOGIC en main.js');
 logicFile.content=logicJson;
 mainFile.content=mainFile.content.replace(/^const LOGIC=.*;$/m,'const LOGIC='+JSON.stringify(logic)+';');
 current.updatedAt=new Date().toISOString();
 if(!persist())throw Error('No se pudo persistir la lógica');
 if(['logic.json','main.js'].includes(selected))$('#wfEditor').value=file()?.content||'';
 renderFiles();diagnostics();notify('Gameplay Logic v9 guardado en logic.json y main.js');return true;
}
function normalizeLogicV10(raw){
 if(!raw||typeof raw!=='object'||raw.schema!=='wae-logic/v10'||!Array.isArray(raw.rules)||raw.rules.length<1||raw.rules.length>140)throw Error('Logic Builder v10 inválido');
 const clean=JSON.parse(JSON.stringify(raw)),validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value);
 const eventTypes=new Set(['scene_enter','trigger_enter','score_changed','mission_completed','timer','npc_interact','npc_state_changed','npc_goal_completed']);
 const conditionTypes=new Set(['always','score_gte','visited_scenes_gte','mission_status','scene_is']);
 const actionTypes=new Set(['message','scene','spawn_prefab','mission_complete','score_add','lighting','npc_set_state','npc_say']);
 const npcStates=new Set(['idle','patrol','chase','interact']),ids=new Set();
 for(const rule of clean.rules){
  if(!rule||typeof rule!=='object'||!validId(rule.id)||ids.has(rule.id))throw Error('Regla lógica v10 inválida o duplicada');
  ids.add(rule.id);rule.name=String(rule.name||rule.id).slice(0,80);rule.enabled=rule.enabled!==false;rule.once=Boolean(rule.once);
  if(!rule.event||!eventTypes.has(rule.event.type))throw Error('Evento lógico v10 no permitido');
  const event={type:rule.event.type};
  if(event.type==='scene_enter')event.sceneId=String(rule.event.sceneId||'').slice(0,60);
  if(event.type==='trigger_enter')event.triggerId=String(rule.event.triggerId||'').slice(0,60);
  if(event.type==='mission_completed')event.missionId=String(rule.event.missionId||'').slice(0,60);
  if(event.type==='timer')event.seconds=Math.max(.2,Math.min(3600,Number(rule.event.seconds)||1));
  if(['npc_interact','npc_state_changed','npc_goal_completed'].includes(event.type)){event.npcId=String(rule.event.npcId||'').slice(0,60);if(event.type==='npc_state_changed'&&rule.event.state)event.state=npcStates.has(rule.event.state)?rule.event.state:'idle'}
  rule.event=event;
  if(!Array.isArray(rule.conditions)||rule.conditions.length<1||rule.conditions.length>8)throw Error('Condiciones lógicas v10 inválidas');
  rule.conditions=rule.conditions.map(condition=>{
   const type=conditionTypes.has(condition?.type)?condition.type:'always';
   if(type==='always')return{type};
   if(type==='score_gte'||type==='visited_scenes_gte')return{type,value:Math.max(0,Math.min(999999,Number(condition?.value)||0))};
   if(type==='mission_status')return{type,status:String(condition?.status||'completed').slice(0,30)};
   return{type,sceneId:String(condition?.sceneId||'').slice(0,60)};
  });
  if(!Array.isArray(rule.actions)||rule.actions.length<1||rule.actions.length>12)throw Error('Acciones lógicas v10 inválidas');
  rule.actions=rule.actions.map(action=>{
   const type=actionTypes.has(action?.type)?action.type:'message';
   if(type==='message')return{type,text:String(action?.text||'').slice(0,160)};
   if(type==='scene')return{type,target:String(action?.target||'').slice(0,60)};
   if(type==='spawn_prefab')return{type,prefab:String(action?.prefab||'').slice(0,60)};
   if(type==='mission_complete')return{type,missionId:String(action?.missionId||'').slice(0,60)};
   if(type==='score_add')return{type,value:Math.max(-99999,Math.min(99999,Number(action?.value)||0))};
   if(type==='lighting')return{type,ambient:Math.max(.2,Math.min(1.4,Number(action?.ambient)||.8))};
   if(type==='npc_set_state')return{type,npcId:String(action?.npcId||'').slice(0,60),state:npcStates.has(action?.state)?action.state:'idle'};
   return{type,npcId:String(action?.npcId||'').slice(0,60),text:String(action?.text||'').slice(0,160)};
  });
 }
 clean.version=10;
 if(JSON.stringify(clean).length>140000)throw Error('La lógica v10 supera el límite de 140 KB');
 return clean;
}
function persistLogicStudioV10(raw){
 saveEditor();
 const logic=normalizeLogicV10(raw),logicJson=JSON.stringify(logic,null,2);
 const mainFile=current.files.find(f=>f.name==='main.js');let logicFile=current.files.find(f=>f.name==='logic.json');
 if(!mainFile)throw Error('El proyecto no contiene main.js');
 if(!logicFile){if(current.files.length>=MAX_FILES)throw Error('No hay espacio para logic.json');logicFile={name:'logic.json',content:''};current.files.push(logicFile)}
 if(!/^const LOGIC=.*;$/m.test(mainFile.content))throw Error('No se encontró el contrato LOGIC en main.js');
 logicFile.content=logicJson;mainFile.content=mainFile.content.replace(/^const LOGIC=.*;$/m,'const LOGIC='+JSON.stringify(logic)+';');current.updatedAt=new Date().toISOString();
 if(!persist())throw Error('No se pudo persistir la lógica v10');if(['logic.json','main.js'].includes(selected))$('#wfEditor').value=file()?.content||'';renderFiles();diagnostics();notify('Gameplay Logic v10 guardado en logic.json y main.js');return true;
}
function normalizeNpcV10(raw){
 if(!raw||typeof raw!=='object'||raw.schema!=='wae-npc/v10'||!raw.factions||typeof raw.factions!=='object'||!Array.isArray(raw.characters)||raw.characters.length<1||raw.characters.length>120)throw Error('NPC Engine v10 inválido');
 const clean=JSON.parse(JSON.stringify(raw)),validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value),finite3=value=>Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(Number(n)));
 const states=new Set(['idle','patrol','chase','interact']),attitudes=new Set(['friendly','neutral','hostile']),factionIds=new Set();
 const worldFile=current.files.find(f=>f.name==='world.json');let scenes=new Set();
 try{const world=JSON.parse(worldFile?.content||'{}');scenes=new Set((world.scenes||[]).map(scene=>scene.id))}catch{}
 for(const [id,faction] of Object.entries(clean.factions)){
  if(!validId(id)||factionIds.has(id)||!faction||!attitudes.has(faction.attitude))throw Error('Facción NPC inválida');
  factionIds.add(id);faction.label=String(faction.label||id).slice(0,60);faction.material=String(faction.material||'npcNeutral').slice(0,40);
 }
 if(factionIds.size<1||factionIds.size>20)throw Error('Cantidad de facciones inválida');
 const ids=new Set();
 for(const npc of clean.characters){
  if(!npc||!validId(npc.id)||ids.has(npc.id)||!factionIds.has(npc.faction)||!states.has(npc.state))throw Error('NPC inválido o duplicado');
  ids.add(npc.id);npc.name=String(npc.name||npc.id).slice(0,80);npc.sceneId=String(npc.sceneId||'').slice(0,60);if(scenes.size&&!scenes.has(npc.sceneId))throw Error('NPC apunta a escena inexistente');
  if(!finite3(npc.position))throw Error('Posición NPC inválida');npc.position=npc.position.map(n=>Math.max(-100,Math.min(100,Number(n))));
  npc.rotation=Math.max(-Math.PI*8,Math.min(Math.PI*8,Number(npc.rotation)||0));npc.patrolIndex=Math.max(0,Math.floor(Number(npc.patrolIndex)||0));
  if(!npc.behavior||typeof npc.behavior!=='object'||!states.has(npc.behavior.defaultState))throw Error('Comportamiento NPC inválido');
  npc.behavior.moveSpeed=Math.max(.1,Math.min(10,Number(npc.behavior.moveSpeed)||1));npc.behavior.chaseSpeed=Math.max(.1,Math.min(15,Number(npc.behavior.chaseSpeed)||2));npc.behavior.perceptionRadius=Math.max(.5,Math.min(30,Number(npc.behavior.perceptionRadius)||4));npc.behavior.interactionRadius=Math.max(.5,Math.min(10,Number(npc.behavior.interactionRadius)||2));
  if(!Array.isArray(npc.patrol)||npc.patrol.length<1||npc.patrol.length>60||npc.patrol.some(point=>!finite3(point)))throw Error('Ruta de patrulla NPC inválida');npc.patrol=npc.patrol.map(point=>point.map(n=>Math.max(-100,Math.min(100,Number(n)))));
  if(!Array.isArray(npc.dialogue)||npc.dialogue.length<1||npc.dialogue.length>20)throw Error('Diálogo NPC inválido');npc.dialogue=npc.dialogue.map((item,i)=>({id:validId(item?.id)?item.id:npc.id+'-dialogue-'+(i+1),text:String(item?.text||'').slice(0,240)}));
  if(!Array.isArray(npc.goals)||npc.goals.length<1||npc.goals.length>20)throw Error('Objetivos NPC inválidos');npc.goals=npc.goals.map((goal,i)=>({id:validId(goal?.id)?goal.id:npc.id+'-goal-'+(i+1),type:['patrol','interact','guard'].includes(goal?.type)?goal.type:'interact',label:String(goal?.label||'Objetivo').slice(0,100),status:goal?.status==='completed'?'completed':'active'}));
  npc.stats={health:Math.max(0,Math.min(100000,Number(npc.stats?.health)||100)),maxHealth:Math.max(1,Math.min(100000,Number(npc.stats?.maxHealth)||100))};
  if(npc.stats.health>npc.stats.maxHealth)npc.stats.health=npc.stats.maxHealth;
  npc.brain={type:'state_machine',states:['idle','patrol','chase','interact'],transitions:['perception','distance','interaction','goal']};
 }
 clean.version=10;
 if(JSON.stringify(clean).length>160000)throw Error('NPC Engine supera el límite de 160 KB');
 return clean;
}
function persistNpcStudioV10(raw){
 saveEditor();
 const npcs=normalizeNpcV10(raw),npcJson=JSON.stringify(npcs,null,2);
 const mainFile=current.files.find(f=>f.name==='main.js');let npcFile=current.files.find(f=>f.name==='npc.json');
 if(!mainFile)throw Error('El proyecto no contiene main.js');
 if(!npcFile){if(current.files.length>=MAX_FILES)throw Error('No hay espacio para npc.json');npcFile={name:'npc.json',content:''};current.files.push(npcFile)}
 if(!/^const NPCS=.*;$/m.test(mainFile.content))throw Error('No se encontró el contrato NPCS en main.js');
 npcFile.content=npcJson;mainFile.content=mainFile.content.replace(/^const NPCS=.*;$/m,'const NPCS='+JSON.stringify(npcs)+';');current.updatedAt=new Date().toISOString();
 if(!persist())throw Error('No se pudieron persistir los NPCs');if(['npc.json','main.js'].includes(selected))$('#wfEditor').value=file()?.content||'';renderFiles();diagnostics();notify('NPC Engine v10 guardado en npc.json y main.js');return true;
}
function normalizeLogicV11(raw){
 if(!raw||typeof raw!=='object'||raw.schema!=='wae-logic/v11'||!Array.isArray(raw.rules)||raw.rules.length<1||raw.rules.length>160)throw Error('Logic Builder v11 inválido');
 const clean=JSON.parse(JSON.stringify(raw)),validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value);
 const eventTypes=new Set(['scene_enter','trigger_enter','score_changed','mission_completed','timer','npc_interact','npc_state_changed','npc_goal_completed','player_damaged','npc_defeated','item_collected','inventory_changed','player_respawn','checkpoint_set','item_used']);
 const conditionTypes=new Set(['always','score_gte','visited_scenes_gte','mission_status','scene_is']);
 const actionTypes=new Set(['message','scene','spawn_prefab','mission_complete','score_add','lighting','npc_set_state','npc_say','heal_player','give_item','set_checkpoint']);
 const npcStates=new Set(['idle','patrol','chase','interact']),ids=new Set();
 for(const rule of clean.rules){
  if(!rule||typeof rule!=='object'||!validId(rule.id)||ids.has(rule.id))throw Error('Regla lógica v11 inválida o duplicada');
  ids.add(rule.id);rule.name=String(rule.name||rule.id).slice(0,80);rule.enabled=rule.enabled!==false;rule.once=Boolean(rule.once);
  if(!rule.event||!eventTypes.has(rule.event.type))throw Error('Evento lógico v11 no permitido');
  const event={type:rule.event.type};
  if(event.type==='scene_enter')event.sceneId=String(rule.event.sceneId||'').slice(0,60);
  if(event.type==='trigger_enter')event.triggerId=String(rule.event.triggerId||'').slice(0,60);
  if(event.type==='mission_completed')event.missionId=String(rule.event.missionId||'').slice(0,60);
  if(event.type==='timer')event.seconds=Math.max(.2,Math.min(3600,Number(rule.event.seconds)||1));
  if(['npc_interact','npc_state_changed','npc_goal_completed','npc_defeated'].includes(event.type)){event.npcId=String(rule.event.npcId||'').slice(0,60);if(event.type==='npc_state_changed'&&rule.event.state)event.state=npcStates.has(rule.event.state)?rule.event.state:'idle'}
  if(['item_collected','inventory_changed','item_used'].includes(event.type))event.itemId=String(rule.event.itemId||'').slice(0,60);
  rule.event=event;
  if(!Array.isArray(rule.conditions)||rule.conditions.length<1||rule.conditions.length>8)throw Error('Condiciones lógicas v11 inválidas');
  rule.conditions=rule.conditions.map(condition=>{
   const type=conditionTypes.has(condition?.type)?condition.type:'always';
   if(type==='always')return{type};
   if(type==='score_gte'||type==='visited_scenes_gte')return{type,value:Math.max(0,Math.min(999999,Number(condition?.value)||0))};
   if(type==='mission_status')return{type,status:String(condition?.status||'completed').slice(0,30)};
   return{type,sceneId:String(condition?.sceneId||'').slice(0,60)};
  });
  if(!Array.isArray(rule.actions)||rule.actions.length<1||rule.actions.length>12)throw Error('Acciones lógicas v11 inválidas');
  rule.actions=rule.actions.map(action=>{
   const type=actionTypes.has(action?.type)?action.type:'message';
   if(type==='message')return{type,text:String(action?.text||'').slice(0,160)};
   if(type==='scene')return{type,target:String(action?.target||'').slice(0,60)};
   if(type==='spawn_prefab')return{type,prefab:String(action?.prefab||'').slice(0,60)};
   if(type==='mission_complete')return{type,missionId:String(action?.missionId||'').slice(0,60)};
   if(type==='score_add')return{type,value:Math.max(-99999,Math.min(99999,Number(action?.value)||0))};
   if(type==='lighting')return{type,ambient:Math.max(.2,Math.min(1.4,Number(action?.ambient)||.8))};
   if(type==='npc_set_state')return{type,npcId:String(action?.npcId||'').slice(0,60),state:npcStates.has(action?.state)?action.state:'idle'};
   if(type==='npc_say')return{type,npcId:String(action?.npcId||'').slice(0,60),text:String(action?.text||'').slice(0,160)};
   if(type==='heal_player')return{type,value:Math.max(0,Math.min(100000,Number(action?.value)||0))};
   if(type==='give_item')return{type,itemId:String(action?.itemId||'').slice(0,60),quantity:Math.max(1,Math.min(999,Math.floor(Number(action?.quantity)||1)))};
   return{type:'set_checkpoint'};
  });
 }
 clean.version=11;
 if(JSON.stringify(clean).length>160000)throw Error('La lógica v11 supera el límite de 160 KB');
 return clean;
}
function persistLogicStudioV11(raw){
 saveEditor();
 const logic=normalizeLogicV11(raw),logicJson=JSON.stringify(logic,null,2);
 const mainFile=current.files.find(f=>f.name==='main.js');let logicFile=current.files.find(f=>f.name==='logic.json');
 if(!mainFile)throw Error('El proyecto no contiene main.js');
 if(!logicFile){if(current.files.length>=MAX_FILES)throw Error('No hay espacio para logic.json');logicFile={name:'logic.json',content:''};current.files.push(logicFile)}
 if(!/^const LOGIC=.*;$/m.test(mainFile.content))throw Error('No se encontró el contrato LOGIC en main.js');
 logicFile.content=logicJson;mainFile.content=mainFile.content.replace(/^const LOGIC=.*;$/m,'const LOGIC='+JSON.stringify(logic)+';');current.updatedAt=new Date().toISOString();
 if(!persist())throw Error('No se pudo persistir la lógica v11');if(['logic.json','main.js'].includes(selected))$('#wfEditor').value=file()?.content||'';renderFiles();diagnostics();notify('Gameplay Logic v11 guardado en logic.json y main.js');return true;
}
function normalizeCombatV11(raw){
 if(!raw||typeof raw!=='object'||raw.schema!=='wae-combat/v11'||!raw.player||!raw.items||typeof raw.items!=='object'||!Array.isArray(raw.pickups))throw Error('Combat Engine v11 inválido');
 const clean=JSON.parse(JSON.stringify(raw)),validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(value),finite3=value=>Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(Number(n)));
 const worldFile=current.files.find(f=>f.name==='world.json');const npcFile=current.files.find(f=>f.name==='npc.json');let scenes=new Set(),npcIds=new Set();
 try{const world=JSON.parse(worldFile?.content||'{}');scenes=new Set((world.scenes||[]).map(scene=>scene.id))}catch{}
 try{const npcs=JSON.parse(npcFile?.content||'{}');npcIds=new Set((npcs.characters||[]).map(npc=>npc.id))}catch{}
 const p=clean.player;
 p.maxHealth=Math.max(1,Math.min(100000,Number(p.maxHealth)||100));p.health=Math.max(0,Math.min(p.maxHealth,Number(p.health)||p.maxHealth));
 p.maxStamina=Math.max(1,Math.min(100000,Number(p.maxStamina)||100));p.stamina=Math.max(0,Math.min(p.maxStamina,Number(p.stamina)||p.maxStamina));
 p.attackDamage=Math.max(0,Math.min(100000,Number(p.attackDamage)||1));p.attackRange=Math.max(.1,Math.min(20,Number(p.attackRange)||2));
 p.staminaCost=Math.max(0,Math.min(p.maxStamina,Number(p.staminaCost)||0));p.regenPerSecond=Math.max(0,Math.min(10000,Number(p.regenPerSecond)||0));p.inventoryCapacity=Math.max(1,Math.min(200,Math.floor(Number(p.inventoryCapacity)||12)));
 if(!p.checkpoint||!scenes.has(p.checkpoint.sceneId)||!finite3(p.checkpoint.position))throw Error('Checkpoint inválido');p.checkpoint.position=p.checkpoint.position.map(n=>Math.max(-100,Math.min(100,Number(n))));
 if(!Array.isArray(p.inventory)||p.inventory.length>100)throw Error('Inventario inválido');
 const itemIds=new Set();
 for(const [id,item] of Object.entries(clean.items)){
  if(!validId(id)||itemIds.has(id)||!item||!['consumable','resource','loot'].includes(item.type))throw Error('Item inválido');
  itemIds.add(id);item.label=String(item.label||id).slice(0,80);item.stackMax=Math.max(1,Math.min(999,Math.floor(Number(item.stackMax)||1)));item.material=String(item.material||'itemLoot').slice(0,40);
  item.effect={heal:Math.max(0,Math.min(100000,Number(item.effect?.heal)||0)),stamina:Math.max(0,Math.min(100000,Number(item.effect?.stamina)||0))};
 }
 p.inventory=p.inventory.map(entry=>{if(!itemIds.has(entry?.itemId))throw Error('Inventario referencia item inexistente');return{itemId:entry.itemId,quantity:Math.max(0,Math.min(999,Math.floor(Number(entry.quantity)||0)))}}).filter(entry=>entry.quantity>0);
 if(clean.pickups.length>300)throw Error('Demasiados pickups');
 const pickupIds=new Set();
 clean.pickups=clean.pickups.map(pickup=>{if(!pickup||!validId(pickup.id)||pickupIds.has(pickup.id)||!scenes.has(pickup.sceneId)||!itemIds.has(pickup.itemId)||!finite3(pickup.position))throw Error('Pickup inválido');pickupIds.add(pickup.id);return{id:pickup.id,sceneId:pickup.sceneId,itemId:pickup.itemId,quantity:Math.max(1,Math.min(999,Math.floor(Number(pickup.quantity)||1))),position:pickup.position.map(n=>Math.max(-100,Math.min(100,Number(n)))),collected:Boolean(pickup.collected)}}); 
 if(!clean.lootTables||typeof clean.lootTables!=='object'||Object.keys(clean.lootTables).length>50)throw Error('Loot tables inválidas');
 for(const [id,rows] of Object.entries(clean.lootTables)){if(!validId(id)||!Array.isArray(rows)||rows.length>30)throw Error('Loot table inválida');clean.lootTables[id]=rows.map(row=>{if(!itemIds.has(row?.itemId))throw Error('Loot referencia item inexistente');return{itemId:row.itemId,min:Math.max(1,Math.min(999,Math.floor(Number(row.min)||1))),max:Math.max(1,Math.min(999,Math.floor(Number(row.max)||1)))}})}
 if(!clean.npcCombat||typeof clean.npcCombat!=='object'||Object.keys(clean.npcCombat).length>120)throw Error('Combate NPC inválido');
 for(const [npcId,profile] of Object.entries(clean.npcCombat)){if(npcIds.size&&!npcIds.has(npcId))throw Error('Combate referencia NPC inexistente');profile.damage=Math.max(0,Math.min(100000,Number(profile.damage)||0));profile.attackRange=Math.max(.1,Math.min(20,Number(profile.attackRange)||1));profile.cooldownMs=Math.max(100,Math.min(60000,Number(profile.cooldownMs)||900));if(profile.lootTable&&!clean.lootTables[profile.lootTable])throw Error('NPC referencia loot table inexistente')}
 clean.rules={respawnDelayMs:Math.max(100,Math.min(10000,Number(clean.rules?.respawnDelayMs)||450)),pickupRadius:Math.max(.25,Math.min(10,Number(clean.rules?.pickupRadius)||1.15))};
 clean.version=11;
 if(JSON.stringify(clean).length>220000)throw Error('Combat Engine supera el límite de 220 KB');
 return clean;
}
function persistCombatStudioV11(raw){
 saveEditor();
 const combat=normalizeCombatV11(raw),combatJson=JSON.stringify(combat,null,2);
 const mainFile=current.files.find(f=>f.name==='main.js');let combatFile=current.files.find(f=>f.name==='combat.json');
 if(!mainFile)throw Error('El proyecto no contiene main.js');
 if(!combatFile){if(current.files.length>=MAX_FILES)throw Error('No hay espacio para combat.json');combatFile={name:'combat.json',content:''};current.files.push(combatFile)}
 if(!/^const COMBAT=.*;$/m.test(mainFile.content))throw Error('No se encontró el contrato COMBAT en main.js');
 combatFile.content=combatJson;mainFile.content=mainFile.content.replace(/^const COMBAT=.*;$/m,'const COMBAT='+JSON.stringify(combat)+';');current.updatedAt=new Date().toISOString();
 if(!persist())throw Error('No se pudo persistir Combat Engine');if(['combat.json','main.js'].includes(selected))$('#wfEditor').value=file()?.content||'';renderFiles();diagnostics();notify('Combat Engine v11 guardado en combat.json y main.js');return true;
}
function onPreviewMessage(event){
 const frame=$('#wfPreview');if(!frame||event.source!==frame.contentWindow)return;const data=event.data;if(!data||typeof data!=='object')return;
 if(data.type==='wae-game-studio-combat-save'&&data.studio==='wae-game-studio/v11'){
  try{persistCombatStudioV11(data.combat);frame.contentWindow?.postMessage({type:'wae-game-studio-combat-saved',ok:true,studio:'wae-game-studio/v11'},'*')}
  catch(error){notify('No se pudo guardar Combat Engine: '+String(error.message||error));frame.contentWindow?.postMessage({type:'wae-game-studio-combat-saved',ok:false,message:String(error.message||error).slice(0,160)},'*')}return;
 }
 if(data.type==='wae-game-studio-logic-save'&&data.studio==='wae-game-studio/v11'){
  try{persistLogicStudioV11(data.logic);frame.contentWindow?.postMessage({type:'wae-game-studio-logic-saved',ok:true,studio:'wae-game-studio/v11'},'*')}
  catch(error){notify('No se pudo guardar la lógica v11: '+String(error.message||error));frame.contentWindow?.postMessage({type:'wae-game-studio-logic-saved',ok:false,message:String(error.message||error).slice(0,160)},'*')}return;
 }
 if(data.type==='wae-game-studio-npc-save'&&data.studio==='wae-game-studio/v10'){
  try{persistNpcStudioV10(data.npcs);frame.contentWindow?.postMessage({type:'wae-game-studio-npc-saved',ok:true,studio:'wae-game-studio/v10'},'*')}
  catch(error){notify('No se pudieron guardar NPCs: '+String(error.message||error));frame.contentWindow?.postMessage({type:'wae-game-studio-npc-saved',ok:false,message:String(error.message||error).slice(0,160)},'*')}return;
 }
 if(data.type==='wae-game-studio-logic-save'&&data.studio==='wae-game-studio/v10'){
  try{persistLogicStudioV10(data.logic);frame.contentWindow?.postMessage({type:'wae-game-studio-logic-saved',ok:true,studio:'wae-game-studio/v10'},'*')}
  catch(error){notify('No se pudo guardar la lógica v10: '+String(error.message||error));frame.contentWindow?.postMessage({type:'wae-game-studio-logic-saved',ok:false,message:String(error.message||error).slice(0,160)},'*')}return;
 }
 if(data.type==='wae-game-studio-logic-save'&&data.studio==='wae-game-studio/v9'){
  try{persistLogicStudioV9(data.logic);frame.contentWindow?.postMessage({type:'wae-game-studio-logic-saved',ok:true,studio:'wae-game-studio/v9'},'*')}
  catch(error){notify('No se pudo guardar la lógica: '+String(error.message||error));frame.contentWindow?.postMessage({type:'wae-game-studio-logic-saved',ok:false,message:String(error.message||error).slice(0,160)},'*')}return;
 }
 if(data.type==='wae-game-studio-world-save'&&['wae-game-studio/v8','wae-game-studio/v9','wae-game-studio/v10','wae-game-studio/v11'].includes(data.studio)){
  try{persistWorldStudioV8(data.scene,data.world);frame.contentWindow?.postMessage({type:'wae-game-studio-world-saved',ok:true,studio:data.studio},'*')}
  catch(error){notify('No se pudo guardar el mundo: '+String(error.message||error));frame.contentWindow?.postMessage({type:'wae-game-studio-world-saved',ok:false,message:String(error.message||error).slice(0,160)},'*')}return;
 }
 if(data.type!=='wae-game-studio-scene-save'||data.studio!=='wae-game-studio/v7')return;
 try{persistStudioScene(data.scene);frame.contentWindow?.postMessage({type:'wae-game-studio-scene-saved',ok:true,studio:'wae-game-studio/v7'},'*')}
 catch(error){notify('No se pudo guardar la escena: '+String(error.message||error));frame.contentWindow?.postMessage({type:'wae-game-studio-scene-saved',ok:false,message:String(error.message||error).slice(0,160)},'*')}
}
function exportProject(){saveEditor();persist();download((current.name||'producto').replace(/[^\w-]+/g,'-')+'.wae-project.json',JSON.stringify({format:'wae-factory/v1',project:current},null,2),'application/json;charset=utf-8')}
function exportBundle(){saveEditor();download('index.html',bundle(),'text/html;charset=utf-8')}
function exportZip(){
 saveEditor();if(typeof window.WAEZipProject!=='function')return notify('Exportador ZIP no disponible.');
 try{
  const bytes=window.WAEZipProject(current.files),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
  const a=document.createElement('a');a.href=url;a.download=(current.name||'producto').replace(/[^\w-]+/g,'-')+'.zip';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);notify('Proyecto completo exportado como ZIP.');
 }catch(error){notify('No se pudo exportar ZIP: '+String(error.message||error))}
}
function exportFile(){saveEditor();const f=file();if(f)download(f.name.split('/').pop(),f.content)}
function selectFile(name){saveEditor();selected=name;renderFiles();$('#wfEditor').value=file()?.content||'';$('#wfCurrentFile').textContent=name}
function renderFiles(){const box=$('#wfFiles');box.replaceChildren();current.files.forEach(f=>{const b=document.createElement('button');b.type='button';b.className='wf-file'+(f.name===selected?' active':'');b.textContent=f.name;b.addEventListener('click',()=>selectFile(f.name));box.appendChild(b)})}
function announceProjectChange(){document.dispatchEvent(new CustomEvent('wae:factory-project-changed',{detail:{id:current.id}}))}
function render(){const picker=$('#wfProjects');picker.replaceChildren();projects.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;picker.appendChild(o)});picker.value=current.id;renderFiles();$('#wfEditor').value=file()?.content||'';$('#wfCurrentFile').textContent=selected;$('#wfDiagnostics').textContent='Ejecuta una auditoría de estructura o abre la vista previa.'}
function addFile(){const raw=$('#wfNewFile').value.trim();if(!validName(raw)||current.files.some(f=>f.name===raw)||current.files.length>=MAX_FILES)return notify('Nombre inválido, duplicado o límite de archivos');saveEditor();current.files.push({name:raw,content:''});$('#wfNewFile').value='';selected=raw;persist();render()}
function removeFile(){if(current.files.length===1)return notify('El proyecto debe conservar al menos un archivo');if(!confirm('¿Eliminar '+selected+' de este proyecto?'))return;current.files=current.files.filter(f=>f.name!==selected);selected=current.files[0].name;persist();render()}
function importProject(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;if(f.size>2000000)return notify('El archivo excede 2 MB');f.text().then(text=>{const data=JSON.parse(text);if(data.format!=='wae-factory/v1')throw Error('Formato no admitido');const p=cleanProject(data.project);p.id=id();projects.unshift(p);projects=projects.slice(0,25);current=p;selected=p.files[0].name;persist();render();preview();announceProjectChange();notify('Proyecto importado')}).catch(()=>notify('No se pudo importar: revisa el formato'))}
function importCanvas(){const html=$('#htmlEditor')?.value||'';if(!/^\s*<!doctype\s+html/i.test(html))return notify('El Canvas actual debe contener HTML5 completo');if(!confirm('Se creará un nuevo proyecto con el HTML actual. ¿Continuar?'))return;saveEditor();const next=createProject('Canvas importado');next.files.find(f=>f.name==='index.html').content=html;next.files.find(f=>f.name==='styles.css').content='';next.files.find(f=>f.name==='main.js').content='';projects.unshift(next);projects=projects.slice(0,25);current=next;selected='index.html';persist();render();preview();announceProjectChange();notify('Canvas importado como proyecto independiente')}
function sendToCanvas(){saveEditor();const html=bundle();if(typeof window.WAECanvasCommit!=='function')return notify('Canvas no disponible');if(!confirm('¿Enviar este HTML al Canvas principal? Se conservará su historial de Deshacer.'))return;window.WAECanvasCommit(html,'Producto enviado desde la Fábrica.');notify('Producto enviado al Canvas principal')}
function snapshot(){saveEditor();return{id:current.id,name:current.name,html:bundle(),files:current.files.map(f=>({...f}))}}
const REVISIONS='wae.render.factory.revisions.v3';
function previousForProject(){try{return JSON.parse(localStorage.getItem(REVISIONS)||'{}')[current.id]||[]}catch{return[]}}
function commitGenerated(html,expected){
  saveEditor();
  if(!expected||current.id!==expected.id||bundle()!==expected.html)return{ok:false,error:'El proyecto cambió durante la generación. No sobrescribí tus archivos.'};
  if(typeof html!=='string'||html.length>LIMIT||!/^\s*<!doctype\s+html/i.test(html)||!/<\/html>\s*$/i.test(html))return{ok:false,error:'La generación no contiene un HTML5 válido dentro del límite.'};
  const before=current.files.map(f=>({...f}));
  const target=current.files.find(f=>f.name==='index.html');
  if(!target)return{ok:false,error:'Falta index.html en el proyecto.'};
  const css=current.files.find(f=>f.name==='styles.css');
  const js=current.files.find(f=>f.name==='main.js');
  const savedRevisions=localStorage.getItem(REVISIONS);
  try{
    const all=JSON.parse(savedRevisions||'{}');
    const history=Array.isArray(all[current.id])?all[current.id]:[];
    all[current.id]=history.concat([{date:new Date().toISOString(),files:before}]).slice(-4);
    localStorage.setItem(REVISIONS,JSON.stringify(all));
    target.content=html;
    if(css)css.content='';
    if(js)js.content='';
    selected='index.html';
    if(!persist())throw Error('No hay espacio disponible para guardar el nuevo producto.');
    const verify=JSON.parse(localStorage.getItem(KEY)||'[]').find(p=>p.id===current.id);
    if(verify?.files.find(f=>f.name==='index.html')?.content!==html)throw Error('No se pudo verificar el guardado del nuevo producto.');
    render();preview();return{ok:true};
  }catch(error){
    current.files=before;
    if(savedRevisions===null)localStorage.removeItem(REVISIONS);else localStorage.setItem(REVISIONS,savedRevisions);
    persist();render();preview();return{ok:false,error:String(error.message||error)}
  }
}
function commitProject(nextFiles,expected){
  saveEditor();
  if(!expected||current.id!==expected.id||JSON.stringify(current.files)!==JSON.stringify(expected.files))
    return{ok:false,error:'El proyecto cambió durante la construcción. No sobrescribí archivos.'};
  if(!Array.isArray(nextFiles)||nextFiles.length<5||nextFiles.length>20)
    return{ok:false,error:'La Fábrica v5 no devolvió un paquete fuente completo de 5 a 20 archivos.'};
  const names=new Set(),required=['index.html','styles.css','main.js','README.md','wae-product.json'];
  let total=0;
  for(const f of nextFiles){
    if(!f||typeof f.name!=='string'||typeof f.content!=='string'||!validName(f.name)||f.content.length>120000||names.has(f.name))
      return{ok:false,error:'El constructor devolvió rutas o archivos inválidos.'};
    names.add(f.name);total+=f.content.length;
  }
  if(total>280000||required.some(name=>!names.has(name)))
    return{ok:false,error:'La Fábrica v5 devolvió un paquete demasiado grande o incompleto.'};
  try{const manifest=JSON.parse(nextFiles.find(f=>f.name==='wae-product.json').content);if(manifest?.schema!=='wae-product/v5'||!manifest?.profile)throw Error()}catch{return{ok:false,error:'El manifiesto wae-product.json es inválido.'}}
  const before=current.files.map(f=>({...f}));
  const previousSelected=selected,oldProjects=localStorage.getItem(KEY),oldRevisions=localStorage.getItem(REVISIONS);
  try{
    const history=JSON.parse(oldRevisions||'{}');
    const stack=Array.isArray(history[current.id])?history[current.id]:[];
    history[current.id]=stack.concat([{date:new Date().toISOString(),files:before}]).slice(-4);
    localStorage.setItem(REVISIONS,JSON.stringify(history));
    current.files=nextFiles.map(f=>({name:f.name,content:f.content}));
    selected='index.html';
    if(!persist())throw Error('No se pudo guardar el nuevo proyecto por falta de espacio.');
    const verified=JSON.parse(localStorage.getItem(KEY)||'[]').find(p=>p.id===current.id);
    if(JSON.stringify(verified?.files)!==JSON.stringify(current.files))throw Error('Falló la verificación del guardado.');
    render();preview();return{ok:true};
  }catch(error){
    current.files=before;selected=previousSelected;
    try{
      if(oldProjects===null)localStorage.removeItem(KEY);else localStorage.setItem(KEY,oldProjects);
      if(oldRevisions===null)localStorage.removeItem(REVISIONS);else localStorage.setItem(REVISIONS,oldRevisions);
    }catch{}
    render();preview();return{ok:false,error:String(error.message||error)};
  }
}
function restorePrevious(){
  const history=previousForProject();if(!history.length)return{ok:false,error:'No hay una versión previa.'};
  saveEditor();
  const previous=history[history.length-1];
  if(!previous||!Array.isArray(previous.files))return{ok:false,error:'Versión previa inválida.'};
  const before=current.files.map(f=>({...f})),original=localStorage.getItem(REVISIONS);
  try{
    const all=JSON.parse(original||'{}');all[current.id]=history.slice(0,-1);localStorage.setItem(REVISIONS,JSON.stringify(all));
    current.files=previous.files.map(f=>({...f}));selected=current.files[0].name;
    if(!persist())throw Error('No se pudo restaurar por falta de almacenamiento.');
    render();preview();return{ok:true};
  }catch(e){current.files=before;if(original!==null)localStorage.setItem(REVISIONS,original);persist();return{ok:false,error:String(e.message||e)}}
}
function insertResponse(){const answers=Array.from(document.querySelectorAll('#messages .message.assistant,#messages .turn.assistant'));const last=answers.at(-1);const text=last?.querySelector('.rich-answer,.assistant-body,.rich-content')?.textContent||'';if(!text.trim())return notify('No existe una respuesta de IA para insertar');const editor=$('#wfEditor');editor.setRangeText(text,editor.selectionStart,editor.selectionEnd,'end');saveEditor();notify('Respuesta insertada; revisa el código antes de ejecutarlo')}
function onExport(e){if(!root||!$('.workspace-tabs [data-tab="factory"].active'))return;e.stopImmediatePropagation();exportProject()}
function onSave(e){if(!root||!$('.workspace-tabs [data-tab="factory"].active'))return;e.stopImmediatePropagation();save()}
function init(){
const workspace=$('#workspace'),tabs=$('.workspace-tabs'),body=$('.workspace-body');if(!workspace||!tabs||!body)return;
const tab=document.createElement('button');tab.type='button';tab.dataset.tab='factory';tab.textContent='⚒ Fábrica';tabs.appendChild(tab);
root=document.createElement('section');root.id='panel-factory';root.className='tab-panel wf-panel';
root.innerHTML='<div class="wf-head"><div><strong>WAE · Digital Product Foundry</strong><small>Juegos 3D · Apps · Web · PWA · API · Automatización · Código fuente exportable</small></div><select id="wfProjects" aria-label="Proyecto activo"></select><button id="wfNewProject" type="button">＋ Proyecto</button></div><div class="wf-toolbar"><input id="wfNewFile" placeholder="archivo.js" aria-label="Nombre de archivo"><button id="wfAddFile" type="button">＋ Archivo</button><button id="wfRemoveFile" type="button">Eliminar archivo</button><button id="wfImportCanvas" type="button">Importar Canvas</button><button id="wfSendCanvas" type="button">Enviar al Canvas</button><button id="wfInsertResponse" type="button">Insertar respuesta</button><button id="wfAudit" type="button">Auditar</button><button id="wfRun" type="button">▶ Previsualizar</button></div><div class="wf-body"><nav id="wfFiles" aria-label="Archivos del proyecto"></nav><div class="wf-code"><div class="wf-label" id="wfCurrentFile"></div><textarea id="wfEditor" spellcheck="false" aria-label="Editor de código"></textarea></div><div class="wf-preview"><div class="wf-label">Vista previa aislada</div><iframe id="wfPreview" title="Vista previa del producto" sandbox="allow-scripts"></iframe></div></div><div class="wf-footer"><pre id="wfDiagnostics" aria-live="polite"></pre><div class="wf-export"><button id="wfExportFile" type="button">Archivo</button><button id="wfExportHTML" type="button">HTML ejecutable</button><button id="wfExportZIP" type="button">ZIP completo</button><button id="wfExportProject" type="button">Proyecto JSON</button><button id="wfImport" type="button">Importar proyecto</button><input id="wfImportFile" type="file" accept=".json,application/json" hidden></div></div>';
body.appendChild(root);load();render();window.addEventListener('message',onPreviewMessage);
tab.addEventListener('click',()=>{tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===tab));body.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p===root));preview()});
$('#wfProjects').addEventListener('change',e=>{save();current=projects.find(p=>p.id===e.target.value)||current;selected=current.files[0].name;persist();render();preview();announceProjectChange()});
$('#wfNewProject').addEventListener('click',()=>{const name=prompt('Nombre del producto digital');if(!name?.trim())return;save();current=createProject(name.trim().slice(0,80));projects.unshift(current);projects=projects.slice(0,25);selected='index.html';persist();render();preview();announceProjectChange()});
$('#wfEditor').addEventListener('input',()=>{saveEditor();clearTimeout(timer);timer=setTimeout(persist,800)});
$('#wfAddFile').addEventListener('click',addFile);$('#wfRemoveFile').addEventListener('click',removeFile);
$('#wfImportCanvas').addEventListener('click',importCanvas);$('#wfSendCanvas').addEventListener('click',sendToCanvas);$('#wfInsertResponse').addEventListener('click',insertResponse);$('#wfRun').addEventListener('click',preview);$('#wfAudit').addEventListener('click',diagnostics);
$('#wfExportFile').addEventListener('click',exportFile);$('#wfExportHTML').addEventListener('click',exportBundle);$('#wfExportZIP').addEventListener('click',exportZip);$('#wfExportProject').addEventListener('click',exportProject);
$('#wfImport').addEventListener('click',()=>$('#wfImportFile').click());$('#wfImportFile').addEventListener('change',importProject);
$('#exportBtn')?.addEventListener('click',onExport,true);$('#saveBtn')?.addEventListener('click',onSave,true);
window.__waeFactoryV1={version:'5',save,preview,diagnostics,exportProject,exportZip,snapshot,commitGenerated,commitProject,restorePrevious};if(new URLSearchParams(location.search).get('wae_factory')==='1'){setTimeout(()=>{$('#workspaceBtn')?.click();tab.click()},80)}}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();