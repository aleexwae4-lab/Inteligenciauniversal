const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function safeText(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function nowLabel(){return new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}).format(new Date())}

function sanitizeAssistantText(raw){
  raw=String(raw??'').trim();if(!raw)return'';const lower=raw.toLowerCase();const tags=['thought','thoughts','analysis','reasoning'];let last=-1,end=-1;
  for(const tag of tags){const marker=`</${tag}>`,idx=lower.lastIndexOf(marker);if(idx>last){last=idx;end=idx+marker.length}}
  let text=last>=0?raw.slice(end):raw;for(const tag of tags)text=text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'gi'),'');
  text=text.replace(/<\/?(?:thoughts?|analysis|reasoning)\b[^>]*>/gi,'').trim();
  if(/(?:Language Policy|RELEVANT MEMORY|VERIFIED WEB EVIDENCE|system_guidance|Role:\s*Advanced general-purpose AI)/i.test(text))return'';return text;
}

function inlineMarkdown(s){
  let x=safeText(s);x=x.replace(/`([^`]+)`/g,'<code>$1</code>');x=x.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');x=x.replace(/__([^_]+)__/g,'<strong>$1</strong>');x=x.replace(/\*([^*]+)\*/g,'<em>$1</em>');return x;
}
function renderPremiumText(text){
  const lines=String(text||'').split(/\r?\n/);let html='',list=null,table=[];
  const closeList=()=>{if(list){html+=`</${list}>`;list=null}};
  const flushTable=()=>{if(table.length<2){table=[];return}const rows=table.map(r=>r.split('|').slice(1,-1).map(c=>c.trim()));const divider=rows[1]?.every(c=>/^:?-{3,}:?$/.test(c));if(!divider){table=[];return}html+='<div class="rich-table-wrap"><table class="rich-table"><thead><tr>'+rows[0].map(c=>`<th>${inlineMarkdown(c)}</th>`).join('')+'</tr></thead><tbody>'+rows.slice(2).map(r=>'<tr>'+r.map(c=>`<td>${inlineMarkdown(c)}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>';table=[]};
  for(let i=0;i<lines.length;i++){const line=lines[i];if(/^\|.*\|\s*$/.test(line)){closeList();table.push(line);continue}else if(table.length)flushTable();
    if(!line.trim()){closeList();continue}let m;
    if((m=line.match(/^(#{1,3})\s+(.+)$/))){closeList();const level=Math.min(4,m[1].length+1);html+=`<h${level}>${inlineMarkdown(m[2])}</h${level}>`;continue}
    if((m=line.match(/^[-*•]\s+(.+)$/))){if(list!=='ul'){closeList();list='ul';html+='<ul>'}html+=`<li>${inlineMarkdown(m[1])}</li>`;continue}
    if((m=line.match(/^\d+[.)]\s+(.+)$/))){if(list!=='ol'){closeList();list='ol';html+='<ol>'}html+=`<li>${inlineMarkdown(m[1])}</li>`;continue}
    if((m=line.match(/^>\s?(.+)$/))){closeList();html+=`<blockquote>${inlineMarkdown(m[1])}</blockquote>`;continue}
    if((m=line.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/))){closeList();html+=`<a class="answer-btn" href="${safeText(m[2])}" target="_blank" rel="noopener noreferrer">${inlineMarkdown(m[1])}</a>`;continue}
    if((m=line.match(/^\[BAR:\s*([^|]+)\|\s*(\d{1,3})%\s*\]$/i))){closeList();const v=Math.min(100,Number(m[2]));html+=`<div class="answer-meter"><div><strong>${inlineMarkdown(m[1].trim())}</strong><span>${v}%</span></div><i><b style="width:${v}%"></b></i></div>`;continue}
    closeList();html+=`<p>${inlineMarkdown(line)}</p>`;
  }if(table.length)flushTable();closeList();return html;
}
function voiceText(raw){return String(raw||'').replace(/```[\s\S]*?```/g,' código omitido ').replace(/https?:\/\/\S+/g,' enlace disponible ').replace(/[#*_`~>|]/g,' ').replace(/[•▪◦●◆◇■□►▶✓✔✦✣⌕⌘▦↻◈▤▧⚙＋➜☰◉]/g,' ').replace(/\p{Extended_Pictographic}/gu,' ').replace(/^\s*[-–—]+\s*/gm,' ').replace(/\[(.*?)\]\([^)]*\)/g,'$1').replace(/\[BAR:\s*([^|]+)\|\s*(\d{1,3})%\s*\]/gi,'$1, $2 por ciento.').replace(/\s+/g,' ').trim()}
function speakAnswer(text){if(!('speechSynthesis'in window))return toast('La voz no está disponible en este dispositivo');speechSynthesis.cancel();const clean=voiceText(text);if(!clean)return;const u=new SpeechSynthesisUtterance(clean);u.lang='es-MX';u.rate=.98;u.pitch=1;const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>/es[-_]MX/i.test(v.lang))||voices.find(v=>/^es/i.test(v.lang))||null;speechSynthesis.speak(u)}

function readStoredMessages(){let list=[];try{list=JSON.parse(localStorage.getItem('wae.messages')||'[]')}catch{}if(!Array.isArray(list))return[];return list.map(m=>{if(!m||!['user','assistant'].includes(m.role))return null;let text=String(m.text??'');if(m.role==='assistant'&&text.trim()==='**Sistema listo.** Investiga, programa, analiza, diseña o escribe directamente lo que necesitas.')return null;if(m.role==='assistant'){if(/No pude usar el endpoint configurado|configura tu endpoint IA|sustituir este motor local por inferencia real/i.test(text))return null;text=sanitizeAssistantText(text);if(!text)return null}return{role:m.role,text,at:String(m.at||'')};}).filter(Boolean).slice(-60)}
localStorage.setItem('wae.endpoint','/api/chat');
const state={mode:localStorage.getItem('wae.mode')||'general',endpoint:'/api/chat',coreName:localStorage.getItem('wae.coreName')||'Universal Core',document:localStorage.getItem('wae.document')||'',html:localStorage.getItem('wae.html')||'',messages:readStoredMessages(),busy:false,autoVoice:localStorage.getItem('wae.autoVoice')!=='false'};
const modeLabels={general:'General',research:'Investigar',code:'Programar',analysis:'Analizar',design:'Diseñar',executive:'Ejecutivo'};
function persistMessages(){localStorage.setItem('wae.messages',JSON.stringify(state.messages.slice(-60)))}
function renderMessages(){const t=$('#messages');t.innerHTML='';state.messages.forEach(renderMessage);scrollChat()}
function renderMessage(m){const e=document.createElement('article');e.className=`message ${m.role==='user'?'user':'assistant'}`;const n=m.role==='user'?'Tú':state.coreName;const body=m.role==='assistant'?`<div class="rich-answer">${renderPremiumText(m.text)}</div>`:`<p>${safeText(m.text)}</p>`;e.innerHTML=`<div class="message-meta"><strong>${safeText(n)}</strong><span>${safeText(m.at||nowLabel())}</span></div>${body}${m.role==='assistant'?'<div class="answer-actions"><button class="speak-answer" type="button">▶ Escuchar</button><button class="copy-answer" type="button">Copiar</button></div>':''}`;if(m.role==='assistant'){e.querySelector('.speak-answer')?.addEventListener('click',()=>speakAnswer(m.text));e.querySelector('.copy-answer')?.addEventListener('click',()=>navigator.clipboard?.writeText(m.text).then(()=>toast('Respuesta copiada')).catch(()=>{}))}$('#messages').appendChild(e)}
let typingTimer=null;
function showTyping(){
  if($('#typingMessage'))return;
  const e=document.createElement('article');e.className='message assistant';e.id='typingMessage';
  e.innerHTML=`<div class="message-meta"><strong>${safeText(state.coreName)}</strong><span id="typingElapsed" role="status">Esperando respuesta · 0 s</span></div><span class="typing"><i></i><i></i><i></i></span>`;
  $('#messages').appendChild(e);scrollChat();
  const started=Date.now();clearInterval(typingTimer);
  typingTimer=setInterval(()=>{const label=$('#typingElapsed');if(!label){clearInterval(typingTimer);typingTimer=null;return}label.textContent=`Esperando respuesta · ${Math.floor((Date.now()-started)/1000)} s`;},1000);
}
function hideTyping(){if(typingTimer){clearInterval(typingTimer);typingTimer=null}$('#typingMessage')?.remove()}function scrollChat(){requestAnimationFrame(()=>{const s=$('.chat-layout');if(s)s.scrollTop=s.scrollHeight})}
function addMessage(role,text){text=role==='assistant'?sanitizeAssistantText(text):String(text??'').trim();if(!text)return;const i={role,text,at:nowLabel()};state.messages.push(i);persistMessages();renderMessage(i);scrollChat();if(role==='assistant'&&state.autoVoice&&!window.__waeVoice)speakAnswer(text)}
async function getAIReply(message){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),65000);
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,mode:state.mode,preferences:{responseStyle:'premium-rich',voiceNatural:true}}),signal:c.signal});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d||d.success===false||typeof d.reply!=='string')throw new Error(d?.error||`runtime_${r.status}`);
    const clean=sanitizeAssistantText(d.reply);
    const terminal=/no obtuvo una respuesta suficientemente confiable|ninguna ruta alcanzó el umbral|tu solicitud quedó preservada|la ia no respondió|reconectando el núcleo de inteligencia/i.test(clean);
    if(!clean||d.recoverable===true||d.answer_assurance?.finalSafeFallback===true||(d.degraded===true&&terminal))throw new Error('no_generative_answer');
    return clean;
  }catch(e){console.warn('[WAE IU] turn did not complete',e?.message||e);throw e}
  finally{clearTimeout(timer)}
}
function setMode(mode){state.mode=mode;localStorage.setItem('wae.mode',mode);$('#modePill').textContent=modeLabels[mode]||'General';$$('.capability-card').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('#messageInput')?.focus()}
function resetConversation(){state.messages=[];persistMessages();renderMessages();toast('Nueva conversación creada')}function openDrawer(){$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#scrim').classList.add('visible')}function closeDrawer(){$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#scrim').classList.remove('visible')}function openWorkspace(){$('#workspace').classList.add('open');$('#workspace').setAttribute('aria-hidden','false');closeDrawer()}function closeWorkspace(){$('#workspace').classList.remove('open');$('#workspace').setAttribute('aria-hidden','true')}
function switchWorkspaceTab(tab){$$('.workspace-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$$('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`panel-${tab}`));if(tab==='html')updatePreview()}function markDirty(){$('#saveState').textContent='Cambios sin guardar'}function saveWorkspace(){state.document=$('#documentEditor').innerHTML;state.html=$('#htmlEditor').value;localStorage.setItem('wae.document',state.document);localStorage.setItem('wae.html',state.html);$('#saveState').textContent='Guardado';toast('Workspace guardado')}function updatePreview(){$('#htmlPreview').srcdoc=$('#htmlEditor').value}
function downloadText(filename,content,type='text/plain'){const b=new Blob([content],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}function exportWorkspace(){const a=$('.workspace-tabs button.active')?.dataset.tab;if(a==='html')downloadText('wae-canvas.html',$('#htmlEditor').value,'text/html');else downloadText('wae-workspace.html',`<!doctype html><meta charset="utf-8"><title>WAE Workspace</title><body>${$('#documentEditor').innerHTML}</body>`,'text/html');toast('Archivo exportado')}
let toastTimer;function toast(message){let e=$('.toast');if(!e){e=document.createElement('div');e.className='toast';$('.app-shell').appendChild(e)}e.textContent=message;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),1800)}window.toast=toast;function autosizeInput(){const i=$('#messageInput');if(!i)return;i.style.height='auto';i.style.height=`${Math.min(i.scrollHeight,120)}px`}
const TURN_LIFECYCLE_VERSION='turn-lifecycle/v113';
function visibleComposerInput(){return matchMedia('(max-width:899px)').matches&&$('#mobileSafeInput')?$('#mobileSafeInput'):$('#messageInput')}
function setTurnBusy(active){state.busy=!!active;document.documentElement.dataset.aiBusy=String(!!active);for(const send of [$('.send-btn'),$('#mobileSafeSend')]){if(!send)continue;send.disabled=!!active;if(active)send.setAttribute('aria-busy','true');else send.removeAttribute('aria-busy')}document.documentElement.dataset.turnLifecycle=TURN_LIFECYCLE_VERSION}
function releaseTurnUI({focus=true}={}){hideTyping();setTurnBusy(false);const native=$('#messageInput');if(native){native.disabled=false;native.readOnly=false;native.removeAttribute('disabled');native.removeAttribute('readonly');native.removeAttribute('inert')}window.__waeMobileSafeComposer?.repair?.();if(focus){const target=visibleComposerInput();try{target?.focus({preventScroll:true})}catch{target?.focus()}}}
function showTurnFailure(message,error){
  const e=document.createElement('article');e.className='message assistant runtime-error';e.setAttribute('role','alert');
  const note=error?.name==='AbortError'?'La consulta excedió el tiempo de espera.':'La generación no entregó una respuesta utilizable.';
  e.innerHTML=`<div class="message-meta"><strong>${safeText(state.coreName)}</strong><span>Reintento disponible</span></div><p>${note} Tu mensaje continúa en el historial.</p>`;
  const retry=document.createElement('button');retry.type='button';retry.className='retry-turn';retry.textContent='↻ Reintentar esta consulta';
  retry.addEventListener('click',()=>submitMessage({preventDefault(){}},{retryText:message}));
  e.appendChild(retry);$('#messages').appendChild(e);scrollChat();
}
async function submitMessage(ev,{retryText=null}={}){
  ev.preventDefault();const i=$('#messageInput'),m=String(retryText??i.value).trim();
  if(!m||state.busy)return;
  setTurnBusy(true);$('.runtime-error')?.remove();
  if(retryText===null){i.value='';autosizeInput();addMessage('user',m)}
  showTyping();
  try{const r=await getAIReply(m);hideTyping();addMessage('assistant',r)}
  catch(error){hideTyping();showTurnFailure(m,error)}
  finally{releaseTurnUI()}
}
window.__waeTurnLifecycle={version:TURN_LIFECYCLE_VERSION,release:releaseTurnUI,get busy(){return state.busy}};
window.addEventListener('pageshow',()=>{if(!$('#typingMessage'))releaseTurnUI({focus:false})});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('#typingMessage'))releaseTurnUI({focus:false})});
function openSettings(){const ep=$('#apiEndpoint');if(ep){ep.value='/api/chat';ep.disabled=true}$('#coreName').value=state.coreName;$('#settingsDialog').showModal();closeDrawer()}function saveSettings(){state.endpoint='/api/chat';state.coreName=$('#coreName').value.trim()||'Universal Core';localStorage.setItem('wae.endpoint','/api/chat');localStorage.setItem('wae.coreName',state.coreName);$('#settingsDialog').close();renderMessages();toast('Configuración guardada')}
function initDocument(){if(state.document)$('#documentEditor').innerHTML=state.document;if(state.html)$('#htmlEditor').value=state.html;updatePreview()}
function initInteractions(){$('#profileBtn')?.addEventListener('click',openSettings);$('#menuBtn').addEventListener('click',openDrawer);$('#closeDrawerBtn').addEventListener('click',closeDrawer);$('#scrim').addEventListener('click',closeDrawer);$('#newChatBtn').addEventListener('click',resetConversation);$('#drawerNewChat').addEventListener('click',()=>{resetConversation();closeDrawer()});$('#workspaceBtn').addEventListener('click',openWorkspace);$('#drawerWorkspace').addEventListener('click',openWorkspace);$('#closeWorkspaceBtn').addEventListener('click',closeWorkspace);$('#composer').addEventListener('submit',submitMessage);$('#messageInput').addEventListener('input',autosizeInput);$('#messageInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#composer').requestSubmit()}});$$('.capability-card').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));$$('.workspace-tabs button').forEach(b=>b.addEventListener('click',()=>switchWorkspaceTab(b.dataset.tab)));$$('.toolbar button').forEach(b=>b.addEventListener('click',()=>{document.execCommand(b.dataset.format,false,b.dataset.value||null);$('#documentEditor').focus();markDirty()}));$('#documentEditor').addEventListener('input',markDirty);$('#htmlEditor').addEventListener('input',()=>{updatePreview();markDirty()});$('#saveBtn').addEventListener('click',saveWorkspace);$('#exportBtn').addEventListener('click',exportWorkspace);$('#attachBtn').addEventListener('click',()=>$('#fileInput').click());$('#fileInput').addEventListener('change',e=>{const c=e.target.files.length;if(c)toast(`${c} archivo${c>1?'s':''} seleccionado${c>1?'s':''}`)});$('#voiceBtn').addEventListener('click',()=>{state.autoVoice=!state.autoVoice;localStorage.setItem('wae.autoVoice',String(state.autoVoice));toast(state.autoVoice?'Respuestas por voz activadas':'Respuestas por voz desactivadas')});$('#settingsBtn').addEventListener('click',openSettings);$('#saveSettingsBtn').addEventListener('click',saveSettings);$('.nav-list button[data-view]').forEach(b=>b.addEventListener('click',()=>{const view=b.dataset.view;closeDrawer();if(view==='ai'){toast('Chat de Universal Core');return}if(view==='knowledge'){setMode('research');toast('Modo Investigar activado');return}toast(`${b.querySelector('span').textContent}: aún no disponible en esta interfaz`)}));window.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#workspace').classList.contains('open'))closeWorkspace()})}
function registerSW(){if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{})}
async function refreshCoreHealth(){
  const label=$('#coreStatusLabel'),meta=$('#coreStatusMeta'),memory=$('#memoryStatus');
  if(!label||!meta)return;
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),6000);
  try{
    const response=await fetch('/api/health',{cache:'no-store',signal:c.signal});
    if(!response.ok)throw new Error('health_http');
    const health=await response.json();
    const live=health.generativeReady===true;
    label.textContent=live?'Universal Core · disponible':'Universal Core · generación degradada';
    meta.textContent=live?'Generación disponible':'Verifica proveedores';
    if(memory)memory.textContent=health.memory?.configured?'Memoria conectada':'Memoria no conectada';
  }catch{
    label.textContent='Universal Core · estado no verificado';
    meta.textContent='Revisar conexión';
    if(memory)memory.textContent='Memoria sin verificar';
  }finally{clearTimeout(timer)}
}
renderMessages();initDocument();initInteractions();setMode(state.mode);registerSW();void refreshCoreHealth();
window.addEventListener('online',refreshCoreHealth);
window.addEventListener('pageshow',refreshCoreHealth);