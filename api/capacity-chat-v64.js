import capacityChatV63 from './capacity-chat-v63.js';
import directChatHandler from './chat.js';
import {emergencyGenerate} from '../lib/emergency-generation-v49.js';

const FALLBACK_CODES=new Set([
  'COGNITIVE_PATH_UNAVAILABLE',
  'EXECUTIVE_ORCHESTRATION_FAILED',
  'LIBRARY_PATH_FAILED'
]);
const RESCUE_PROVIDER='wae_deterministic_rescue';
const RESCUE_MODEL_RX=/deterministic[-_ ]rescue/i;
const STOPWORDS=new Set(['como','para','porque','donde','cuando','desde','hasta','este','esta','esto','estos','estas','sobre','entre','forma','clara','explica','analiza','resume','dame','quiero','puede','puedes','debe','debes','with','that','this','from','what','when','where','which','about','into','your','have','does','explain','analyze','summarize']);

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return false;
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    },
    set(target,prop,value){
      if(prop==='statusCode'){code=Number(value)||code;return true}
      target[prop]=value;return true;
    }
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

function shouldFallThrough(code,payload){
  if(code<500)return false;
  return FALLBACK_CODES.has(String(payload?.error||payload?.code||'').toUpperCase());
}

function providerIdentity(payload={}){
  const meta=payload?.response?.metadata||{};
  return{
    provider:String(payload?.provider||meta?.provider||'').toLowerCase(),
    model:String(payload?.model||meta?.model||'').toLowerCase()
  };
}

function isDeterministicRescue(payload={}){
  const {provider,model}=providerIdentity(payload);
  return provider===RESCUE_PROVIDER||RESCUE_MODEL_RX.test(model);
}

function queryTerms(message=''){
  return [...new Set(String(message||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().match(/[a-z0-9]{4,}/g)||[])].filter(token=>!STOPWORDS.has(token)).slice(0,18);
}

function sourceRelevant(source,terms){
  if(!terms.length)return true;
  const haystack=`${source?.title||''} ${source?.snippet||''} ${source?.url||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return terms.some(term=>haystack.includes(term));
}

function enforceContinuityTruth(payload,message=''){
  if(!payload||typeof payload!=='object'||!isDeterministicRescue(payload))return payload;
  const response=payload.response&&typeof payload.response==='object'?payload.response:null;
  const allSources=Array.isArray(payload.web_sources)?payload.web_sources:Array.isArray(response?.sources)?response.sources:[];
  const terms=queryTerms(message);
  const relevantSources=allSources.filter(source=>sourceRelevant(source,terms));
  const rejected=allSources.length-relevantSources.length;
  const noRelevantEvidence=allSources.length>0&&relevantSources.length===0;
  const originalReply=String(payload.reply||response?.content||'').trim();
  const reply=noRelevantEvidence
    ? 'La capa generativa no estuvo disponible en este turno y la evidencia recuperada no coincide suficientemente con tu pregunta. No voy a presentar fuentes irrelevantes como si fueran una respuesta válida. Puedes reintentar la consulta.'
    : originalReply;
  const priorQuality=response?.metadata?.quality;
  const metadata=response?{
    ...(response.metadata||{}),
    degraded:true,
    continuityOnly:true,
    generative:false,
    evidenceRelevanceGate:{checked:allSources.length>0,rejected,kept:relevantSources.length},
    ...(priorQuality&&typeof priorQuality==='object'?{quality:{...priorQuality,pass:false,degraded:true,continuityOnly:true}}:{})
  }:null;
  return{
    ...payload,
    reply,
    speech_text:reply||payload.speech_text,
    degraded:true,
    web_sources:relevantSources,
    resilience:{...(payload.resilience||{}),continuity_only:true,evidence_relevance_gate:true},
    ...(response?{response:{...response,content:reply||response.content,speechText:reply||response.speechText,sources:relevantSources,metadata}}:{})
  };
}

function markFallback(payload,fromCode,message=''){
  if(!payload||typeof payload!=='object')return payload;
  const normalized=enforceContinuityTruth(payload,message);
  const response=normalized.response&&typeof normalized.response==='object'?normalized.response:null;
  return{
    ...normalized,
    resilience:{...(normalized.resilience||{}),cognitive_fallthrough:true,from:String(fromCode||'unknown'),route:'direct-generative-core-v64'},
    ...(response?{response:{...response,metadata:{...(response.metadata||{}),cognitiveFallthrough:true,cognitiveFallthroughFrom:String(fromCode||'unknown'),cognitiveFallthroughRoute:'direct-generative-core-v64'}}}:{})
  };
}

async function improveRescue(payload,req,reason='DETERMINISTIC_RESCUE'){
  if(!isDeterministicRescue(payload))return enforceContinuityTruth(payload,req?.body?.message||req?.body?.task||'');
  const emergency=await emergencyGenerate({body:req?.body||{},userKey:req?.user?.id||req?.headers?.['x-user-id']||'',failure:{error:reason}}).catch(()=>null);
  return emergency||enforceContinuityTruth(payload,req?.body?.message||req?.body?.task||'');
}

export default async function capacityChatV64(req,res){
  const first=bufferedResponse(res);
  await capacityChatV63(req,first.proxy);
  if(res.writableEnded||!first.hasJson)return;

  if(!shouldFallThrough(first.code,first.payload)){
    const normalized=await improveRescue(first.payload,req);
    return res.status(first.code).json(normalized);
  }

  const failureCode=String(first.payload?.error||first.payload?.code||'COGNITIVE_PATH_UNAVAILABLE').toUpperCase();
  const fallback=bufferedResponse(res);
  await directChatHandler(req,fallback.proxy);
  if(res.writableEnded||!fallback.hasJson)return;

  let improved=await improveRescue(fallback.payload,req,failureCode);
  improved=markFallback(improved,failureCode,req?.body?.message||req?.body?.task||'');
  res.setHeader('X-WAE-Cognitive-Fallback','direct-generative-core-v64');
  res.setHeader('X-WAE-Cognitive-Fallback-From',failureCode);
  return res.status(fallback.code).json(improved);
}
