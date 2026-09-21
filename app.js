const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function safeText(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function nowLabel(){return new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}).format(new Date())}

function sanitizeAssistantText(raw){
  raw=String(raw??'').trim();
  if(!raw)return '';
  const lower=raw.toLowerCase();
  const tags=['thought','thoughts','analysis','reasoning'];
  let last=-1,end=-1;
  for(const tag of tags){
    const marker=`</${tag}>`,idx=lower.lastIndexOf(marker);
    if(idx>last){last=idx;end=idx+marker.length}
  }
  let text=last>=0?raw.slice(end):raw;
  for(const tag of tags)text=text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'gi'),'');
  text=text.replace(/<\/?(?:thoughts?|analysis|reasoning)\b[^>]*>/gi,'').trim();
  if(/(?:Language Policy|RELEVANT MEMORY|VERIFIED WEB EVIDENCE|system_guidance|Role:\s*Advanced general-purpose AI)/i.test(text))return '';
  return text;
}

function readStoredMessages(){
  let list=[];
  try{list=JSON.parse(localStorage.getItem('wae.messages')||'[]')}catch{}
  if(!Array.isArray(list))return[];
  return list.map(m=>{
    if(!m||!['user','assistant'].includes(m.role))return null;
    let text=String(m.text??'');
    if(m.role==='assistant'){
      if(/No pude usar el endpoint configurado|configura tu endpoint IA|sustituir este motor local por inferencia real/i.test(text)||text==='Sistema listo. Investiga, programa, analiza, diseña o escribe directamente lo que necesitas.')return null;
      text=sanitizeAssistantText(text);
      if(!text)return null;
    }
    return{role:m.role,text,at:String(m.at||'')};
  }).filter(Boolean).slice(-60);
}

localStorage.setItem('wae.endpoint','/api/chat');
const state={
  mode:localStorage.getItem('wae.mode')||'general',
  endpoint:'/api/chat',
  coreName:localStorage.getItem('wae.coreName')||'Universal Core',
  document:localStorage.getItem('wae.document')||'',
  html:localStorage.getItem('wae.html')||'',
  messages:readStoredMessages(),
  busy:false
};
const modeLabels={general:'General',research:'Investigar',code:'Programar',analysis:'Analizar',design:'Diseñar',executive:'Ejecutivo'};

function persistMessages(){localStorage.setItem('wae.messages',JSON.stringify(state.messages.slice(-60)))}
function renderMessages(){
  const t=$('#messages');t.innerHTML='';
  state.messages.forEach(renderMessage);scrollChat();
}
function renderMessage(m){
  const e=document.createElement('article');
  e.className=`message ${m.role==='user'?'user':'assistant'}`;
  const n=m.role==='user'?'Tú':state.coreName;
  e.innerHTML=`<div class="message-meta"><strong>${safeText(n)}</strong><span>${safeText(m.at||nowLabel())}</span></div><p>${safeText(m.text)}</p>`;
  $('#messages').appendChild(e);
}
function showTyping(){
  if($('#typingMessage'))return;
  const e=document.createElement('article');e.className='message assistant';e.id='typingMessage';
  e.innerHTML=`<div class="message-meta"><strong>${safeText(state.coreName)}</strong><span>procesando</span></div><span class="typing"><i></i><i></i><i></i></span>`;
  $('#messages').appendChild(e);scrollChat();
}
function hideTyping(){$('#typingMessage')?.remove()}
function scrollChat(){requestAnimationFrame(()=>{const s=$('.chat-layout');if(s)s.scrollTop=s.scrollHeight})}
function addMessage(role,text){
  text=role==='assistant'?sanitizeAssistantText(text):String(text??'').trim();
  if(!text)return;
  const i={role,text,at:nowLabel()};state.messages.push(i);persistMessages();renderMessage(i);scrollChat();
}

async function getAIReply(message){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),65000);
  try{
    const r=await fetch('/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message,mode:state.mode,history:state.messages.slice(0,-1).slice(-12),sessionId:localStorage.getItem('iu.sessionId')||'',attachments:window.__waeRuntimeAttachments||[]}),
      signal:c.signal
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d||typeof d.reply!=='string')throw new Error(d?.error||`runtime_${r.status}`);
    const clean=sanitizeAssistantText(d.reply);
    if(!clean)throw new Error('unsafe_or_empty_output');
    return clean;
  }catch(e){
    console.warn('[WAE IU] runtime unavailable',e?.message||e);
    return 'El núcleo de inteligencia está reconectando. Tu conversación sigue segura; vuelve a enviar el mensaje en unos segundos.';
  }finally{clearTimeout(timer)}
}

function setMode(mode){
  state.mode=mode;localStorage.setItem('wae.mode',mode);
  $('#modePill').textContent=modeLabels[mode]||'General';
  $$('.capability-card').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  $('#messageInput')?.focus();
}
function resetConversation(){state.messages=[];persistMessages();renderMessages();toast('Nueva conversación creada')}
function openDrawer(){$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#scrim').classList.add('visible')}
function closeDrawer(){$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#scrim').classList.remove('visible')}
function openWorkspace(){$('#workspace').classList.add('open');$('#workspace').setAttribute('aria-hidden','false');closeDrawer()}
function closeWorkspace(){$('#workspace').classList.remove('open');$('#workspace').setAttribute('aria-hidden','true')}

function switchWorkspaceTab(tab){
  $$('.workspace-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $$('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${tab}`));
  if(tab==='html')updatePreview();
}
function markDirty(){$('#saveState').textContent='Cambios sin guardar'}
function saveWorkspace(){
  state.document=$('#documentEditor').innerHTML;state.html=$('#htmlEditor').value;
  localStorage.setItem('wae.document',state.document);localStorage.setItem('wae.html',state.html);
  $('#saveState').textContent='Guardado';toast('Workspace guardado');
}
function updatePreview(){$('#htmlPreview').srcdoc=$('#htmlEditor').value}
function downloadText(filename,content,type='text/plain'){
  const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function exportWorkspace(){
  const a=$('.workspace-tabs button.active')?.dataset.tab;
  if(a==='html')downloadText('wae-canvas.html',$('#htmlEditor').value,'text/html');
  else downloadText('wae-workspace.html',`<!doctype html><meta charset="utf-8"><title>WAE Workspace</title><body>${$('#documentEditor').innerHTML}</body>`,'text/html');
  toast('Archivo exportado');
}

let toastTimer;
function toast(message){
  let e=$('.toast');
  if(!e){e=document.createElement('div');e.className='toast';$('.app-shell').appendChild(e)}
  e.textContent=message;e.classList.add('show');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>e.classList.remove('show'),1800);
}
window.toast=toast;

function autosizeInput(){
  const i=$('#messageInput');if(!i)return;
  i.style.height='auto';i.style.height=`${Math.min(i.scrollHeight,120)}px`;
}

async function submitMessage(ev){
  ev.preventDefault();
  const i=$('#messageInput'),m=i.value.trim();
  if(!m||state.busy)return;
  state.busy=true;
  const send=$('.send-btn');if(send){send.disabled=true;send.setAttribute('aria-busy','true')}
  i.value='';autosizeInput();addMessage('user',m);showTyping();
  try{const r=await getAIReply(m);hideTyping();addMessage('assistant',r)}
  finally{
    state.busy=false;hideTyping();
    if(send){send.disabled=false;send.removeAttribute('aria-busy')}
    i.focus();
  }
}

function openSettings(){
  const ep=$('#apiEndpoint');if(ep){ep.value='/api/chat';ep.disabled=true}
  $('#coreName').value=state.coreName;$('#settingsDialog').showModal();closeDrawer();
}
function saveSettings(){
  state.endpoint='/api/chat';
  state.coreName=$('#coreName').value.trim()||'Universal Core';
  localStorage.setItem('wae.endpoint','/api/chat');localStorage.setItem('wae.coreName',state.coreName);
  $('#settingsDialog').close();renderMessages();toast('Configuración guardada');
}
function initDocument(){
  if(state.document)$('#documentEditor').innerHTML=state.document;
  if(state.html)$('#htmlEditor').value=state.html;
  updatePreview();
}
function initInteractions(){
  $('#menuBtn').addEventListener('click',openDrawer);
  $('#closeDrawerBtn').addEventListener('click',closeDrawer);
  $('#scrim').addEventListener('click',closeDrawer);
  $('#newChatBtn').addEventListener('click',resetConversation);
  $('#drawerNewChat').addEventListener('click',()=>{resetConversation();closeDrawer()});
  $('#workspaceBtn').addEventListener('click',openWorkspace);
  $('#drawerWorkspace').addEventListener('click',openWorkspace);
  $('#closeWorkspaceBtn').addEventListener('click',closeWorkspace);
  $('#composer').addEventListener('submit',submitMessage);
  $('#messageInput').addEventListener('input',autosizeInput);
  $('#messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#composer').requestSubmit()}});
  $$('.capability-card').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $$('.workspace-tabs button').forEach(b=>b.addEventListener('click',()=>switchWorkspaceTab(b.dataset.tab)));
  $$('.toolbar button').forEach(b=>b.addEventListener('click',()=>{document.execCommand(b.dataset.format,false,b.dataset.value||null);$('#documentEditor').focus();markDirty()}));
  $('#documentEditor').addEventListener('input',markDirty);
  $('#htmlEditor').addEventListener('input',()=>{updatePreview();markDirty()});
  $('#saveBtn').addEventListener('click',saveWorkspace);
  $('#exportBtn').addEventListener('click',exportWorkspace);
  $('#attachBtn').addEventListener('click',()=>$('#fileInput').click());
  $('#fileInput').addEventListener('change',e=>{const c=e.target.files.length;if(c)toast(`${c} archivo${c>1?'s':''} seleccionado${c>1?'s':''}`)});
  $('#voiceBtn').addEventListener('click',()=>toast('Voz lista'));
  $('#settingsBtn').addEventListener('click',openSettings);
  $('#saveSettingsBtn').addEventListener('click',saveSettings);
  $$('.nav-list button[data-view]').forEach(b=>b.addEventListener('click',()=>{toast(`${b.querySelector('span').textContent}: módulo preparado`);closeDrawer()}));
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#workspace').classList.contains('open'))closeWorkspace()});
}
function registerSW(){if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{})}

renderMessages();initDocument();initInteractions();setMode(state.mode);registerSW();
