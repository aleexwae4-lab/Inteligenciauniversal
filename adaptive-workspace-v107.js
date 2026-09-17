(()=>{
  'use strict';
  if(window.__WAE_ADAPTIVE_WORKSPACE_V107__)return;
  const VERSION='adaptive-workspace/v107';
  const USER_SCOPE_KEY='wae.userScope.v107';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const money=value=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(num(value));

  function userScope(){
    let key='';
    try{key=localStorage.getItem(USER_SCOPE_KEY)||''}catch{}
    if(key)return key;
    key=crypto.randomUUID?.()||`wae-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}`;
    try{localStorage.setItem(USER_SCOPE_KEY,key)}catch{}
    return key;
  }
  function conversationId(){
    try{return localStorage.getItem('wae.v59.activeConversationId')||localStorage.getItem('iu.conversationId')||''}catch{return''}
  }
  function latestUserMessage(){
    try{
      const rows=JSON.parse(localStorage.getItem('wae.messages')||'[]');
      if(Array.isArray(rows))return String([...rows].reverse().find(x=>x?.role==='user')?.text||'').slice(0,12000);
    }catch{}
    return'';
  }

  const upstreamFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    let url=null;
    try{url=new URL(typeof input==='string'?input:input?.url,location.href)}catch{}
    const method=String(init.method||'GET').toUpperCase();
    if(url&&url.origin===location.origin&&url.pathname==='/api/chat'&&method==='POST'&&typeof init.body==='string'){
      try{
        const body=JSON.parse(init.body);
        if(body&&typeof body==='object'){
          body.userKey=body.userKey||userScope();
          body.sessionId=body.sessionId||conversationId()||userScope();
          body.conversationId=body.conversationId||conversationId()||undefined;
          init={...init,body:JSON.stringify(body)};
        }
      }catch{}
    }
    return upstreamFetch(input,init);
  };

  function badge(value,kind=''){
    const label=String(value||'').trim();
    return label?`<span class="wae107-badge ${esc(kind)}">${esc(label)}</span>`:'';
  }
  function chips(items=[],formatter=x=>x){
    const rows=(Array.isArray(items)?items:[]).map(formatter).filter(Boolean).slice(0,20);
    return rows.length?`<div class="wae107-chips">${rows.map(x=>badge(x)).join('')}</div>`:'<p class="wae107-muted">Sin señales activas para este turno.</p>';
  }
  function profileList(label,items=[]){
    const rows=(Array.isArray(items)?items:[]).filter(Boolean).slice(0,8);
    return rows.length?`<div class="wae107-profile-row"><strong>${esc(label)}</strong><span>${rows.map(esc).join(' · ')}</span></div>`:'';
  }
  function stat(label,value,sub=''){
    return `<article class="wae107-stat"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub?`<span>${esc(sub)}</span>`:''}</article>`;
  }

  function shell(){
    let tabs=$('.workspace-tabs'),body=$('.workspace-body');
    if(!tabs||!body)return null;
    let button=$('[data-tab="core"]',tabs),panel=$('#panel-core',body);
    if(!button){
      button=document.createElement('button');
      button.type='button';button.dataset.tab='core';button.textContent='Core Adaptativo';button.dataset.wae107='true';
      tabs.appendChild(button);
    }
    if(!panel){
      panel=document.createElement('section');panel.className='tab-panel wae107-panel';panel.id='panel-core';
      panel.innerHTML='<div class="wae107-loading"><span></span><strong>Adaptive Meta‑OS</strong><small>Preparando estado operativo…</small></div>';
      body.appendChild(panel);
    }
    if(!button.dataset.wae107Bound){
      button.dataset.wae107Bound='1';
      button.addEventListener('click',event=>{event.preventDefault();activate(button,panel)});
    }
    return{button,panel};
  }

  function activate(button,panel){
    $$('.workspace-tabs button').forEach(x=>x.classList.toggle('active',x===button));
    $$('.tab-panel').forEach(x=>x.classList.toggle('active',x===panel));
    refresh(panel);
  }

  async function fetchState(){
    const response=await upstreamFetch('/api/meta-os',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        userKey:userScope(),
        sessionId:conversationId()||userScope(),
        conversationId:conversationId()||undefined,
        message:latestUserMessage()
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data?.success)throw new Error(data?.error||`meta_os_${response.status}`);
    return data;
  }

  function render(panel,data){
    const meta=data.meta_os||{},profile=data.user_profile||{},assets=data.asset_portfolio||{},ledger=data.value_ledger||{};
    const packs=Array.isArray(meta.professionalPacks)?meta.professionalPacks:[];
    const specialists=Array.isArray(meta.orchestration?.specialists)?meta.orchestration.specialists:[];
    const project=meta.projectIntent||{};
    const valueCandidates=Array.isArray(meta.valueMeasurementCandidates)?meta.valueMeasurementCandidates:[];
    const activeDomains=Array.isArray(meta.capabilityDomains)?meta.capabilityDomains:[];
    const amountVerified=num(ledger.verifiedAmountMxn),amountRealized=num(ledger.realizedAmountMxn);
    panel.innerHTML=`<div class="wae107-wrap">
      <header class="wae107-hero">
        <div><span class="wae107-kicker">UNIVERSAL CORE · ADAPTIVE META‑OS</span><h2>Estado operativo personal</h2><p>Contexto → especialización → capacidades → agentes → ejecución → memoria → activo → valor.</p></div>
        <button type="button" class="wae107-refresh" id="wae107Refresh">↻ Actualizar</button>
      </header>

      <section class="wae107-summary">
        ${stat('Nivel',String(meta.executionLevel||'know').toUpperCase(),'KNOW · CREATE · DO')}
        ${stat('Especializaciones',String(packs.length),packs.map(x=>x.name).slice(0,2).join(' · ')||'Generalista')}
        ${stat('Activos',String(num(assets.totalAssets)),`${num(assets.reusableAssets)} reutilizables`)}
        ${stat('Valor verificado',money(amountVerified),`${num(ledger.verifiedHoursSaved)} h registradas`)}
      </section>

      <div class="wae107-grid">
        <section class="wae107-card wide">
          <div class="wae107-card-head"><div><span>01</span><h3>Modo profesional adaptativo</h3></div>${meta.governance?.regulatedHumanValidation?badge('Validación humana','warn'):badge('Operativo','ok')}</div>
          ${packs.length?`<div class="wae107-pack-grid">${packs.map(pack=>`<article><strong>${esc(pack.name)}</strong><small>${esc(pack.source==='current_task'?'activado por la misión actual':'perfil explícito')}</small><em>${esc(pack.risk==='regulated'?'dominio regulado':'estándar')}</em></article>`).join('')}</div>`:'<p class="wae107-muted">Modo generalista activo. Universal Core activará un Core profesional cuando la misión o tu perfil explícito lo requieran.</p>'}
          ${profileList('Roles',profile.professional_roles)}${profileList('Objetivos',profile.goals)}${profileList('Responsabilidades',profile.responsibilities)}
        </section>

        <section class="wae107-card">
          <div class="wae107-card-head"><div><span>02</span><h3>Capacidades activas</h3></div></div>
          ${chips(activeDomains,x=>String(x).replaceAll('_',' '))}
        </section>

        <section class="wae107-card">
          <div class="wae107-card-head"><div><span>03</span><h3>Orquestación</h3></div>${badge(meta.orchestration?.parallel?'paralelo':'dirigido')}</div>
          ${chips(specialists,x=>typeof x==='string'?x:(x?.name||x?.id||''))}
          <p class="wae107-foot">Estrategia: <strong>${esc(meta.orchestration?.strategy||'direct')}</strong></p>
        </section>

        <section class="wae107-card">
          <div class="wae107-card-head"><div><span>04</span><h3>Problem → Project</h3></div>${badge(project.convert?'Candidato a proyecto':'Turno directo',project.convert?'ok':'')}</div>
          <p>${project.convert?'La misión tiene alcance suficiente para convertirse en proyecto persistente con plan, hitos y entregables.':'La solicitud actual puede resolverse sin crear un proyecto de largo horizonte.'}</p>
          <small>${esc(project.reason||'single_turn_sufficient')}</small>
        </section>

        <section class="wae107-card">
          <div class="wae107-card-head"><div><span>05</span><h3>Asset Portfolio</h3></div></div>
          <div class="wae107-mini-stats"><b>${num(assets.totalAssets)}<small>activos</small></b><b>${num(assets.reusableAssets)}<small>reutilizables</small></b><b>${num(assets.verifiedOutcomes)}<small>verificados</small></b></div>
          ${Object.keys(assets.byType||{}).length?chips(Object.entries(assets.byType).map(([k,v])=>`${k}: ${v}`)):'<p class="wae107-muted">Los entregables reutilizables aparecerán aquí conforme Universal Core los genere y archive.</p>'}
        </section>

        <section class="wae107-card wide">
          <div class="wae107-card-head"><div><span>06</span><h3>WAE Value Ledger</h3></div>${badge('sin ROI inventado','ok')}</div>
          <div class="wae107-value-grid">
            ${stat('Señales candidatas',String(num(ledger.candidateSignals)),'aún no cuentan como ROI')}
            ${stat('Entradas verificadas',String(num(ledger.verifiedEntries)),money(amountVerified))}
            ${stat('Valor realizado',String(num(ledger.realizedEntries)),money(amountRealized))}
            ${stat('Horas verificadas',String(num(ledger.verifiedHoursSaved)),`${num(ledger.realizedHoursSaved)} h realizadas`)}
          </div>
          ${valueCandidates.length?`<div class="wae107-candidate-row"><small>El turno actual podría producir:</small>${chips(valueCandidates,x=>String(x.category||'').replaceAll('_',' '))}</div>`:''}
          <p class="wae107-integrity">Los montos y horas sólo entran a los totales cuando existe una medición verificable. Una oportunidad detectada no se presenta como dinero generado.</p>
        </section>
      </div>
    </div>`;
    $('#wae107Refresh',panel)?.addEventListener('click',()=>refresh(panel));
  }

  async function refresh(panel){
    if(!panel||panel.dataset.loading==='true')return;
    panel.dataset.loading='true';
    panel.innerHTML='<div class="wae107-loading"><span></span><strong>Sincronizando Adaptive Meta‑OS</strong><small>Perfil, capacidades, activos y valor.</small></div>';
    try{render(panel,await fetchState())}
    catch(error){panel.innerHTML=`<div class="wae107-error"><strong>No se pudo leer el estado adaptativo</strong><p>${esc(error?.message||'meta_os_unavailable')}</p><button type="button" id="wae107Retry">Reintentar</button></div>`;$('#wae107Retry',panel)?.addEventListener('click',()=>refresh(panel))}
    finally{panel.dataset.loading='false'}
  }

  function init(){
    const mounted=shell();
    if(!mounted)return;
    document.documentElement.dataset.waeAdaptiveWorkspace='v107';
    window.dispatchEvent(new CustomEvent('wae:adaptive-workspace-ready',{detail:{version:VERSION}}));
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
  window.__WAE_ADAPTIVE_WORKSPACE_V107__={version:VERSION,userScope,refresh:()=>{const mounted=shell();return mounted&&refresh(mounted.panel)}};
})();
