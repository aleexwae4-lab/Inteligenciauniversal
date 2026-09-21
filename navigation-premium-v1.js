(()=>{
'use strict';
const KEY='iu.premium.navigation.v1',PENDING='iu.premium.pendingRemote.v1',CLOUD='iu.conversationId';
const $=s=>document.querySelector(s),uuid=()=>crypto.randomUUID?.()||'iu-'+Date.now()+'-'+Math.random().toString(36).slice(2),now=()=>new Date().toISOString(),short=(v,n=100)=>String(v??'').trim().slice(0,n);
const node=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const button=(label,fn,cls)=>{const e=node('button',cls,label);e.type='button';e.addEventListener('click',fn);return e};
const messages=()=>window.WAEChatState?.snapshot?.()||[];
const nameFrom=ms=>short(ms.find(m=>m.role==='user')?.text?.replace(/\s+/g,' '),65)||'Nueva conversación';
let db,view='conversations',search='',remote=[],remoteLoad=null,panel,links,modal,expanded=null,muted=false,storageWarning=false;
const active=()=>db?.conversations.find(c=>c.id===db.active),project=id=>db?.projects.find(p=>p.id===id);
function persist(){
 const snapshot=JSON.parse(JSON.stringify(db));
 if(window.WAEStorage){
  window.WAEStorage.save('navigation',snapshot).then(()=>{storageWarning=false}).catch(error=>{
   console.warn('[WAE] IndexedDB could not save conversation archive',error);
   if(!storageWarning){storageWarning=true;window.toast?.('No se pudo guardar en este dispositivo. Descarga una copia de seguridad desde Conversaciones.')}
  });
  return true;
 }
 try{localStorage.setItem(KEY,JSON.stringify(snapshot));return true}catch(error){console.warn('navigation storage',error);window.toast?.('No se pudo guardar: usa Exportar memoria para respaldar tus datos.');return false}
}
async function initializeData(){
 let archivedActive=[];
 if(window.WAEStorage){try{await window.WAEStorage.ready;[db,archivedActive]=await Promise.all([window.WAEStorage.load('navigation'),window.WAEStorage.load('active')]);if(!Array.isArray(archivedActive))archivedActive=[]}catch(error){console.warn('[WAE] navigation archive read failed',error)}}
 if(!db){try{db=JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){}}
 if(!db||!Array.isArray(db.projects)||!Array.isArray(db.conversations))db={active:null,projects:[],conversations:[]};
 db.projects=db.projects.filter(p=>p&&typeof p.id==='string');
 db.conversations=db.conversations.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages));
 let pending;try{pending=JSON.parse(localStorage.getItem(PENDING)||'null')}catch(_){}
 if(pending?.remoteId){
  const ms=archivedActive.length?archivedActive:messages(),existing=db.conversations.find(c=>c.remoteId===pending.remoteId);
  const c=existing||{id:uuid(),createdAt:now(),projectId:null,title:short(pending.title,80)||nameFrom(ms)};
  Object.assign(c,{messages:ms,remoteId:pending.remoteId,mode:localStorage.getItem('wae.mode')||'general',updatedAt:now()});
  if(!existing)db.conversations.unshift(c);db.active=c.id;localStorage.removeItem(PENDING);
 }else if(!db.conversations.length&&(messages().length||archivedActive.length)){
  const ms=archivedActive.length?archivedActive:messages(),c={id:uuid(),title:nameFrom(ms),messages:ms,projectId:null,remoteId:localStorage.getItem(CLOUD)||null,mode:localStorage.getItem('wae.mode')||'general',createdAt:now(),updatedAt:now()};db.conversations.push(c);db.active=c.id;
 }
 if(db.active&&!active())db.active=null;
 persist();
}
function sync(){
 if(muted||!db)return;
 let c=active();if(!c&&messages().length&&db.conversations.length<30){c={id:uuid(),title:nameFrom(messages()),projectId:null,remoteId:localStorage.getItem(CLOUD)||null,mode:window.WAEChatState?.mode?.()||'general',messages:[],createdAt:now(),updatedAt:now()};db.conversations.unshift(c);db.active=c.id}
 if(!c)return;
 c.messages=messages();c.mode=window.WAEChatState?.mode?.()||c.mode||'general';c.updatedAt=now();
 c.remoteId=localStorage.getItem(CLOUD)||c.remoteId||null;
 if(c.title==='Nueva conversación'&&c.messages.some(m=>m.role==='user'))c.title=nameFrom(c.messages);
 persist();render();
}
function closeMenu(){$('#drawer')?.classList.remove('open');$('#drawer')?.setAttribute('aria-hidden','true');$('#scrim')?.classList.remove('visible')}
function restore(c){
 muted=true;
 if(c.remoteId)localStorage.setItem(CLOUD,c.remoteId);else localStorage.removeItem(CLOUD);
 window.__waeRuntimeAttachments=[];window.__waeHydratingHistory=true;window.WAEChatState?.restore?.(c.messages,c.mode||'general');muted=false;queueMicrotask(()=>{window.__waeHydratingHistory=false});
}
function newConversation(pid){
 if(!db){window.toast?.('Abriendo memoria local…');return true}
 if(window.WAEChatState?.busy?.()){window.toast?.('Termina la respuesta antes de cambiar de chat');return true}
 sync();
 
 const c={id:uuid(),title:'Nueva conversación',projectId:pid===undefined?(active()?.projectId||null):(project(pid)?pid:null),remoteId:null,mode:window.WAEChatState?.mode?.()||'general',messages:[],createdAt:now(),updatedAt:now()};
 db.conversations.unshift(c);db.active=c.id;persist();restore(c);render();closeMenu();window.toast?.('Nueva conversación creada');return true;
}
function openChat(id){
 if(window.WAEChatState?.busy?.())return window.toast?.('Termina la respuesta primero');
 const c=db.conversations.find(x=>x.id===id);if(!c)return;
 sync();db.active=id;persist();restore(c);render();closeMenu();
}
function openModal(title,fields,save){
 modal.replaceChildren();const box=node('div','iu-nav-modal-card'),h=node('h3','',title),form=node('form','iu-nav-modal-form'),controls=[];
 fields.forEach(f=>{const lab=node('label','',f.label),input=f.large?node('textarea'):node('input');if(!f.large)input.type='text';input.maxLength=f.max||80;input.value=f.value||'';if(f.large)input.rows=4;lab.append(input);form.append(lab);controls.push(input)});
 const actions=node('div','iu-nav-modal-actions');
 actions.append(button('Cancelar',()=>modal.close()),button('Guardar',()=>{if(save(controls.map(i=>i.value.trim()))!==false)modal.close()},'iu-nav-primary'));
 form.addEventListener('submit',e=>e.preventDefault());form.append(actions);box.append(h,form);modal.append(box);modal.showModal();controls[0]?.focus();
}
function editProject(p){
 openModal(p?'Editar proyecto':'Nuevo proyecto',[
  {label:'Nombre',value:p?.title,max:80},{label:'Instrucciones del proyecto',value:p?.instructions,max:3000,large:true},{label:'Conocimiento del proyecto',value:p?.knowledge,max:8000,large:true}
 ],([title,instructions,knowledge])=>{
  if(!title){window.toast?.('Escribe un nombre');return false}
  
  if(p)Object.assign(p,{title:short(title,80),instructions:short(instructions,3000),knowledge:short(knowledge,8000),updatedAt:now()});
  else{p={id:uuid(),title:short(title,80),instructions:short(instructions,3000),knowledge:short(knowledge,8000),createdAt:now(),updatedAt:now()};db.projects.unshift(p)}
  expanded=p.id;persist();render();window.toast?.('Proyecto guardado');
 });
}
function removeChat(c){
 if(window.WAEChatState?.busy?.())return window.toast?.('Termina la respuesta primero');
 if(!confirm('¿Eliminar esta conversación del dispositivo?'+(c.remoteId?' Su copia en Supabase podría permanecer.':'')))return;
 db.conversations=db.conversations.filter(x=>x.id!==c.id);
 if(db.active===c.id){db.active=null;localStorage.removeItem(CLOUD);muted=true;window.WAEChatState?.restore?.([],'general');muted=false}
 persist();render();
}
function removeProject(p){
 if(!confirm('¿Eliminar el proyecto? Se conservarán sus conversaciones sin asignar.'))return;
 db.projects=db.projects.filter(x=>x.id!==p.id);db.conversations.forEach(c=>{if(c.projectId===p.id)c.projectId=null});if(expanded===p.id)expanded=null;persist();render();
}
function chatRow(c){
 const row=node('div','iu-nav-chat'+(db.active===c.id?' active':'')),open=button(c.title||'Nueva conversación',()=>openChat(c.id),'iu-nav-chat-open');
 open.append(node('small','',project(c.projectId)?.title|| (c.remoteId?'En Supabase':'Chat local')));
 const actions=node('div','iu-nav-chat-actions'),rename=button('✎',()=>openModal('Renombrar conversación',[{label:'Nombre',value:c.title,max:80}],([title])=>{if(!title)return false;c.title=short(title,80);persist();render()}));
 rename.title='Renombrar';
 const select=node('select');select.title='Mover a proyecto';select.setAttribute('aria-label','Mover conversación a proyecto');
 select.add(new Option('Sin proyecto',''));db.projects.forEach(p=>select.add(new Option(p.title,p.id)));select.value=c.projectId||'';
 select.addEventListener('change',()=>{c.projectId=project(select.value)?select.value:null;c.updatedAt=now();persist();render()});
 const del=button('×',()=>removeChat(c),'iu-nav-danger');del.title='Eliminar conversación local';
 actions.append(rename,select,del);row.append(open,actions);return row;
}
function listChats(){
 const holder=$('#iuNavChatList');if(!holder)return;holder.replaceChildren();
 const q=search.trim().toLowerCase();const list=db.conversations.slice().sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).filter(c=>!q||c.title.toLowerCase().includes(q)||c.messages.some(m=>String(m.text||'').toLowerCase().includes(q)));
 list.forEach(c=>holder.append(chatRow(c)));
 if(!list.length)holder.append(node('p','iu-nav-empty',q?'Sin coincidencias.':'Aún no hay conversaciones.'));
}
async function exportMemory(){
 if(!db)return window.toast?.('Memoria aún no disponible');
 if(window.WAEChatState?.busy?.())return window.toast?.('Termina la respuesta antes de exportar');
 sync();
 const read=async key=>{try{return await window.WAEStorage?.load(key)}catch{return undefined}};
 const legacy=key=>{try{return localStorage.getItem(key)}catch{return null}};
 const file={
  format:'wae-universal-render-memory-v2',exportedAt:now(),scope:'local-device-only',
  note:'No incluye conversaciones ni memorias remotas almacenadas en Supabase.',
  navigation:JSON.parse(JSON.stringify(db)),activeMessages:messages(),
  settings:(()=>{try{return JSON.parse(legacy('iu.premium.settings.v1')||'null')}catch{return null}})(),
  document:(await read('document'))??legacy('wae.document')??'',
  html:(await read('html'))??legacy('wae.html')??''
 };
 const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='WAE-UniversalCore-memoria-local-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 window.toast?.('Respaldo local solicitado: comprueba la descarga antes de borrar datos.');
}
function renderConversations(){
 const q=node('input','iu-nav-search');q.type='search';q.placeholder='Buscar conversaciones…';q.value=search;q.setAttribute('aria-label','Buscar conversaciones');
 q.addEventListener('input',()=>{search=q.value;listChats()});panel.append(q,node('div','iu-nav-section-title','CONVERSACIONES'));
 const backup=button('↓ Exportar memoria local (.json)',()=>{exportMemory().catch(error=>{console.warn('[WAE] backup export failed',error);window.toast?.('No se pudo generar la copia de seguridad')})},'iu-nav-create');
 panel.append(backup,node('p','iu-nav-hint','Conserva tus chats y proyectos locales. El historial de Supabase permanece separado.'));
 const list=node('div');list.id='iuNavChatList';panel.append(list);listChats();
 const remaining=remote.filter(r=>!db.conversations.some(c=>c.remoteId===r.id));
 if(remaining.length&&remoteLoad){
  panel.append(node('div','iu-nav-section-title','HISTORIAL EN SUPABASE'));
  remaining.slice(0,16).forEach(r=>{const b=button(short(r.title||'Conversación',80),()=>{if(window.WAEChatState?.busy?.())return window.toast?.('Termina la respuesta primero');sync();remoteLoad(r.id)},'iu-nav-cloud');b.append(node('small','','Abrir conversación sincronizada'));panel.append(b)});
 }
}
function renderProjects(){
 panel.append(button('＋ Nuevo proyecto',()=>editProject(null),'iu-nav-create'));
 if(!db.projects.length)panel.append(node('p','iu-nav-empty','Organiza conversaciones, instrucciones y conocimientos por proyecto.'));
 db.projects.forEach(p=>{
  const card=node('section','iu-nav-project'),count=db.conversations.filter(c=>c.projectId===p.id).length;
  card.append(button(p.title,()=>{expanded=expanded===p.id?null:p.id;render()},'iu-nav-project-title'),node('small','',count+' conversación'+(count===1?'':'es')));
  const actions=node('div','iu-nav-project-actions');
  actions.append(button('＋ Chat',()=>newConversation(p.id),'iu-nav-primary'),button('Editar',()=>editProject(p)),button('Eliminar',()=>removeProject(p),'iu-nav-danger'));card.append(actions);
  if(expanded===p.id){card.append(node('p','iu-nav-hint','Los chats del proyecto usan sus instrucciones y conocimiento.'));db.conversations.filter(c=>c.projectId===p.id).forEach(c=>card.append(chatRow(c)))}
  panel.append(card);
 });
}
function render(){if(!panel)return;panel.replaceChildren();links.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(view==='projects')renderProjects();else renderConversations()}
async function init(){
 await initializeData();
 const nav=$('#drawer .nav-list');if(!nav)return;
 const settings=$('#settingsBtn');nav.replaceChildren();links=node('div','iu-nav-links');
 const chats=button('☷  Conversaciones',()=>{view='conversations';render()},'iu-nav-link');chats.dataset.view='conversations';
 const projects=button('◇  Proyectos',()=>{view='projects';render()},'iu-nav-link');projects.dataset.view='projects';
 links.append(chats,projects);
 panel=node('section','iu-nav-panel');nav.append(links,panel);
 // Keep the existing settings button and its working handler outside the scrolling list.
 if(settings){const footer=node('div','iu-nav-footer');settings.className='iu-nav-settings';settings.textContent='⚙  Configuración';footer.append(settings);nav.after(footer)}
 modal=node('dialog','iu-nav-modal');$('#app').append(modal);modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});
 const c=active();if(c&&JSON.stringify(c.messages)!==JSON.stringify(messages()))restore(c);
 window.addEventListener('wae:messages-changed',sync);render();
}
window.WAENavigation={
 snapshotLocal:()=>{if(!db)return null;sync();return JSON.parse(JSON.stringify(db))},
 newConversation,
 getProjectContext:()=>{const p=project(active()?.projectId);return p?{instructions:short(p.instructions,3000),knowledge:short(p.knowledge,8000)}:{}},
 setRemoteConversations:(items,open)=>{remote=Array.isArray(items)?items:[];remoteLoad=open;render()},
 markRemoteConversation:(id,title)=>{if(id)localStorage.setItem(PENDING,JSON.stringify({remoteId:id,title:short(title,80)}))},
 remoteUpdated:id=>{const c=active();if(c&&id){c.remoteId=id;persist()}},
 openConversations:()=>{view='conversations';render()},
 openProjects:()=>{view='projects';render()}
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();