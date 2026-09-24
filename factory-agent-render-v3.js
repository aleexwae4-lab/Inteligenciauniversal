/* Universal Core Render · conversational product agent v3. Builds only through real /api/canvas. */
(()=>{
'use strict';
if(window.__waeFactoryAgentV3)return;
const $=s=>document.querySelector(s);
const KEY='wae.render.factory.agent.v3', MAX_MESSAGE=700, MAX_TURNS=16;
let store={},busy=false,lastId='',form,feed,entry,send,status,root,stage;
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
  if(!store[id]||typeof store[id]!=='object')store[id]={kind:'',messages:[]};
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
  if(!t.messages.length){
    bubble('assistant','Dime qué quieres construir. Crearé y modificaré los archivos reales del proyecto contigo, con vista previa y Deshacer. El modo HTML rápido sigue disponible; backend y publicación no se crean automáticamente.');
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
  const priorGoals=t.messages.filter(m=>m.role==='user').slice(-5).map(m=>m.text).filter(Boolean);
  const mission=(priorGoals.length>0?('Contexto acumulado del proyecto (conserva requisitos compatibles):\n- '+priorGoals.join('\n- ')+'\n\nCambio solicitado ahora:\n'+instruction):instruction).slice(0,3400);
  if(refining&&snapshot.html.length>100000){state('El proyecto supera 100 KB. Exporta una copia o reduce su tamaño antes de pedir una revisión.',true);return}
  busy=true;send.disabled=true;send.textContent='Construyendo…';entry.disabled=true;['#wfProjects','#wfNewProject','#wfImportCanvas','#wfAgentEngine'].forEach(q=>{const el=$(q);if(el)el.disabled=true});
  entry.value='';remember('user',instruction);
  state(multiFile?'Arquitectura → archivos → auditoría → guardado…':refining?'Analizando contexto → especialistas → construcción → QA…':'Definiendo producto → especialistas → construcción → QA…');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),115000);
  try{
    const res=await fetch(multiFile?'/api/factory-project':'/api/canvas',{
      method:'POST',credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(multiFile
        ?{request:mission,kind:t.kind||'app',files:refining?snapshot.files:[]}
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
    now.kind=String(data.kind||now.kind||'');
    save();
    const action=refining?'Actualicé tu producto.':'Construí la primera versión de tu producto.';
    const detail=multiFile
      ?'Archivos actualizados: '+data.project.files.length+'. Vista previa lista. Auditoría estructural aprobada; backend y pruebas de navegador no ejecutados.'
      :'Vista previa actualizada. Auditoría estructural aprobada; prueba botones y contenido antes de publicar.';
    remember('assistant',action+' '+detail);
    state('Producto construido y guardado. Puedes pedirme otro cambio.');
    if(window.matchMedia('(max-width:899px)').matches)setMobileView('preview');
  }catch(error){
    const message=error?.name==='AbortError'?'La construcción agotó el tiempo de espera.':'No pude aplicar el cambio: '+String(error.message||'Error de conexión.');
    // Keep the actual brief editable for a native retry instead of making users retype it.
    if(!entry.value.trim())entry.value=instruction;
    remember('assistant',message+' Conservé la versión anterior del producto.');
    state(message,true);
  }finally{
    clearTimeout(timeout);busy=false;send.disabled=false;send.textContent='✦ Construir';entry.disabled=false;['#wfProjects','#wfNewProject','#wfImportCanvas','#wfAgentEngine'].forEach(q=>{const el=$(q);if(el)el.disabled=false});entry.focus();
  }
}
function changeProject(){
  const id=project()?.id;if(!id||id===lastId)return;renderMessages();setMobileView('build');
}
function setMobileView(view){
  if(!stage)return;
  const next=view==='preview'?'preview':'build';stage.dataset.wfView=next;
  stage.querySelectorAll('[data-wf-mobile-view]').forEach(button=>{const pressed=button.dataset.wfMobileView===next;button.setAttribute('aria-pressed',String(pressed));button.classList.toggle('active',pressed)});
  if(next==='preview')factory()?.preview();
}
function init(){
  root=$('#panel-factory');const body=root?.querySelector('.wf-body');
  if(!root||!body||!factory()?.commitGenerated)return;
  root.classList.add('wf-agent-mode');
  const heading=root.querySelector('.wf-head small');if(heading)heading.textContent='Dile al agente qué crear · Mira el producto · Pide cambios';
  stage=document.createElement('div');stage.className='wf-stage';stage.dataset.wfView='build';
  const mobileNav=document.createElement('nav');mobileNav.className='wf-mobile-nav';mobileNav.setAttribute('aria-label','Vista de la Fábrica');
  mobileNav.innerHTML='<button type="button" data-wf-mobile-view="build" aria-pressed="true" class="active">✦ Crear y mejorar</button><button type="button" data-wf-mobile-view="preview" aria-pressed="false">◉ Ver producto</button>';
  stage.append(mobileNav);mobileNav.querySelectorAll('[data-wf-mobile-view]').forEach(button=>button.addEventListener('click',()=>setMobileView(button.dataset.wfMobileView)));
  root.insertBefore(stage,body);
  const chat=document.createElement('section');chat.className='wf-agent';
  chat.setAttribute('aria-label','Asistente constructor de productos');
  chat.innerHTML='<header class="wf-agent-top"><strong>✦ Agente constructor</strong><label class="wf-engine-label">Modo <select id="wfAgentEngine" aria-label="Motor de construcción"><option value="project">🧩 Proyecto multifichero</option><option value="html">⚡ HTML rápido</option></select></label></header><div id="wfAgentFeed" class="wf-agent-feed" role="log" aria-live="polite"></div><div class="wf-agent-prompts"><button type="button" data-brief="Crea una página web para mi negocio, moderna, móvil y con botones funcionales.">Página web</button><button type="button" data-brief="Construye un dashboard empresarial responsive con datos demostrativos claramente etiquetados y filtros funcionales.">Dashboard</button><button type="button" data-brief="Crea una presentación ejecutiva interactiva con cinco diapositivas y controles de navegación.">Presentación</button></div><form id="wfAgentForm" class="wf-agent-form"><label for="wfAgentText">¿Qué construimos o mejoramos?</label><textarea id="wfAgentText" rows="3" maxlength="2100" placeholder="Ej.: Crea una app para controlar ventas de mi tienda…"></textarea><div class="wf-agent-actions"><button id="wfAgentBuild" type="submit" class="wf-agent-primary">✦ Construir</button><button id="wfAgentPreview" type="button" class="wf-agent-see">◉ Ver producto</button><details class="wf-agent-more"><summary>Más herramientas</summary><div class="wf-agent-more-items"><button id="wfAgentUndo" type="button">↶ Deshacer</button><button id="wfAgentCode" type="button" aria-pressed="false">⌘ Código</button><button id="wfAgentExport" type="button">↓ HTML</button><button id="wfAgentProject" type="button">↓ ZIP</button><button id="wfAgentToCanvas" type="button">↗ Canvas</button><button id="wfAgentFromCanvas" type="button">↙ Importar Canvas</button></div></details></div><div id="wfAgentStatus" class="wf-agent-status" role="status"></div></form>';
  stage.append(chat,body);
  form=$('#wfAgentForm');feed=$('#wfAgentFeed');entry=$('#wfAgentText');send=$('#wfAgentBuild');status=$('#wfAgentStatus');
  load();renderMessages();
  form.addEventListener('submit',event=>{event.preventDefault();build()});
  entry.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();build()}});
  chat.querySelectorAll('[data-brief]').forEach(b=>b.addEventListener('click',()=>{entry.value=b.dataset.brief;entry.focus()}));
  $('#wfAgentCode').addEventListener('click',()=>{
    root.classList.toggle('wf-code-visible');const active=root.classList.contains('wf-code-visible');
    $('#wfAgentCode').setAttribute('aria-pressed',String(active));$('#wfAgentCode').textContent=active?'◉ Vista simple':'⌘ Código';
    factory().preview();if(window.matchMedia('(max-width:899px)').matches)setMobileView('preview');
  });
  $('#wfAgentUndo').addEventListener('click',()=>{
    if(busy)return;
    const r=factory().restorePrevious();
    if(!r.ok){state(r.error,true);return}
    remember('assistant','Restauré la versión anterior de tu producto. Puedes pedirme una nueva modificación.');
    state('Versión anterior restaurada.');
    if(window.matchMedia('(max-width:899px)').matches)setMobileView('preview');
  });
  $('#wfAgentExport').addEventListener('click',()=>$('#wfExportHTML')?.click());
  $('#wfAgentProject').addEventListener('click',()=>$('#wfExportZIP')?.click());
  $('#wfAgentPreview').addEventListener('click',()=>{setMobileView('preview');if(!window.matchMedia('(max-width:899px)').matches)$('#wfPreview')?.scrollIntoView({behavior:'smooth',block:'nearest'});});
  $('#wfAgentToCanvas').addEventListener('click',()=>{if(!busy)$('#wfSendCanvas')?.click()});
  $('#wfAgentFromCanvas').addEventListener('click',()=>{if(!busy)$('#wfImportCanvas')?.click()});
  document.addEventListener('wae:factory-project-changed',()=>{if(!busy)changeProject()});
  $('#wfProjects')?.addEventListener('change',()=>{if(!busy)changeProject()});
  $('#wfNewProject')?.addEventListener('click',()=>{if(!busy)queueMicrotask(changeProject)});
  $('#wfImportCanvas')?.addEventListener('click',()=>{if(!busy)queueMicrotask(changeProject)});
  root.addEventListener('click',event=>{if(event.target?.closest('[data-tab="factory"]'))queueMicrotask(changeProject)});
  window.__waeFactoryAgentV3={version:'4-mobile-ux',build,changeProject,setMobileView};
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();