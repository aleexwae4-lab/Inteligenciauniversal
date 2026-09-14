(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const notify=message=>{if(typeof window.toast==='function')window.toast(message)};

  if(!document.querySelector('link[data-wae-v3]')){
    const css=document.createElement('link');css.rel='stylesheet';css.href='./premium-v3.css';css.dataset.waeV3='true';document.head.appendChild(css);
  }

  $$('img[src$="assets/logo.svg"]').forEach(img=>img.src='./assets/logo-v2.svg');
  const brand=$('.topbar .brand');
  if(brand){const copy=brand.querySelector('div');if(copy)copy.innerHTML='<strong>WAE OS</strong><span>ENTERPRISE · AI</span>'}

  const topActions=$('.top-actions');
  if(topActions){
    if(!$('.v2-tier')){const tier=document.createElement('div');tier.className='v2-tier';tier.innerHTML='<i></i><strong>FREE</strong><span>⌄</span>';topActions.before(tier)}
    if(!$('.v2-bell')){const bell=document.createElement('button');bell.type='button';bell.className='icon-btn v2-bell';bell.setAttribute('aria-label','Notificaciones');bell.innerHTML='♧<i></i>';bell.addEventListener('click',()=>notify('Sin notificaciones nuevas'));topActions.prepend(bell)}
  }

  $('#newChatBtn')?.classList.add('v2-hide-new');
  const workspaceBtn=$('#workspaceBtn');if(workspaceBtn){workspaceBtn.innerHTML='⊞';workspaceBtn.title='Workspace'}
  const avatar=$('.avatar');if(avatar)avatar.textContent='AX';
  $('.status-strip')?.classList.add('v2-status-hidden');

  const eyebrow=$('.chat-heading .eyebrow');if(eyebrow)eyebrow.textContent='WAE OS · SESIÓN ACTIVA';
  const h1=$('.chat-heading h1');if(h1)h1.textContent='WAE OS · IA Corporativa';
  const intro=$('.chat-heading > p:last-child');if(intro)intro.classList.add('v2-intro-hidden');

  const grid=$('#capabilityGrid'),messages=$('#messages');
  if(grid&&messages&&!$('#v2Welcome')){
    const shell=document.createElement('section');shell.id='v2Welcome';shell.className='v2-welcome';
    shell.innerHTML='<div class="v2-hero-mark"><img src="./assets/logo-v2.svg" alt=""></div><h2>WAE OS Enterprise</h2><p>Inteligencia empresarial con memoria, web, archivos y ejecución asistida.</p>';
    messages.before(shell);shell.appendChild(grid);
  }

  const cardData=[['🔍','Investigar','Consulta web y fuentes verificables'],['💻','Programar','Arquitectura, código y pruebas'],['📊','Analizar','Datos, riesgos y decisiones'],['🎨','Diseñar','Producto, UX y sistemas']];
  $$('.capability-card').forEach((b,i)=>{const d=cardData[i];if(!d)return;b.innerHTML=`<span class="v2-cap-icon">${d[0]}</span><span><strong>${d[1]}</strong><small>${d[2]}</small></span>`});

  const syncConversation=()=>{document.documentElement.classList.toggle('v2-has-messages',!!document.querySelector('.message.user'))};
  syncConversation();if(messages)new MutationObserver(syncConversation).observe(messages,{childList:true,subtree:true});

  const composer=$('#composer');
  if(composer){
    const textarea=$('#messageInput');if(textarea)textarea.placeholder='Escribe una misión o pregunta…';
    $('#modePill')?.classList.add('v2-mode-hidden');
    const tools=$('.composer-actions')?.querySelector('div');
    if(tools){
      const attach=$('#attachBtn');if(attach){attach.textContent='＋';attach.title='Agregar archivo'}
      const voice=$('#voiceBtn');if(voice){voice.textContent='♩';voice.title='Dictado por voz'}
      if(!$('.v2-tool-search')){const search=document.createElement('button');search.type='button';search.className='mini-btn v2-tool v2-tool-search';search.textContent='⌕';search.title='Modo investigación';search.addEventListener('click',()=>document.querySelector('.capability-card[data-mode="research"]')?.click());attach?.after(search)}
      if(!$('.v2-tool-speak')){const speak=document.createElement('button');speak.type='button';speak.className='mini-btn v2-tool v2-tool-speak';speak.textContent='◖))';speak.title='Escuchar';speak.addEventListener('click',()=>notify('Salida de voz preparada'));voice?.after(speak)}
      if(!$('.v2-tool-doc')){const doc=document.createElement('button');doc.type='button';doc.className='mini-btn v2-tool v2-tool-doc';doc.textContent='▤';doc.title='Workspace';doc.addEventListener('click',()=>$('#workspaceBtn')?.click());$('.v2-tool-speak')?.after(doc)}
    }
    if(!$('.v2-composer-hint')){const hint=document.createElement('div');hint.className='v2-composer-hint';hint.innerHTML='<span>Comando inteligente</span><span>ENTER enviar</span>';composer.after(hint)}
  }

  const runtime=$('.runtime-bar');
  if(runtime){runtime.classList.add('v2-runtime');runtime.innerHTML='<div class="v2-runtime-icon">▣</div><div class="v2-runtime-copy"><strong>Universal Runtime · conectando</strong><small>memoria · web · archivos · guard</small></div><div class="v2-efficiency"><strong>LIVE</strong><small>UNIVERSAL AI</small></div>'}

  const settings=$('#settingsDialog');
  if(settings){
    const ep=$('#apiEndpoint');if(ep){ep.value='/api/chat';ep.disabled=true}
    const help=settings.querySelector('.help');if(help){help.id='managedRuntimeHelp';help.innerHTML='El runtime de producción se administra automáticamente. La interfaz usa <code>/api/chat</code> con Supabase como núcleo principal y Render como continuidad.'}
    const title=settings.querySelector('h2');if(title)title.textContent='Inteligencia y preferencias';
  }

  const drawer=$('#drawer');
  if(drawer){
    const dbrand=drawer.querySelector('.brand div');if(dbrand)dbrand.innerHTML='<strong>WAE OS</strong>';
    const dn=$('#drawerNewChat');if(dn)dn.innerHTML='＋ <span>Nueva Conversación</span>';
    const dw=$('#drawerWorkspace');if(dw)dw.innerHTML='▱ <span>Workspace</span>';
    const nav=drawer.querySelector('.nav-list');
    const values=[['Centro de Control',''],['Conversaciones',''],['Proyectos',''],['Agentes',''],['Automatizaciones',''],['Memoria',''],['Base de Conocimiento',''],['API Center',''],['Marketplace','NEW'],['Configuración','']];
    nav&&[...nav.children].forEach((b,i)=>{const span=b.querySelector('span');if(span&&values[i])span.textContent=values[i][0];let em=b.querySelector('em'),badge=values[i]?.[1];if(badge){if(!em){em=document.createElement('em');b.appendChild(em)}em.textContent=badge;if(badge==='NEW')em.className='new-badge'}else if(em&&!em.classList.contains('new-badge'))em.remove()});
    const foot=drawer.querySelector('.drawer-foot');if(foot)foot.innerHTML='<small>MEMORIA</small><div class="memory-meter"><span style="width:18%"></span></div><strong>ACTIVA</strong>';
  }
})();
