import capacityChatV82 from './capacity-chat-v82.js';
import { runFocusedFactualAnswer, focusedFactualEligible, FOCUSED_FACTUAL_VERSION } from '../lib/knowledge/focused-factual-v83.js';

export const CAPACITY_CHAT_V83='capacity-chat/v83-focused-factual-answer';

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return false;
      if(prop==='headersSent')return false;
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(target,prop,value){if(prop==='statusCode'){code=Number(value)||code;return true}target[prop]=value;return true}
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

function replyOf(payload={}){return String(payload?.reply??payload?.response?.content??'').trim()}
function terminalControlFailure(code,payload={}){
  const error=String(payload?.error||payload?.code||'').toUpperCase();
  return code===403||code===405||code===429||[
    'CAPACITY_BUSY','RATE_LIMITED','ORIGIN_NOT_ALLOWED','METHOD_NOT_ALLOWED','GPU_RATE_LIMITED','LIVE_RATE_LIMITED','KNOWLEDGE_RATE_LIMITED'
  ].includes(error);
}
function needsFocusedRecovery(code,payload={}){
  if(terminalControlFailure(code,payload))return false;
  if(code>=500||!replyOf(payload))return true;
  if(payload?.degraded===true)return true;
  const reply=replyOf(payload).toLowerCase();
  return /respuesta no lleg[oó] completa|no pude completar|recuper[eé] evidencia verificable|metadatos por s[ií] solos|all_models_unavailable|continuity_pass_through/i.test(reply);
}
async function boundedFocused(body){
  const timeoutMs=Math.max(2500,Math.min(12000,Number(process.env.WAE_V83_FACTUAL_TIMEOUT_MS||7500)));
  let timer;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs)});
  try{return await Promise.race([runFocusedFactualAnswer({body}),timeout])}
  finally{if(timer)clearTimeout(timer)}
}

export default async function capacityChatV83(req,res){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V83);
  res.setHeader('X-WAE-Factual-Recovery',FOCUSED_FACTUAL_VERSION);
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const first=bufferedResponse(res);
  await capacityChatV82(req,first.proxy);
  if(res.writableEnded||!first.hasJson)return;
  if(!needsFocusedRecovery(first.code,first.payload)||!focusedFactualEligible(body)){
    return res.status(first.code).json(first.payload);
  }
  try{
    const recovered=await boundedFocused(body);
    if(recovered?.success===true&&replyOf(recovered)){
      const payload={
        ...recovered,
        recovery:{
          ...(recovered.recovery||{}),
          active:true,
          path:'focused-factual-v83',
          upstream_status:first.code,
          upstream_degraded:first.payload?.degraded===true,
          upstream_model:first.payload?.model||null
        }
      };
      res.setHeader('X-WAE-Operational-Recovery','focused-factual-v83');
      return res.status(200).json(payload);
    }
  }catch{}
  return res.status(first.code||503).json(first.payload||{error:'FACTUAL_RECOVERY_EXHAUSTED',recoverable:true});
}
