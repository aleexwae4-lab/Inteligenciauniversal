(()=>{
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const notify=(message)=>{ if(typeof window.toast==='function') window.toast(message); };
  $$('img[src$="assets/logo.svg"]').forEach(img=>img.src='./assets/logo-v2.svg');
  const brand=$('.topbar .brand');
  if(brand){const copy=brand.querySelector('div');if(copy)copy.innerHTML='<strong>WAE OS</strong><span>ENTERPRISE · AI</span>';}
  const topActions=$('.top-actions');
  if(topActions){
    // No se anuncia una suscripción que no haya sido verificada.
    // Las notificaciones se mostrarán cuando exista un servicio real de notificaciones.
  }
  const newBtn=$('#newChatBtn');if(newBtn)newBtn.classList.add('v2-hide-new');
  const workspaceBtn=$('#workspaceBtn');if(workspaceBtn){workspaceBtn.innerHTML='⊞';workspaceBtn.title='Workspace'}
  const avatar=$('.avatar');if(avatar)avatar.textContent='AX';
  $('.status-strip')?.classList.add('v2-status-hidden');
  const eyebrow=$('.chat-heading .eyebrow');if(eyebrow)eyebrow.textContent='WAE OS ENTERPRISE';
  const h1=$('.chat-heading h1');if(h1)h1.textContent='Universal Core';
  const intro=$('.chat-heading > p:last-child');if(intro)intro.classList.add('v2-intro-hidden');
  const grid=$('#capabilityGrid');const messages=$('#messages');
  if(grid&&messages&&!$('#v2Welcome')){
    const shell=document.createElement('section');shell.id='v2Welcome';shell.className='v2-welcome';
    shell.innerHTML='<div class="v2-hero-mark"><img src="./assets/logo-v2.svg" alt=""></div><h2>WAE OS Enterprise</h2><p>Sistema operativo empresarial: analiza, audita, refactoriza y dirige tu organización con IA.</p>';
    messages.before(shell);shell.appendChild(grid);
  }
  const cards=$$('.capability-card');
  const cardData=[['🔍','Investigar','Fuentes y contexto'],['💻','Programar','Código y depuración'],['📊','Analizar','Datos y riesgos'],['🎨','Diseñar','Producto y experiencia']];
  cards.forEach((b,i)=>{const d=cardData[i];if(!d)return;b.innerHTML=`<span class="v2-cap-icon">${d[0]}</span><span><strong>${d[1]}</strong><small>${d[2]}</small></span>`});
  const syncConversation=()=>document.querySelector('.message.user')?document.documentElement.classList.add('v2-has-messages'):document.documentElement.classList.remove('v2-has-messages');
  syncConversation();if(messages)new MutationObserver(syncConversation).observe(messages,{childList:true,subtree:true});
  const composer=$('#composer');
  if(composer){
    const textarea=$('#messageInput');if(textarea)textarea.placeholder='Describe una misión, crea un sistema o';
    const mode=$('#modePill');if(mode)mode.classList.add('v2-mode-hidden');
    const actions=$('.composer-actions');const tools=actions?.querySelector('div');
    if(tools){
      const attach=$('#attachBtn');if(attach){attach.textContent='＋';attach.title='Agregar'}
      const voice=$('#voiceBtn');if(voice){voice.textContent='♩';voice.title='Dictado por voz'}
      const clip=document.createElement('button');clip.type='button';clip.className='mini-btn v2-tool';clip.textContent='⌕';clip.title='Investigar en la web';clip.setAttribute('aria-label','Activar modo Investigar');clip.addEventListener('click',()=>window.WAEModes?.select('research'));
      const speak=document.createElement('button');speak.type='button';speak.className='mini-btn v2-tool';speak.textContent='■';speak.title='Detener voz';speak.setAttribute('aria-label','Detener reproducción de voz');speak.addEventListener('click',()=>{if(window.WAEVoice?.stop){window.WAEVoice.stop();notify('Voz detenida')}else if(window.speechSynthesis){window.speechSynthesis.cancel();notify('Voz detenida')}else notify('Voz no disponible en este navegador')});
      const doc=document.createElement('button');doc.type='button';doc.className='mini-btn v2-tool';doc.textContent='▤';doc.title='Documento';doc.addEventListener('click',()=>$('#workspaceBtn')?.click());
      if(attach)attach.after(clip);if(voice)voice.after(speak,doc);
    }
    const hint=document.createElement('div');hint.className='v2-composer-hint';hint.innerHTML='<span>Barra de comandos inteligente</span><span>ENTER enviar</span>';composer.after(hint);
  }
  const runtime=$('.runtime-bar');
  if(runtime){runtime.classList.add('v2-runtime');runtime.innerHTML='<div class="v2-runtime-icon">▣</div><div class="v2-runtime-copy"><strong>Operativo · 0 req</strong><small>100% éxito · 0ms promedio</small></div><div class="v2-efficiency"><strong>100%</strong><small>EFICIENCIA IA</small></div>';}
  const drawer=$('#drawer');
  if(drawer){
    const dbrand=drawer.querySelector('.brand div');if(dbrand)dbrand.innerHTML='<strong>WAE OS</strong>';
    const dn=$('#drawerNewChat');if(dn)dn.innerHTML='＋ <span>Nueva Conversación</span>';
    const dw=$('#drawerWorkspace');if(dw)dw.innerHTML='▱ <span>Workspace</span>';
    // El historial real se inserta a través de runtime-client.js.
    const nav=drawer.querySelector('.nav-list');const values=[['Centro de Control',''],['Conversaciones',''],['Proyectos',''],['Agentes',''],['Automatizaciones',''],['Memoria',''],['Base de Conocimiento',''],['API Center',''],['Marketplace',''],['Configuración','']];
    nav&&[...nav.children].forEach((b,i)=>{const span=b.querySelector('span');if(span&&values[i])span.textContent=values[i][0];let em=b.querySelector('em');const badge=values[i]?.[1];if(badge){if(!em){em=document.createElement('em');b.appendChild(em)}em.textContent=badge;if(badge==='NEW')em.className='new-badge'}});
    const foot=drawer.querySelector('.drawer-foot');if(foot)foot.innerHTML='<small>MEMORIA</small><small>Estado sujeto a conexión</small>';
  }
})();
