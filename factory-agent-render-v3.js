/* Universal Core Render · conversational product agent v3. Builds only through real /api/canvas. */
(()=>{
'use strict';
if(window.__waeFactoryAgentV5)return;
const $=s=>document.querySelector(s);
const KEY='wae.render.factory.agent.v5', MAX_MESSAGE=900, MAX_TURNS=20;
let store={},busy=false,lastId='',form,feed,entry,send,status,root;
const factory=()=>window.__waeFactoryV1;
const project=()=>factory()?.snapshot();
function load(){
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}');store=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}}catch{store={}}
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(store));return true}
  catch{state('El historial no pudo guardarse; exporta tu proyecto.',true);return false}
}
function thread(id){
  if(!store[id]||typeof store[id]!=='object')store[id]={kind:'auto',messages:[]};
  if(!Array.isArray(store[id].messages))store[id].messages=[];
  return store[id];
}
function state(message,error=false){
  if(!status)return;status.textContent=message;status.dataset.error=error?'true':'false';
}
function bubble(role,text){
  const outer=document.createElement('div');
  outer.className='wf-agent-message '+(role==='user'?'user':'assistant');
  const small=document.createElement('small');small.textContent=role==='user'?'Tú':'Universal Core · Constructor';
  const body=document.createElement('p');body.textContent=text;
  outer.append(small,body);feed.append(outer);feed.scrollTop=feed.scrollHeight;
}
function renderMessages(){
  const p=project();if(!p)return;
  lastId=p.id;feed.replaceChildren();
  const t=thread(p.id);
  const picker=$('#wfProductType');if(picker&&Array.from(picker.options).some(o=>o.value===(t.kind||'auto')))picker.value=t.kind||'auto';
  if(!t.messages.length){
    bubble('assistant','Dime qué quieres fabricar. Puedo construir juegos 3D/2D, simulaciones, apps web/PWA, herramientas, dashboards y paquetes fuente para móvil, escritorio, APIs o automatizaciones. La vista previa ejecuta targets web; los binarios nativos sólo se consideran construidos cuando exista un toolchain real.');
  }else t.messages.forEach(m=>bubble(m.role,m.text));
  state('Proyecto: '+p.name+' · Los cambios se guardan en este dispositivo.');
}
function remember(role,text){
  const p=project();if(!p)return;
  const t=thread(p.id);
  t.messages.push({role,text:String(text).slice(0,MAX_MESSAGE)});
  t.messages=t.messages.slice(-MAX_TURNS);save();
  if(lastId!==p.id)renderMessages();else bubble(role,String(text).slice(0,MAX_MESSAGE));
}
function isStarter(p){
  const html=p.files.find(f=>f.name==='index.html')?.content||'';
  return html.includes('Tu producto comienza aquí')&&html.includes('Construye, prueba y exporta.');
}
async function build(){
  if(busy)return;
  const instruction=entry.value.trim();
  if(instruction.length<8){state('Describe lo que quieres crear o cambiar, con al menos ocho caracteres.',true);entry.focus();return}
  if(instruction.length>2100){state('El mensaje supera 2 100 caracteres. Divide el encargo en pasos.',true);return}
  const snapshot=project();
  if(!snapshot){state('No encuentro el proyecto. Vuelve a abrir la Fábrica.',true);return}
  const t=thread(snapshot.id);
  const refining=!isStarter(snapshot);
  const multiFile=$('#wfAgentEngine')?.value!=='html';
  const selectedKind=$('#wfProductType')?.value||t.kind||'auto';
  const priorGoals=t.messages.filter(m=>m.role==='user').slice(-5).map(m=>m.text).filter(Boolean);
  const mission=(priorGoals.length>0?('Contexto acumulado del proyecto (conserva requisitos compatibles):\n- '+priorGoals.join('\n- ')+'\n\nCambio solicitado ahora:\n'+instruction):instruction).slice(0,3400);
  if(refining&&snapshot.files.reduce((n,f)=>n+String(f.content||'').length,0)>150000){state('El proyecto supera 150 KB de contexto editable. Exporta una copia o reduce el paquete antes de pedir una revisión IA.',true);return}
  busy=true;send.disabled=true;send.textContent='Construyendo…';entry.disabled=true;['#wfProjects','#wfNewProject','#wfImportCanvas','#wfAgentEngine','#wfProductType'].forEach(q=>{const el=$(q);if(el)el.disabled=true});
  entry.value='';remember('user',instruction);
  state(multiFile&&['game_3d','simulation_3d'].includes(selectedKind)?'Game Studio v13 → mundo → personajes → rig → animaciones → quests → diálogo → save/load → QA…':multiFile?'Arquitectura → archivos → auditoría → guardado…':refining?'Analizando contexto → especialistas → construcción → QA…':'Definiendo producto → especialistas → construcción → QA…');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),115000);
  try{
    const res=await fetch(multiFile?'/api/factory-project':'/api/canvas',{
      method:'POST',credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(multiFile
        ?{request:mission,kind:selectedKind,files:refining?snapshot.files:[]}
         :{request:mission,baseHtml:refining?snapshot.html:''}),
      signal:controller.signal
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.quality?.structural!=='passed'||(multiFile?!Array.isArray(data.project?.files):typeof data.html!=='string')){
      throw Error(data.message||data.error||'La construcción no pasó la validación estructural.');
    }
    const result=multiFile?factory().commitProject(data.project.files,snapshot):factory().commitGenerated(data.html,snapshot);
    if(!result.ok)throw Error(result.error);
    const now=thread(snapshot.id);
    now.kind=String(data.kind||selectedKind||now.kind||'auto');
    const picker=$('#wfProductType');if(picker&&Array.from(picker.options).some(o=>o.value===now.kind))picker.value=now.kind;
    save();
    const action=data.recovery?.mode==='native_game_studio'?'La ruta generativa no respondió, pero Game Studio v13 nativo recuperó la construcción y creó un producto 3D funcional.':refining?'Actualicé tu producto.':'Construí la primera versión de tu producto.';
    const detail=multiFile
      ?'Perfil: '+String(data.kind||selectedKind)+'. Plan: '+String(data.plan||'Proyecto construido').slice(0,220)+'\nArchivos guardados: '+data.project.files.length+'. Cambios: '+(data.changes||[]).map(c=>c.name).join(', ').slice(0,150)+'. Vista previa actualizada. QA estructural aprobado. Targets: '+(data.artifact?.targets||[]).join(', ')+'. Build nativo: '+String(data.quality?.nativeBuild||'not_run')+'.'
      :'QA estructural aprobado. '+(data.experts?.length||0)+' responsabilidades registradas. La vista previa ya está actualizada; comprueba los botones y el contenido antes de publicarlo.';
    remember('assistant',action+' '+detail);
    state('Producto construido y guardado. Puedes pedirme otro cambio.');
  }catch(error){
    const message=error?.name==='AbortError'?'La construcción agotó el tiempo de espera.':'No pude aplicar el cambio: '+String(error.message||'Error de conexión.');
    // Keep the actual brief editable for a native retry instead of making users retype it.
    if(!entry.value.trim())entry.value=instruction;
    remember('assistant',message+' Conservé la versión anterior del producto.');
    state(message,true);
  }finally{
    clearTimeout(timeout);busy=false;send.disabled=false;send.textContent='✦ Construir';entry.disabled=false;['#wfProjects','#wfNewProject','#wfImportCanvas','#wfAgentEngine','#wfProductType'].forEach(q=>{const el=$(q);if(el)el.disabled=false});entry.focus();
  }
}
function changeProject(){
  const id=project()?.id;if(!id||id===lastId)return;renderMessages();
}
function init(){
  root=$('#panel-factory');const body=root?.querySelector('.wf-body');
  if(!root||!body||!factory()?.commitGenerated)return;
  root.classList.add('wf-agent-mode');
  const heading=root.querySelector('.wf-head small');if(heading)heading.textContent='Dile al agente qué crear · Mira el producto · Pide cambios';
  const stage=document.createElement('div');stage.className='wf-stage';
  root.insertBefore(stage,body);
  const chat=document.createElement('section');chat.className='wf-agent';
  chat.setAttribute('aria-label','Asistente constructor de productos');
  chat.innerHTML='<header class="wf-agent-top"><strong>✦ Universal Product Foundry</strong><span class="wf-studio-badge">Game Studio v13</span><label class="wf-engine-label">Producto <select id="wfProductType" aria-label="Tipo de producto"><option value="auto">Auto</option><option value="game_3d">🎮 Juego 3D · Studio v12</option><option value="simulation_3d">🧊 Simulación 3D · Studio v12</option><option value="game_2d">🕹 Juego 2D</option><option value="web_app">▣ App web</option><option value="website">◎ Sitio web</option><option value="dashboard">◫ Dashboard</option><option value="presentation">▤ Presentación</option><option value="creative_tool">✦ Herramienta creativa</option><option value="pwa">◉ PWA</option><option value="mobile_app">▯ App móvil</option><option value="desktop_app">▰ App escritorio</option><option value="api_service">⌁ API / servicio</option><option value="automation">⚙ Automatización</option></select></label><label class="wf-engine-label">Modo <select id="wfAgentEngine" aria-label="Motor de construcción"><option value="project">🧩 Foundry multifichero</option><option value="html">⚡ HTML rápido</option></select></label></header><div id="wfAgentFeed" class="wf-agent-feed" role="log" aria-live="polite"></div><div class="wf-agent-prompts"><button type="button" data-kind="game_3d" data-brief="Crea un juego 3D con World Builder, Character Controller, Animation State Machine, Asset Pipeline, Logic Builder, NPC Engine, Combat Engine y Quest System: personajes third-person, rigs, clips, prefabs, quests, diálogo, journal y save/load.">Juego 3D</button><button type="button" data-kind="simulation_3d" data-brief="Construye una simulación 3D multi-escena con World Builder, Character Controller, Animation State Machine, Asset Pipeline, Logic Builder, NPC Engine, Combat Engine y sistema de quests, decisiones, journal y partidas guardadas.">Simulación 3D</button><button type="button" data-kind="web_app" data-brief="Crea una aplicación web premium, responsive, con flujo principal funcional, estados vacíos y errores claros.">App web</button><button type="button" data-kind="mobile_app" data-brief="Crea el paquete fuente de una app móvil con preview web funcional, arquitectura documentada y pasos reales de compilación.">App móvil</button><button type="button" data-kind="api_service" data-brief="Crea un servicio API con contrato, validación, errores, documentación y una preview web de uso.">API</button></div><form id="wfAgentForm" class="wf-agent-form"><label for="wfAgentText">¿Qué construimos o mejoramos?</label><textarea id="wfAgentText" rows="3" maxlength="2100" placeholder="Ej.: Crea una app para controlar ventas de mi tienda…"></textarea><div class="wf-agent-actions"><button id="wfAgentBuild" type="submit" class="wf-agent-primary">✦ Construir</button><button id="wfAgentUndo" type="button">↶ Deshacer</button><button id="wfAgentCode" type="button" aria-pressed="false">⌘ Código</button><button id="wfAgentExport" type="button">↓ HTML</button><button id="wfAgentProject" type="button">↓ ZIP</button><button id="wfAgentPreview" type="button">◉ Vista</button><button id="wfAgentToCanvas" type="button">↗ Canvas</button><button id="wfAgentFromCanvas" type="button">↙ Importar Canvas</button></div><div id="wfAgentStatus" class="wf-agent-status" role="status"></div></form>';
  stage.append(chat,body);
  form=$('#wfAgentForm');feed=$('#wfAgentFeed');entry=$('#wfAgentText');send=$('#wfAgentBuild');status=$('#wfAgentStatus');
  load();renderMessages();
  const initialThread=thread(project()?.id||'');const typePicker=$('#wfProductType');if(typePicker&&Array.from(typePicker.options).some(o=>o.value===initialThread.kind))typePicker.value=initialThread.kind||'auto';
  form.addEventListener('submit',event=>{event.preventDefault();build()});
  entry.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();build()}});
  chat.querySelectorAll('[data-brief]').forEach(b=>b.addEventListener('click',()=>{entry.value=b.dataset.brief;const picker=$('#wfProductType');if(picker&&b.dataset.kind)picker.value=b.dataset.kind;entry.focus()}));
  $('#wfProductType')?.addEventListener('change',()=>{const p=project();if(!p)return;const t=thread(p.id);t.kind=$('#wfProductType').value;save()});
  $('#wfAgentCode').addEventListener('click',()=>{
    root.classList.toggle('wf-code-visible');const active=root.classList.contains('wf-code-visible');
    $('#wfAgentCode').setAttribute('aria-pressed',String(active));$('#wfAgentCode').textContent=active?'◉ Vista simple':'⌘ Código';
    factory().preview();
  });
  $('#wfAgentUndo').addEventListener('click',()=>{
    if(busy)return;
    const r=factory().restorePrevious();
    if(!r.ok){state(r.error,true);return}
    remember('assistant','Restauré la versión anterior de tu producto. Puedes pedirme una nueva modificación.');
    state('Versión anterior restaurada.');
  });
  $('#wfAgentExport').addEventListener('click',()=>$('#wfExportHTML')?.click());
  $('#wfAgentProject').addEventListener('click',()=>$('#wfExportZIP')?.click());
  $('#wfAgentPreview').addEventListener('click',()=>{factory().preview();$('#wfPreview')?.scrollIntoView({behavior:'smooth',block:'nearest'});});
  $('#wfAgentToCanvas').addEventListener('click',()=>{if(!busy)$('#wfSendCanvas')?.click()});
  $('#wfAgentFromCanvas').addEventListener('click',()=>{if(!busy)$('#wfImportCanvas')?.click()});
  document.addEventListener('wae:factory-project-changed',()=>{if(!busy)changeProject()});
  $('#wfProjects')?.addEventListener('change',()=>{if(!busy)changeProject()});
  $('#wfNewProject')?.addEventListener('click',()=>{if(!busy)queueMicrotask(changeProject)});
  $('#wfImportCanvas')?.addEventListener('click',()=>{if(!busy)queueMicrotask(changeProject)});
  root.addEventListener('click',event=>{if(event.target?.closest('[data-tab="factory"]'))queueMicrotask(changeProject)});
  window.__waeFactoryAgentV5={version:'5',build,changeProject};window.__waeFactoryAgentV3=window.__waeFactoryAgentV5;
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();