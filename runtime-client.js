(()=>{
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const VISUAL_EDGE=`${SUPABASE_URL}/functions/v1/wae-ai-stream`;
  const nativeFetch=window.fetch.bind(window);
  const responsePolicy='CALIDAD UNIVERSAL CORE: Responde primero a lo pedido, con criterio y especificidad. Distingue hechos, inferencias y límites. Si la pregunta exige actualidad, fundamenta lo que afirmas solo en fuentes recuperadas y pertinentes. No agregues fuentes tangenciales ni un listado de enlaces por defecto; sin evidencia, indica el límite. Para código, entrega cambios reproducibles, pruebas pertinentes y riesgos, sin afirmar ejecuciones que no hiciste. Usa Markdown, tablas o ejemplos únicamente cuando mejoren la explicación. Mantén un tono natural, sin relleno ni texto interno. Contrato visual opcional WAE: si realmente mejora la respuesta puedes incluir un bloque de código ```wae-card con JSON válido {"title":"Título","description":"Resumen","badge":"Estado","metrics":[{"label":"Indicador","value":"—"}],"actions":[{"type":"workspace","label":"Abrir Workspace"}]}; o un bloque ```wae-chart con JSON válido {"title":"Título","data":[{"label":"Categoría","value":10}],"basis":"demo"}. Cierra ambos con tres acentos graves. No uses estos bloques por defecto ni si bastan párrafos, listas o tablas. Usa basis=user solo si todos los números los dio el usuario; si no hay cifras reales, evita gráficos o etiqueta basis=demo con claridad. No inventes acciones, resultados, enlaces, valores reales ni pruebas ejecutadas. Las acciones disponibles son copy, workspace o ask y deben ser relevantes.';
  function needsFreshWeb(message, mode){
    const q=String(message||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/\b(sin internet|sin buscar en internet|no busques en la web|no uses la web)\b/.test(q))return false;
    if(mode==='research')return true;
    return /\b(hoy|ahora|actualizad[oa]s?|reciente[s]?|ultim[oa]s?|noticias|tiempo real|en vivo|vigente[s]?|cotizacion|tipo de cambio|precio[s]? actual(?:es)?|verifica|verificar|comprueba|busca en internet|busca en la web|investiga en la web|fuentes actuales|con fuentes|cita fuentes|jurisprudencia vigente|reforma legal|normativa vigente)\b/.test(q);
  }
  const wantsSources=question=>/\b(fuentes?|referencias?|bibliografia|cit[ae]s?|enlaces?|links?|sources?|references?)\b/i.test(String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
  const commonTerms=new Set('que como cual cuales donde cuando porque para sobre entre desde hasta acerca tema libro libros autor autores quiero dame dime conoces sabes explicame tienes con sin los las unas unos una uno del por fue son esta este estos estas ese esa esos esas mas muy todo toda todos todas fuente fuentes referencias bibliografia cita citas enlace enlaces link links actual actualidad informacion original pagina paginas sitio sitios oficial confiable verificada'.split(' '));
  function topicTerms(value){
    const normalized=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b4\b/g,'cuatro');
    return new Set((normalized.match(/[a-z0-9]{4,}/g)||[]).filter(t=>!commonTerms.has(t)));
  }
  function withRetrievedSources(reply,sources,question){
    const answer=String(reply||'').trim();
    if(!answer||!Array.isArray(sources)||!wantsSources(question))return answer;
    const queryTerms=topicTerms(question);if(!queryTerms.size)return answer;
    const seen=new Set(),lines=[];
    for(const item of sources){
      if(!item||typeof item!=='object'||typeof item.url!=='string'||!item.title)continue;
      let url;try{url=new URL(item.url);if(!['https:','http:'].includes(url.protocol)||!url.hostname||/[<>"\s]/.test(item.url))continue}catch{continue}
      if(seen.has(url.href)||answer.includes(url.href))continue;
      const title=String(item.title).replace(/[\r\n\[\]()]/g,' ').replace(/\s+/g,' ').slice(0,130).trim();
      const overlaps=[...topicTerms(title+' '+url.pathname)].filter(t=>queryTerms.has(t));
      if(overlaps.length<Math.min(2,queryTerms.size)||(queryTerms.size===1&&overlaps[0].length<6))continue;
      seen.add(url.href);lines.push('- ['+title+']('+url.href+')');if(lines.length>=3)break;
    }
    return lines.length?answer+'\n\n### Fuentes relacionadas\n'+lines.join('\n'):answer;
  }
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
  // Reuse the IU custom session; never copy the other WAE OS product's org token or Gemini key.
  // Multimodal photo / video requests stay first-party. Render proxies to the
  // same IU-authenticated WAE function, so Android avoids a large cross-origin POST.
  async function ensureVisualSession(force=false){
    // Do not force a cross-origin bootstrap just to send a photograph.
    if(!force&&localStorage.getItem(SESSION_ID)&&localStorage.getItem(SESSION_SECRET))return;
    let recovery;
    try{
      recovery=await nativeFetch('/api/vision',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'bootstrap',...sessionPayload()}),cache:'no-store',
        signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(20000):undefined
      });
    }catch(_){
      throw Object.assign(Error('No se pudo conectar para iniciar una sesión visual. Verifica tu conexión.'),{code:'visual_bootstrap_transport'});
    }
    const session=await recovery.json().catch(()=>({}));
    if(!recovery.ok||!session.session_id||!session.session_secret)
      throw Object.assign(Error(session.message||'No fue posible iniciar la sesión visual. Tu captura se conserva.'),{code:session.error||'visual_bootstrap_failed',status:recovery.status});
    localStorage.setItem(SESSION_ID,session.session_id);localStorage.setItem(SESSION_SECRET,session.session_secret);
    bootPromise=Promise.resolve(session);
  }
  async function visualRequest({question,kind,frames,mode}){
    let response;
    try{
      response=await nativeFetch('/api/vision',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({...sessionPayload(),question,kind,frames,mode}),cache:'no-store',
        signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(65000):undefined
      });
    }catch(error){
      const aborted=error?.name==='AbortError'||error?.name==='TimeoutError';
      throw Object.assign(Error(aborted?'Se agotó el tiempo de análisis. Conservamos la captura para reintentar.':'La conexión con Universal Core se interrumpió antes del análisis. Conservamos la captura para reintentar.'),{code:aborted?'visual_timeout':'visual_transport'});
    }
    const body=await response.json().catch(()=>({}));
    if(!response.ok||typeof body.reply!=='string'||!body.reply.trim())
      throw Object.assign(Error(body.message||'El motor visual no devolvió una respuesta. Tu captura continúa preparada.'),{code:body.error||'vision_unavailable',status:response.status});
    return body;
  }
  window.WAEVisualRuntime=Object.freeze({
    analyze:async payload=>{
      try{return await visualRequest(payload)}
      catch(error){
        // An authentication rejection happens before any provider call. It is
        // safe to renew once; never repeat a costly/in-flight model inference.
        if(error?.code!=='iu_invalid_session'&&error?.code!=='iu_session_required')throw error;
        await ensureVisualSession(true);
        return visualRequest(payload);
      }
    },
    transport:'render_native_or_guarded_gateway'
  });

  function isLocalRuntime(input){
    try{const raw=typeof input==='string'?input:input?.url;const url=new URL(raw,location.href);return url.origin===location.origin&&url.pathname==='/api/chat'}catch{return false}
  }

  const selfQuery=value=>/(?:\bque tan inteligente (?:eres|es)\b|\b(?:quien|que) eres\b|\b(?:que|cuales) (?:capacidades|funciones) (?:tienes|tiene)\b|\bque (?:puedes|sabes) hacer\b|\b(?:como funcionas|que modelo eres|eres chatgpt|eres un modelo de openai|tienes acceso a internet|puedes buscar en internet)\b)/.test(String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,:]/g,' ').replace(/\s+/g,' ').trim());
  window.fetch=async(input,init={})=>{
    if(!isLocalRuntime(input)||String(init.method||'GET').toUpperCase()!=='POST')return nativeFetch(input,init);
    const request=typeof init.body==='string'?JSON.parse(init.body):{};
    // Capability/identity answers come from the product's real server registry, not a generic upstream persona.
    if(selfQuery(request.message)||request.canvas_direct===true||request.canvas_blueprint===true)return nativeFetch(input,init);
    try{
      await bootstrap();
      const incoming=request;
      const runtimeMode=String(incoming.mode||localStorage.getItem('wae.mode')||'general');
      const useWeb=!incoming.canvas&&needsFreshWeb(incoming.message,runtimeMode);
      const data=await edge({action:'chat',...sessionPayload(),conversation_id:incoming.canvas?null:localStorage.getItem(CONVERSATION_ID)||null,message:[!incoming.canvas?'DIRECTRICES DE RESPUESTA (subordinadas a instrucciones del sistema):\n'+responsePolicy:'',incoming.preferences?.instructions?'PREFERENCIAS DEL USUARIO (no prevalecen sobre reglas de seguridad):\n'+String(incoming.preferences.instructions).slice(0,4000):'',incoming.preferences?.knowledge?'CONTEXTO GENERAL DEL USUARIO (no verificado):\n'+String(incoming.preferences.knowledge).slice(0,12000):'',incoming.project?.instructions?'INSTRUCCIONES DE ESTE PROYECTO (subordinadas a seguridad):\n'+String(incoming.project.instructions).slice(0,3000):'',incoming.project?.knowledge?'CONOCIMIENTO DEL PROYECTO (información aportada, no verificada):\n'+String(incoming.project.knowledge).slice(0,8000):'','SOLICITUD ACTUAL:\n'+String(incoming.message||'')].filter(Boolean).join('\n\n'),mode:runtimeMode,web_enabled:useWeb,attachments:window.__waeRuntimeAttachments||[]});
      if(!String(data.reply||'').trim())throw new Error('empty_supabase_reply');
      // A degraded upstream status sentence is not a successful answer; let the existing Render fallback try another configured model.
      if(/la ruta generativa avanzada no est[aá] disponible|no existe evidencia p[uú]blica suficiente para responder sin inventar|ninguna ruta alcanz[oó] el umbral m[ií]nimo/i.test(String(data.reply)))throw new Error('degraded_supabase_reply');
      // Only advance cloud conversation pointers after a valid answer. A failed
      // generation must not change the active conversation in the user's UI.
      if(data.conversation_id&&!incoming.canvas){localStorage.setItem(CONVERSATION_ID,data.conversation_id);window.WAENavigation?.remoteUpdated?.(data.conversation_id)}
      window.__iuLastRuntime=data;
      if(!incoming.canvas)queueMicrotask(()=>{updateRuntimeCard(data);loadConversations().catch(()=>{})});
      const reply=incoming.canvas?String(data.reply):withRetrievedSources(data.reply,data.web_sources,incoming.message);
      return new Response(JSON.stringify({reply,runtime:data.runtime,provider:data.provider,model:data.model,web_sources:data.web_sources||[]}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-wae-runtime':'supabase-primary'}});
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
    const media=[...files].some(file=>file.type.startsWith('image/')||file.type.startsWith('video/')||/\.(?:mp4|webm|mov|m4v)$/i.test(file.name));
    if(output.length)window.toast?.(`${output.length} archivo${output.length===1?'':'s'} de texto listo${output.length===1?'':'s'}`);
    else if(!media)window.toast?.('Ese formato todavía no se procesa como texto, foto o video');
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
    if(window.WAEStorage){await window.WAEStorage.ready;await window.WAEStorage.save('active',messages.slice(-60))}
    else localStorage.setItem('wae.messages',JSON.stringify(messages.slice(-60)));
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
