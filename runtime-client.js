(()=>{
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const nativeFetch=window.fetch.bind(window);
  const SESSION_ID='iu.sessionId',SESSION_SECRET='iu.sessionSecret',CONVERSATION_ID='iu.conversationId',STREAM_OVERRIDE='iu.streamCanary';
  let runtimeCaps=null,currentStream=null,sseModulePromise=null;

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
    const res=await nativeFetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-inteligencia-universal/2.0'},body:JSON.stringify(payload),cache:'no-store',signal});
    const data=await res.json().catch(()=>({success:false,error:`HTTP ${res.status}`}));
    if(!res.ok)throw Object.assign(new Error(data.error||`HTTP ${res.status}`),{status:res.status,data});
    return data;
  };

  let bootPromise;
  const bootstrap=()=>bootPromise||(bootPromise=edge({action:'bootstrap',session_id:localStorage.getItem(SESSION_ID)||'',session_secret:localStorage.getItem(SESSION_SECRET)||''}).then(data=>{
    if(!data?.session_id||!data?.session_secret)throw new Error('invalid_bootstrap');
    localStorage.setItem(SESSION_ID,data.session_id);localStorage.setItem(SESSION_SECRET,data.session_secret);return data;
  }).catch(err=>{bootPromise=null;throw err}));

  async function streamingAllowed(){
    if(!runtimeCaps||Number(runtimeCaps.verified_streaming_models||0)<1||runtimeCaps.streaming_mode!=='verified_only')return false;
    const {streamingCanaryEligible}=await sseModule();
    return streamingCanaryEligible({sessionId:localStorage.getItem(SESSION_ID)||'',verifiedModels:Number(runtimeCaps.verified_streaming_models||0),canaryPct:Number(runtimeCaps.canary_pct||25),override:localStorage.getItem(STREAM_OVERRIDE)||''});
  }

  async function streamChat(payload,outerSignal){
    const {createSSEParser}=await sseModule();
    const controller=new AbortController();
    const startedPerf=performance.now();
    if(outerSignal){if(outerSignal.aborted)controller.abort(outerSignal.reason);else outerSignal.addEventListener('abort',()=>controller.abort(outerSignal.reason),{once:true})}
    currentStream={controller,canCancel:runtimeCaps?.stream_continuity===true,userCancelled:false,startedPerf,requestId:null};
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
      const res=await nativeFetch(EDGE,{method:'POST',headers:{'content-type':'application/json','accept':'text/event-stream','apikey':SUPABASE_KEY,'x-client-info':'wae-streaming-client/2.0'},body:JSON.stringify({...payload,stream:true,routing_variant:'candidate'}),cache:'no-store',signal:controller.signal});
      if(!res.ok)throw Object.assign(new Error(`stream_http_${res.status}`),{status:res.status,serverStarted});
      if(!(res.headers.get('content-type')||'').toLowerCase().includes('text/event-stream')||!res.body)throw Object.assign(new Error('stream_transport_invalid'),{serverStarted});
      const reader=res.body.getReader(),decoder=new TextDecoder();
      while(true){const {done,value}=await reader.read();if(done)break;parser.push(decoder.decode(value,{stream:true}))}
      parser.push(decoder.decode());parser.end();
      if(finalData){
        if(finalData.conversation_id)localStorage.setItem(CONVERSATION_ID,finalData.conversation_id);
        const rid=finalData.request_id||currentStream?.requestId;
        if(rid&&firstClientTtft!==null){void edge({action:'client_metric',...sessionPayload(),request_id:rid,client_ttft_ms:firstClientTtft,client_first_token_at:firstTokenAt}).catch(()=>{})}
        return finalData;
      }
      if(streamError)throw Object.assign(new Error(streamError.error||'stream_failed'),{serverStarted,recoverable:streamError.recoverable!==false});
      throw Object.assign(new Error('stream_ended_without_completion'),{serverStarted});
    }catch(err){
      if(controller.signal.aborted&&partial.trim()){
        const data={success:true,reply:partial.trim(),response:{schema:'assistant-response/v1',content:partial.trim(),components:[],actions:[],sources:[],speechText:partial.trim(),metadata:{cancelled:true}},speech_text:partial.trim(),components:[],actions:[],web_sources:[],conversation_id:localStorage.getItem(CONVERSATION_ID)||null,message_id:null,request_id:currentStream?.requestId||null,provider:null,model:null,memory_count:0,web_used:false,latency_ms:Math.round(performance.now()-startedPerf),ttft_ms:null,runtime:runtimeCaps?.version||null,response_schema:'assistant-response/v1',cancelled:true,client_partial:true};
        emit('response.complete',data);return data;
      }
      err.serverStarted=err.serverStarted||serverStarted;throw err;
    }finally{currentStream=null}
  }

  window.__iuStream={
    cancel(){if(!currentStream?.canCancel)return false;currentStream.userCancelled=true;currentStream.controller.abort('user_cancelled');return true},
    get active(){return !!currentStream},get canCancel(){return currentStream?.canCancel===true},
    get enabled(){return Number(runtimeCaps?.verified_streaming_models||0)>0},get capabilities(){return runtimeCaps}
  };

  function isLocalRuntime(input){try{const raw=typeof input==='string'?input:input?.url,url=new URL(raw,location.href);return url.origin===location.origin&&url.pathname==='/api/chat'}catch{return false}}
  function setThinking(active,label='Procesando'){const copy=document.querySelector('.v2-runtime-copy');if(!copy)return;if(active){copy.innerHTML=`<strong>${label}</strong><small>memoria · router · modelo</small>`;document.documentElement.dataset.aiBusy='true'}else document.documentElement.dataset.aiBusy='false'}

  window.fetch=async(input,init={})=>{
    if(!isLocalRuntime(input)||String(init.method||'GET').toUpperCase()!=='POST')return nativeFetch(input,init);
    const incoming=typeof init.body==='string'?JSON.parse(init.body):{};
    setThinking(true,String(incoming.mode||'')==='research'?'Investigando':'Procesando');
    try{
      await bootstrap();
      const payload={action:'chat',...sessionPayload(),conversation_id:localStorage.getItem(CONVERSATION_ID)||null,message:String(incoming.message||''),mode:String(incoming.mode||localStorage.getItem('wae.mode')||'general'),web_enabled:incoming.web_enabled===true||String(incoming.mode||'')==='research',attachments:window.__waeRuntimeAttachments||[]};
      let data;
      if(await streamingAllowed())data=await streamChat(payload,init.signal);
      else data=await edge(payload,{signal:init.signal});
      const clean=sanitizeReply(data.reply);if(!clean)throw Object.assign(new Error('unsafe_or_empty_output'),{status:502,serverStarted:true});
      if(data.conversation_id)localStorage.setItem(CONVERSATION_ID,data.conversation_id);
      window.__iuLastRuntime={...data,reply:clean};
      queueMicrotask(()=>{updateRuntimeCard(data);loadConversations().catch(()=>{})});
      return new Response(JSON.stringify({...data,reply:clean}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-wae-runtime':'supabase-primary'}});
    }catch(err){
      console.warn('[WAE IU] primary runtime unavailable',err?.message||err);
      if(err?.serverStarted){
        return new Response(JSON.stringify({error:'primary_stream_interrupted',recoverable:true}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
      }
      try{
        const fallback=await nativeFetch(input,init);
        if(fallback.ok){const copy=document.querySelector('.v2-runtime-copy');if(copy)copy.innerHTML='<strong>Runtime redundante · activo</strong><small>continuidad automática</small>'}
        return fallback;
      }catch{
        return new Response(JSON.stringify({error:'runtime_temporarily_unavailable'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
      }
    }finally{document.documentElement.dataset.aiBusy='false'}
  };

  async function readAttachments(files){const allowed=/\.(txt|md|markdown|json|csv|tsv|js|mjs|cjs|ts|tsx|jsx|css|html|htm|xml|yaml|yml|py|java|go|rs|sql|sh|log)$/i,output=[];for(const file of [...files].slice(0,5)){const looksText=file.type.startsWith('text/')||file.type.includes('json')||file.type.includes('xml')||allowed.test(file.name);if(!looksText)continue;output.push({name:file.name,type:file.type||'text/plain',text:(await file.text()).slice(0,120000)})}window.__waeRuntimeAttachments=output;window.toast?.(output.length?`${output.length} archivo${output.length===1?'':'s'} listo${output.length===1?'':'s'} para IA`:'Ese formato todavía no se procesa como texto')}

  function updateRuntimeCard(data){const copy=document.querySelector('.v2-runtime-copy'),eff=document.querySelector('.v2-efficiency');if(!copy)return;if(data?.model_count!==undefined){const verified=Number(data.verified_streaming_models||0),extra=[data.web_search?'web':'',data.memory?'memoria':'',data.adaptive_routing?'router adaptativo':'',verified?`${verified} stream verificado`:''].filter(Boolean).join(' · ');copy.innerHTML=`<strong>Universal Runtime · ${data.model_count} modelo${data.model_count===1?'':'s'}</strong><small>${extra||'backend persistente'}</small>`;if(eff)eff.innerHTML=`<strong>${data.model_count?'LIVE':'SETUP'}</strong><small>${verified?'SSE READY':'UNIVERSAL AI'}</small>`;document.documentElement.dataset.runtimeReady=data.model_count?'true':'false'}else if(data?.model){const ttft=Number(data.client_ttft_ms||data.ttft_ms);copy.innerHTML=`<strong>${escapeHtml(data.model)}</strong><small>${data.web_used?'web · ':''}${data.memory_count||0} memorias · ${data.latency_ms||0}ms${Number.isFinite(ttft)&&ttft>0?` · TTFT ${ttft}ms`:''}</small>`;if(eff)eff.innerHTML='<strong>LIVE</strong><small>UNIVERSAL AI</small>'}}
  const escapeHtml=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function loadHealth(){try{const data=await edge({action:'health'});runtimeCaps=data;updateRuntimeCard(data)}catch{runtimeCaps=null;const copy=document.querySelector('.v2-runtime-copy');if(copy)copy.innerHTML='<strong>Runtime · reconectando</strong><small>continuidad automática activa</small>'}}

  function ensureHistoryStyles(){if(document.querySelector('#iuHistoryStyles'))return;const style=document.createElement('style');style.id='iuHistoryStyles';style.textContent=`.iu-history{margin:4px 14px 12px;display:grid;gap:5px}.iu-history-title{padding:7px 7px 3px;color:#5e6165;font-size:.56rem;font-weight:800;letter-spacing:.12em}.iu-history button{border:0;background:transparent;color:#a5aaad;text-align:left;border-radius:11px;padding:9px 10px;display:grid;gap:4px;cursor:pointer;min-width:0}.iu-history button:hover,.iu-history button.active{background:#17191d;color:#f4f7f6}.iu-history strong{font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.iu-history small{font-size:.56rem;color:#62666a}.iu-history-empty{padding:8px;color:#62666a;font-size:.63rem}`;document.head.appendChild(style)}
  async function loadConversation(id){await bootstrap();const data=await edge({action:'get_conversation',...sessionPayload(),conversation_id:id});localStorage.setItem(CONVERSATION_ID,id);if(data.conversation?.mode)localStorage.setItem('wae.mode',data.conversation.mode);const fmt=new Intl.DateTimeFormat('es-MX',{hour:'2-digit',minute:'2-digit'}),messages=(data.messages||[]).filter(m=>['user','assistant'].includes(m.role)).map(m=>({role:m.role,text:m.role==='assistant'?sanitizeReply(m.content):m.content,at:m.created_at?fmt.format(new Date(m.created_at)):''})).filter(m=>m.text);localStorage.setItem('wae.messages',JSON.stringify(messages.slice(-60)));location.reload()}
  async function loadConversations(){await bootstrap();ensureHistoryStyles();const data=await edge({action:'list_conversations',...sessionPayload()});const drawer=document.querySelector('#drawer');if(!drawer)return;drawer.querySelector('.v2-recent')?.remove();let box=drawer.querySelector('.iu-history');if(!box){box=document.createElement('section');box.className='iu-history';const nav=drawer.querySelector('.nav-label');nav?.before(box)}const current=localStorage.getItem(CONVERSATION_ID);box.innerHTML='<div class="iu-history-title">CONVERSACIONES</div>';if(!(data.conversations||[]).length){box.insertAdjacentHTML('beforeend','<div class="iu-history-empty">Tu historial aparecerá aquí.</div>');return}for(const c of data.conversations.slice(0,8)){const b=document.createElement('button');b.type='button';b.classList.toggle('active',c.id===current);b.innerHTML=`<strong>${escapeHtml(c.title||'Conversación')}</strong><small>${escapeHtml(c.mode||'general')} · ${new Date(c.updated_at).toLocaleDateString('es-MX',{day:'2-digit',month:'short'})}</small>`;b.addEventListener('click',()=>loadConversation(c.id).catch(()=>window.toast?.('No pude abrir la conversación')));box.appendChild(b)}}
  function startNewConversation(){localStorage.removeItem(CONVERSATION_ID);window.__waeRuntimeAttachments=[]}
  document.querySelector('#newChatBtn')?.addEventListener('click',startNewConversation,true);document.querySelector('#drawerNewChat')?.addEventListener('click',startNewConversation,true);
  document.addEventListener('DOMContentLoaded',()=>{document.querySelector('#fileInput')?.addEventListener('change',e=>readAttachments(e.target.files));const endpoint=document.querySelector('#apiEndpoint');if(endpoint){endpoint.value='/api/chat';endpoint.disabled=true;endpoint.setAttribute('aria-describedby','managedRuntimeHelp')}bootstrap().then(()=>Promise.allSettled([loadHealth(),loadConversations()])).catch(()=>loadHealth())});
})();
