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
 if(!sceneRaw||typeof sceneRaw!=='object'||sceneRaw.engine!=='wae-game-studio/v8')throw Error('Escena Game Studio v8 inválida');
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
function onPreviewMessage(event){
 const frame=$('#wfPreview');if(!frame||event.source!==frame.contentWindow)return;const data=event.data;if(!data||typeof data!=='object')return;
 if(data.type==='wae-game-studio-world-save'&&data.studio==='wae-game-studio/v8'){
  try{persistWorldStudioV8(data.scene,data.world);frame.contentWindow?.postMessage({type:'wae-game-studio-world-saved',ok:true,studio:'wae-game-studio/v8'},'*')}
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