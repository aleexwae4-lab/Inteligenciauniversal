import capacityChatV86 from './capacity-chat-v86.js';
import {
  planUniversalIntelligence,
  applyUniversalIntelligencePlan,
  publicUniversalIntelligencePlan,
  UNIVERSAL_INTELLIGENCE_PLANNER_VERSION
} from '../lib/universal-intelligence-planner-v87.js';
import { runFocusedFactualAnswer, focusedFactualEligible, FOCUSED_FACTUAL_VERSION } from '../lib/knowledge/focused-factual-v83.js';

export const CAPACITY_CHAT_V87='capacity-chat/v87-universal-intelligence-planner';

const SIMPLE_CONCEPT_RX=/\b(?:qu[eé]|what)\s+(?:es|son|is|are)\b|\b(?:define|definici[oó]n|explica|expl[ií]came|explain|para\s+qu[eé]\s+sirve|c[oó]mo\s+funciona|how\s+does)\b/i;
const CURRENT_OR_HIGH_STAKES_RX=/\b(?:hoy|ahora|actual(?:es|mente|idad)?|vigente|reciente|[uú]ltim[oa]s?|latest|today|current|news|noticias|precio|cotizaci[oó]n|clima|tiempo|weather|elecci[oó]n|presidente|ceo|legal|jur[ií]dic|delito|m[eé]dic|salud|dosis|tratamiento|farmacol|inversi[oó]n|cr[eé]dito|fraude)\b/i;
const COMPLEX_ACTION_RX=/\b(?:construye|desarrolla|implementa|programa|c[oó]digo|arquitectura|audita|analiza\s+este|compara|planifica|estrategia|investiga|fuentes?|paper|estudio|benchmark|deploy|despliega|integra|crea\s+una\s+app)\b/i;
const META_OR_IDENTITY_RX=/\b(?:qui[eé]n\s+eres|qu[eé]\s+eres|c[oó]mo\s+te\s+llamas|cu[aá]l\s+es\s+tu\s+(?:nombre|identidad)|tu\s+identidad|qu[eé]\s+modelo\s+eres|modelo\s+eres|eres\s+(?:una?\s+)?(?:ia|ai|inteligencia\s+artificial)|qu[eé]\s+puedes\s+hacer|cu[aá]les\s+son\s+tus\s+capacidades|prompt\s+del\s+sistema|system\s+prompt|who\s+are\s+you|what\s+are\s+you|what\s+model\s+are\s+you|what\s+can\s+you\s+do|your\s+identity|your\s+name)\b/i;

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
    set(target,prop,value){
      if(prop==='statusCode'){code=Number(value)||code;return true}
      target[prop]=value;return true;
    }
  });
  return{proxy,get code(){return code},get payload(){return payload},get hasJson(){return hasJson}};
}

function decorate(payload={},plan={}){
  if(!payload||typeof payload!=='object')return payload;
  const publicPlan=publicUniversalIntelligencePlan(plan);
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    intelligence_plan:publicPlan,
    response:{
      ...response,
      metadata:{
        ...(response.metadata||{}),
        universalIntelligencePlanner:publicPlan
      }
    }
  };
}

function setHeaders(res,plan={}){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V87);
  res.setHeader('X-WAE-Intelligence-Planner',UNIVERSAL_INTELLIGENCE_PLANNER_VERSION);
  res.setHeader('X-WAE-Intelligence-Route',String(plan.route||'standard'));
  res.setHeader('X-WAE-Intelligence-Live',plan?.needs?.live===true?'1':'0');
  res.setHeader('X-WAE-Intelligence-Knowledge',plan?.needs?.knowledge===true?'1':'0');
  res.setHeader('X-WAE-Intelligence-Library',plan?.needs?.library===true?'1':'0');
  res.setHeader('X-WAE-Intelligence-Multiagent',plan?.needs?.multiagent===true?'1':'0');
}

function replyOf(payload={}){
  return String(payload?.reply??payload?.response?.content??'').trim();
}

async function withTimeout(work,ms){
  let timer;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(null),ms)});
  try{return await Promise.race([work,timeout])}
  finally{if(timer)clearTimeout(timer)}
}

export function fastConceptEligible(body={},plan={}){
  const message=String(body?.message||body?.task||body?.prompt||'').trim();
  const mode=String(body?.mode||body?.agent||'general').toLowerCase();
  const attachments=Array.isArray(body?.attachments)?body.attachments:[];
  if(!message||message.length>280)return false;
  if(!['general','analysis'].includes(mode))return false;
  if(body?.web_enabled===true||body?.explicit_research===true||attachments.length)return false;
  if(plan?.needs?.live===true||plan?.needs?.multiagent===true)return false;
  if(META_OR_IDENTITY_RX.test(message))return false;
  if(CURRENT_OR_HIGH_STAKES_RX.test(message)||COMPLEX_ACTION_RX.test(message))return false;
  return SIMPLE_CONCEPT_RX.test(message)&&focusedFactualEligible(body);
}

async function fastFocusedAnswer(body={}){
  const timeout=Math.max(1800,Math.min(5000,Number(process.env.WAE_V89_FAST_FACTUAL_TIMEOUT_MS||3200)));
  return withTimeout(runFocusedFactualAnswer({body}),timeout);
}

function fastFocusedUsable(result={}){
  const reply=replyOf(result);
  const sources=Array.isArray(result?.web_sources)?result.web_sources:[];
  return result?.success===true&&result?.degraded!==true&&reply.length>=45&&sources.length>=1
    &&!/\[K\d+\]|\bunclassified\b|capa generativa|registros utilizables|continuity_pass_through/i.test(reply);
}

export default async function capacityChatV87(req,res){
  const original=req.body&&typeof req.body==='object'?req.body:{};
  const plan=planUniversalIntelligence(original);

  if(fastConceptEligible(original,plan)){
    try{
      const fast=await fastFocusedAnswer(original);
      if(fastFocusedUsable(fast)){
        setHeaders(res,plan);
        res.setHeader('X-WAE-Fast-Factual',FOCUSED_FACTUAL_VERSION);
        res.setHeader('X-WAE-Latency-Class','fast-factual');
        const response=fast.response&&typeof fast.response==='object'?fast.response:{};
        const payload={
          ...fast,
          degraded:false,
          accuracy_verified:true,
          fast_lane:{active:true,version:'v89',path:'focused-factual',source_count:Array.isArray(fast.web_sources)?fast.web_sources.length:0},
          response:{
            ...response,
            metadata:{...(response.metadata||{}),fastLane:'v89-focused-factual',degraded:false}
          }
        };
        return res.status(200).json(decorate(payload,plan));
      }
    }catch{}
  }

  const planned=applyUniversalIntelligencePlan(original,plan);
  const buffered=bufferedResponse(res);
  req.body=planned;
  try{
    await capacityChatV86(req,buffered.proxy);
  }finally{
    req.body=original;
  }
  if(res.writableEnded||!buffered.hasJson)return;
  setHeaders(res,plan);
  return res.status(buffered.code).json(decorate(buffered.payload,plan));
}
