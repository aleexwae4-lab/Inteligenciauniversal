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

try{localStorage.setItem('wae.endpoint','/api/chat')}catch(error){console.warn('[WAE] endpoint preference not persisted',error)}
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

function persistMessages(){
 const recent=state.messages.slice(-60);
 if(window.WAEStorage){window.WAEStorage.save('active',recent).catch(error=>{console.warn('[WAE] active chat archive failed',error);window.toast?.('No se pudo guardar el chat en este dispositivo. Exporta memoria desde Conversaciones.')})}
 else try{localStorage.setItem('wae.messages',JSON.stringify(recent))}catch(error){console.warn('[WAE] active chat local storage failed',error);window.toast?.('No se pudo guardar el chat: exporta memoria desde Conversaciones.')}
 window.dispatchEvent(new CustomEvent('wae:messages-changed'))
}
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
let typingTimer=null;
function showTyping(){
  if($('#typingMessage'))return;
  const e=document.createElement('article');e.className='message assistant';e.id='typingMessage';
  e.innerHTML=`<div class="message-meta"><strong>${safeText(state.coreName)}</strong><span id="typingElapsed" role="status">Procesando · 0 s</span></div><span class="typing"><i></i><i></i><i></i></span>`;
  $('#messages').appendChild(e);scrollChat();
  const started=Date.now();if(typingTimer)clearInterval(typingTimer);
  typingTimer=setInterval(()=>{const t=$('#typingElapsed');if(!t){clearInterval(typingTimer);typingTimer=null;return}t.textContent=`Procesando · ${Math.floor((Date.now()-started)/1000)} s`;},1000);
}
function hideTyping(){if(typingTimer){clearInterval(typingTimer);typingTimer=null}$('#typingMessage')?.remove()}
function scrollChat(){requestAnimationFrame(()=>{const s=$('.chat-layout');if(s)s.scrollTop=s.scrollHeight})}
function addMessage(role,text){
  text=role==='assistant'?sanitizeAssistantText(text):String(text??'').trim();
  if(!text)return;
  const i={role,text,at:nowLabel()};state.messages.push(i);persistMessages();renderMessage(i);scrollChat();
}

async function getAIReply(message){
  // All native tools are dispatched by Universal Core, independent of the button used to provide evidence.
  try{
    const tool=await window.WAECoreTools?.runTurn({
      message,mode:state.mode,history:state.messages.slice(0,-1).slice(-8),
      attachments:window.__waeRuntimeAttachments||[],
      project:window.WAENavigation?.getProjectContext?.()||{}
    });
    if(tool?.handled)return tool.reply;
  }catch(error){
    console.warn('[WAE Core Tool] real execution did not complete',error?.code||error?.message);
    return 'La evidencia visual sigue preparada. '+String(error?.message||'No se pudo completar el análisis.').slice(0,220)+' No afirmaré que analicé la imagen hasta recibir un resultado real. Puedes reintentar o quitar la captura.';
  }
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),100000);
  try{
    const r=await fetch('/api/chat',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message,mode:state.mode,history:state.messages.slice(0,-1).slice(-12),sessionId:localStorage.getItem('iu.sessionId')||'',attachments:window.__waeRuntimeAttachments||[],preferences:window.WAESettings?.getPromptSettings?.()||{},project:window.WAENavigation?.getProjectContext?.()||{}}),
      signal:c.signal
    });
    const d=await r.json().catch(()=>({}));
    if(d?.e2e&&typeof d.e2e==='object'){window.__waeLastTurnE2E=d.e2e;window.__waeLastTurnAt=Date.now();}
    if(!r.ok||!d||d.success===false||typeof d.reply!=='string')throw new Error(d?.error||`runtime_${r.status}`);
    const clean=sanitizeAssistantText(d.reply);
    const terminal=/la ia no respondió|ninguna ruta alcanzó el umbral|tu solicitud quedó preservada|no obtuvo una respuesta suficientemente confiable|reconectando el núcleo de inteligencia/i.test(clean);
    if(!clean||d.recoverable===true||d.provider==='web_recovery'||d.resilience?.automatic_evidence_rescue===true||d.answer_assurance?.finalSafeFallback===true||(d.degraded===true&&terminal))throw new Error('no_generative_answer');
    return clean;
  }catch(e){
    console.warn('[WAE IU] runtime unavailable',e?.message||e);
    if(typeof applyTurnE2E==='function')applyTurnE2E(window.__waeLastTurnE2E);
    // A provider outage is a transport failure, not an assistant answer.
    // Keep the user's submitted question in the transcript and restore the
    // draft for one-touch retry instead of persisting a fake assistant turn.
    return null;
  }finally{clearTimeout(timer)}
}

const modeDescriptions={
  research:'Investigar: consultaré fuentes pertinentes si la búsqueda está disponible. Escribe tu pregunta y envíala.',
  code:'Programar: priorizaré código, arquitectura y depuración. Describe qué necesitas construir.',
  analysis:'Analizar: priorizaré datos, riesgos y razonamiento. Comparte la información que quieres examinar.',
  design:'Diseñar: priorizaré producto, experiencia e interfaz. Describe tu idea o proyecto.'
};
const modePlaceholders={
  general:'Describe una misión, crea un sistema o haz una consulta…',
  research:'¿Qué deseas investigar?',
  code:'¿Qué necesitas programar o depurar?',
  analysis:'¿Qué datos, situación o problema quieres analizar?',
  design:'¿Qué producto, interfaz o experiencia deseas diseñar?'
};
function setMode(mode){
  mode=Object.hasOwn(modeLabels,mode)?mode:'general';
  state.mode=mode;
  try{localStorage.setItem('wae.mode',mode)}catch(error){console.warn('[WAE] no se pudo conservar la preferencia de modo',error)}
  const pill=$('#modePill'),input=$('#messageInput'),composer=$('#composer');
  if(pill){
    pill.textContent=mode==='general'?'General':'✓ '+modeLabels[mode]+' activo';
    pill.classList.toggle('wae-mode-visible',mode!=='general');
    pill.setAttribute('aria-live','polite');
    pill.setAttribute('aria-label',mode==='general'?'Modo general':'Modo '+modeLabels[mode]+' activo');
    let clear=$('#waeModeClear');
    if(!clear){
      clear=document.createElement('button');
      clear.id='waeModeClear';clear.type='button';clear.className='wae-mode-clear';
      clear.textContent='×';clear.title='Desactivar modo y volver a General';
      clear.setAttribute('aria-label','Desactivar '+modeLabels[mode]+' y volver a General');
      clear.addEventListener('click',event=>{event.stopPropagation();setMode('general')});
    }
    if(mode!=='general'){
      clear.hidden=false;clear.setAttribute('aria-label','Desactivar '+modeLabels[mode]+' y volver a General');
      pill.append(clear);
    }
  }
  if(input)input.placeholder=modePlaceholders[mode];
  let helper=$('#waeModeHelp');
  if(!helper&&composer){
    helper=document.createElement('small');helper.id='waeModeHelp';
    helper.className='wae-mode-help';helper.setAttribute('role','status');helper.setAttribute('aria-live','polite');
    pill?.after(helper);
  }
  if(helper){helper.textContent=modeDescriptions[mode]||'';helper.hidden=mode==='general'}
  $$('.capability-card').forEach(button=>{
    const selected=button.dataset.mode===mode;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
    button.setAttribute('aria-controls','messageInput');
    button.title=selected?modeLabels[mode]+' activo · escribe tu consulta':'Activar '+(modeLabels[button.dataset.mode]||'modo');
  });
  window.dispatchEvent(new CustomEvent('wae:mode-changed',{detail:{mode}}));
}
function resetConversation(){if(state.busy)return;window.WAECamera?.clear?.();if(window.WAENavigation?.newConversation?.())return;state.messages=[];persistMessages();renderMessages();toast('Nueva conversación creada')}
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
async function saveWorkspace(){
 state.document=$('#documentEditor').innerHTML;state.html=$('#htmlEditor').value;
 try{
  if(window.WAEStorage){await window.WAEStorage.ready;await window.WAEStorage.save('document',state.document);await window.WAEStorage.save('html',state.html)}
  else{localStorage.setItem('wae.document',state.document);localStorage.setItem('wae.html',state.html)}
  $('#saveState').textContent='Guardado';toast('Workspace guardado');
 }catch(error){console.warn('[WAE] workspace archive failed',error);$('#saveState').textContent='Sin guardar';toast('No se guardó el Workspace. Exporta una copia antes de salir.')}
}
let previewTimer;
function updatePreview(){
  clearTimeout(previewTimer);
  previewTimer=setTimeout(()=>{
    if(window.WAECanvasRefreshPreview){window.WAECanvasRefreshPreview();return}
    const html=$('#htmlEditor').value;
    $('#htmlPreview').srcdoc=window.WAECanvasPreparePreview?.(html)||html;
  },250);
}
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

function showRetryTurn(message){
  $('#waeRetryTurn')?.remove();
  const e=document.createElement('div');e.id='waeRetryTurn';e.className='wae-retry-turn';e.setAttribute('role','alert');
  const label=document.createElement('span');label.textContent='La generación no se completó. Conservé tu pregunta para reintentar.';
  const retry=document.createElement('button');retry.type='button';retry.textContent='↻ Reintentar';
  retry.addEventListener('click',()=>{if(state.busy)return;const i=$('#messageInput');if(!i)return;i.value=message;autosizeInput();$('#composer').requestSubmit()});
  e.append(label,retry);$('#messages').append(e);scrollChat();
}
function applyTurnE2E(meta=window.__waeLastTurnE2E){
  if(!meta||typeof meta!=='object')return;
  const label=$('#coreStatusLabel'),status=$('#coreStatusMeta');
  if(!label||!status)return;
  const latency=Number(meta.latencyMs),latencyText=Number.isFinite(latency)&&latency>=0?' · '+Math.round(latency)+' ms':'';
  if(meta.status==='failed'){
    label.textContent='Universal Core · E2E degradado';
    status.textContent='Turno no completado'+latencyText;
    return;
  }
  if(meta.status==='degraded'){
    label.textContent='Universal Core · E2E parcial';
    status.textContent='Respuesta disponible · revisar voz'+latencyText;
    return;
  }
  if(meta.recovered||meta.status==='recovered'){
    label.textContent='Universal Core · E2E recuperado';
    status.textContent=(Number(meta.recoveryCount)||1)+' recuperación'+((Number(meta.recoveryCount)||1)===1?'':'es')+latencyText;
    return;
  }
  label.textContent='Universal Core · E2E operativo';
  status.textContent='Turno verificado'+latencyText;
}
function markUIStage(meta){
  if(!meta||!Array.isArray(meta.stages))return meta;
  const next={...meta,stages:meta.stages.map(stage=>stage?.id==='ui'?{...stage,status:'ok'}:stage)};
  window.__waeLastTurnE2E=next;
  window.dispatchEvent(new CustomEvent('wae:turn-e2e',{detail:next}));
  return next;
}

function markVoiceStage(detail={}){
  const meta=window.__waeLastTurnE2E;
  if(!meta||!Array.isArray(meta.stages))return;
  const status=String(detail.status||'');
  const stageStatus=status==='recovered'?'recovered':status==='failed'?'failed':status==='completed'||status==='playing'?'ok':'unobserved';
  let recoveryCount=Number(meta.recoveryCount)||0,recovered=!!meta.recovered,nextStatus=meta.status;
  if(stageStatus==='recovered'){
    const wasRecovered=meta.stages.some(stage=>stage?.id==='voice'&&stage.status==='recovered');
    if(!wasRecovered)recoveryCount++;
    recovered=true;nextStatus='recovered';
  }else if(stageStatus==='failed'&&nextStatus!=='failed'){
    nextStatus='degraded';
  }
  const next={...meta,status:nextStatus,recovered,recoveryCount,stages:meta.stages.map(stage=>stage?.id==='voice'?{...stage,status:stageStatus,code:detail.code||undefined,fallback:!!detail.fallback}:stage)};
  window.__waeLastTurnE2E=next;applyTurnE2E(next);
}
async function submitMessage(ev){
  ev.preventDefault();
  const i=$('#messageInput'),m=i.value.trim()||(window.WAECoreTools?.defaultQuestion?.()||'');
  if(!m||state.busy)return;
  state.busy=true;$('#waeRetryTurn')?.remove();
  const send=$('.send-btn');if(send){send.disabled=true;send.setAttribute('aria-busy','true')}
  i.value='';autosizeInput();
  // Retrying after a transport error should not duplicate an unanswered user
  // message or silently discard the original question.
  const previous=state.messages.at(-1);
  if(previous?.role!=='user'||previous.text!==m)addMessage('user',m);
  showTyping();
  try{
    const r=await getAIReply(m);hideTyping();
    // v130: health remains global, while the last completed turn exposes its own E2E contract.
    void refreshCoreReadiness().then(()=>applyTurnE2E(window.__waeLastTurnE2E));
    if(typeof r==='string'&&r.trim()){addMessage('assistant',r);applyTurnE2E(markUIStage(window.__waeLastTurnE2E));}
    else{
      if(!i.value.trim()){i.value=m;autosizeInput();}
      showRetryTurn(m);
      return;
    }
    // A failed multimodal request never discards the user's question or evidence.
    if(window.WAECamera?.status?.().pending&&window.WAECoreTools?.status?.().last?.ok===false&&!i.value.trim()){
      i.value=m;autosizeInput();
    }
  }
  finally{
    state.busy=false;hideTyping();
    if(send){send.disabled=false;send.removeAttribute('aria-busy')}
    i.focus();
  }
}

function openSettings(){
  if(window.WAESettings){window.WAESettings.open();return}
  const ep=$('#apiEndpoint');if(ep){ep.value='/api/chat';ep.disabled=true}
  $('#coreName').value=state.coreName;$('#settingsDialog').showModal();closeDrawer();
}
function saveSettings(){
  if(window.WAESettings){window.WAESettings.save();return}
  state.endpoint='/api/chat';
  state.coreName=$('#coreName').value.trim()||'Universal Core';
  localStorage.setItem('wae.endpoint','/api/chat');localStorage.setItem('wae.coreName',state.coreName);
  $('#settingsDialog').close();renderMessages();toast('Configuración guardada');
}
function initDocument(){
 const editor=$('#documentEditor'),htmlEditor=$('#htmlEditor');
 if(state.document)editor.innerHTML=state.document;
 if(state.html)htmlEditor.value=state.html;
 const initialDocument=editor.innerHTML,initialHtml=htmlEditor.value;
 updatePreview();
 if(window.WAEStorage){window.WAEStorage.ready.then(async()=>{
  const [doc,html]=await Promise.all([window.WAEStorage.load('document'),window.WAEStorage.load('html')]);
  if(typeof doc==='string'&&editor.innerHTML===initialDocument){state.document=doc;editor.innerHTML=doc}
  if(typeof html==='string'&&htmlEditor.value===initialHtml){state.html=html;htmlEditor.value=html;updatePreview()}
 }).catch(error=>console.warn('[WAE] Workspace archive recovery unavailable',error))}
}
function initInteractions(){
  $('#profileBtn')?.addEventListener('click',openSettings);
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
  // The runtime attachment reader confirms which text files actually reached the AI; never announce raw selection as success.
  $('#voiceBtn').addEventListener('click',()=>{if(!window.WAEVoice)toast('La voz no está disponible en esta sesión')});
  $('#settingsBtn').addEventListener('click',openSettings);
  $('#saveSettingsBtn').addEventListener('click',saveSettings);
  $$('.nav-list button[data-view]').forEach(b=>b.addEventListener('click',()=>{toast(`${b.querySelector('span').textContent}: no disponible todavía en esta versión`);closeDrawer()}));
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#workspace').classList.contains('open'))closeWorkspace()});
}
function registerSW(){if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{})}

window.WAEModes={select:setMode,current:()=>state.mode};
window.WAEChatState={snapshot:()=>state.messages.map(m=>({...m})),restore:(messages,mode)=>{state.messages=Array.isArray(messages)?messages.map(m=>({...m})):[];persistMessages();renderMessages();if(mode)setMode(mode)},busy:()=>state.busy,mode:()=>state.mode};
async function refreshCoreReadiness(){
  const label=$('#coreStatusLabel'),meta=$('#coreStatusMeta'),memory=$('#memoryStatus');
  if(!label||!meta)return;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
  try{
    const r=await fetch('/api/health',{cache:'no-store',signal:controller.signal});
    const health=await r.json();
    const configured=health.generativeReady===true||health.ready===true;
    const verified=health.providerInferenceVerified===true;
    const operations=health.operations||{};
    const latency=Number(operations.lastLatencyMs);
    const latencyText=Number.isFinite(latency)&&latency>=0?' · '+Math.round(latency)+' ms':'';
    const fresh=operations.inferenceFresh===true;
    label.textContent=verified?'Universal Core · generación verificada':configured?'Universal Core · proveedores configurados':'Universal Core · generación no disponible';
    meta.textContent=verified?(fresh?'Inferencia real'+latencyText:'Inferencia verificada anteriormente'+latencyText):configured?'Esperando una inferencia generativa real':'Revisar proveedor';
    if(memory)memory.textContent=health.memory?.configured?'Memoria configurada':'Memoria no configurada';
  }catch{
    label.textContent='Universal Core · estado no verificado';meta.textContent='Revisar conexión';
    if(memory)memory.textContent='Memoria sin verificar';
  }finally{clearTimeout(timer)}
}
renderMessages();initDocument();initInteractions();setMode(state.mode);registerSW();void refreshCoreReadiness();
window.addEventListener('online',refreshCoreReadiness);
window.addEventListener('pageshow',refreshCoreReadiness);
window.addEventListener('wae:voice-e2e',event=>markVoiceStage(event.detail||{}));