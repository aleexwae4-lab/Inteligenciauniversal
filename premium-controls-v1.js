(()=>{
'use strict';
if(window.__waePremiumControlsV1)return;
const q=(s,r=document)=>r.querySelector(s);
const all=(s,r=document)=>[...r.querySelectorAll(s)];
const toast=t=>window.toast?.(t);
let playing=null;
function stop(){
 try{window.__waeVoice?.stop?.();window.__waeMobileVoice?.stop?.();speechSynthesis?.cancel?.()}catch{}
 if(playing){playing.textContent='▶ Escuchar';playing.setAttribute('aria-pressed','false')}
 playing=null;
}
function messageText(node){
 const body=q('.rich-answer,.assistant-body',node);
 const nodes=all('.message.assistant:not(#typingMessage):not(#iuLiveStream)');
 const i=nodes.indexOf(node);
 try{
  const rows=JSON.parse(localStorage.getItem('wae.messages')||'[]').filter(m=>m?.role==='assistant');
  const raw=rows[i+Math.max(0,rows.length-nodes.length)]?.text;
  if(raw)return String(raw);
 }catch{}
 return body?.innerText||body?.textContent||'';
}
async function copy(value){
 const text=String(value||'');
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);toast('Copiado');return true}}catch{}
 const field=document.createElement('textarea');field.value=text;field.style.cssText='position:fixed;left:-9999px;top:0';document.body.append(field);field.select();
 try{const ok=document.execCommand('copy');toast(ok?'Copiado':'No se pudo copiar');return ok}catch{toast('No se pudo copiar');return false}finally{field.remove()}
}
async function speak(button,node){
 if(playing===button){stop();return}
 const text=messageText(node);if(!text)return toast('Respuesta vacía');
 stop();playing=button;button.textContent='■ Detener';button.setAttribute('aria-pressed','true');
 try{
  if(window.__waeVoice?.speak)await window.__waeVoice.speak(text,{force:true});
  else if('speechSynthesis'in window)await new Promise(resolve=>{const u=new SpeechSynthesisUtterance(text);u.lang='es-MX';u.onend=u.onerror=resolve;speechSynthesis.speak(u)});
  else toast('Voz no disponible');
 }catch{toast('La reproducción de voz falló')}
 finally{if(playing===button)stop()}
}
function addWorkspace(){
 all('.message.assistant:not(#typingMessage):not(#iuLiveStream),.turn.assistant').forEach(node=>{
  const bar=q('.answer-actions,.actions',node);
  if(!bar||bar.dataset.waeWorkspace)return;
  bar.dataset.waeWorkspace='1';
  const b=document.createElement('button');b.type='button';b.className='wae-open-workspace';b.textContent='◇ Workspace';
  b.addEventListener('click',()=>{
   const editor=q('#documentEditor');if(!editor)return toast('Workspace no disponible');
   editor.replaceChildren();
   messageText(node).split(/\n{2,}/).forEach(block=>{const p=document.createElement('p');p.textContent=block.trim();editor.append(p)});
   q('#saveState').textContent='Cambios sin guardar';q('#workspaceBtn')?.click();toast('Respuesta abierta en Workspace');
  });bar.append(b);
 });
}
function closeDrawer(){q('#drawer')?.classList.remove('open');q('#drawer')?.setAttribute('aria-hidden','true');q('#scrim')?.classList.remove('visible')}
let overlay=null;
function panel(title){
 if(!overlay){
  overlay=document.createElement('section');overlay.id='waePremiumPanel';overlay.className='wae-premium-panel';
  overlay.innerHTML='<div class="wae-premium-panel-inner"><header><strong></strong><button type="button" aria-label="Cerrar">×</button></header><div class="wae-premium-panel-body"></div></div>';
  q('header button',overlay).onclick=()=>overlay.classList.remove('open');
  overlay.onclick=e=>{if(e.target===overlay)overlay.classList.remove('open')};
  document.body.append(overlay);
 }
 q('header strong',overlay).textContent=title;
 const body=q('.wae-premium-panel-body',overlay);body.replaceChildren();overlay.classList.add('open');closeDrawer();return body;
}
function line(root,text){const p=document.createElement('p');p.textContent=String(text||'');root.append(p)}
function item(root,name,description,callback){
 const b=document.createElement('button');b.type='button';b.className='wae-premium-panel-row';
 const strong=document.createElement('strong'),small=document.createElement('small');
 strong.textContent=name;small.textContent=description;b.append(strong,small);b.onclick=callback;root.append(b);
}
function draft(text,mode='general'){
 overlay?.classList.remove('open');closeDrawer();q('[data-mode="'+mode+'"]')?.click();
 const input=(matchMedia('(max-width:899px)').matches?q('#mobileSafeInput'):q('#messageInput'))||q('#messageInput');
 if(input){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()}
}
async function api(path){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
 try{const r=await fetch(path,{headers:{accept:'application/json'},cache:'no-store',signal:c.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}
 finally{clearTimeout(timer)}
}
async function navigate(view){
 if(view==='ai'){closeDrawer();q('#messageInput')?.focus();return}
 if(view==='comms'){closeDrawer();return window.__WAE_PRODUCTIVITY_V59__?.showHistory?.()}
 if(view==='projects'){closeDrawer();return window.__WAE_PRODUCT_MODULES_V92__?.openProjects?.()}
 if(view==='memory'){
  const b=panel('Memoria');let n=0;try{n=JSON.parse(localStorage.getItem('wae.messages')||'[]').length}catch{}
  line(b,'Mensajes almacenados en este dispositivo: '+n);
  item(b,'Historial','Abrir conversaciones guardadas',()=>{overlay.classList.remove('open');window.__WAE_PRODUCTIVITY_V59__?.showHistory?.()});return;
 }
 if(view==='automations'){
  const b=panel('Tareas');line(b,'Ejecución de tareas disponible. No se atribuye programación recurrente sin servicio conectado.');
  item(b,'Preparar tarea','Escribir una misión para Universal Core',()=>draft('Ejecuta esta tarea: ','analysis'));return;
 }
 const title={control:'Centro de control',agents:'Agentes',knowledge:'Base de conocimiento',market:'Herramientas'}[view]||'Universal Core';
 const path={control:'/api/health',agents:'/api/capabilities',knowledge:'/api/knowledge/health',market:'/api/tools'}[view];
 const b=panel(title);line(b,'Verificando el servidor…');
 try{
  const data=await api(path);b.replaceChildren();
  if(view==='agents'){
   const agents=Array.isArray(data.agents)?data.agents:[];line(b,agents.length+' agentes registrados');
   agents.slice(0,40).forEach(a=>item(b,a.name||a.id,a.description||'',()=>draft('Necesito al agente '+(a.name||a.id)+': ','analysis')));
  }else if(view==='market'){
   const tools=data.toolFabric?.tools||[];line(b,tools.length+' herramientas registradas');
   tools.slice(0,40).forEach(t=>item(b,t.name||t.id,t.description||'',()=>draft('Utiliza '+(t.name||t.id)+' para ')));
  }else{line(b,JSON.stringify(data,null,2));item(b,'Investigar','Hacer una consulta con el núcleo',()=>draft('Investiga con fuentes: ','research'))}
 }catch{b.replaceChildren();line(b,'No se pudo verificar el módulo. Comprueba la conexión e inténtalo de nuevo.')}
}
document.addEventListener('click',e=>{
 const b=e.target.closest?.('button');if(!b)return;
 const node=b.closest('.message.assistant,.turn.assistant');
 if(node&&b.matches('.speak-answer')){e.preventDefault();e.stopImmediatePropagation();void speak(b,node);return}
 if(node&&b.matches('.copy-answer')){e.preventDefault();e.stopImmediatePropagation();void copy(messageText(node));return}
 if(b.matches('.avatar')){e.preventDefault();e.stopImmediatePropagation();window.__WAE_PRODUCT_MODULES_V92__?.openSettings?.()||q('#settingsBtn')?.click();return}
 const nav=b.closest('.nav-list button[data-view]');
 if(nav&&nav.dataset.view!=='projects'){e.preventDefault();e.stopImmediatePropagation();void navigate(nav.dataset.view)}
},true);
document.addEventListener('pointerdown',e=>{if(e.target.closest?.('.toolbar button'))e.preventDefault()},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape')overlay?.classList.remove('open')});
const messages=q('#messages');if(messages)new MutationObserver(addWorkspace).observe(messages,{childList:true,subtree:true});
addWorkspace();
window.__waePremiumControlsV1={version:'1.0.0',copy,stop,navigate};
})();