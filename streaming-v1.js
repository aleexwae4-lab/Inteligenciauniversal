(()=>{
  const SUPABASE_URL='https://pbswcbryxawsmltyromd.supabase.co';
  const SUPABASE_KEY='sb_publishable_2zXa35U9Z--xuy_mQekG9w_kY7AVlv-';
  const EDGE=`${SUPABASE_URL}/functions/v1/wae-local-voice-demo-v61`;
  const SID='iu.sessionId',SECRET='iu.sessionSecret',CID='iu.conversationId';
  const priorFetch=window.fetch.bind(window);
  let activeController=null;

  const isChat=(input,init={})=>{try{const u=new URL(typeof input==='string'?input:input?.url,location.href);return u.origin===location.origin&&u.pathname==='/api/chat'&&String(init.method||'GET').toUpperCase()==='POST'}catch{return false}};
  const session=()=>({session_id:localStorage.getItem(SID)||'',session_secret:localStorage.getItem(SECRET)||''});
  const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function parseEvent(block){let event='message',data='';for(const line of block.split(/\r?\n/)){if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data+=line.slice(5).trim()}if(!data)return null;try{return{event,data:JSON.parse(data)}}catch{return null}}
  function streamCard(){const host=document.querySelector('#typingMessage');if(!host)return null;host.classList.add('iu-streaming');host.innerHTML=`<div class="message-meta"><strong>Universal Core</strong><span class="iu-stream-status">conectando</span></div><div class="rich-answer iu-stream-body"><p></p></div><div class="iu-stream-actions"><button type="button" class="iu-cancel">Detener</button></div>`;host.querySelector('.iu-cancel')?.addEventListener('click',()=>activeController?.abort('user_cancelled'));return host}
  function setStatus(host,text){const e=host?.querySelector('.iu-stream-status');if(e)e.textContent=text}
  function setText(host,text){const e=host?.querySelector('.iu-stream-body p');if(e)e.textContent=text;requestAnimationFrame(()=>{const s=document.querySelector('.chat-layout');if(s)s.scrollTop=s.scrollHeight})}
  async function reportClientTTFT(requestId,started,firstAt){if(!requestId||!firstAt)return;try{await priorFetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-streaming-client/1.0'},body:JSON.stringify({action:'client_metric',...session(),request_id:requestId,client_ttft_ms:Math.max(1,firstAt-started),client_first_token_at:new Date(firstAt).toISOString()}),cache:'no-store'})}catch{}}
  async function streamChat(incoming,outerSignal){
    const started=Date.now(),controller=new AbortController();activeController=controller;
    if(outerSignal){if(outerSignal.aborted)controller.abort();else outerSignal.addEventListener('abort',()=>controller.abort(),{once:true})}
    const host=streamCard();let text='',requestId=null,conversationId=null,firstAt=0,complete=null,buffer='',pendingRender=false;
    const render=()=>{pendingRender=false;setText(host,text)};
    try{
      const payload={action:'chat',...session(),conversation_id:localStorage.getItem(CID)||null,message:String(incoming.message||''),mode:String(incoming.mode||localStorage.getItem('wae.mode')||'general'),web_enabled:incoming.web_enabled===true||String(incoming.mode||'')==='research',attachments:window.__waeRuntimeAttachments||[],stream:true};
      const res=await priorFetch(EDGE,{method:'POST',headers:{'content-type':'application/json','apikey':SUPABASE_KEY,'x-client-info':'wae-streaming-client/1.0'},body:JSON.stringify(payload),signal:controller.signal,cache:'no-store'});
      if(!res.ok||!res.body)throw new Error(`stream_http_${res.status}`);
      const reader=res.body.getReader(),dec=new TextDecoder();
      while(true){const{done,value}=await reader.read();if(done)break;buffer+=dec.decode(value,{stream:true});let cut;while((cut=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,cut);buffer=buffer.slice(cut+2);const evt=parseEvent(block);if(!evt)continue;const d=evt.data;
        if(evt.event==='response.start'){requestId=d.request_id||requestId;conversationId=d.conversation_id||conversationId;setStatus(host,d.routing_path?`${String(d.routing_path).toLowerCase()} · analizando`:'analizando')}
        else if(evt.event==='reasoning.status')setStatus(host,String(d.status||'procesando'));
        else if(evt.event==='content.delta'){const delta=String(d.text||'');if(delta){if(!firstAt){firstAt=Date.now();void reportClientTTFT(requestId,started,firstAt)}text+=delta;if(!pendingRender){pendingRender=true;requestAnimationFrame(render)}}}
        else if(evt.event==='source.add')setStatus(host,'verificando fuentes');
        else if(evt.event==='tool.start')setStatus(host,'ejecutando herramienta');
        else if(evt.event==='response.complete'){complete=d;requestId=d.request_id||requestId;conversationId=d.conversation_id||conversationId;text=String(d.reply||text);setStatus(host,'completado')}
        else if(evt.event==='response.error')throw new Error(d.error||'stream_failed');
      }}
      if(!complete||!text.trim())throw new Error('stream_incomplete');
      if(conversationId)localStorage.setItem(CID,conversationId);
      window.__iuLastRuntime=complete;window.__iuLastStream={requestId,clientTtftMs:firstAt?firstAt-started:null,completedAt:Date.now(),provider:complete.provider,model:complete.model,routingPath:complete.routing_path,taskCategory:complete.task_category};
      return complete;
    }finally{if(activeController===controller)activeController=null}
  }
  window.__iuCancelGeneration=()=>activeController?.abort('user_cancelled');
  window.fetch=async(input,init={})=>{
    if(!isChat(input,init))return priorFetch(input,init);
    let incoming={};try{incoming=typeof init.body==='string'?JSON.parse(init.body):{}}catch{}
    try{
      const data=await streamChat(incoming,init.signal);
      return new Response(JSON.stringify({reply:data.reply,runtime:data.runtime,provider:data.provider,model:data.model,web_sources:data.web_sources||[],memory_count:data.memory_count||0,latency_ms:data.latency_ms,ttft_ms:data.ttft_ms,router_overhead_ms:data.router_overhead_ms,routing_path:data.routing_path,task_category:data.task_category,router_variant:data.router_variant,cost_microunits:data.cost_microunits,response:data.response,request_id:data.request_id,conversation_id:data.conversation_id,message_id:data.message_id}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store','x-wae-runtime':'supabase-streaming-primary'}});
    }catch(err){if(String(err?.name)==='AbortError'||String(err?.message||'').includes('cancel'))return new Response(JSON.stringify({error:'generation_cancelled'}),{status:499,headers:{'content-type':'application/json'}});console.warn('[WAE IU stream] failover to legacy path',err?.message||err);return priorFetch(input,init)}
  };
  const style=document.createElement('style');style.textContent='.iu-streaming .iu-stream-body{min-height:1.4em}.iu-streaming .iu-stream-body p{white-space:pre-wrap}.iu-stream-actions{margin-top:10px}.iu-cancel{border:1px solid #2c3036;background:#15181c;color:#c9ced3;border-radius:999px;padding:7px 12px;font:inherit;font-size:.68rem;cursor:pointer}.iu-stream-status{font-variant-numeric:tabular-nums}';document.head.appendChild(style);
})();
