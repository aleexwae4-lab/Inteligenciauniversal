import chatHandler from './chat.js';
import { getClientIp, allowRequest, originAllowed, applyHeaders } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';
import { emergencyGenerate, EMERGENCY_GENERATION_VERSION } from '../lib/emergency-generation-v49.js';
import { directModernAnswer, modernizePayload, MODERN_RESPONSE_VERSION } from '../lib/modern-response-v50.js';

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
  res.setHeader('X-WAE-Fast-Path','modern-conversation-v50');
  res.status(200).json(answer);
  return true;
}

export default async function capacityChatHandler(req,res){
  const body=req.body||{};
  if(modernFastPath(req,res,body))return;

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
