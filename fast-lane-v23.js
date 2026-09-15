(()=>{
  'use strict';
  const downstream=window.fetch.bind(window);
  const FAST_ENDPOINT='/api/fast-chat';
  const RETRYABLE_STATUS=new Set([500,502,503,504]);
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();
  const safeMode=body=>String(body?.mode||'general').toLowerCase()==='general';
  const noHeavyContext=body=>!(Array.isArray(body?.attachments)&&body.attachments.length)&&body?.web_enabled!==true;
  function eligible(message,body={}){
    if(!safeMode(body)||!noHeavyContext(body))return false;
    const raw=String(message||'').trim(),q=normalize(raw);
    if(!q&&/[?¿]+/.test(raw))return true;
    if(/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches|hola buenas|como estas|como andas|que tal|quien eres|que eres|que tan inteligente eres|que es universal core|que puedes hacer|como puedes ayudarme|ayuda|ayudame|gracias|muchas gracias|ok|okay|vale|perfecto|listo)$/.test(q))return true;
    return /^(sabes(?: todo)? sobre|sabes de|conoces(?: de| sobre)?|puedes hablar de|tienes conocimiento(?: de| sobre)?)\s+\S+/.test(q);
  }
  function parseBody(init={}){try{return typeof init.body==='string'?JSON.parse(init.body):{}}catch{return{}}}
  function isChatRequest(input,init={}){
    try{
      if(String(init.method||'GET').toUpperCase()!=='POST')return false;
      const raw=typeof input==='string'?input:input?.url,url=new URL(raw,location.href);
      return url.pathname==='/api/chat'||url.pathname.includes('/functions/v1/wae-local-voice-demo-v61');
    }catch{return false}
  }
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function retryInit(init={}){
    const headers=new Headers(init.headers||{});
    headers.set('x-wae-lifecycle-retry','1');
    return {...init,headers};
  }
  async function responseRetryable(response){
    if(!response||!RETRYABLE_STATUS.has(Number(response.status)))return false;
    let data={};
    try{data=await response.clone().json()}catch{}
    const code=String(data?.error||'').toUpperCase();
    if(['RATE_LIMITED','CAPACITY_BUSY'].includes(code)||Number(response.status)===429)return false;
    return data?.recoverable!==false;
  }
  async function resilientDownstream(input,init={}){
    try{
      const first=await downstream(input,init);
      if(!(await responseRetryable(first))||init.signal?.aborted)return first;
      await wait(180);
      if(init.signal?.aborted)return first;
      const second=await downstream(input,retryInit(init));
      window.dispatchEvent(new CustomEvent('wae:lifecycle-retry',{detail:{firstStatus:first.status,secondStatus:second.status,recovered:second.ok}}));
      return second;
    }catch(firstError){
      if(init.signal?.aborted)throw firstError;
      await wait(180);
      if(init.signal?.aborted)throw firstError;
      try{
        const second=await downstream(input,retryInit(init));
        window.dispatchEvent(new CustomEvent('wae:lifecycle-retry',{detail:{firstStatus:0,secondStatus:second.status,recovered:second.ok}}));
        return second;
      }catch{throw firstError}
    }
  }
  async function fastReply(body,signal){
    const message=String(body?.message||body?.task||'').trim();
    if(!message||!eligible(message,body))return null;
    const payload={message,mode:'general',sessionId:String(body?.session_id||body?.sessionId||''),attachments:[],disableTools:true,preferences:{responseStyle:'premium-rich',voiceNatural:true}};
    try{
      const response=await downstream(FAST_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal});
      if(!response.ok)return null;
      const data=await response.clone().json().catch(()=>null);
      if(!data||typeof data.reply!=='string'||!data.reply.trim())return null;
      const out={...data,success:true,conversation_id:body?.conversation_id||data.conversation_id||null,fast_lane:true,fast_lane_version:data.fast_lane_version||'universal-fast-lane/v23'};
      window.__iuLastRuntime=out;
      window.dispatchEvent(new CustomEvent('wae:fast-lane',{detail:{message,model:out.model||null,latencyMs:out.latencyMs??out.latency_ms??null}}));
      return new Response(JSON.stringify(out),{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-wae-fast-lane':'v23'}});
    }catch{return null}
  }
  window.fetch=async(input,init={})=>{
    if(!isChatRequest(input,init))return downstream(input,init);
    const body=parseBody(init);
    if(body?.action&&body.action!=='chat')return downstream(input,init);
    const fast=await fastReply(body,init.signal);
    return fast||resilientDownstream(input,init);
  };
  window.__iuFastLane={eligible,version:'v64-response-lifecycle',retryPolicy:{attempts:1,delayMs:180,excludedErrors:['RATE_LIMITED','CAPACITY_BUSY']}};
})();
