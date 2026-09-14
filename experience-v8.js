(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const PROFILE_KEY='iu.reasoningProfile';
  const priorFetch=window.fetch.bind(window);
  let caps=null,perf=null,lastSync=0,activityTimer=null;

  const profile=()=>localStorage.getItem(PROFILE_KEY)==='deep'?'deep':'auto';
  const setProfile=value=>{localStorage.setItem(PROFILE_KEY,value==='deep'?'deep':'auto');document.documentElement.dataset.reasoningProfile=profile();renderProfile();syncLive(true)};
  const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtMs=v=>Number.isFinite(Number(v))&&Number(v)>0?`${Math.round(Number(v))} ms`:'—';
  const isChatPost=(input,init={})=>{try{const raw=typeof input==='string'?input:input?.url,u=new URL(raw,location.href);return u.origin===location.origin&&u.pathname==='/api/chat'&&String(init.method||'GET').toUpperCase()==='POST'}catch{return false}};
  const history=()=>{try{return (JSON.parse(localStorage.getItem('wae.messages')||'[]')||[]).slice(-16)}catch{return[]}};

  function ensureDock(){
    if($('#v8LiveDock'))return;
    const messages=$('#messages');if(!messages)return;
    const dock=document.createElement('section');dock.id='v8LiveDock';dock.className='v8-live-dock';dock.innerHTML=`
      <button type="button" class="v8-live-cell" data-v7-view="control"><small>NÚCLEO</small><strong id="v8CoreState">Sincronizando</strong><span id="v8CoreDetail">runtime</span></button>
      <button type="button" class="v8-live-cell" data-v7-view="agents"><small>ORQUESTACIÓN</small><strong id="v8AgentState">—</strong><span>especialistas</span></button>
      <button type="button" class="v8-live-cell" data-v7-view="market"><small>HERRAMIENTAS</small><strong id="v8ToolState">—</strong><span>conectadas</span></button>
      <button type="button" class="v8-live-cell" data-v7-view="memory"><small>ÚLTIMA RESPUESTA</small><strong id="v8Latency">—</strong><span id="v8MemoryState">memoria lista</span></button>`;
    messages.before(dock);
  }

  function ensureReasoningControl(){
    const composer=$('#composer');if(!composer||$('#v8Reasoning'))return;
    const bar=document.createElement('div');bar.id='v8Reasoning';bar.className='v8-reasoning';
    bar.innerHTML=`<button type="button" id="v8ReasoningToggle" aria-pressed="false"><span class="v8-reasoning-dot"></span><strong>Auto</strong><small>routing adaptativo</small></button><div class="v8-activity" id="v8Activity"><i></i><span>Listo</span></div>`;
    composer.before(bar);
    $('#v8ReasoningToggle')?.addEventListener('click',()=>setProfile(profile()==='deep'?'auto':'deep'));
  }

  function renderProfile(){
    const deep=profile()==='deep',btn=$('#v8ReasoningToggle');if(!btn)return;
    btn.setAttribute('aria-pressed',String(deep));btn.classList.toggle('deep',deep);
    const strong=btn.querySelector('strong'),small=btn.querySelector('small');
    if(strong)strong.textContent=deep?'Deep':'Auto';
    if(small)small.textContent=deep?'multiagente paralelo':'routing adaptativo';
  }

  function activity(text,busy=false,hold=0){
    const root=$('#v8Activity');if(!root)return;root.classList.toggle('busy',busy);const span=root.querySelector('span');if(span)span.textContent=text;
    clearTimeout(activityTimer);if(hold)activityTimer=setTimeout(()=>activity('Listo',false),hold);
  }

  async function json(url){const r=await priorFetch(url,{headers:{accept:'application/json'},cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
  async function syncLive(force=false){
    if(!force&&Date.now()-lastSync<20000)return;
    try{
      [caps,perf]=await Promise.all([json('/api/capabilities'),json('/api/performance').catch(()=>null)]);lastSync=Date.now();
      const tools=caps?.tools||[],agents=caps?.agents||[],configured=tools.filter(x=>x.configured).length,last=window.__iuLastRuntime||{};
      const core=$('#v8CoreState'),detail=$('#v8CoreDetail'),agent=$('#v8AgentState'),tool=$('#v8ToolState'),lat=$('#v8Latency'),mem=$('#v8MemoryState');
      if(core)core.textContent=caps?.ready?'Operativo':'Degradado';if(detail)detail.textContent=profile()==='deep'?'Deep disponible':'runtime activo';
      if(agent)agent.textContent=String(agents.length||0);if(tool)tool.textContent=`${configured}/${tools.length}`;if(lat)lat.textContent=fmtMs(last.latency_ms||last.latencyMs||last.orchestration?.elapsedMs);
      if(mem)mem.textContent=Number(last.memory_count??last.memory?.recalled??0)>0?`${Number(last.memory_count??last.memory?.recalled)} memorias`:(caps?.memory?.configured?'memoria persistente':'continuidad');
      document.documentElement.dataset.v8Ready=caps?.ready?'true':'false';
    }catch{const core=$('#v8CoreState');if(core)core.textContent='Reconectando';document.documentElement.dataset.v8Ready='false'}
  }

  async function deepChat(incoming){
    activity('Planificando misión',true);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort('deep_timeout'),110000);
    try{
      const response=await priorFetch('/api/orchestrate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        message:String(incoming.message||''),
        mode:String(incoming.mode||localStorage.getItem('wae.mode')||'general'),
        sessionId:localStorage.getItem('iu.sessionId')||undefined,
        history:history(),
        attachments:window.__waeRuntimeAttachments||[],
      }),cache:'no-store',signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||typeof data.reply!=='string')return new Response(JSON.stringify(data),{status:response.status||502,headers:{'content-type':'application/json','cache-control':'no-store'}});
      window.__iuLastRuntime={...data,latency_ms:data.latencyMs||data.orchestration?.elapsedMs||null,memory_count:data.memory?.recalled||0};
      activity(`Síntesis Deep · ${data.orchestration?.specialists?.filter(x=>x.ok).length||0} especialistas`,false,3200);
      syncLive(true).catch(()=>{});
      if(window.__waeVoice?.enabled&&data.speech_text)window.__waeVoice.enqueue?.(String(data.speech_text)).catch(()=>{});
      return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-wae-runtime':'universal-core-deep'}});
    }catch(error){activity(error?.name==='AbortError'?'Deep agotó su ventana':'Continuidad activada',false,3200);return new Response(JSON.stringify({error:'deep_runtime_unavailable',message:String(error?.message||error),recoverable:true}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}})}
    finally{clearTimeout(timer)}
  }

  window.fetch=async(input,init={})=>{
    if(profile()==='deep'&&isChatPost(input,init)){
      let incoming={};try{incoming=typeof init.body==='string'?JSON.parse(init.body):{}}catch{}
      return deepChat(incoming);
    }
    return priorFetch(input,init);
  };

  window.addEventListener('wae:stream-event',event=>{
    const name=event.detail?.event,data=event.detail?.data||{};
    if(name==='response.start')activity('Procesando',true);
    if(name==='reasoning.status')activity(String(data.status||'Procesando'),true);
    if(name==='source.add')activity('Verificando fuentes',true);
    if(name==='content.delta')activity('Respondiendo',true);
    if(name==='response.complete'){activity('Respuesta lista',false,2200);syncLive(true).catch(()=>{})}
    if(name==='response.error')activity('Continuidad activada',false,2600);
  });

  const observer=new MutationObserver(()=>{if(document.documentElement.dataset.aiBusy==='true')activity(profile()==='deep'?'Orquestando':'Procesando',true)});
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-ai-busy']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncLive(true).catch(()=>{})});
  window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='d'){event.preventDefault();setProfile(profile()==='deep'?'auto':'deep')}});

  function init(){ensureDock();ensureReasoningControl();document.documentElement.dataset.reasoningProfile=profile();renderProfile();syncLive(true).catch(()=>{});setInterval(()=>{if(!document.hidden)syncLive(false).catch(()=>{})},30000)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
  window.__waeV8={get profile(){return profile()},setProfile,sync:()=>syncLive(true)};
})();
