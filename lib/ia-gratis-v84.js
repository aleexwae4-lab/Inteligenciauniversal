export const IA_GRATIS_PROVIDER_VERSION='ia-gratis-provider/v84';
export const IA_GRATIS_TOOL_FABRIC_VERSION='ia-gratis-tools/v85';

const DEFAULT_BASE='https://ia.gratis/api/tools';
const MAX_MESSAGE_CHARS=24000;
const MAX_HISTORY_ITEMS=10;
const MAX_TOOL_INPUT_CHARS=24000;
const ALLOWED_TOOLS=new Set(['search','summarize','translate','humanize','detect']);
const TOOL_TOKEN_COST=Object.freeze({search:50,summarize:20,translate:20,humanize:20,detect:20});

const text=(value,max=MAX_MESSAGE_CHARS)=>String(value??'').trim().slice(0,max);

export function iaGratisConfigured(){
  return Boolean(String(process.env.IA_GRATIS_API_TOKEN||'').trim());
}

export function iaGratisPublicState(){
  return {
    version:IA_GRATIS_PROVIDER_VERSION,
    toolFabricVersion:IA_GRATIS_TOOL_FABRIC_VERSION,
    configured:iaGratisConfigured(),
    endpoint:'chat',
    model:String(process.env.IA_GRATIS_CHAT_MODEL||'').trim()||'provider-default',
    timeoutMs:Math.max(3000,Math.min(60000,Number(process.env.IA_GRATIS_TIMEOUT_MS||22000))),
    tools:[...ALLOWED_TOOLS],
    maxToolTokenCost:Number(process.env.IA_GRATIS_MAX_TOOL_TOKENS_PER_CALL||50),
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
  const direct=[data?.reply,data?.answer,data?.output_text,data?.text,data?.result,data?.summary,data?.translation].find(value=>typeof value==='string'&&value.trim());
  if(direct)return direct.trim();
  const choice=data?.choices?.[0]?.message?.content;
  if(typeof choice==='string'&&choice.trim())return choice.trim();
  const output=data?.response?.content;
  if(typeof output==='string'&&output.trim())return output.trim();
  return '';
}

function timeoutMs(){
  return Math.max(3000,Math.min(60000,Number(process.env.IA_GRATIS_TIMEOUT_MS||22000)));
}

function sanitizePayload(value,depth=0){
  if(depth>6)return null;
  if(Array.isArray(value))return value.slice(0,50).map(item=>sanitizePayload(item,depth+1));
  if(value&&typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)){
      if(/token|authorization|api[_-]?key|secret|credential/i.test(key))continue;
      out[String(key).slice(0,120)]=sanitizePayload(item,depth+1);
    }
    return out;
  }
  if(typeof value==='string')return value.slice(0,50000);
  if(['number','boolean'].includes(typeof value)||value===null)return value;
  return null;
}

async function postJson(path,payload,{fetchImpl=globalThis.fetch,timeout=timeoutMs()}={}){
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

  let response;
  try{
    response=await fetchImpl(endpoint(path),{
      method:'POST',
      headers:{
        Authorization:`Bearer ${String(process.env.IA_GRATIS_API_TOKEN||'').trim()}`,
        'Content-Type':'application/json',
        'User-Agent':'WAE-Universal-Core/1.0',
      },
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(Math.max(3000,Math.min(60000,Number(timeout)||timeoutMs()))),
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
  return data;
}

export async function callIaGratisChat({system='',message='',history=[],fetchImpl=globalThis.fetch}={}){
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
  const data=await postJson('chat',body,{fetchImpl});
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

export async function callIaGratisTool(tool,payload={},options={}){
  const name=String(tool||'').trim().toLowerCase();
  if(!ALLOWED_TOOLS.has(name)){
    const error=new Error('ia_gratis_tool_not_allowed');
    error.code='IA_GRATIS_TOOL_NOT_ALLOWED';
    throw error;
  }
  const maxCost=Math.max(0,Number(process.env.IA_GRATIS_MAX_TOOL_TOKENS_PER_CALL||50));
  const tokenCost=Number(TOOL_TOKEN_COST[name]||0);
  if(tokenCost>maxCost){
    const error=new Error(`ia_gratis_tool_budget_blocked:${name}:${tokenCost}`);
    error.code='IA_GRATIS_TOOL_BUDGET_BLOCKED';
    throw error;
  }
  const safePayload=sanitizePayload(payload);
  if(JSON.stringify(safePayload).length>MAX_TOOL_INPUT_CHARS){
    const error=new Error('ia_gratis_tool_payload_too_large');
    error.code='IA_GRATIS_TOOL_PAYLOAD_TOO_LARGE';
    throw error;
  }
  const data=await postJson(name,safePayload,options);
  return {
    tool:name,
    tokenCost,
    reply:extractReply(data)||null,
    data:sanitizePayload(data),
    version:IA_GRATIS_TOOL_FABRIC_VERSION,
  };
}

export const iaGratisTools=Object.freeze({
  search:({query},options)=>callIaGratisTool('search',{query:text(query,12000)},options),
  summarize:({text:content,style='concise'},options)=>callIaGratisTool('summarize',{prompt:text(content,20000),text:text(content,20000),style:text(style,80)},options),
  translate:({text:content,target='es'},options)=>callIaGratisTool('translate',{prompt:text(content,20000),text:text(content,20000),target:text(target,40),target_language:text(target,40)},options),
  humanize:({text:content},options)=>callIaGratisTool('humanize',{prompt:text(content,20000),text:text(content,20000)},options),
  detect:({text:content},options)=>callIaGratisTool('detect',{prompt:text(content,20000),text:text(content,20000)},options),
});
