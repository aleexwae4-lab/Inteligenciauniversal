(()=>{
  'use strict';
  if(window.__WAE_PRODUCTIVITY_V59__)return;
  const VERSION='productivity/v59';
  const K={conversations:'wae.v59.conversations',projects:'wae.v59.projects',active:'wae.v59.activeConversationId',settings:'wae.v59.settings'};
  const liveRx=/\b(hoy|ahora|actual|actualmente|últim[oa]s?|ultimo|ultima|reciente|noticias?|precio|cotizaci[oó]n|clima|resultado|marcador|elecci[oó]n|presidente|ceo|release|lanzamiento|vulnerabilidad|cve|outage|ca[ií]da|today|now|current|latest|recent|news|price|weather|score|election|release|outage)\b/i;
  const jread=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||'');return value??fallback}catch{return fallback}};
  const jwrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const uuid=()=>crypto.randomUUID?.()||`wae-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=(s,max=12000)=>String(s??'').replace(/\s+$/g,'').trim().slice(0,max);
  const defaults={responseDepth:'balanced',autoResearch:true,autoVoice:localStorage.getItem('wae.autoVoice')!=='false'};
  const readSettings=()=>({...defaults,...jread(K.settings,{})});
  const conversations=()=>{const x=jread(K.conversations,[]);return Array.isArray(x)?x:[]};
  const projects=()=>{const x=jread(K.projects,[]);return Array.isArray(x)?x:[]};
  function activeId(){let id=localStorage.getItem(K.active)||localStorage.getItem('iu.conversationId')||'';if(!id){id=uuid();localStorage.setItem(K.active,id)}localStorage.setItem('iu.conversationId',id);return id}
  function setActive(id){localStorage.setItem(K.active,id);localStorage.setItem('iu.conversationId',id)}
  function titleFor(messages=[]){const first=messages.find(x=>x.role==='user'&&clean(x.text));const t=clean(first?.text||'Nueva conversación',72);return t.length>=72?`${t.slice(0,69)}…`:t}
  function previewFor(messages=[]){const last=[...messages].reverse().find(x=>clean(x.text));return clean(last?.text||'',110).replace(/\s+/g,' ')}
  function domMessages(){
    const root=document.querySelector('#messages');if(!root)return[];
    const out=[];
    root.querySelectorAll('.turn.user,.turn.assistant,.message.user,.message.assistant').forEach(node=>{
      if(node.id==='typingMessage'||node.querySelector('.typing'))return;
      const role=node.classList.contains('user')?'user':'assistant';
      const body=role==='user'?(node.querySelector('.bubble-user')||node.querySelector('p')||node):(node.querySelector('.assistant-body')||node.querySelector('.rich-answer')||node);
      const text=clean(body?.innerText||body?.textContent||'',30000);if(text)out.push({role,text,at:new Date().toISOString()});
    });
    return out.slice(-80);
  }
  function storedDesktopMessages(){
    const rows=jread('wae.messages',[]);if(!Array.isArray(rows))return[];
    return rows.filter(x=>x&&['user','assistant'].includes(x.role)&&clean(x.text)).map(x=>({role:x.role,text:clean(x.text,30000),at:x.at||new Date().toISOString()})).slice(-80);
  }
  function currentMessages(){const dom=domMessages();return dom.length?dom:storedDesktopMessages()}
  function upsertConversation(messages=currentMessages()){
    if(!messages.length)return null;
    const id=activeId(),rows=conversations(),index=rows.findIndex(x=>x.id===id),now=new Date().toISOString();
    const old=index>=0?rows[index]:{};
    const next={...old,id,title:titleFor(messages),preview:previewFor(messages),messages,createdAt:old.createdAt||now,updatedAt:now};
    if(index>=0)rows[index]=next;else rows.unshift(next);
    rows.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    jwrite(K.conversations,rows.slice(0,120));return next;
  }
  let snapshotTimer=null;
  function scheduleSnapshot(){clearTimeout(snapshotTimer);snapshotTimer=setTimeout(()=>upsertConversation(),220)}
  function beginNewConversation(){upsertConversation();const id=uuid();setActive(id);localStorage.removeItem('wae.messages');return id}
  function recordFor(id=activeId()){return conversations().find(x=>x.id===id)||null}
  function activeProject(){const id=activeId();return projects().find(p=>Array.isArray(p.conversationIds)&&p.conversationIds.includes(id))||null}
  function historyForRequest(message=''){
    const rows=(recordFor()?.messages?.length?recordFor().messages:currentMessages()).slice(-20).map(x=>({role:x.role,text:clean(x.text,12000)}));
    const q=clean(message,30000);if(rows.length&&rows.at(-1)?.role==='user'&&clean(rows.at(-1).text)===q)rows.pop();return rows;
  }
  function enhanceBody(body={}){
    const settings=readSettings(),project=activeProject(),message=String(body.message||body.task||'');
    const next={...body,sessionId:activeId(),session_id:activeId(),history:Array.isArray(body.history)&&body.history.length?body.history:historyForRequest(message)};
    next.preferences={...(body.preferences||{}),responseStyle:'premium-rich',voiceNatural:true,responseDepth:settings.responseDepth,projectName:project?.name||'',projectInstructions:clean(project?.instructions||'',4000)};
    if(settings.autoResearch&&liveRx.test(message))next.web_enabled=true;
    return next;
  }
  const upstreamFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    let url=null;try{url=new URL(typeof input==='string'?input:input?.url,location.href)}catch{}
    if(url&&String(init.method||'GET').toUpperCase()==='POST'&&typeof init.body==='string'){
      let body=null;try{body=JSON.parse(init.body)}catch{}
      const direct=url.origin===location.origin&&url.pathname==='/api/chat';
      const edge=url.pathname.includes('/functions/v1/wae-local-voice-demo-v61')&&body?.action==='chat';
      if(body&&(direct||edge)){
        const enhanced=enhanceBody(body);
        init={...init,body:JSON.stringify(enhanced)};
      }
    }
    const response=await upstreamFetch(input,init);
    if(url&&(url.pathname==='/api/chat'||url.pathname.includes('/functions/v1/wae-local-voice-demo-v61')))setTimeout(scheduleSnapshot,0);
    return response;
  };

  function ensureOverlay(){
    let overlay=document.getElementById('wae59Overlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='wae59Overlay';overlay.className='wae59-overlay';overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML='<section class="wae59-panel" role="dialog" aria-modal="true"><header class="wae59-head"><button class="wae59-close" type="button" aria-label="Cerrar">←</button><div><strong id="wae59Title">Universal Core</strong><small id="wae59Subtitle"></small></div></header><div class="wae59-body" id="wae59Body"></div></section>';
    document.body.appendChild(overlay);overlay.querySelector('.wae59-close').addEventListener('click',closePanel);overlay.addEventListener('click',e=>{if(e.target===overlay)closePanel()});return overlay;
  }
  function closePanel(){const el=document.getElementById('wae59Overlay');if(el){el.classList.remove('open');el.setAttribute('aria-hidden','true')}}
  function openPanel(title,subtitle,html){const el=ensureOverlay();el.querySelector('#wae59Title').textContent=title;el.querySelector('#wae59Subtitle').textContent=subtitle||'';const body=el.querySelector('#wae59Body');body.innerHTML=html;el.classList.add('open');el.setAttribute('aria-hidden','false');return body}
  function dateLabel(value){try{return new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}catch{return''}}
  function openConversation(id){
    upsertConversation();const rec=conversations().find(x=>x.id===id);if(!rec)return;setActive(id);jwrite('wae.messages',rec.messages.map(x=>({role:x.role,text:x.text,at:x.at||''})));location.reload();
  }
  function deleteConversation(id){
    jwrite(K.conversations,conversations().filter(x=>x.id!==id));
    const ps=projects().map(p=>({...p,conversationIds:(p.conversationIds||[]).filter(x=>x!==id)}));jwrite(K.projects,ps);
    if(id===activeId())beginNewConversation();showHistory();
  }
  function showHistory(){
    upsertConversation();const rows=conversations();
    const html=`<div class="wae59-toolbar"><button class="wae59-primary" id="wae59NewChat" type="button">＋ Nueva conversación</button></div><div class="wae59-list">${rows.length?rows.map(r=>`<div class="wae59-row ${r.id===activeId()?'active':''}"><button class="wae59-row-main" data-open-conversation="${esc(r.id)}" type="button"><strong>${esc(r.title||'Conversación')}</strong><small>${esc(r.preview||'Sin vista previa')} · ${esc(dateLabel(r.updatedAt))}</small></button><div class="wae59-row-actions"><button data-delete-conversation="${esc(r.id)}" type="button" aria-label="Eliminar">×</button></div></div>`).join(''):'<div class="wae59-empty">Tus conversaciones aparecerán aquí automáticamente.</div>'}</div>`;
    const body=openPanel('Historial','Conversaciones persistentes de Universal Core',html);
    body.querySelector('#wae59NewChat')?.addEventListener('click',()=>{beginNewConversation();location.reload()});
    body.querySelectorAll('[data-open-conversation]').forEach(b=>b.addEventListener('click',()=>openConversation(b.dataset.openConversation)));
    body.querySelectorAll('[data-delete-conversation]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();deleteConversation(b.dataset.deleteConversation)}));
  }
  function saveProjects(value){jwrite(K.projects,value)}
  function showProjects(){
    upsertConversation();const list=projects(),current=activeProject();
    const html=`<div class="wae59-form"><label class="wae59-field"><span>Nuevo proyecto</span><input id="wae59ProjectName" maxlength="80" placeholder="Nombre del proyecto"></label><label class="wae59-field"><span>Instrucciones del proyecto</span><textarea id="wae59ProjectInstructions" maxlength="4000" placeholder="Contexto, objetivo, tono o reglas que Universal Core debe mantener en este proyecto"></textarea></label><div class="wae59-toolbar"><button class="wae59-primary" id="wae59CreateProject" type="button">Crear proyecto</button>${current?'<button class="wae59-secondary" id="wae59DetachProject" type="button">Sacar conversación del proyecto</button>':''}</div></div><div class="wae59-section-title">Proyectos</div><div class="wae59-list">${list.length?list.map(p=>`<article class="wae59-project-card"><div><h4>${esc(p.name)}</h4><p>${esc(p.instructions||'Sin instrucciones específicas')}</p></div><span class="wae59-chip">${(p.conversationIds||[]).length} conversación${(p.conversationIds||[]).length===1?'':'es'}</span><div class="wae59-toolbar"><button class="wae59-secondary" data-project-attach="${esc(p.id)}" type="button">${(p.conversationIds||[]).includes(activeId())?'Proyecto activo':'Añadir conversación actual'}</button><button class="wae59-danger" data-project-delete="${esc(p.id)}" type="button">Eliminar</button></div></article>`).join(''):'<div class="wae59-empty">Crea un proyecto para agrupar conversaciones y mantener instrucciones de trabajo persistentes.</div>'}</div>`;
    const body=openPanel('Proyectos','Contexto persistente por iniciativa',html);
    body.querySelector('#wae59CreateProject')?.addEventListener('click',()=>{
      const name=clean(body.querySelector('#wae59ProjectName')?.value,80),instructions=clean(body.querySelector('#wae59ProjectInstructions')?.value,4000);if(!name)return;
      const rows=projects();rows.unshift({id:uuid(),name,instructions,conversationIds:[activeId()],createdAt:new Date().toISOString()});saveProjects(rows);showProjects();
    });
    body.querySelector('#wae59DetachProject')?.addEventListener('click',()=>{saveProjects(projects().map(p=>({...p,conversationIds:(p.conversationIds||[]).filter(x=>x!==activeId())})));showProjects()});
    body.querySelectorAll('[data-project-attach]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.dataset.projectAttach;saveProjects(projects().map(p=>({...p,conversationIds:p.id===id?[...new Set([...(p.conversationIds||[]),activeId()])]:(p.conversationIds||[]).filter(x=>x!==activeId())})));showProjects();
    }));
    body.querySelectorAll('[data-project-delete]').forEach(btn=>btn.addEventListener('click',()=>{saveProjects(projects().filter(p=>p.id!==btn.dataset.projectDelete));showProjects()}));
  }
  function showSettings(){
    const s=readSettings();
    const html=`<div class="wae59-form"><label class="wae59-field"><span>Profundidad de respuesta</span><select id="wae59Depth"><option value="concise" ${s.responseDepth==='concise'?'selected':''}>Concisa</option><option value="balanced" ${s.responseDepth==='balanced'?'selected':''}>Equilibrada</option><option value="deep" ${s.responseDepth==='deep'?'selected':''}>Profunda</option></select></label><label class="wae59-switch"><div><strong>Datos actuales automáticos</strong><small>Activa recuperación en vivo cuando la pregunta depende de información reciente.</small></div><input id="wae59Research" type="checkbox" ${s.autoResearch?'checked':''}></label><label class="wae59-switch"><div><strong>Respuesta por voz</strong><small>Mantiene la preferencia de voz automática de la interfaz.</small></div><input id="wae59Voice" type="checkbox" ${s.autoVoice?'checked':''}></label><div class="wae59-toast-note">Universal Core mantiene una sola identidad. Las preferencias se aplican a las nuevas respuestas sin cambiar la estética ni el núcleo visual.</div><div class="wae59-settings-actions"><button class="wae59-primary" id="wae59SaveSettings" type="button">Guardar configuración</button></div></div>`;
    const body=openPanel('Configuración','Preferencias de Universal Core',html);
    body.querySelector('#wae59SaveSettings')?.addEventListener('click',()=>{
      const next={responseDepth:body.querySelector('#wae59Depth')?.value||'balanced',autoResearch:!!body.querySelector('#wae59Research')?.checked,autoVoice:!!body.querySelector('#wae59Voice')?.checked};jwrite(K.settings,next);localStorage.setItem('wae.autoVoice',String(next.autoVoice));window.toast?.('Configuración guardada');closePanel();
    });
  }
  function addMenuEntries(){
    const nav=document.querySelector('.nav-list');
    if(nav&&!nav.querySelector('[data-wae59="history"]')){
      const projectsBtn=nav.querySelector('[data-view="projects"]'),btn=document.createElement('button');btn.type='button';btn.dataset.wae59='history';btn.className='wae59-history-btn';btn.innerHTML='◷ <span>Historial</span>';projectsBtn?.after(btn);btn.addEventListener('click',showHistory);
    }
    const sheet=document.querySelector('#sheetBackdrop .sheet');
    if(sheet&&!sheet.querySelector('[data-wae59="history"]')){
      const anchor=sheet.querySelector('#sheetNew');
      [['history','Historial','Conversaciones'],['projects','Proyectos','Contexto'],['settings','Configuración','Preferencias']].forEach(([id,label,small])=>{
        const b=document.createElement('button');b.type='button';b.dataset.wae59=id;b.className='wae59-sheet-entry';b.innerHTML=`<span>${label}</span><small>${small}</small>`;anchor?.after(b);b.addEventListener('click',()=>{document.querySelector('#sheetBackdrop')?.classList.remove('open');id==='history'?showHistory():id==='projects'?showProjects():showSettings()});
      });
    }
  }
  function interceptNativeMenus(){
    document.addEventListener('click',event=>{
      const target=event.target?.closest?.('button');if(!target)return;
      if(target.matches('[data-view="projects"]')){event.preventDefault();event.stopImmediatePropagation();showProjects();return}
      if(target.id==='settingsBtn'){event.preventDefault();event.stopImmediatePropagation();showSettings();return}
      if(['newChat','newChatBtn','drawerNewChat','sheetNew'].includes(target.id)){beginNewConversation();setTimeout(scheduleSnapshot,80)}
    },true);
  }
  function restoreMobileConversation(){
    if(document.querySelector('#messageInput'))return;
    const root=document.querySelector('#messages'),rec=recordFor();if(!root||!rec?.messages?.length||root.querySelector('.turn.user,.turn.assistant'))return;
    root.querySelector('#welcome')?.classList.add('hidden');
    rec.messages.slice(-40).forEach(m=>{
      const turn=document.createElement('section');turn.className=`turn ${m.role}`;
      if(m.role==='user')turn.innerHTML=`<div class="bubble-user">${esc(m.text)}</div>`;
      else turn.innerHTML=`<div class="assistant-wrap"><div class="assistant-label">Universal Core</div><div class="assistant-body" style="white-space:pre-wrap">${esc(m.text)}</div><div class="actions"></div></div>`;
      root.appendChild(turn);
    });
    root.scrollTop=root.scrollHeight;
  }
  function installObserver(){const root=document.querySelector('#messages');if(root)new MutationObserver(scheduleSnapshot).observe(root,{childList:true,subtree:true,characterData:true})}
  function injectAssetsMarker(){document.documentElement.dataset.waeProductivity='v59'}
  function init(){activeId();injectAssetsMarker();addMenuEntries();interceptNativeMenus();restoreMobileConversation();installObserver();setTimeout(()=>{addMenuEntries();restoreMobileConversation();scheduleSnapshot()},700);window.addEventListener('keydown',e=>{if(e.key==='Escape')closePanel()})}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
  window.__WAE_PRODUCTIVITY_V59__={version:VERSION,showHistory,showProjects,showSettings,snapshot:upsertConversation,newConversation:beginNewConversation};
})();
