import capacityChatV81 from './capacity-chat-v81.js';
import { runKnowledgeAnswer } from '../lib/knowledge/knowledge-answer-v1.js';
import { sameOriginKnowledgeEligible } from '../lib/recovery-policy-v82.js';
import { runFocusedFactualAnswer, focusedFactualEligible, FOCUSED_FACTUAL_VERSION } from '../lib/knowledge/focused-factual-v83.js';
export { CAPACITY_CHAT_V82 } from './capacity-chat-v82.js';

export const CAPACITY_CHAT_V83='capacity-chat/v83-focused-factual-answer';

const EXPLICIT_RESEARCH=/\b(?:investiga|investigación|investigacion|fuentes?|evidencia|paper|papers|estudio|estudios|cient[ií]fic|acad[eé]mic|bibliograf[ií]a|doi|pubmed|openalex|crossref|arxiv|meta.?an[aá]lisis|revisi[oó]n sistem[aá]tica)\b/i;
const INTERNAL_METADATA_FALLBACK=/recuper[eé] evidencia verificable|capa generativa no complet[oó]|registros utilizables|\bunclassified\b|\[K\d+\]/i;

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
function upstreamUsable(code,payload={}){
  const reply=replyOf(payload).toLowerCase();
  return code<500&&!!reply&&payload?.degraded!==true
    &&!/respuesta no lleg[oó] completa|no pude completar|all_models_unavailable|continuity_pass_through/i.test(reply);
}
export function explicitResearchIntent(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const message=String(body.message||body.task||body.prompt||'');
  return ['research','academic','science'].includes(mode)||body.explicit_research===true||EXPLICIT_RESEARCH.test(message);
}
export function knowledgeUsable(result,body={}){
  const reply=replyOf(result);
  if(!reply||result?.quality?.critical===true||/all_models_unavailable|continuity_pass_through|no pude completar/i.test(reply))return false;
  if(!explicitResearchIntent(body)&&(result?.citation_gate_fallback===true||INTERNAL_METADATA_FALLBACK.test(reply)))return false;
  return true;
}
async function withTimeout(work,timeoutMs){
  let timer;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs)});
  try{return await Promise.race([work,timeout])}
  finally{if(timer)clearTimeout(timer)}
}
async function boundedFocused(body){
  const timeoutMs=Math.max(2500,Math.min(12000,Number(process.env.WAE_V83_FACTUAL_TIMEOUT_MS||6500)));
  return withTimeout(runFocusedFactualAnswer({body}),timeoutMs);
}
async function boundedGenericKnowledge(body,userKey){
  const timeoutMs=Math.max(4000,Math.min(18000,Number(process.env.WAE_V83_KNOWLEDGE_TIMEOUT_MS||10000)));
  const recoveryContext=explicitResearchIntent(body)?'explicit_research':'general_concept';
  return withTimeout(runKnowledgeAnswer({body:{...body,mode:'research',web_enabled:false,knowledge:true,provider:'auto',recovery_context:recoveryContext,original_mode:String(body.mode||body.agent||'general')},userKey}),timeoutMs);
}

export default async function capacityChatV83(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const first=bufferedResponse(res);
  await capacityChatV81(req,first.proxy);
  if(res.writableEnded||!first.hasJson)return;

  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V83);
  res.setHeader('X-WAE-Factual-Recovery',FOCUSED_FACTUAL_VERSION);

  if(upstreamUsable(first.code,first.payload)||terminalControlFailure(first.code,first.payload)){
    return res.status(first.code).json(first.payload);
  }

  if(focusedFactualEligible(body)){
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
  }

  const message=String(body.message||body.task||'').trim();
  if(sameOriginKnowledgeEligible(message,body.mode||'general')){
    try{
      const userKey=String(body.userKey||body.sessionId||body.session_id||'anonymous').slice(0,160);
      const recovered=await boundedGenericKnowledge(body,userKey);
      if(knowledgeUsable(recovered,body)){
        const payload={
          ...recovered,
          recovery:{
            ...(recovered?.recovery||{}),
            active:true,
            path:'same-origin-knowledge-v83',
            upstream_status:first.code,
            upstream_degraded:first.payload?.degraded===true,
            upstream_model:first.payload?.model||null
          }
        };
        res.setHeader('X-WAE-Operational-Recovery','same-origin-knowledge-v83');
        return res.status(200).json(payload);
      }
    }catch{}
  }

  return res.status(first.code||503).json(first.payload||{error:'RECOVERY_PATHS_EXHAUSTED',recoverable:true});
}