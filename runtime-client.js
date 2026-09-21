(()=>{
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const nativeFetch=window.fetch.bind(window);
  const SESSION_ID='iu.sessionId',SESSION_SECRET='iu.sessionSecret',CONVERSATION_ID='iu.conversationId';
  if(!localStorage.getItem('wae.endpoint')||localStorage.getItem('wae.endpoint')==='/api/chat')localStorage.setItem('wae.endpoint','/api/chat');
  window.__waeRuntimeAttachments=[];

  const edge=async(payload)=>{
    const res=await nativeFetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-inteligencia-universal/1.2'},body:JSON.stringify(payload),cache:'no-store',signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(32000):undefined});
    const data=await res.json().catch(()=>({success:false,error:`HTTP ${res.status}`}));
    if(!res.ok)throw Object.assign(new Error(data.error||`HTTP ${res.status}`),{status:res.status,data});
    return data;
  };

  let bootPromise;
  const bootstrap=()=>bootPromise||(bootPromise=edge({action:'bootstrap',session_id:localStorage.getItem(SESSION_ID)||'',session_secret:localStorage.getItem(SESSION_SECRET)||''}).then(data=>{
    if(!data?.session_id||!data?.session_secret)throw new Error('invalid_bootstrap');
    localStorage.setItem(SESSION_ID,data.session_id);localStorage.setItem(SESSION_SECRET,data.session_secret);return data;
  }).catch(err=>{bootPromise=null;throw err}));
  const sessionPayload=()=>({session_id:localStorage.getItem(SESSION_ID)||'',session_secret:localStorage.getItem(SESSION_SECRET)||''});

  function isLocalRuntime(input){
    try{const raw=typeof input==='string'?input:input?.url;const url=new URL(raw,location.href);return url.origin===location.origin&&url.pathname==='/api/chat'}catch{return false}
  }

  const selfQuery=value=>/(?:\bque tan inteligente (?:eres|es)\b|\b(?:quien|que) eres\b|\b(?:que|cuales) (?:capacidades|funciones) (?:tienes|tiene)\b|\bque (?:puedes|sabes) hacer\b|\b(?:como funcionas|que modelo eres|eres chatgpt|eres un modelo de openai|tienes acceso a internet|puedes buscar en internet)\b)/.test(String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,:]/g,' ').replace(/\s+/g,' ').trim());
  window.fetch=async(input,init={})=>{
    if(!isLocalRuntime(input)||String(init.method||'GET').toUpperCase()!=='POST')return nativeFetch(input,init);
    const request=typeof init.body==='string'?JSON.parse(init.body):{};
    // Capability/identity answers come from the product's real server registry, not a generic upstream persona.
    if(selfQuery(request.message))return nativeFetch(input,init);
    try{
      await bootstrap();
      const incoming=request;
      const data=await edge({action:'chat',...sessionPayload(),conversation_id:localStorage.getItem(CONVERSATION_ID)||null,message:[incoming.preferences?.instructions?'PREFERENCIAS DEL USUARIO (no prevalecen sobre reglas de seguridad):\n'+String(incoming.preferences.instructions).slice(0,4000):'',incoming.preferences?.knowledge?'CONTEXTO GENERAL DEL USUARIO (no verificado):\n'+String(incoming.preferences.knowledge).slice(0,12000):'',incoming.project?.instructions?'INSTRUCCIONES DE ESTE PROYECTO (subordinadas a seguridad):\n'+String(incoming.project.instructions).slice(0,3000):'',incoming.project?.knowledge?'CONOCIMIENTO DEL PROYECTO (información aportada, no verificada):\n'+String(incoming.project.knowledge).slice(0,8000):'','SOLICITUD ACTUAL:\n'+String(incoming.message||'')].filter(Boolean).join('\n\n'),mode:String(incoming.mode||localStorage.getItem('wae.mode')||'general'),web_enabled:String(incoming.mode||'')==='research',attachments:window.__waeRuntimeAttachments||[]});
      if(data.conversation_id){localStorage.setItem(CONVERSATION_ID,data.conversation_id);window.WAENavigation?.remoteUpdated?.(data.conversation_id)}
      window.__iuLastRuntime=data;
      queueMicrotask(()=>{updateRuntimeCard(data);loadConversations().catch(()=>{})});
      return new Response(JSON.stringify({reply:data.reply||'',runtime:data.runtime,provider:data.provider,model:data.model,web_sources:data.web_sources||[]}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-wae-runtime':'supabase-primary'}});
    }catch(err){
      console.warn('[WAE IU] Supabase primary unavailable; using Render fallback',err?.message||err);
      try{
        const fallback=await nativeFetch(input,init);
        const copy=document.querySelector('.v2-runtime-copy');
        if(copy&&fallback.ok)copy.innerHTML='<strong>WAE Gateway · fallback activo</strong><small>Render → Supabase capability router</small>';
        return fallback;
      }catch(fallbackError){
        const status=Number(err?.status)||503;
        return new Response(JSON.stringify({error:'universal_runtime_unavailable',primary:err?.message||'supabase_runtime_unavailable',fallback:fallbackError?.message||'render_runtime_unavailable'}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
      }
    }
  };

  async function readAttachments(files){
    const allowed=/\.(txt|md|markdown|json|csv|tsv|js|mjs|cjs|ts|tsx|jsx|css|html|htm|xml|yaml|yml|py|java|go|rs|sql|sh|log)$/i;
    const output=[];
    for(const file of [...files].slice(0,5)){
      const looksText=file.type.startsWith('text/')||file.type.includes('json')||file.type.includes('xml')||allowed.test(file.name);
      if(!looksText)continue;
      output.push({name:file.name,type:file.type||'text/plain',text:(await file.text()).slice(0,120000)});
    }
    window.__waeRuntimeAttachments=output;
    window.toast?.(output.length?`${output.length} archivo${output.length===1?'':'s'} listo${output.length===1?'':'s'} para IA`:'Ese formato todavía no se procesa como texto');
  }

  function updateRuntimeCard(data){
    const copy=document.querySelector('.v2-runtime-copy'),eff=document.querySelector('.v2-efficiency');
    if(!copy)return;
    if(data?.model_count!==undefined){
      const extra=[data.web_configured?'web':'',data.memory?'memoria':'',data.files?'archivos':'',data.history?'historial':''].filter(Boolean).join(' · ');
      copy.innerHTML=`<strong>Supabase Universal Runtime · ${data.model_count} modelo${data.model_count===1?'':'s'}</strong><small>${extra||'backend persistente'} · sesiones cifradas</small>`;
      if(eff)eff.innerHTML=`<strong>${data.model_count?'LIVE':'SETUP'}</strong><small>UNIVERSAL AI</small>`;
      document.documentElement.dataset.runtimeReady=data.model_count?'true':'false';
    }else if(data?.model){
      copy.innerHTML=`<strong>Supabase Runtime · ${escapeHtml(data.model)}</strong><small>${data.web_used?'web verificada · ':''}${data.memory_count||0} memorias recuperadas · ${data.latency_ms||0}ms</small>`;
      if(eff)eff.innerHTML='<strong>LIVE</strong><small>UNIVERSAL AI</small>';
    }
  }
  const escapeHtml=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  async function loadHealth(){
    try{const data=await edge({action:'health'});updateRuntimeCard(data)}catch{const copy=document.querySelector('.v2-runtime-copy');if(copy)copy.innerHTML='<strong>Supabase Runtime · reconectando</strong><small>Fallback Render → WAE Gateway disponible</small>'}
  }

  function ensureHistoryStyles(){
    if(document.querySelector('#iuHistoryStyles'))return;
    const style=document.createElement('style');style.id='iuHistoryStyles';style.textContent=`
      .iu-history{margin:4px 14px 12px;display:grid;gap:5px}.iu-history-title{padding:7px 7px 3px;color:#5e6165;font-size:.56rem;font-weight:800;letter-spacing:.12em}.iu-history button{border:0;background:transparent;color:#a5aaad;text-align:left;border-radius:11px;padding:9px 10px;display:grid;gap:4px;cursor:pointer;min-width:0}.iu-history button:hover,.iu-history button.active{background:#17191d;color:#f4f7f6}.iu-history strong{font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iu-history small{font-size:.56rem;color:#62666a}.iu-history-empty{padding:8px;color:#62666a;font-size:.63rem}`;document.head.appendChild(style);
  }

  async function loadConversation(id){
    await bootstrap();
    const data=await edge({action:'get_conversation',...sessionPayload(),conversation_id:id});
    localStorage.setItem(CONVERSATION_ID,id);
    if(data.conversation?.mode)localStorage.setItem('wae.mode',data.conversation.mode);
    const fmt=new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'});
    const messages=(data.messages||[]).filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,text:m.content,at:m.created_at?fmt.format(new Date(m.created_at)):''}));
    localStorage.setItem('wae.messages',JSON.stringify(messages.slice(-60)));
    window.WAENavigation?.markRemoteConversation?.(id,data.conversation?.title||'Conversación');
    location.reload();
  }

  async function loadConversations(){
    await bootstrap();ensureHistoryStyles();
    const data=await edge({action:'list_conversations',...sessionPayload()});
    const drawer=document.querySelector('#drawer');if(!drawer)return;
    drawer.querySelector('.v2-recent')?.remove();
    if(window.WAENavigation?.setRemoteConversations){window.WAENavigation.setRemoteConversations(data.conversations||[],loadConversation);drawer.querySelector('.iu-history')?.remove();return}
    let box=drawer.querySelector('.iu-history');
    if(!box){box=document.createElement('section');box.className='iu-history';const nav=drawer.querySelector('.nav-label');nav?.before(box)}
    const current=localStorage.getItem(CONVERSATION_ID);
    box.innerHTML='<div class="iu-history-title">CONVERSACIONES</div>';
    if(!(data.conversations||[]).length){box.insertAdjacentHTML('beforeend','<div class="iu-history-empty">Tu historial aparecerá aquí.</div>');return}
    for(const c of data.conversations.slice(0,8)){
      const b=document.createElement('button');b.type='button';b.classList.toggle('active',c.id===current);b.innerHTML=`<strong>${escapeHtml(c.title||'Conversación')}</strong><small>${escapeHtml(c.mode||'general')} · ${new Date(c.updated_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}</small>`;b.addEventListener('click',()=>loadConversation(c.id).catch(()=>window.toast?.('No pude abrir la conversación')));box.appendChild(b);
    }
  }

  function startNewConversation(){if(window.WAEChatState?.busy?.())return;localStorage.removeItem(CONVERSATION_ID);window.__waeRuntimeAttachments=[]}
  document.querySelector('#newChatBtn')?.addEventListener('click',startNewConversation,true);
  document.querySelector('#drawerNewChat')?.addEventListener('click',startNewConversation,true);

  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('#fileInput')?.addEventListener('change',e=>readAttachments(e.target.files));
    bootstrap().then(()=>Promise.allSettled([loadHealth(),loadConversations()])).catch(()=>loadHealth());
  });
})();
