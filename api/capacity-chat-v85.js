import capacityChatV81 from './capacity-chat-v81.js';
import { runKnowledgeAnswer } from '../lib/knowledge/knowledge-answer-v1.js';
import { sameOriginKnowledgeEligible } from '../lib/recovery-policy-v82.js';
import { runFocusedFactualAnswer, focusedFactualEligible, FOCUSED_FACTUAL_VERSION } from '../lib/knowledge/focused-factual-v83.js';
import { runStatelessNativeRecovery, statelessRecoveryEligible, STATELESS_INTELLIGENCE_V85 } from '../lib/stateless-intelligence-v85.js';

export const CAPACITY_CHAT_V85='capacity-chat/v85-native-intelligence-first';

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return false;
      if(prop==='headersSent')return false;
      const value=target[prop];return typeof value==='function'?value.bind(target):value;
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
function upstreamUsable(code,payload={}){
  const reply=replyOf(payload).toLowerCase();
  return code<500&&!!reply&&payload?.degraded!==true&&payload?.response?.metadata?.degraded!==true
    &&!/respuesta no lleg[oó] completa|no pude completar|all_models_unavailable|continuity_pass_through/i.test(reply);
}
function knowledgeUsable(result){
  const reply=replyOf(result);
  return !!reply&&result?.quality?.critical!==true&&!/all_models_unavailable|continuity_pass_through|no pude completar/i.test(reply);
}
async function withTimeout(work,timeoutMs){
  let timer;const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs)});
  try{return await Promise.race([work,timeout])}finally{if(timer)clearTimeout(timer)}
}
async function boundedStateless(body){
  const timeoutMs=Math.max(6000,Math.min(24000,Number(process.env.WAE_V85_STATELESS_TIMEOUT_MS||16000)));
  return withTimeout(runStatelessNativeRecovery({body}),timeoutMs+500);
}
async function boundedFocused(body){
  const timeoutMs=Math.max(2500,Math.min(12000,Number(process.env.WAE_V83_FACTUAL_TIMEOUT_MS||6500)));
  return withTimeout(runFocusedFactualAnswer({body}),timeoutMs);
}
async function boundedGenericKnowledge(body,userKey){
  const timeoutMs=Math.max(4000,Math.min(18000,Number(process.env.WAE_V83_KNOWLEDGE_TIMEOUT_MS||10000)));
  return withTimeout(runKnowledgeAnswer({body:{...body,mode:'research',web_enabled:false,knowledge:true,provider:'auto'},userKey}),timeoutMs);
}

export default async function capacityChatV85(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const first=bufferedResponse(res);
  await capacityChatV81(req,first.proxy);
  if(res.writableEnded||!first.hasJson)return;

  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V85);
  res.setHeader('X-WAE-Native-Recovery',STATELESS_INTELLIGENCE_V85);
  res.setHeader('X-WAE-Factual-Recovery',FOCUSED_FACTUAL_VERSION);

  if(upstreamUsable(first.code,first.payload)||terminalControlFailure(first.code,first.payload)){
    return res.status(first.code).json(first.payload);
  }

  if(statelessRecoveryEligible(body)){
    try{
      const recovered=await boundedStateless(body);
      if(recovered?.success===true&&replyOf(recovered)){
        res.setHeader('X-WAE-Operational-Recovery',STATELESS_INTELLIGENCE_V85);
        return res.status(200).json({...recovered,recovery:{...(recovered.recovery||{}),active:true,path:STATELESS_INTELLIGENCE_V85,upstream_status:first.code,upstream_degraded:first.payload?.degraded===true}});
      }
    }catch{}
  }

  if(focusedFactualEligible(body)){
    try{
      const recovered=await boundedFocused(body);
      if(recovered?.success===true&&replyOf(recovered)){
        res.setHeader('X-WAE-Operational-Recovery','focused-factual-v83');
        return res.status(200).json({...recovered,recovery:{...(recovered.recovery||{}),active:true,path:'focused-factual-v83',upstream_status:first.code,upstream_degraded:first.payload?.degraded===true}});
      }
    }catch{}
  }

  const message=String(body.message||body.task||'').trim();
  if(sameOriginKnowledgeEligible(message,body.mode||'general')){
    try{
      const userKey=String(body.userKey||body.sessionId||body.session_id||'anonymous').slice(0,160);
      const recovered=await boundedGenericKnowledge(body,userKey);
      if(knowledgeUsable(recovered)){
        res.setHeader('X-WAE-Operational-Recovery','same-origin-knowledge-v85');
        return res.status(200).json({...recovered,recovery:{...(recovered?.recovery||{}),active:true,path:'same-origin-knowledge-v85',upstream_status:first.code,upstream_degraded:first.payload?.degraded===true}});
      }
    }catch{}
  }

  return res.status(first.code||503).json(first.payload||{error:'RECOVERY_PATHS_EXHAUSTED',recoverable:true});
}
