import capacityChatV82 from './capacity-chat-v82.js';
import { runStatelessNativeRecovery, statelessRecoveryEligible, STATELESS_INTELLIGENCE_V84 } from '../lib/stateless-intelligence-v84.js';
import { visibleFallbackRelevant, VISIBLE_RELEVANCE_V84 } from '../lib/visible-answer-relevance-v84.js';

export const CAPACITY_CHAT_V84='capacity-chat/v84-visible-intelligence-first';

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

const replyOf=p=>String(p?.reply??p?.response?.content??'').trim();
function terminalControlFailure(code,payload={}){
  const error=String(payload?.error||payload?.code||'').toUpperCase();
  return code===403||code===405||code===429||['CAPACITY_BUSY','RATE_LIMITED','ORIGIN_NOT_ALLOWED','METHOD_NOT_ALLOWED','GPU_RATE_LIMITED','LIVE_RATE_LIMITED','KNOWLEDGE_RATE_LIMITED'].includes(error);
}
function needsVisibleRecovery(code,payload={}){
  const reply=replyOf(payload).toLowerCase();
  const model=String(payload?.model||payload?.response?.metadata?.model||'').toLowerCase();
  const path=String(payload?.recovery?.path||'').toLowerCase();
  return code>=500||!reply||payload?.degraded===true||payload?.response?.metadata?.degraded===true
    ||/knowledge-fabric-evidence-fallback|deterministic-rescue|continuity/.test(model)
    ||/same-origin-knowledge/.test(path)
    ||/all_models_unavailable|no pude completar|respuesta no lleg[oó] completa|rutas generativas.*(?:saturad|no estuv)/i.test(reply);
}
function isKnowledgeFallback(payload={}){
  const model=String(payload?.model||payload?.response?.metadata?.model||'').toLowerCase();
  const path=String(payload?.recovery?.path||'').toLowerCase();
  return /knowledge-fabric|evidence-fallback/.test(model)||/same-origin-knowledge/.test(path);
}

export default async function capacityChatV84(req,res){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V84);
  res.setHeader('X-WAE-Visible-Relevance',VISIBLE_RELEVANCE_V84);

  const body=req.body&&typeof req.body==='object'?req.body:{};
  const first=bufferedResponse(res);
  await capacityChatV82(req,first.proxy);
  if(res.writableEnded||!first.hasJson)return;
  if(terminalControlFailure(first.code,first.payload))return res.status(first.code).json(first.payload);
  if(!needsVisibleRecovery(first.code,first.payload))return res.status(first.code).json(first.payload);

  if(statelessRecoveryEligible(body)){
    const recovered=await runStatelessNativeRecovery({body});
    if(recovered){
      res.setHeader('X-WAE-Operational-Recovery',STATELESS_INTELLIGENCE_V84);
      return res.status(200).json(recovered);
    }
  }

  const message=String(body.message||body.task||'').trim();
  if(isKnowledgeFallback(first.payload)&&!visibleFallbackRelevant(message,first.payload)){
    res.setHeader('X-WAE-Visible-Answer-Blocked','semantic-mismatch');
    return res.status(503).json({
      success:false,
      error:'VISIBLE_ANSWER_RELEVANCE_FAILED',
      recoverable:true,
      degraded:true,
      reply:'No pude obtener una respuesta suficientemente relevante en este intento. Prefiero no mostrar evidencia que no contesta realmente tu pregunta.',
      response_schema:'assistant-response/v1',
      recovery:{active:true,path:'semantic-relevance-gate-v84'}
    });
  }

  return res.status(first.code||503).json(first.payload||{error:'PROVIDER_PATH_EXHAUSTED',recoverable:true});
}
