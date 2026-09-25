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
  return e;
}
let typingTimer=null;
const turnStageLabels={router:'Interpretando',memory:'Recuperando contexto',tools:'Ejecutando herramientas',provider:'Generando respuesta',sources:'Verificando evidencia',persistence:'Guardando continuidad'};
const turnStageOrder=['router','memory','tools','provider','sources','persistence'];
function stageStatusSymbol(status){return status==='ok'?'✓':status==='recovered'?'↻':status==='skipped'?'–':status==='failed'?'!':'•'}
function updateTurnProgress(detail={}){
  if(!detail||detail.type!=='stage'||!turnStageOrder.includes(detail.stage))return;
  const current=$('#typingStage'),list=$('#typingStages');if(!current||!list)return;
  const label=turnStageLabels[detail.stage]||detail.stage;
  if(detail.phase==='begin')current.textContent=label;
  let chip=list.querySelector(`[data-stage="${detail.stage}"]`);
  if(!chip){chip=document.createElement('span');chip.dataset.stage=detail.stage;list.appendChild(chip)}
  chip.className='wae-turn-stage '+String(detail.status||'running');
  chip.textContent=stageStatusSymbol(detail.status)+' '+label;
  chip.title=detail.phase==='end'&&Number.isFinite(Number(detail.latencyMs))?label+' · '+Math.round(Number(detail.latencyMs))+' ms':label;
  if(detail.phase==='end'&&detail.stage==='persistence')current.textContent=detail.status==='failed'?'Respuesta lista · continuidad no guardada':'Respuesta verificada';
}
window.addEventListener('wae:turn-progress',event=>updateTurnProgress(event.detail));
function updateProviderProgress(detail={}){
  if(!detail||typeof detail!=='object')return;
  const current=$('#typingStage'),providerChip=$('#typingStages')?.querySelector('[data-stage="provider"]');
  if(!current)return;
  const provider=String(detail.provider||'proveedor');
  if(detail.type==='attempt'){
    current.textContent=detail.streaming?'Conectando stream · '+provider:'Consultando · '+provider;
  }else if(detail.type==='first_token'){
    const ttft=Number(detail.ttftMs);
    current.textContent='Primer token recibido'+(Number.isFinite(ttft)?' · '+Math.round(ttft)+' ms':'');
    if(providerChip&&Number.isFinite(ttft))providerChip.title='Proveedor · primer token '+Math.round(ttft)+' ms';
  }else if(detail.type==='circuit_open'){
    current.textContent='Proveedor aislado · buscando alternativa';
  }else if(detail.type==='quarantined'){
    const seconds=Number.isFinite(Number(detail.remainingMs))?Math.ceil(Number(detail.remainingMs)/1000):null;
    current.textContent='Ruta en cuarentena por SLO'+(seconds?' · '+seconds+' s':'')+' · usando alternativa';
  }else if(detail.type==='probation'){
    current.textContent='Probando recuperación controlada · '+provider;
  }else if(detail.type==='recovered'){
    current.textContent='Ruta recuperada · '+provider;
  }else if(detail.type==='failed'){
    current.textContent='Proveedor falló · recuperación automática';
  }else if(detail.type==='quality_rejected'){
    current.textContent='Respuesta rechazada por calidad · reintentando';
  }else if(detail.type==='complete'&&detail.streaming){
    current.textContent='Generación recibida · verificando calidad';
  }
}
window.addEventListener('wae:provider-progress',event=>updateProviderProgress(event.detail));
function showTyping(){
  if($('#typingMessage'))return;
  const e=document.createElement('article');e.className='message assistant';e.id='typingMessage';
  e.innerHTML=`<div class="message-meta"><strong>${safeText(state.coreName)}</strong><span id="typingElapsed" role="status">Procesando · 0 s</span></div><div class="wae-turn-progress"><span id="typingStage">Conectando con Universal Core</span><div id="typingStages" class="wae-turn-stages" aria-label="Progreso real del turno"></div></div><span class="typing"><i></i><i></i><i></i></span>`;
  $('#messages').appendChild(e);scrollChat();
  const started=Date.now();if(typingTimer)clearInterval(typingTimer);
  typingTimer=setInterval(()=>{const t=$('#typingElapsed');if(!t){clearInterval(typingTimer);typingTimer=null;return}t.textContent=`Procesando · ${Math.floor((Date.now()-started)/1000)} s`;},1000);
}
function hideTyping(){if(typingTimer){clearInterval(typingTimer);typingTimer=null}$('#typingMessage')?.remove()}
function scrollChat(){requestAnimationFrame(()=>{const s=$('.chat-layout');if(s)s.scrollTop=s.scrollHeight})}
function addMessage(role,text){
  text=role==='assistant'?sanitizeAssistantText(text):String(text??'').trim();
  if(!text)return null;
  const i={role,text,at:nowLabel()};state.messages.push(i);persistMessages();
  const article=renderMessage(i);scrollChat();return article;
}

function captureResponseEnvelope(d){
  if(d?.e2e&&typeof d.e2e==='object'){window.__waeLastTurnE2E=d.e2e;window.__waeLastTurnAt=Date.now();}
  if(!d||typeof d!=='object')return;
  const nativeEnvelope=d.response&&typeof d.response==='object'?d.response:{};
  window.__waePendingResponseEnvelope={
    schema:String(nativeEnvelope.schema||'assistant-response/v2'),
    speechText:String(d.speech_text||nativeEnvelope.speechText||'').slice(0,12000),
    sources:Array.isArray(d.sources)?d.sources:(Array.isArray(nativeEnvelope.sources)?nativeEnvelope.sources:[]),
    components:Array.isArray(d.components)?d.components:(Array.isArray(nativeEnvelope.components)?nativeEnvelope.components:[]),
    actions:Array.isArray(d.actions)?d.actions:(Array.isArray(nativeEnvelope.actions)?nativeEnvelope.actions:[]),
    metadata:{...(nativeEnvelope.metadata||{}),requestId:d.request_id||nativeEnvelope.metadata?.requestId||null,progressive:d.progressive?.version||null}
  };
}
function parseSSEBlock(block){
  let event='message',data='';
  for(const line of String(block||'').split('\n')){
    if(line.startsWith('event:'))event=line.slice(6).trim();
    else if(line.startsWith('data:'))data+=(data?'\n':'')+line.slice(5).trim();
  }
  if(!data)return null;
  try{return{event,data:JSON.parse(data)}}catch{return null}
}
async function progressiveChat(payload,signal){
  const r=await fetch('/api/chat-stream',{
    method:'POST',
    headers:{'Content-Type':'application/json','Accept':'text/event-stream'},
    body:JSON.stringify(payload),
    signal
  });
  if(!r.ok||!r.body?.getReader)throw Object.assign(new Error(`stream_${r.status}`),{safeFallback:true});
  const reader=r.body.getReader(),decoder=new TextDecoder();
  let buffer='',ready=false,result=null;
  try{
    while(true){
      const {done,value}=await reader.read();
      buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
      let cut;
      while((cut=buffer.indexOf('\n\n'))>=0){
        const parsed=parseSSEBlock(buffer.slice(0,cut));buffer=buffer.slice(cut+2);
        if(!parsed)continue;
        if(parsed.event==='ready'){ready=true;window.__waeProgressContract=parsed.data;continue}
        if(parsed.event==='progress'){
          window.dispatchEvent(new CustomEvent('wae:turn-progress',{detail:parsed.data}));
          continue;
        }
        if(parsed.event==='provider'){
          window.dispatchEvent(new CustomEvent('wae:provider-progress',{detail:parsed.data}));
          continue;
        }
        if(parsed.event==='result'){result=parsed.data;continue}
        if(parsed.event==='error')throw Object.assign(new Error(parsed.data?.error||'stream_runtime_error'),{safeFallback:!ready,e2e:parsed.data?.e2e});
      }
      if(done)break;
    }
  }catch(error){
    try{reader.cancel()}catch{}
    if(error?.name==='AbortError')throw error;
    if(error?.safeFallback===undefined)error.safeFallback=!ready;
    throw error;
  }
  if(!result)throw Object.assign(new Error('stream_without_result'),{safeFallback:!ready});
  return result;
}
async function jsonChat(payload,signal){
  const r=await fetch('/api/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),signal
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.error||`runtime_${r.status}`);
  return data;
}

async function getAIReply(message){
  window.__waePendingResponseEnvelope=null;
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

  const payload={
    message,mode:state.mode,history:state.messages.slice(0,-1).slice(-12),
    sessionId:localStorage.getItem('iu.sessionId')||'',
    attachments:window.__waeRuntimeAttachments||[],
    preferences:window.WAESettings?.getPromptSettings?.()||{},
    project:window.WAENavigation?.getProjectContext?.()||{}
  };
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100000);
  try{
    let d;
    try{
      d=await progressiveChat(payload,controller.signal);
    }catch(streamError){
      if(streamError?.name==='AbortError')throw streamError;
      if(streamError?.safeFallback===true){
        console.warn('[WAE Progressive] SSE unavailable before turn start; using compatibility transport');
        d=await jsonChat(payload,controller.signal);
      }else throw streamError;
    }
    captureResponseEnvelope(d);
    if(!d||d.success===false||typeof d.reply!=='string')throw new Error(d?.error||'runtime_invalid_response');
    const clean=sanitizeAssistantText(d.reply);
    const terminal=/la ia no respondió|ninguna ruta alcanzó el umbral|tu solicitud quedó preservada|no obtuvo una respuesta suficientemente confiable|reconectando el núcleo de inteligencia/i.test(clean);
    if(!clean||d.recoverable===true||d.provider==='web_recovery'||d.resilience?.automatic_evidence_rescue===true||d.answer_assurance?.finalSafeFallback===true||(d.degraded===true&&terminal))throw new Error('no_generative_answer');
    return clean;
  }catch(error){
    window.__waePendingResponseEnvelope=null;
    console.warn('[WAE IU] runtime unavailable',error?.message||error);
    if(error?.e2e&&typeof error.e2e==='object'){window.__waeLastTurnE2E=error.e2e;window.__waeLastTurnAt=Date.now();}
    if(typeof applyTurnE2E==='function')applyTurnE2E(window.__waeLastTurnE2E);
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
  // v143: arm the audio pipeline inside the same trusted gesture that submits the turn.
  try{window.dispatchEvent(new CustomEvent('wae:voice-prime',{detail:{reason:'submit'}}))}catch(_){}
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
    if(typeof r==='string'&&r.trim()){
      const assistantArticle=addMessage('assistant',r);
      applyTurnE2E(markUIStage(window.__waeLastTurnE2E));
      // v143: autoplay is an explicit completed-turn contract, not a MutationObserver side effect.
      try{window.dispatchEvent(new CustomEvent('wae:assistant-final',{detail:{article:assistantArticle,at:Date.now()}}))}catch(_){}
    }
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