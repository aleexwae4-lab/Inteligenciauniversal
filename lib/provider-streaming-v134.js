export const PROVIDER_STREAMING_VERSION='provider-streaming/v134';
export const VERIFIED_STREAMING_PROVIDERS=Object.freeze(['openai','anthropic','gemini','xai','openrouter']);

const timeout=ms=>AbortSignal.timeout(ms);

async function readSSE(url,options,onEvent,ms=60000){
  const {signal:parentSignal,...rest}=options||{};
  const signal=parentSignal?AbortSignal.any([parentSignal,timeout(ms)]):timeout(ms);
  const res=await fetch(url,{...rest,signal});
  if(!res.ok){
    const raw=await res.text().catch(()=>'');
    const err=new Error(`${res.status}: ${raw.slice(0,300)||'stream_error'}`);
    err.status=res.status;throw err;
  }
  if(!res.body?.getReader)throw new Error('stream_body_unavailable');
  const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='';
  try{
    while(true){
      const {done,value}=await reader.read();
      buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
      let cut;
      while((cut=buffer.indexOf('\n\n'))>=0){
        const block=buffer.slice(0,cut);buffer=buffer.slice(cut+2);
        let event='message',data='';
        for(const line of block.split(/\r?\n/)){
          if(line.startsWith('event:'))event=line.slice(6).trim();
          else if(line.startsWith('data:'))data+=(data?'\n':'')+line.slice(5).trim();
        }
        if(!data||data==='[DONE]')continue;
        let parsed;try{parsed=JSON.parse(data)}catch{continue}
        await onEvent?.({event,data:parsed});
      }
      if(done)break;
    }
  }finally{try{reader.releaseLock()}catch{}}
}

function streamedResult({text,usage=null,responseId=null,started,chunks}){
  const clean=String(text||'').trim();
  if(!clean)throw new Error('stream_empty_answer');
  return{text:clean,usage,responseId,streaming:{transport:'sse',ttftMs:started.ttftMs,chunks}};
}
function firstToken(state,meta,onProviderEvent){
  if(state.ttftMs!==null)return;
  state.ttftMs=Date.now()-state.startedAt;
  onProviderEvent?.({type:'first_token',...meta,ttftMs:state.ttftMs});
}

export async function streamOpenAI({provider='openai',url,headers,model,input,signal,onProviderEvent}){
  const state={startedAt:Date.now(),ttftMs:null},parts=[];let chunks=0,responseId=null,usage=null;
  await readSSE(url,{signal,method:'POST',headers,body:JSON.stringify({model,input,stream:true})},({data})=>{
    if(data?.type==='response.output_text.delta'&&typeof data.delta==='string'){
      firstToken(state,{provider,model},onProviderEvent);parts.push(data.delta);chunks++;
    }else if(data?.type==='response.completed'){responseId=data.response?.id||responseId;usage=data.response?.usage||usage}
  });
  return streamedResult({text:parts.join(''),usage,responseId,started:state,chunks});
}

export async function streamAnthropic({url,headers,model,system,messages,maxTokens,signal,onProviderEvent}){
  const state={startedAt:Date.now(),ttftMs:null},parts=[];let chunks=0,responseId=null,usage=null;
  await readSSE(url,{signal,method:'POST',headers,body:JSON.stringify({model,max_tokens:maxTokens,system,messages,stream:true})},({data})=>{
    if(data?.type==='message_start'){responseId=data.message?.id||responseId;usage=data.message?.usage||usage}
    if(data?.type==='content_block_delta'&&data.delta?.type==='text_delta'&&typeof data.delta.text==='string'){
      firstToken(state,{provider:'anthropic',model},onProviderEvent);parts.push(data.delta.text);chunks++;
    }
    if(data?.type==='message_delta'&&data.usage)usage={...(usage||{}),...data.usage};
  });
  return streamedResult({text:parts.join(''),usage,responseId,started:state,chunks});
}

export async function streamGemini({url,headers,model,body,signal,onProviderEvent}){
  const state={startedAt:Date.now(),ttftMs:null},parts=[];let chunks=0,usage=null;
  await readSSE(url,{signal,method:'POST',headers,body:JSON.stringify(body)},({data})=>{
    const delta=(data?.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
    if(delta){firstToken(state,{provider:'gemini',model},onProviderEvent);parts.push(delta);chunks++}
    if(data?.usageMetadata)usage=data.usageMetadata;
  });
  return streamedResult({text:parts.join(''),usage,responseId:null,started:state,chunks});
}

export async function streamOpenAICompatible({provider,url,headers,model,messages,signal,onProviderEvent}){
  const state={startedAt:Date.now(),ttftMs:null},parts=[];let chunks=0,responseId=null,usage=null;
  await readSSE(url,{signal,method:'POST',headers,body:JSON.stringify({model,messages,stream:true})},({data})=>{
    const delta=data?.choices?.[0]?.delta?.content;
    if(typeof delta==='string'&&delta){firstToken(state,{provider,model},onProviderEvent);parts.push(delta);chunks++}
    responseId=data?.id||responseId;if(data?.usage)usage=data.usage;
  });
  return streamedResult({text:parts.join(''),usage,responseId,started:state,chunks});
}

export function streamingContract(){
  return {version:PROVIDER_STREAMING_VERSION,providers:[...VERIFIED_STREAMING_PROVIDERS],transport:'sse',contentRelease:'withheld-until-quality-gate'};
}
