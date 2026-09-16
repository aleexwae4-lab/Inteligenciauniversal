import capacityChatV81 from './capacity-chat-v81.js';
import { runKnowledgeAnswer } from '../lib/knowledge/knowledge-answer-v1.js';
import { sameOriginKnowledgeEligible, RECOVERY_POLICY_V82 } from '../lib/recovery-policy-v82.js';

export const CAPACITY_CHAT_V82='capacity-chat/v82-same-origin-knowledge-recovery';

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
function weakOrFailed(code,payload={}){
  const reply=replyOf(payload).toLowerCase();
  return code>=500||!reply||payload?.error==='mobile_routes_unavailable'
    ||/continuity_pass_through|all_models_unavailable|no pude completar|respuesta no lleg[oó] completa|rutas generativas.*(?:saturad|no estuv)/i.test(reply);
}
function knowledgeUsable(result){
  const reply=replyOf(result);
  return !!reply&&result?.quality?.critical!==true&&!/all_models_unavailable|continuity_pass_through|no pude completar/i.test(reply);
}
async function boundedKnowledge(body,userKey){
  const timeoutMs=Math.max(4000,Math.min(18000,Number(process.env.WAE_V82_KNOWLEDGE_TIMEOUT_MS||12000)));
  let timer;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs)});
  try{
    return await Promise.race([
      runKnowledgeAnswer({body:{...body,mode:'research',web_enabled:false,knowledge:true,provider:'auto'},userKey}),
      timeout
    ]);
  }finally{if(timer)clearTimeout(timer)}
}

export default async function capacityChatV82(req,res){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V82);
  res.setHeader('X-WAE-Recovery-Policy',RECOVERY_POLICY_V82);

  const body=req.body&&typeof req.body==='object'?req.body:{};
  const first=bufferedResponse(res);
  await capacityChatV81(req,first.proxy);
  if(res.writableEnded||!first.hasJson)return;
  if(!weakOrFailed(first.code,first.payload)||terminalControlFailure(first.code,first.payload)){
    return res.status(first.code).json(first.payload);
  }

  const message=String(body.message||body.task||'').trim();
  if(sameOriginKnowledgeEligible(message,body.mode||'general')){
    try{
      const userKey=String(body.userKey||body.sessionId||body.session_id||'anonymous').slice(0,160);
      const recovered=await boundedKnowledge(body,userKey);
      if(knowledgeUsable(recovered)){
        const payload={
          ...recovered,
          recovery:{
            ...(recovered?.recovery||{}),
            active:true,
            path:'same-origin-knowledge-v82',
            upstream_status:first.code,
            upstream_error:String(first.payload?.error||first.payload?.code||'provider_path_unavailable').slice(0,120)
          }
        };
        res.setHeader('X-WAE-Operational-Recovery','same-origin-knowledge-v82');
        return res.status(200).json(payload);
      }
    }catch{}
  }

  return res.status(first.code||503).json(first.payload||{error:'PROVIDER_PATH_EXHAUSTED',recoverable:true});
}
