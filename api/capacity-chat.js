import chatHandler from './chat.js';
import { getClientIp, allowRequest, originAllowed, applyHeaders } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';
import { emergencyGenerate, EMERGENCY_GENERATION_VERSION } from '../lib/emergency-generation-v49.js';
import { directModernAnswer, modernizePayload, MODERN_RESPONSE_VERSION } from '../lib/modern-response-v50.js';
import { getUniversalSelfDescription, buildIdentityReply, UNIVERSAL_CONTEXT_VERSION } from '../lib/universal-context-v52.js';
import { shouldUseLibraryAnswer, runLibraryAnswer, LIBRARY_ANSWER_VERSION } from '../lib/library-answer-v52.js';
import { shouldUseExecutiveOrchestrator, runExecutiveOrchestration, EXECUTIVE_ORCHESTRATION_VERSION } from '../lib/executive-orchestration-v52.js';
import { runWithRequestSignal } from '../lib/network-deadlines-v46.js';

function bufferedResponse(real){
  let code=200,payload,hasJson=false;
  const proxy=new Proxy(real,{
    get(target,prop){
      if(prop==='status')return status=>{code=Number(status)||500;return proxy};
      if(prop==='json')return body=>{payload=body;hasJson=true;return proxy};
      if(prop==='statusCode')return code;
      if(prop==='writableEnded')return target.writableEnded;
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

function retryableFailure(status,payload){
  if(status<400)return false;
  const code=String(payload?.error||payload?.code||'').toUpperCase();
  if(['METHOD_NOT_ALLOWED','ORIGIN_NOT_ALLOWED','RATE_LIMITED','CAPACITY_BUSY'].includes(code))return false;
  return payload?.recoverable===true||status>=500||/CONTINUITY|PROVIDER|RUNTIME|QUALITY|DEADLINE/.test(code);
}

function modernFastPath(req,res,body){
  const answer=directModernAnswer(body);
  if(!answer)return false;
  applyHeaders(res);
  if(req.method!=='POST'){res.status(405).json({error:'method_not_allowed'});return true}
  if(!originAllowed(req)){res.status(403).json({error:'origin_not_allowed'});return true}
  if(!allowRequest(req)){res.status(429).json({error:'rate_limited'});return true}
  res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
  res.setHeader('X-WAE-Fast-Path','estimate-first-v51');
  res.status(200).json(answer);
  return true;
}

function normalize(value=''){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,;:]+/g,' ').replace(/\s+/g,' ').trim();
}

function identityContextIntent(body={}){
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  if(!['general','auto'].includes(mode)||body.web_enabled===true||(Array.isArray(body.attachments)&&body.attachments.length))return false;
  const q=normalize(body.message||body.task||'');
  return /^(quien eres|que eres|que es universal core|como funciona universal core|que tiene tu nucleo|que hay en tu nucleo|cuantos libros tienes|tienes millones de libros|tienes libros|que biblioteca tienes|cuantos agentes tienes|tienes multiagentes|que agentes tienes|como es tu nucleo)$/.test(q);
}

function authorizeIntercept(req,res){
  applyHeaders(res);
  if(req.method!=='POST'){res.status(405).json({error:'method_not_allowed'});return false}
  if(!originAllowed(req)){res.status(403).json({error:'origin_not_allowed'});return false}
  if(!allowRequest(req)){res.status(429).json({error:'rate_limited'});return false}
  return true;
}

async function bounded(ms,task){
  const signal=AbortSignal.timeout(ms);
  return runWithRequestSignal(signal,task);
}

async function identityFastPath(req,res,body){
  if(!identityContextIntent(body))return false;
  if(!authorizeIntercept(req,res))return true;
  let stats=null;
  try{stats=await bounded(2200,()=>getUniversalSelfDescription())}catch{}
  const reply=stats?buildIdentityReply(stats):'Soy **Universal Core**, el núcleo de inteligencia de WAE OS Enterprise. Integro razonamiento, memoria, herramientas, un orquestador multiagente y una biblioteca cognitiva federada. En este momento no pude verificar las cifras del registro, así que no voy a inventarlas.';
  res.setHeader('X-WAE-Cognitive-Path','universal-context-v52');
  res.setHeader('X-WAE-Context-Version',UNIVERSAL_CONTEXT_VERSION);
  res.status(200).json({
    success:true,reply,speech_text:reply,
    response:{content:reply,speechText:reply,metadata:{fastLane:true,universalContext:true,universalContextVersion:UNIVERSAL_CONTEXT_VERSION}},
    provider:'universal_core',model:'universal-core-context-v52',fast_lane:true,fast_lane_version:UNIVERSAL_CONTEXT_VERSION,
    core_context:stats||undefined,web_sources:[]
  });
  return true;
}

async function emergencyAfterPathFailure({body,key,error,res,path}){
  try{
    const emergency=await bounded(5500,()=>emergencyGenerate({body,userKey:key,failure:{error:path,recoverable:true,detail:String(error?.message||error).slice(0,220)}}));
    if(emergency){
      res.setHeader('X-WAE-Resilience',`${EMERGENCY_GENERATION_VERSION}:${path}`);
      res.setHeader('X-WAE-Emergency-Provider',String(emergency.provider||'universal_core'));
      res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
      return res.status(200).json(modernizePayload(emergency,body));
    }
  }catch{}
  return res.status(503).json({error:path,message:'Universal Core liberó este turno de forma controlada antes de quedar bloqueado. Puedes reintentarlo.',recoverable:true});
}

export default async function capacityChatHandler(req,res){
  const body=req.body||{};
  if(modernFastPath(req,res,body))return;
  if(await identityFastPath(req,res,body))return;

  const libraryIntent=shouldUseLibraryAnswer(body);
  const executiveIntent=shouldUseExecutiveOrchestrator(body);
  const intercepted=libraryIntent||executiveIntent;
  if(intercepted&&!authorizeIntercept(req,res))return;

  const key=body.userKey||body.sessionId||body.session_id||getClientIp(req);
  const slot=tryAcquireChatSlot(key);
  if(!slot.ok){
    const retrySeconds=Math.max(1,Math.ceil(slot.retryAfterMs/1000));
    res.setHeader('Retry-After',String(retrySeconds));
    res.setHeader('X-WAE-Capacity','shed-v48');
    res.setHeader('X-WAE-Capacity-Reason',slot.reason);
    return res.status(503).json({
      error:'CAPACITY_BUSY',
      message:'Universal Core está absorbiendo una ráfaga de concurrencia. Este turno no se dejó colgado: fue rechazado de forma controlada y puede reintentarse.',
      recoverable:true,
      retry_after_ms:slot.retryAfterMs
    });
  }

  res.setHeader('X-WAE-Capacity','admitted-v48');
  try{
    if(libraryIntent){
      try{
        const result=await bounded(16_000,()=>runLibraryAnswer({body,userKey:key}));
        if(result){
          res.setHeader('X-WAE-Cognitive-Path',LIBRARY_ANSWER_VERSION);
          res.setHeader('X-WAE-Library-Intelligence','rights-aware-v52');
          res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
          return res.status(200).json(modernizePayload(result,{...body,mode:'analysis'}));
        }
      }catch(error){
        console.warn('[Library Intelligence v52]',String(error?.message||error).slice(0,240));
        return emergencyAfterPathFailure({body,key,error,res,path:'LIBRARY_PATH_FAILED'});
      }
    }

    if(executiveIntent){
      try{
        const explicit=body.multiagent===true||body.deep===true||body.orchestrate===true||String(body.mode||'').toLowerCase()==='executive';
        const result=await bounded(explicit?24_000:18_000,()=>runExecutiveOrchestration({body,userKey:key,sessionId:String(body.sessionId||body.session_id||'')}));
        if(result){
          res.setHeader('X-WAE-Cognitive-Path',EXECUTIVE_ORCHESTRATION_VERSION);
          res.setHeader('X-WAE-Multi-Agent','database-backed-v52');
          res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
          return res.status(200).json(modernizePayload(result,{...body,mode:'executive'}));
        }
      }catch(error){
        console.warn('[Executive Orchestrator v52]',String(error?.message||error).slice(0,240));
        return emergencyAfterPathFailure({body,key,error,res,path:'EXECUTIVE_ORCHESTRATION_FAILED'});
      }
    }

    if(intercepted){
      return emergencyAfterPathFailure({body,key,error:new Error('intercept_path_unavailable'),res,path:'COGNITIVE_PATH_UNAVAILABLE'});
    }

    const buffered=bufferedResponse(res);
    await chatHandler(req,buffered.proxy);

    if(res.writableEnded)return;
    if(!buffered.hasJson)return;

    if(buffered.code<400){
      res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
      return res.status(buffered.code).json(modernizePayload(buffered.payload,body));
    }

    if(retryableFailure(buffered.code,buffered.payload)){
      try{
        const emergency=await emergencyGenerate({body,userKey:key,failure:buffered.payload});
        if(emergency){
          res.setHeader('X-WAE-Resilience',EMERGENCY_GENERATION_VERSION);
          res.setHeader('X-WAE-Emergency-Provider',String(emergency.provider||'universal_core'));
          res.setHeader('X-WAE-Response-Style',MODERN_RESPONSE_VERSION);
          return res.status(200).json(modernizePayload(emergency,body));
        }
      }catch(error){
        console.warn('[Emergency Generation v49]',String(error?.message||error).slice(0,240));
      }
    }

    return res.status(buffered.code).json(buffered.payload);
  }finally{
    slot.release();
  }
}
