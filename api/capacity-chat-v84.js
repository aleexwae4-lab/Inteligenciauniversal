import capacityChatV83 from './capacity-chat-v83.js';
import { callIaGratisChat, iaGratisConfigured, IA_GRATIS_PROVIDER_VERSION } from '../lib/ia-gratis-v84.js';

export const CAPACITY_CHAT_V84='capacity-chat/v84-ia-gratis-resilience';

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

function replyOf(payload={}){
  return String(payload?.reply??payload?.response?.content??'').trim();
}

function terminalControlFailure(code,payload={}){
  const error=String(payload?.error||payload?.code||'').toUpperCase();
  return code===403||code===405||code===429||[
    'CAPACITY_BUSY','RATE_LIMITED','ORIGIN_NOT_ALLOWED','METHOD_NOT_ALLOWED','GPU_RATE_LIMITED','LIVE_RATE_LIMITED','KNOWLEDGE_RATE_LIMITED'
  ].includes(error);
}

function upstreamUsable(code,payload={}){
  const reply=replyOf(payload).toLowerCase();
  return code>=200&&code<300&&!!reply&&payload?.degraded!==true
    &&!/respuesta no lleg[oó] completa|no pude completar|all_models_unavailable|continuity_pass_through|recovery_paths_exhausted/i.test(reply);
}

function userMessage(body={}){
  return String(body.message||body.task||body.prompt||'').trim().slice(0,24000);
}

function historyOf(body={}){
  if(Array.isArray(body.history))return body.history;
  if(Array.isArray(body.messages))return body.messages.filter(item=>item?.role!=='system').slice(0,-1);
  return [];
}

function systemOf(body={}){
  const provided=String(body.system||body.systemPrompt||body.system_prompt||'').trim();
  if(provided)return provided.slice(0,24000);
  return 'Eres Universal Core. Responde directamente a la solicitud del usuario con precisión, utilidad y claridad. No inventes hechos ni acciones ejecutadas. Conserva el idioma del usuario salvo que pida otro.';
}

export default async function capacityChatV84(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const first=bufferedResponse(res);
  await capacityChatV83(req,first.proxy);
  if(res.writableEnded||!first.hasJson)return;

  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V84);
  res.setHeader('X-WAE-IA-Gratis',IA_GRATIS_PROVIDER_VERSION);

  if(upstreamUsable(first.code,first.payload)||terminalControlFailure(first.code,first.payload)){
    return res.status(first.code).json(first.payload);
  }

  const message=userMessage(body);
  if(!iaGratisConfigured()||!message){
    return res.status(first.code||503).json(first.payload||{error:'RECOVERY_PATHS_EXHAUSTED',recoverable:true});
  }

  try{
    const recovered=await callIaGratisChat({
      system:systemOf(body),
      message,
      history:historyOf(body),
    });
    const payload={
      success:true,
      reply:recovered.reply,
      provider:recovered.provider,
      model:recovered.model,
      usage:recovered.usage,
      degraded:false,
      response:{
        content:recovered.reply,
        metadata:{
          provider:recovered.provider,
          model:recovered.model,
          responseId:recovered.responseId,
          recovery:true,
          recoveryPath:'ia-gratis-v84',
        },
      },
      recovery:{
        active:true,
        path:'ia-gratis-v84',
        upstream_status:first.code,
        upstream_degraded:first.payload?.degraded===true,
        upstream_model:first.payload?.model||null,
      },
    };
    res.setHeader('X-WAE-Operational-Recovery','ia-gratis-v84');
    return res.status(200).json(payload);
  }catch(error){
    const payload=first.payload&&typeof first.payload==='object'?{...first.payload}:{error:'RECOVERY_PATHS_EXHAUSTED',recoverable:true};
    payload.recovery={
      ...(payload.recovery||{}),
      ia_gratis_attempted:true,
      ia_gratis_error:String(error?.code||'IA_GRATIS_FAILED').slice(0,120),
    };
    return res.status(first.code||503).json(payload);
  }
}
