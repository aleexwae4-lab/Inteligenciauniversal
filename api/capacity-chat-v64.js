import capacityChatV63 from './capacity-chat-v63.js';
import directChatHandler from './chat.js';

const FALLBACK_CODES=new Set([
  'COGNITIVE_PATH_UNAVAILABLE',
  'EXECUTIVE_ORCHESTRATION_FAILED',
  'LIBRARY_PATH_FAILED'
]);

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

function markFallback(payload,fromCode){
  if(!payload||typeof payload!=='object')return payload;
  const response=payload.response&&typeof payload.response==='object'?payload.response:null;
  return{
    ...payload,
    degraded:payload.degraded===true,
    resilience:{...(payload.resilience||{}),cognitive_fallthrough:true,from:String(fromCode||'unknown'),route:'direct-generative-core-v64'},
    ...(response?{response:{...response,metadata:{...(response.metadata||{}),cognitiveFallthrough:true,cognitiveFallthroughFrom:String(fromCode||'unknown'),cognitiveFallthroughRoute:'direct-generative-core-v64'}}}:{})
  };
}

export default async function capacityChatV64(req,res){
  const first=bufferedResponse(res);
  await capacityChatV63(req,first.proxy);
  if(res.writableEnded||!first.hasJson)return;

  if(!shouldFallThrough(first.code,first.payload))return res.status(first.code).json(first.payload);

  const failureCode=String(first.payload?.error||first.payload?.code||'COGNITIVE_PATH_UNAVAILABLE').toUpperCase();
  const fallback=bufferedResponse(res);
  await directChatHandler(req,fallback.proxy);
  if(res.writableEnded||!fallback.hasJson)return;

  res.setHeader('X-WAE-Cognitive-Fallback','direct-generative-core-v64');
  res.setHeader('X-WAE-Cognitive-Fallback-From',failureCode);
  return res.status(fallback.code).json(markFallback(fallback.payload,failureCode));
}
