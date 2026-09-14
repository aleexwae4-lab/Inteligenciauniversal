(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  // Universal Core is the only intelligence identity exposed by the product UI.
  localStorage.setItem('wae.autoVoice','false');
  localStorage.setItem('wae.coreName','Universal Core');
  try{state.autoVoice=false;state.coreName='Universal Core'}catch{}

  if(!document.querySelector('link[data-wae-v3]')){
    const css=document.createElement('link');
    css.rel='stylesheet';css.href='./premium-v3.css';css.dataset.waeV3='true';
    document.head.appendChild(css);
  }

  document.title='WAE OS Enterprise · Universal Core';
  const description=document.querySelector('meta[name="description"]');
  if(description)description.content='WAE OS Enterprise — Universal Core para investigación, programación, análisis, diseño y ejecución.';

  $$('img[src$="assets/logo.svg"]').forEach(img=>img.src='./assets/logo-v2.svg');
  const brand=$('.topbar .brand div');
  if(brand)brand.innerHTML='<strong>WAE OS Enterprise</strong><span>Universal Core</span>';
  $('#newChatBtn')?.classList.add('v2-hide-new');

  const workspaceBtn=$('#workspaceBtn');
  if(workspaceBtn){workspaceBtn.innerHTML='⊞';workspaceBtn.title='Workspace'}
  const avatar=$('.avatar');if(avatar)avatar.textContent='AX';
  $('.status-strip')?.classList.add('v2-status-hidden');

  const eyebrow=$('.chat-heading .eyebrow');if(eyebrow)eyebrow.textContent='WAE OS ENTERPRISE · SESIÓN ACTIVA';
  const h1=$('.chat-heading h1');if(h1)h1.textContent='Universal Core';
  const intro=$('.chat-heading > p:last-child');if(intro)intro.classList.add('v2-intro-hidden');

  const grid=$('#capabilityGrid'),messages=$('#messages');
  if(grid&&messages&&!$('#v2Welcome')){
    const shell=document.createElement('section');
    shell.id='v2Welcome';shell.className='v2-welcome';
    shell.innerHTML='<div class="v2-hero-mark"><img src="./assets/logo-v2.svg" alt=""></div><h2>Universal Core</h2><p>Núcleo operativo de WAE OS Enterprise con memoria, investigación, archivos y ejecución asistida.</p>';
    messages.before(shell);shell.appendChild(grid);
  }

  const cardData=[['⌕','Investigar','Consulta web y fuentes verificables'],['⌘','Programar','Arquitectura, código y pruebas'],['▦','Analizar','Datos, riesgos y decisiones'],['✦','Diseñar','Producto, UX y sistemas']];
  $$('.capability-card').forEach((b,i)=>{const d=cardData[i];if(d)b.innerHTML=`<span class="v2-cap-icon">${d[0]}</span><span><strong>${d[1]}</strong><small>${d[2]}</small></span>`});

  const sync=()=>document.documentElement.classList.toggle('v2-has-messages',!!document.querySelector('.message.user'));
  sync();if(messages)new MutationObserver(sync).observe(messages,{childList:true,subtree:true});

  const composer=$('#composer');
  if(composer){
    const textarea=$('#messageInput');if(textarea)textarea.placeholder='Escribe una misión o pregunta…';
    $('#modePill')?.classList.add('v2-mode-hidden');
    const tools=$('.composer-actions')?.querySelector('div');
    if(tools){
      const attach=$('#attachBtn');if(attach){attach.textContent='＋';attach.title='Agregar archivo'}
      const legacyVoice=$('#voiceBtn');
      let voice=legacyVoice;
      if(legacyVoice){voice=legacyVoice.cloneNode(true);legacyVoice.replaceWith(voice);voice.id='voiceBtn';voice.textContent='♩';voice.title='Activar o desactivar respuestas por voz';voice.setAttribute('aria-pressed','true')}
      if(!$('.v2-tool-search')){const search=document.createElement('button');search.type='button';search.className='mini-btn v2-tool v2-tool-search';search.textContent='⌕';search.title='Modo investigación';search.addEventListener('click',()=>document.querySelector('.capability-card[data-mode="research"]')?.click());attach?.after(search)}
      if(!$('.v2-tool-doc')){const doc=document.createElement('button');doc.type='button';doc.className='mini-btn v2-tool v2-tool-doc';doc.textContent='▤';doc.title='Workspace';doc.addEventListener('click',()=>$('#workspaceBtn')?.click());voice?.after(doc)}
    }
    if(!$('.v2-composer-hint')){const hint=document.createElement('div');hint.className='v2-composer-hint';hint.innerHTML='<span>Universal Core · voz natural</span><span>ENTER enviar</span>';composer.after(hint)}
  }

  const runtime=$('.runtime-bar');
  if(runtime){runtime.classList.add('v2-runtime');runtime.innerHTML='<div class="v2-runtime-icon">▣</div><div class="v2-runtime-copy"><strong>Universal Core · online</strong><small>memoria · web · herramientas · seguridad · voz</small></div><div class="v2-efficiency"><strong>LIVE</strong><small>WAE OS</small></div>'}

  const settings=$('#settingsDialog');
  if(settings){
    const ep=$('#apiEndpoint');if(ep)ep.closest('label')?.remove();
    const core=$('#coreName');if(core){core.value='Universal Core';core.readOnly=true;core.setAttribute('aria-readonly','true')}
    const help=settings.querySelector('.help');if(help)help.textContent='Universal Core se administra automáticamente dentro de WAE OS Enterprise. La interfaz mantiene una sola identidad para respuestas, memoria, herramientas y voz.';
    const title=settings.querySelector('h2');if(title)title.textContent='Universal Core';
  }

  const drawer=$('#drawer');
  if(drawer){
    const dbrand=drawer.querySelector('.brand div');if(dbrand)dbrand.innerHTML='<strong>WAE OS Enterprise</strong><span>Universal Core</span>';
    const coreNav=drawer.querySelector('.nav-list button[data-view="ai"] span');if(coreNav)coreNav.textContent='Universal Core';
    const foot=drawer.querySelector('.drawer-foot');if(foot)foot.innerHTML='<small>MEMORIA</small><div class="memory-meter"><span style="width:18%"></span></div><strong>ACTIVA</strong>';
  }

  // Provider/model names are internal routing data and never product identity.
  const providerMark=/\b(?:gemini|gpt|openai|claude|anthropic|grok|mistral|groq|openrouter|llama|qwen|deepseek|copilot)\b/i;
  const sanitizeRuntimeMeta=()=>$$('.iu-answer-meta').forEach(meta=>{
    let hasCore=false;
    [...meta.querySelectorAll('span')].forEach(span=>{
      const value=(span.textContent||'').trim();
      if(providerMark.test(value)){span.remove();return}
      if(value==='Universal Core')hasCore=true;
    });
    if(!hasCore){const badge=document.createElement('span');badge.textContent='Universal Core';meta.prepend(badge)}
  });
  sanitizeRuntimeMeta();
  if(messages)new MutationObserver(sanitizeRuntimeMeta).observe(messages,{childList:true,subtree:true});

  if(!document.querySelector('link[data-wae-v4]')){
    const css=document.createElement('link');css.rel='stylesheet';css.href='./premium-v4.css';css.dataset.waeV4='true';document.head.appendChild(css);
  }
  const load=(src,done)=>{
    if(document.querySelector(`script[data-src="${src}"]`)){done?.();return}
    const script=document.createElement('script');script.src=src;script.defer=true;script.dataset.src=src;script.onload=()=>done?.();document.head.appendChild(script);
  };
  load('./voice-client.js',()=>load('./premium-v4.js',()=>load('./streaming-v2.js',sanitizeRuntimeMeta)));
})();
