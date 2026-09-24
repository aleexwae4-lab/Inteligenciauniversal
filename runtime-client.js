(()=>{
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const PERFORMANCE_ENDPOINT='/api/performance';
  const nativeFetch=window.fetch.bind(window);
  const SESSION_ID='iu.sessionId',SESSION_SECRET='iu.sessionSecret',CONVERSATION_ID='iu.conversationId',STREAM_OVERRIDE='iu.streamCanary';
  const SAFE_GATE={available:false,routing_state:'HOLD',candidate_promotable:false,stream_ready:false,fast_lane_ready:false};
  let runtimeCaps=null,performanceGate={...SAFE_GATE},performanceLoadedAt=0,currentStream=null,sseModulePromise=null,gatePromise=null;

  localStorage.setItem('wae.endpoint','/api/chat');
  window.__waeRuntimeAttachments=[];

  const sanitizeReply=(raw)=>{
    raw=String(raw??'').trim();if(!raw)return '';
    const low=raw.toLowerCase(),tags=['thought','thoughts','analysis','reasoning'];let last=-1,end=-1;
    for(const tag of tags){const marker=`</${tag}>`,idx=low.lastIndexOf(marker);if(idx>last){last=idx;end=idx+marker.length}}
    let text=last>=0?raw.slice(end):raw;
    for(const tag of tags)text=text.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`,'gi'),'');
    text=text.replace(/<\/?(?:thoughts?|analysis|reasoning)\b[^>]*>/gi,'').trim();
    if(/(?:Language Policy|RELEVANT MEMORY|VERIFIED WEB EVIDENCE|system_guidance|Role:\s*Advanced general-purpose AI)/i.test(text))return '';
    return text;
  };
  const sessionPayload=()=>({session_id:localStorage.getItem(SESSION_ID)||'',session_secret:localStorage.getItem(SESSION_SECRET)||''});
  const emit=(event,data={})=>window.dispatchEvent(new CustomEvent('wae:stream-event',{detail:{event,data}}));
  const sseModule=()=>sseModulePromise||(sseModulePromise=import('./lib/sse-events.js'));

  const edge=async(payload,{signal}={})=>{
    const res=await nativeFetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-inteligencia-universal/2.3'},body:JSON.stringify(payload),cache:'no-store',signal});
    const data=await res.json().catch(()=>({success:false,error:`HTTP ${res.status}`}));
    if(!res.ok)throw Object.assign(new Error(data.error||`HTTP ${res.status}`),{status:res.status,data});
    return data;
  };

  let bootPromise;
  const bootstrap=()=>bootPromise||(bootPromise=edge({action:'bootstrap',session_id:localStorage.getItem(SESSION_ID)||'',session_secret:localStorage.getItem(SESSION_SECRET)||''}).then(data=>{
    if(!data?.session_id||!data?.session_secret)throw new Error('invalid_bootstrap');
    localStorage.setItem(SESSION_ID,data.session_id);localStorage.setItem(SESSION_SECRET,data.session_secret);return data;
  }).catch(err=>{bootPromise=null;throw err}));

  async function loadPerformanceGate(force=false){
    if(!force&&Date.now()-performanceLoadedAt<60000)return performanceGate;
    if(gatePromise)return gatePromise;
    gatePromise=nativeFetch(PERFORMANCE_ENDPOINT,{headers:{accept:'application/json'},cache:'no-store'}).then(async r=>{
      if(!r.ok)throw new Error(`performance_${r.status}`);
      const data=await r.json();const gate=data?.performance;
      if(!gate||!['universal-performance-gate/v2','universal-performance-gate/v3'].includes(String(gate.schema)))throw new Error('performance_contract_invalid');
      performanceGate={...SAFE_GATE,...gate,available:gate.available!==false};performanceLoadedAt=Date.now();return performanceGate;
    }).catch(()=>{performanceGate={...SAFE_GATE};performanceLoadedAt=Date.now();return performanceGate}).finally(()=>{gatePromise=null});
    return gatePromise;
  }

  const routingVariant=()=>performanceGate?.candidate_promotable===true?'candidate':'control';
  async function streamingAllowed(){
    if(performanceGate?.stream_ready!==true||!runtimeCaps||Number(runtimeCaps.verified_streaming_models||0)<1||runtimeCaps.streaming_mode!=='verified_only')return false;
    const {streamingCanaryEligible}=await sseModule();
    return streamingCanaryEligible({sessionId:localStorage.getItem(SESSION_ID)||'',verifiedModels:Number(runtimeCaps.verified_streaming_models||0),canaryPct:Number(runtimeCaps.canary_pct||25),override:localStorage.getItem(STREAM_OVERRIDE)||''});
  }

  async function streamChat(payload,outerSignal){
    const {createSSEParser}=await sseModule();
    const controller=new AbortController();
    const startedPerf=performance.now();
    if(outerSignal){if(outerSignal.aborted)controller.abort(outerSignal.reason);else outerSignal.addEventListener('abort',()=>controller.abort(outerSignal.reason),{once:true})}
    currentStream={controller,canCancel:true,userCancelled:false,startedPerf,requestId:null};
    let finalData=null,streamError=null,serverStarted=false,firstClientTtft=null,firstTokenAt=null,partial='';
    const parser=createSSEParser(({event,data})=>{
      if(event==='response.start'){serverStarted=true;currentStream.requestId=data?.request_id||null}
      if(event==='content.delta'){
        partial+=String(data?.text||'');
        if(firstClientTtft===null){firstClientTtft=Math.max(1,Math.round(performance.now()-startedPerf));firstTokenAt=new Date().toISOString()}
      }
      if(event==='response.complete')finalData=data;
      if(event==='response.error')streamError=data;
      emit(event,data);
    });
    try{
      const res=await nativeFetch(EDGE,{method:'POST',headers:{'content-type':'application/json','accept':'text/event-stream','apikey':SUPABASE_KEY,'x-client-info':'wae-streaming-client/2.3'},body:JSON.stringify({...payload,stream:true,routing_variant:routingVariant()}),cache:'no-store',signal:controller.signal});
      if(!res.ok)throw Object.assign(new Error(`stream_http_${res.status}`),{status:res.status,serverStarted,hasPartial:false});
      if(!(res.headers.get('content-type')||'').toLowerCase().includes('text/event-stream')||!res.body)throw Object.assign(new Error('stream_transport_invalid'),{serverStarted,hasPartial:false});
      const reader=res.body.getReader(),decoder=new TextDecoder();
      while(true){const {done,value}=await reader.read();if(done)break;parser.push(decoder.decode(value,{stream:true}))}
      parser.push(decoder.decode());parser.end();
      if(finalData){
        if(finalData.conversation_id)localStorage.setItem(CONVERSATION_ID,finalData.conversation_id);
        const rid=finalData.request_id||currentStream?.requestId;
        if(rid&&firstClientTtft!==null){void edge({action:'client_metric',...sessionPayload(),request_id:rid,client_ttft_ms:firstClientTtft,client_first_token_at:firstTokenAt}).catch(()=>{})}
        return finalData;
      }
      if(streamError)throw Object.assign(new Error(streamError.error||'stream_failed'),{serverStarted,recoverable:streamError.recoverable!==false,hasPartial:!!partial.trim()});
      throw Object.assign(new Error('stream_ended_without_completion'),{serverStarted,hasPartial:!!partial.trim()});
    }catch(err){
      err.serverStarted=err.serverStarted||serverStarted;err.hasPartial=err.hasPartial||!!partial.trim();throw err;
    }finally{currentStream=null}
  }

  window.__iuStream={
    cancel(){if(!currentStream?.canCancel)return false;currentStream.userCancelled=true;currentStream.controller.abort('user_cancelled');return true},
    get active(){return !!currentStream},get canCancel(){return currentStream?.canCancel===true},
    get enabled(){return performanceGate?.stream_ready===true&&Number(runtimeCaps?.verified_streaming_models||0)>0},get capabilities(){return runtimeCaps}
  };
  window.__iuPerformance={get gate(){return performanceGate},refresh:()=>loadPerformanceGate(true)};

  function isLocalRuntime(input){try{const raw=typeof input==='string'?input:input?.url,url=new URL(raw,location.href);return url.origin===location.origin&&url.pathname==='/api/chat'}catch{return false}}
  function setThinking(active,label='Procesando'){const copy=document.querySelector('.v2-runtime-copy');if(!copy)return;if(active){copy.innerHTML=`<strong>Universal Core · ${label.toLowerCase()}</strong><small>memoria · herramientas · seguridad</small>`;document.documentElement.dataset.aiBusy='true'}else document.documentElement.dataset.aiBusy='false'}

  window.fetch=async(input,init={})=>{
    if(!isLocalRuntime(input)||String(init.method||'GET').toUpperCase()!=='POST')return nativeFetch(input,init);
    const incoming=typeof init.body==='string'?JSON.parse(init.body):{};
    const candidateKey=incoming.client_request_id;
    const clientRequestId=typeof candidateKey==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(candidateKey)
      ?candidateKey:'wae_'+crypto.randomUUID().replaceAll('-','');
    const fallbackInit={...init,body:JSON.stringify({...incoming,client_request_id:clientRequestId})};
    let chatAttempted=false;
    setThinking(true,String(incoming.mode||'')==='research'?'Investigando':'Procesando');
    try{
      await Promise.all([bootstrap(),loadPerformanceGate()]);
      const payload={action:'chat',...sessionPayload(),conversation_id:localStorage.getItem(CONVERSATION_ID)||null,message:String(incoming.message||''),mode:String(incoming.mode||localStorage.getItem('wae.mode')||'general'),web_enabled:incoming.web_enabled===true||String(incoming.mode||'')==='research',attachments:Array.isArray(incoming.attachments)?incoming.attachments:window.__waeRuntimeAttachments||[],routing_variant:routingVariant(),client_request_id:clientRequestId};
      let data;
      chatAttempted=true;
      if(await streamingAllowed())data=await streamChat(payload,init.signal);
      else data=await edge(payload,{signal:init.signal});
      const clean=sanitizeReply(data.reply);if(!clean)throw Object.assign(new Error('unsafe_or_empty_output'),{status:502,serverStarted:true,hasPartial:false});
      if(data.conversation_id)localStorage.setItem(CONVERSATION_ID,data.conversation_id);
      window.__iuLastRuntime={...data,reply:clean};
      queueMicrotask(()=>{updateRuntimeCard(data);loadConversations().catch(()=>{});loadPerformanceGate(true).catch(()=>{})});
      return new Response(JSON.stringify({...data,reply:clean}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-wae-runtime':'universal-core'}});
    }catch(err){
      console.warn('[Universal Core] primary runtime unavailable',err?.message||err);
      if(chatAttempted){
        if(err?.status===401){
          bootPromise=null;
          localStorage.removeItem(SESSION_ID);localStorage.removeItem(SESSION_SECRET);
        }
        return new Response(JSON.stringify({error:err?.status===409?'request_in_progress':'primary_result_uncertain',recoverable:true,retry_requires_same_key:true,client_request_id:clientRequestId}),{status:err?.status===409?409:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
      }
      try{
        const fallback=await nativeFetch(input,fallbackInit);
        if(fallback.ok){const copy=document.querySelector('.v2-runtime-copy');if(copy)copy.innerHTML='<strong>Universal Core · continuidad</strong><small>redundancia activa · continuidad automática</small>'}
        return fallback;
      }catch{
        return new Response(JSON.stringify({error:'runtime_temporarily_unavailable'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
      }
    }finally{document.documentElement.dataset.aiBusy='false'}
  };

  async function readAttachments(files){const allowed=/\.(txt|md|markdown|json|csv|tsv|js|mjs|cjs|ts|tsx|jsx|css|html|htm|xml|yaml|yml|py|java|go|rs|sql|sh|log)$/i,output=[];for(const file of [...files].slice(0,5)){const looksText=file.type.startsWith('text/')||file.type.includes('json')||file.type.includes('xml')||allowed.test(file.name);if(!looksText)continue;output.push({name:file.name,type:file.type||'text/plain',text:(await file.text()).slice(0,120000)})}window.__waeRuntimeAttachments=output;window.toast?.(output.length?`${output.length} archivo${output.length===1?'':'s'} listo${output.length===1?'':'s'} para Universal Core`:'Ese formato todavía no se procesa como texto')}

  function updateRuntimeCard(data){
    const copy=document.querySelector('.v2-runtime-copy'),eff=document.querySelector('.v2-efficiency');if(!copy)return;
    const latency=Number(data?.latency_ms),memories=Number(data?.memory_count),sources=(data?.web_sources||data?.response?.sources||[]).length;
    if(data?.model_count!==undefined){
      const state=performanceGate?.stream_ready?'streaming':performanceGate?.routing_state==='PROMOTE'?'adaptativo':performanceGate?.fast_lane_ready?'rápido':'estable';
      copy.innerHTML=`<strong>Universal Core · online</strong><small>memoria · web · herramientas · seguridad · modo ${state}</small>`;
      if(eff)eff.innerHTML='<strong>LIVE</strong><small>WAE OS</small>';
      document.documentElement.dataset.runtimeReady=data.model_count?'true':'false';return;
    }
    const parts=[];if(Number.isFinite(latency)&&latency>0)parts.push(`${Math.round(latency)} ms`);if(sources)parts.push(`${sources} fuentes`);if(memories)parts.push(`${memories} memorias`);
    copy.innerHTML=`<strong>Universal Core · online</strong><small>${parts.join(' · ')||'memoria · herramientas · seguridad'}</small>`;
    if(eff)eff.innerHTML='<strong>LIVE</strong><small>WAE OS</small>';
  }
  async function loadHealth(){try{const data=await edge({action:'health'});runtimeCaps=data;updateRuntimeCard(data)}catch{runtimeCaps=null;const copy=document.querySelector('.v2-runtime-copy');if(copy)copy.innerHTML='<strong>Universal Core · reconectando</strong><small>continuidad automática activa</small>'}}

  function ensureHistoryStyles(){if(document.querySelector('#iuHistoryStyles'))return;const style=document.createElement('style');style.id='iuHistoryStyles';style.textContent=`.iu-history{margin:4px 14px 12px;display:grid;gap:5px}.iu-history-title{padding:7px 7px 3px;color:#5e6165;font-size:.56rem;font-weight:800;letter-spacing:.12em}.iu-history button{border:0;background:transparent;color:#a5aaad;text-align:left;border-radius:11px;padding:9px 10px;display:grid;gap:4px;cursor:pointer;min-width:0}.iu-history button:hover,.iu-history button.active{background:#17191d;color:#f4f7f6}.iu-history strong{font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iu-history small{font-size:.56rem;color:#62666a}.iu-history-empty{padding:8px;color:#62666a;font-size:.63rem}`;document.head.appendChild(style)}
  async function loadConversation(id){await bootstrap();const data=await edge({action:'get_conversation',...sessionPayload(),conversation_id:id});localStorage.setItem(CONVERSATION_ID,id);if(data.conversation?.mode)localStorage.setItem('wae.mode',data.conversation.mode);const fmt=new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}),messages=(data.messages||[]).filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,text:m.role==='assistant'?sanitizeReply(m.content):m.content,at:m.created_at?fmt.format(new Date(m.created_at)):''})).filter(m=>m.text);localStorage.setItem('wae.messages',JSON.stringify(messages.slice(-60)));location.reload()}
  async function loadConversations(){await bootstrap();ensureHistoryStyles();const data=await edge({action:'list_conversations',...sessionPayload()});const drawer=document.querySelector('#drawer');if(!drawer)return;drawer.querySelector('.v2-recent')?.remove();let box=drawer.querySelector('.iu-history');if(!box){box=document.createElement('section');box.className='iu-history';const nav=drawer.querySelector('.nav-label');nav?.before(box)}const current=localStorage.getItem(CONVERSATION_ID);box.innerHTML='<div class="iu-history-title">CONVERSACIONES</div>';if(!(data.conversations||[]).length){box.insertAdjacentHTML('beforeend','<div class="iu-history-empty">Tu historial aparecerá aquí.</div>');return}for(const c of data.conversations.slice(0,8)){const b=document.createElement('button');b.type='button';b.classList.toggle('active',c.id===current);b.innerHTML=`<strong>${escapeHtml(c.title||'Conversación')}</strong><small>${escapeHtml(c.mode||'general')} · ${new Date(c.updated_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}</small>`;b.addEventListener('click',()=>loadConversation(c.id).catch(()=>window.toast?.('No pude abrir la conversación')));box.appendChild(b)}}
  const escapeHtml=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function startNewConversation(){localStorage.removeItem(CONVERSATION_ID);window.__waeRuntimeAttachments=[]}
  document.querySelector('#newChatBtn')?.addEventListener('click',startNewConversation,true);document.querySelector('#drawerNewChat')?.addEventListener('click',startNewConversation,true);
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelector('#fileInput')?.addEventListener('change',e=>readAttachments(e.target.files));
    const endpoint=document.querySelector('#apiEndpoint');if(endpoint){endpoint.value='/api/chat';endpoint.disabled=true;endpoint.setAttribute('aria-describedby','managedRuntimeHelp')}
    bootstrap().then(()=>Promise.allSettled([loadPerformanceGate(true),loadHealth(),loadConversations()])).catch(()=>Promise.allSettled([loadPerformanceGate(true),loadHealth()]));
    setInterval(()=>loadPerformanceGate(true).catch(()=>{}),60000);
  });
})();
