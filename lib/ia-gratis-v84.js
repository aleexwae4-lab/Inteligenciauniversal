export const IA_GRATIS_PROVIDER_VERSION='ia-gratis-provider/v84';

const DEFAULT_BASE='https://ia.gratis/api/tools';
const MAX_MESSAGE_CHARS=24000;
const MAX_HISTORY_ITEMS=10;

const text=(value,max=MAX_MESSAGE_CHARS)=>String(value??'').trim().slice(0,max);

export function iaGratisConfigured(){
  return Boolean(String(process.env.IA_GRATIS_API_TOKEN||'').trim());
}

export function iaGratisPublicState(){
  return {
    version:IA_GRATIS_PROVIDER_VERSION,
    configured:iaGratisConfigured(),
    endpoint:'chat',
    model:String(process.env.IA_GRATIS_CHAT_MODEL||'').trim()||'provider-default',
    timeoutMs:Math.max(3000,Math.min(60000,Number(process.env.IA_GRATIS_TIMEOUT_MS||22000))),
    secretExposed:false,
  };
}

function endpoint(path='chat'){
  const base=String(process.env.IA_GRATIS_API_BASE||DEFAULT_BASE).replace(/\/$/,'');
  return `${base}/${String(path||'chat').replace(/^\/+|\/+$/g,'')}/`;
}

function historyMessages(history=[]){
  return (Array.isArray(history)?history:[])
    .slice(-MAX_HISTORY_ITEMS)
    .filter(item=>item&&['user','assistant','system'].includes(item.role)&&typeof(item.content??item.text)==='string')
    .map(item=>({role:item.role,content:text(item.content??item.text)}))
    .filter(item=>item.content);
}

function extractReply(data={}){
  const direct=[data?.reply,data?.answer,data?.output_text,data?.text].find(value=>typeof value==='string'&&value.trim());
  if(direct)return direct.trim();
  const choice=data?.choices?.[0]?.message?.content;
  if(typeof choice==='string'&&choice.trim())return choice.trim();
  const output=data?.response?.content;
  if(typeof output==='string'&&output.trim())return output.trim();
  return '';
}

export async function callIaGratisChat({system='',message='',history=[],fetchImpl=globalThis.fetch}={}){
  if(!iaGratisConfigured()){
    const error=new Error('ia_gratis_unconfigured');
    error.code='IA_GRATIS_UNCONFIGURED';
    throw error;
  }
  if(typeof fetchImpl!=='function'){
    const error=new Error('fetch_unavailable');
    error.code='FETCH_UNAVAILABLE';
    throw error;
  }

  const userMessage=text(message);
  if(!userMessage){
    const error=new Error('ia_gratis_message_required');
    error.code='IA_GRATIS_MESSAGE_REQUIRED';
    throw error;
  }

  const messages=[];
  const systemText=text(system);
  if(systemText)messages.push({role:'system',content:systemText});
  messages.push(...historyMessages(history));
  messages.push({role:'user',content:userMessage});

  const body={messages};
  const model=String(process.env.IA_GRATIS_CHAT_MODEL||'').trim();
  if(model)body.model=model;

  const timeoutMs=Math.max(3000,Math.min(60000,Number(process.env.IA_GRATIS_TIMEOUT_MS||22000)));
  let response;
  try{
    response=await fetchImpl(endpoint('chat'),{
      method:'POST',
      headers:{
        Authorization:`Bearer ${String(process.env.IA_GRATIS_API_TOKEN||'').trim()}`,
        'Content-Type':'application/json',
        'User-Agent':'WAE-Universal-Core/1.0',
      },
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(timeoutMs),
    });
  }catch(error){
    const wrapped=new Error(`ia_gratis_transport_failure:${text(error?.message||error,220)}`);
    wrapped.code='IA_GRATIS_TRANSPORT_FAILURE';
    throw wrapped;
  }

  const raw=await response.text().catch(()=> '');
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{data={raw:text(raw,1000)}}
  if(!response.ok){
    const detail=text(data?.error?.message??data?.error??data?.detail??data?.message??`HTTP_${response.status}`,500);
    const error=new Error(`ia_gratis_http_${response.status}:${detail}`);
    error.code=`IA_GRATIS_HTTP_${response.status}`;
    error.status=response.status;
    throw error;
  }

  const reply=extractReply(data);
  if(!reply){
    const error=new Error('ia_gratis_empty_reply');
    error.code='IA_GRATIS_EMPTY_REPLY';
    throw error;
  }

  return {
    reply,
    provider:'ia_gratis',
    model:text(data?.model||model||'provider-default',180),
    usage:data?.usage??null,
    responseId:text(data?.id||data?.response_id||'',220)||null,
    version:IA_GRATIS_PROVIDER_VERSION,
  };
}
