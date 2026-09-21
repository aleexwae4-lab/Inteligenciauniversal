/* Universal Core Render · conversational product agent v3. Builds only through real /api/canvas. */
(()=>{
'use strict';
if(window.__waeFactoryAgentV3)return;
const $=s=>document.querySelector(s);
const KEY='wae.render.factory.agent.v3', MAX_MESSAGE=700, MAX_TURNS=16;
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
    bubble('assistant','Dime qué quieres construir. Yo generaré el producto y lo iré modificando contigo. Puedes pedirme una página web, un dashboard, una presentación o un prototipo.');
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
  if(refining&&snapshot.html.length>100000){state('El proyecto supera 100 KB. Exporta una copia o reduce su tamaño antes de pedir una revisión.',true);return}
  busy=true;send.disabled=true;entry.disabled=true;
  entry.value='';remember('user',instruction);
  state(refining?'Consultando al agente para mejorar el producto existente…':'Consultando al agente para construir tu primer producto…');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),115000);
  try{
    const res=await fetch('/api/canvas',{
      method:'POST',credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({request:instruction,kind:t.kind||undefined,baseHtml:refining?snapshot.html:''}),
      signal:controller.signal
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||typeof data.html!=='string'||data.quality?.structural!=='passed'){
      throw Error(data.message||data.error||'La construcción no pasó la validación estructural.');
    }
    const result=factory().commitGenerated(data.html,snapshot);
    if(!result.ok)throw Error(result.error);
    const now=thread(snapshot.id);
    now.kind=String(data.kind||now.kind||'');
    save();
    const action=refining?'Actualicé tu producto.':'Construí la primera versión de tu producto.';
    const detail='QA estructural aprobado. '+(data.experts?.length||0)+' responsabilidades registradas. La vista previa ya está actualizada; comprueba los botones y el contenido antes de publicarlo.';
    remember('assistant',action+' '+detail);
    state('Producto construido y guardado. Puedes pedirme otro cambio.');
  }catch(error){
    const message=error?.name==='AbortError'?'La construcción agotó el tiempo de espera.':'No pude aplicar el cambio: '+String(error.message||'Error de conexión.');
    remember('assistant',message+' Conservé la versión anterior del producto.');
    state(message,true);
  }finally{
    clearTimeout(timeout);busy=false;send.disabled=false;entry.disabled=false;entry.focus();
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
  chat.innerHTML='<header class="wf-agent-top"><strong>✦ Agente constructor</strong><span>Describe → Construye → Corrige</span></header><div id="wfAgentFeed" class="wf-agent-feed" role="log" aria-live="polite"></div><div class="wf-agent-prompts"><button type="button" data-brief="Crea una página web para mi negocio, moderna, móvil y con botones funcionales.">Página web</button><button type="button" data-brief="Construye un dashboard empresarial responsive con datos demostrativos claramente etiquetados y filtros funcionales.">Dashboard</button><button type="button" data-brief="Crea una presentación ejecutiva interactiva con cinco diapositivas y controles de navegación.">Presentación</button></div><form id="wfAgentForm" class="wf-agent-form"><label for="wfAgentText">¿Qué construimos o mejoramos?</label><textarea id="wfAgentText" rows="3" maxlength="2100" placeholder="Ej.: Crea una app para controlar ventas de mi tienda…"></textarea><div class="wf-agent-actions"><button id="wfAgentBuild" type="submit" class="wf-agent-primary">✦ Construir</button><button id="wfAgentUndo" type="button">↶ Deshacer</button><button id="wfAgentCode" type="button" aria-pressed="false">⌘ Código</button><button id="wfAgentExport" type="button">↓ HTML</button></div><div id="wfAgentStatus" class="wf-agent-status" role="status"></div></form>';
  stage.append(chat,body);
  form=$('#wfAgentForm');feed=$('#wfAgentFeed');entry=$('#wfAgentText');send=$('#wfAgentBuild');status=$('#wfAgentStatus');
  load();renderMessages();
  form.addEventListener('submit',event=>{event.preventDefault();build()});
  entry.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();build()}});
  chat.querySelectorAll('[data-brief]').forEach(b=>b.addEventListener('click',()=>{entry.value=b.dataset.brief;entry.focus()}));
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
  $('#wfProjects')?.addEventListener('change',()=>{if(!busy)changeProject()});
  $('#wfNewProject')?.addEventListener('click',()=>{if(!busy)queueMicrotask(changeProject)});
  $('#wfImportCanvas')?.addEventListener('click',()=>{if(!busy)queueMicrotask(changeProject)});
  root.addEventListener('click',event=>{if(event.target?.closest('[data-tab="factory"]'))queueMicrotask(changeProject)});
  window.__waeFactoryAgentV3={version:'3',build,changeProject};
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();