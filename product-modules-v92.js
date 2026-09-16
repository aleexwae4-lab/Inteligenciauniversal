(()=>{
  'use strict';
  if(window.__WAE_PRODUCT_MODULES_V92__)return;
  const VERSION='product-modules/v92';
  const K={settings:'wae.v59.settings',projects:'wae.v59.projects',active:'wae.v59.activeConversationId'};
  const DB_NAME='wae-product-modules-v92',STORE='projectFiles';
  const MAX_PROJECT_FILES=5,MAX_FILE_BYTES=2_000_000,MAX_FILE_TEXT=120_000;
  const textExtensions=/\.(txt|md|markdown|csv|tsv|json|jsonl|js|mjs|cjs|ts|tsx|jsx|py|java|go|rs|rb|php|css|scss|less|html|htm|xml|yaml|yml|sql|sh|bash|zsh|ps1|ini|toml|log)$/i;
  const liveRx=/\b(hoy|ahora|actual|actualmente|últim[oa]s?|reciente|noticias?|precio|cotizaci[oó]n|clima|resultado|release|vulnerabilidad|cve|outage|today|now|current|latest|recent|news|price|weather|release|outage)\b/i;
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uuid=()=>crypto.randomUUID?.()||`wae-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  const clean=(s,max=8000)=>String(s??'').replace(/\r/g,'').trim().slice(0,max);
  const jread=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}};
  const jwrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const defaultSettings=()=>({instructions:'',responseDepth:'balanced',autoResearch:true,autoVoice:localStorage.getItem('wae.autoVoice')!=='false',voiceURI:'',voiceRate:1,voicePitch:1});
  const settings=()=>({...defaultSettings(),...jread(K.settings,{})});
  const projects=()=>{const p=jread(K.projects,[]);return Array.isArray(p)?p:[]};
  const saveProjects=p=>jwrite(K.projects,p);
  const activeConversationId=()=>localStorage.getItem(K.active)||localStorage.getItem('iu.conversationId')||'';
  const activeProject=()=>projects().find(p=>Array.isArray(p.conversationIds)&&p.conversationIds.includes(activeConversationId()))||null;
  let pendingAttachments=[];

  if(localStorage.getItem('wae.autoVoice')===null)localStorage.setItem('wae.autoVoice','true');

  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB'in window))return reject(new Error('indexeddb_unavailable'));
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:'id'});store.createIndex('projectId','projectId',{unique:false})}};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('indexeddb_open_failed'));
    });
  }
  async function idbWrite(value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value);tx.oncomplete=()=>{db.close();resolve(value)};tx.onerror=()=>{db.close();reject(tx.error)}})}
  async function idbList(projectId){
    const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),idx=tx.objectStore(STORE).index('projectId'),req=idx.getAll(IDBKeyRange.only(projectId));req.onsuccess=()=>{const out=req.result||[];db.close();resolve(out)};req.onerror=()=>{db.close();reject(req.error)}});
  }
  async function idbDelete(id){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
  async function idbDeleteProject(projectId){const rows=await idbList(projectId).catch(()=>[]);await Promise.all(rows.map(r=>idbDelete(r.id).catch(()=>{})))}

  function isTextFile(file){return file.type.startsWith('text/')||['application/json','application/ld+json','application/xml','application/x-yaml','application/sql'].includes(file.type)||textExtensions.test(file.name)}
  async function normalizeFile(file,projectId=''){
    if(file.size>MAX_FILE_BYTES)throw new Error(`${file.name}: supera 2 MB`);
    const usable=isTextFile(file);
    const text=usable?clean(await file.text(),MAX_FILE_TEXT):'';
    return{id:uuid(),projectId,name:file.name.slice(0,180),type:(file.type||'application/octet-stream').slice(0,100),size:file.size,text,usable,truncated:usable&&text.length>=MAX_FILE_TEXT,updatedAt:new Date().toISOString()};
  }
  function attachmentFrom(row){return row?.usable&&row.text?{name:row.name,type:row.type||'text/plain',text:row.text}:null}
  async function ingestProjectFiles(projectId,fileList){
    const existing=await idbList(projectId).catch(()=>[]),slots=Math.max(0,MAX_PROJECT_FILES-existing.length);let added=0,unsupported=0;const errors=[];
    for(const file of [...fileList].slice(0,slots)){
      try{const row=await normalizeFile(file,projectId);await idbWrite(row);added++;if(!row.usable)unsupported++}catch(error){errors.push(String(error.message||error))}
    }
    return{added,unsupported,errors,full:slots===0};
  }
  async function ingestPendingFiles(fileList){
    const rows=[];for(const file of [...fileList].slice(0,MAX_PROJECT_FILES)){try{rows.push(await normalizeFile(file,''))}catch(error){window.toast?.(String(error.message||error))}}
    pendingAttachments=rows;renderAttachmentTray();
  }
  function renderAttachmentTray(){
    let tray=$('#wae92AttachmentTray');const composer=$('#composer');if(!composer)return;
    if(!tray){tray=document.createElement('div');tray.id='wae92AttachmentTray';tray.className='wae92-attachment-tray';composer.insertBefore(tray,$('.composer-actions',composer)||null)}
    tray.innerHTML=pendingAttachments.map(row=>`<span class="wae92-file-chip ${row.usable?'':'limited'}" title="${esc(row.usable?'Se enviará como contexto':'Archivo registrado, pero este runtime solo extrae texto/código')}">${esc(row.name)}<button type="button" data-pending-remove="${esc(row.id)}">×</button></span>`).join('');
    tray.hidden=pendingAttachments.length===0;
    $$('[data-pending-remove]',tray).forEach(btn=>btn.addEventListener('click',()=>{pendingAttachments=pendingAttachments.filter(x=>x.id!==btn.dataset.pendingRemove);renderAttachmentTray()}));
  }

  function projectForConversation(){return activeProject()}
  async function projectAttachments(){const p=projectForConversation();if(!p)return[];const rows=await idbList(p.id).catch(()=>[]);return rows.map(attachmentFrom).filter(Boolean).slice(0,MAX_PROJECT_FILES)}
  function dedupeAttachments(items){const seen=new Set(),out=[];for(const item of items){if(!item||!item.name||!item.text)continue;const key=`${item.name}|${item.type||''}|${item.text.length}`;if(seen.has(key))continue;seen.add(key);out.push({name:String(item.name).slice(0,180),type:String(item.type||'text/plain').slice(0,100),text:String(item.text).slice(0,MAX_FILE_TEXT)});if(out.length>=MAX_PROJECT_FILES)break}return out}

  const upstreamFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    let url=null;try{url=new URL(typeof input==='string'?input:input?.url,location.href)}catch{}
    const method=String(init.method||'GET').toUpperCase();let chat=false,body=null;
    if(url&&method==='POST'&&typeof init.body==='string'){
      try{body=JSON.parse(init.body)}catch{}
      chat=!!body&&(url.origin===location.origin&&url.pathname==='/api/chat'||url.pathname.includes('/functions/v1/wae-local-voice-demo-v61')&&body.action==='chat');
    }
    if(chat){
      const s=settings(),project=projectForConversation(),stored=await projectAttachments(),pending=pendingAttachments.map(attachmentFrom).filter(Boolean),existing=Array.isArray(body.attachments)?body.attachments:[];
      const preferences={...(body.preferences||{}),responseStyle:'premium-rich',voiceNatural:true,responseDepth:s.responseDepth,customInstructions:clean(s.instructions,8000),projectName:clean(project?.name||'',120),projectInstructions:clean(project?.instructions||'',8000),voice:{enabled:s.autoVoice!==false,uri:s.voiceURI||'',rate:Number(s.voiceRate)||1,pitch:Number(s.voicePitch)||1}};
      body={...body,preferences,attachments:dedupeAttachments([...pending,...existing,...stored])};
      if(s.autoResearch!==false&&liveRx.test(String(body.message||body.task||'')))body.web_enabled=true;
      init={...init,body:JSON.stringify(body)};
    }
    const response=await upstreamFetch(input,init);
    if(chat&&response?.ok&&pendingAttachments.length){pendingAttachments=[];renderAttachmentTray()}
    return response;
  };

  if('speechSynthesis'in window){
    const nativeSpeak=speechSynthesis.speak.bind(speechSynthesis);
    speechSynthesis.speak=utterance=>{
      try{
        const s=settings(),voices=speechSynthesis.getVoices();
        utterance.rate=Math.max(.6,Math.min(1.6,Number(s.voiceRate)||1));
        utterance.pitch=Math.max(.5,Math.min(1.5,Number(s.voicePitch)||1));
        utterance.voice=voices.find(v=>v.voiceURI===s.voiceURI)||utterance.voice||voices.find(v=>/es[-_]MX/i.test(v.lang))||voices.find(v=>/^es/i.test(v.lang))||null;
      }catch{}
      return nativeSpeak(utterance);
    };
  }

  function closeLegacyUi(){
    $('#drawer')?.classList.remove('open');$('#scrim')?.classList.remove('visible');
    try{if($('#settingsDialog')?.open)$('#settingsDialog').close()}catch{}
    $('#wae59Overlay')?.classList.remove('open');
  }
  function overlay(){
    let root=$('#wae92Overlay');if(root)return root;
    root=document.createElement('div');root.id='wae92Overlay';root.className='wae92-overlay';root.setAttribute('aria-hidden','true');
    root.innerHTML='<section class="wae92-panel" role="dialog" aria-modal="true"><header class="wae92-head"><button class="wae92-back" type="button" aria-label="Cerrar">←</button><div><strong id="wae92Title">Universal Core</strong><small id="wae92Subtitle"></small></div><span class="wae92-release">v92</span></header><div class="wae92-body" id="wae92Body"></div></section>';
    document.body.appendChild(root);root.querySelector('.wae92-back').addEventListener('click',closePanel);root.addEventListener('click',e=>{if(e.target===root)closePanel()});return root;
  }
  function openPanel(title,subtitle,html){closeLegacyUi();const root=overlay();$('#wae92Title',root).textContent=title;$('#wae92Subtitle',root).textContent=subtitle||'';$('#wae92Body',root).innerHTML=html;root.classList.add('open');root.setAttribute('aria-hidden','false');document.documentElement.classList.add('wae92-modal-open');return $('#wae92Body',root)}
  function closePanel(){const root=$('#wae92Overlay');root?.classList.remove('open');root?.setAttribute('aria-hidden','true');document.documentElement.classList.remove('wae92-modal-open')}
  function toast(message){window.toast?.(message)}

  function voiceOptions(selected=''){
    const voices=('speechSynthesis'in window?speechSynthesis.getVoices():[]).slice().sort((a,b)=>{const aw=/es[-_]MX/i.test(a.lang)?0:/^es/i.test(a.lang)?1:2,bw=/es[-_]MX/i.test(b.lang)?0:/^es/i.test(b.lang)?1:2;return aw-bw||a.name.localeCompare(b.name)});
    return `<option value="">Automática del dispositivo</option>${voices.map(v=>`<option value="${esc(v.voiceURI)}" ${selected===v.voiceURI?'selected':''}>${esc(v.name)} · ${esc(v.lang)}</option>`).join('')}`;
  }
  function syncAutoVoice(desired){
    const current=localStorage.getItem('wae.autoVoice')!=='false';
    if(current!==desired)$('#voiceBtn')?.click();
    localStorage.setItem('wae.autoVoice',String(desired));
  }
  function showSettings(){
    const s=settings();
    const html=`<div class="wae92-stack">
      <section class="wae92-card"><div class="wae92-card-head"><div><h3>Instrucciones</h3><p>Se aplican a todas las respuestas, salvo que un proyecto defina reglas más específicas.</p></div><span>GLOBAL</span></div><label class="wae92-field"><span>Instrucciones personalizadas</span><textarea id="wae92Instructions" maxlength="8000" rows="7" placeholder="Ejemplo: Responde como un CTO senior. Prioriza precisión, evidencia, seguridad y pasos ejecutables.">${esc(s.instructions||'')}</textarea><small><b id="wae92InstructionCount">${String(s.instructions||'').length}</b> / 8000</small></label></section>
      <section class="wae92-card"><div class="wae92-card-head"><div><h3>Respuesta</h3><p>Controla profundidad y recuperación actual sin cambiar la identidad de Universal Core.</p></div></div><div class="wae92-grid"><label class="wae92-field"><span>Profundidad</span><select id="wae92Depth"><option value="concise" ${s.responseDepth==='concise'?'selected':''}>Concisa</option><option value="balanced" ${s.responseDepth==='balanced'?'selected':''}>Equilibrada</option><option value="deep" ${s.responseDepth==='deep'?'selected':''}>Profunda</option></select></label><label class="wae92-toggle"><div><strong>Datos actuales automáticos</strong><small>Activa evidencia en vivo cuando la consulta depende del presente.</small></div><input id="wae92Research" type="checkbox" ${s.autoResearch!==false?'checked':''}></label></div></section>
      <section class="wae92-card"><div class="wae92-card-head"><div><h3>Voz</h3><p>La respuesta hablada está activa por defecto. Elige la voz disponible en tu dispositivo y ajusta velocidad y pitch.</p></div><span>DEFAULT ON</span></div><label class="wae92-toggle"><div><strong>Leer respuestas automáticamente</strong><small>Puedes seguir usando “Escuchar” manualmente.</small></div><input id="wae92AutoVoice" type="checkbox" ${s.autoVoice!==false?'checked':''}></label><label class="wae92-field"><span>Voz disponible</span><select id="wae92Voice">${voiceOptions(s.voiceURI||'')}</select></label><div class="wae92-slider-grid"><label class="wae92-field"><span>Velocidad <b id="wae92RateValue">${Number(s.voiceRate||1).toFixed(2)}×</b></span><input id="wae92Rate" type="range" min="0.60" max="1.60" step="0.05" value="${Number(s.voiceRate)||1}"></label><label class="wae92-field"><span>Pitch <b id="wae92PitchValue">${Number(s.voicePitch||1).toFixed(2)}</b></span><input id="wae92Pitch" type="range" min="0.50" max="1.50" step="0.05" value="${Number(s.voicePitch)||1}"></label></div><div class="wae92-actions"><button class="wae92-secondary" id="wae92TestVoice" type="button">▶ Probar voz</button><button class="wae92-primary" id="wae92SaveSettings" type="button">Guardar configuración</button></div></section>
      <div class="wae92-evidence-note"><strong>Conectado al runtime.</strong> Instrucciones, proyecto, profundidad y archivos viajan en el payload real de <code>/api/chat</code>; la voz se aplica sobre SpeechSynthesis del dispositivo.</div>
    </div>`;
    const body=openPanel('Configuración','Personalización de Universal Core',html),instructions=$('#wae92Instructions',body),rate=$('#wae92Rate',body),pitch=$('#wae92Pitch',body);
    instructions.addEventListener('input',()=>$('#wae92InstructionCount',body).textContent=String(instructions.value.length));
    rate.addEventListener('input',()=>$('#wae92RateValue',body).textContent=`${Number(rate.value).toFixed(2)}×`);pitch.addEventListener('input',()=>$('#wae92PitchValue',body).textContent=Number(pitch.value).toFixed(2));
    $('#wae92TestVoice',body).addEventListener('click',()=>{if(!('speechSynthesis'in window))return toast('Voz no disponible en este dispositivo');const draft={...settings(),voiceURI:$('#wae92Voice',body).value,voiceRate:Number(rate.value),voicePitch:Number(pitch.value)};jwrite(K.settings,{...settings(),...draft});speechSynthesis.cancel();const u=new SpeechSynthesisUtterance('Universal Core. Esta es una prueba de voz con la velocidad y el tono seleccionados.');u.lang='es-MX';speechSynthesis.speak(u)});
    $('#wae92SaveSettings',body).addEventListener('click',()=>{const next={...settings(),instructions:clean(instructions.value,8000),responseDepth:$('#wae92Depth',body).value||'balanced',autoResearch:$('#wae92Research',body).checked,autoVoice:$('#wae92AutoVoice',body).checked,voiceURI:$('#wae92Voice',body).value||'',voiceRate:Number(rate.value)||1,voicePitch:Number(pitch.value)||1};jwrite(K.settings,next);syncAutoVoice(next.autoVoice);toast('Configuración v92 guardada');closePanel()});
  }

  function setProjectForConversation(projectId){const cid=activeConversationId();if(!cid)return;saveProjects(projects().map(p=>({...p,conversationIds:p.id===projectId?[...new Set([...(p.conversationIds||[]),cid])]:(p.conversationIds||[]).filter(id=>id!==cid)})))}
  async function renderFiles(body,projectId){
    const host=body.querySelector(`[data-wae92-files="${CSS.escape(projectId)}"]`);if(!host)return;const rows=await idbList(projectId).catch(()=>[]);
    host.innerHTML=rows.length?rows.map(r=>`<div class="wae92-source"><div><strong>${esc(r.name)}</strong><small>${Math.max(1,Math.round(r.size/1024))} KB · ${r.usable?(r.truncated?'texto truncado a 120k':'contexto activo'):'referencia sin extracción'}</small></div><button type="button" data-wae92-delete-file="${esc(r.id)}">×</button></div>`).join(''):'<div class="wae92-empty small">Sin archivos. Texto, Markdown, CSV, JSON y código se incorporan directamente al contexto.</div>';
    $$('[data-wae92-delete-file]',host).forEach(btn=>btn.addEventListener('click',async()=>{await idbDelete(btn.dataset.wae92DeleteFile).catch(()=>{});renderFiles(body,projectId)}));
  }
  function showProjects(){
    const list=projects(),active=projectForConversation();
    const cards=list.map(p=>`<article class="wae92-project ${active?.id===p.id?'active':''}" data-project="${esc(p.id)}"><header><div><span class="wae92-project-icon">◇</span><div><input class="wae92-project-name" value="${esc(p.name||'Proyecto')}" maxlength="80"><small>${(p.conversationIds||[]).length} conversación${(p.conversationIds||[]).length===1?'':'es'}${active?.id===p.id?' · ACTIVO':''}</small></div></div><button class="wae92-danger-icon" type="button" data-wae92-delete-project="${esc(p.id)}">×</button></header><label class="wae92-field"><span>Instrucciones del proyecto</span><textarea class="wae92-project-instructions" maxlength="8000" rows="5" placeholder="Objetivo, reglas, estilo, criterios y contexto persistente">${esc(p.instructions||'')}</textarea></label><div class="wae92-project-actions"><button class="wae92-secondary" type="button" data-wae92-use-project="${esc(p.id)}">${active?.id===p.id?'Proyecto activo':'Usar en esta conversación'}</button><button class="wae92-secondary" type="button" data-wae92-add-files="${esc(p.id)}">＋ Agregar archivos</button><button class="wae92-primary" type="button" data-wae92-save-project="${esc(p.id)}">Guardar proyecto</button><input type="file" multiple hidden data-wae92-file-input="${esc(p.id)}"></div><div class="wae92-sources-title">Archivos de referencia</div><div data-wae92-files="${esc(p.id)}"></div></article>`).join('');
    const html=`<div class="wae92-stack"><section class="wae92-card"><div class="wae92-card-head"><div><h3>Nuevo proyecto</h3><p>Agrupa conversaciones, instrucciones y archivos de referencia en un mismo contexto.</p></div></div><div class="wae92-grid"><label class="wae92-field"><span>Nombre</span><input id="wae92NewProjectName" maxlength="80" placeholder="Ej. Lanzamiento WAE 2027"></label><label class="wae92-field wide"><span>Instrucciones</span><textarea id="wae92NewProjectInstructions" maxlength="8000" rows="4" placeholder="Qué debe recordar Universal Core y cómo debe trabajar dentro de este proyecto"></textarea></label></div><div class="wae92-actions"><button class="wae92-primary" id="wae92CreateProject" type="button">＋ Crear proyecto</button></div></section><div class="wae92-section-title"><span>PROYECTOS</span><b>${list.length}</b></div>${cards||'<div class="wae92-empty">Aún no hay proyectos. Crea uno para mantener contexto, archivos e instrucciones entre conversaciones.</div>'}</div>`;
    const body=openPanel('Proyectos','Contexto persistente por iniciativa',html);
    $('#wae92CreateProject',body)?.addEventListener('click',()=>{const name=clean($('#wae92NewProjectName',body)?.value,80),instructions=clean($('#wae92NewProjectInstructions',body)?.value,8000);if(!name)return toast('Escribe un nombre para el proyecto');const id=uuid(),cid=activeConversationId();saveProjects([{id,name,instructions,conversationIds:cid?[cid]:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},...projects()]);showProjects()});
    $$('[data-wae92-save-project]',body).forEach(btn=>btn.addEventListener('click',()=>{const card=btn.closest('.wae92-project'),id=btn.dataset.wae92SaveProject,name=clean($('.wae92-project-name',card)?.value,80)||'Proyecto',instructions=clean($('.wae92-project-instructions',card)?.value,8000);saveProjects(projects().map(p=>p.id===id?{...p,name,instructions,updatedAt:new Date().toISOString()}:p));toast('Proyecto guardado')}));
    $$('[data-wae92-use-project]',body).forEach(btn=>btn.addEventListener('click',()=>{setProjectForConversation(btn.dataset.wae92UseProject);toast('Proyecto conectado a esta conversación');showProjects()}));
    $$('[data-wae92-delete-project]',body).forEach(btn=>btn.addEventListener('click',async()=>{const id=btn.dataset.wae92DeleteProject;saveProjects(projects().filter(p=>p.id!==id));await idbDeleteProject(id).catch(()=>{});showProjects()}));
    $$('[data-wae92-add-files]',body).forEach(btn=>btn.addEventListener('click',()=>body.querySelector(`[data-wae92-file-input="${CSS.escape(btn.dataset.wae92AddFiles)}"]`)?.click()));
    $$('[data-wae92-file-input]',body).forEach(input=>input.addEventListener('change',async()=>{const id=input.dataset.wae92FileInput,result=await ingestProjectFiles(id,input.files||[]);if(result.full)toast('El proyecto ya tiene 5 archivos');else if(result.added)toast(`${result.added} archivo${result.added===1?'':'s'} agregado${result.added===1?'':'s'}${result.unsupported?` · ${result.unsupported} sin extracción de texto`:''}`);if(result.errors[0])toast(result.errors[0]);input.value='';renderFiles(body,id)}));
    list.forEach(p=>renderFiles(body,p.id));
  }

  function interceptNavigation(event){
    const target=event.target.closest?.('#settingsBtn,[data-view="projects"],[data-wae59="settings"],[data-wae59="projects"]');if(!target)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(target.matches('#settingsBtn,[data-wae59="settings"]'))showSettings();else showProjects();
  }
  document.addEventListener('click',interceptNavigation,true);

  function bindComposerFiles(){
    const input=$('#fileInput');if(!input||input.dataset.wae92Bound)return;input.dataset.wae92Bound='1';input.addEventListener('change',async()=>{await ingestPendingFiles(input.files||[]);input.value=''},false);renderAttachmentTray();
  }
  function init(){bindComposerFiles();window.speechSynthesis?.addEventListener?.('voiceschanged',()=>{});document.documentElement.dataset.waeProductModules='v92'}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
  window.__WAE_PRODUCT_MODULES_V92__={version:VERSION,openSettings:showSettings,openProjects:showProjects,settings,activeProject,projectAttachments};
})();
