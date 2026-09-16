import capacityChatV86 from './capacity-chat-v86.js';
import {
  planUniversalIntelligence,
  applyUniversalIntelligencePlan,
  publicUniversalIntelligencePlan,
  UNIVERSAL_INTELLIGENCE_PLANNER_VERSION
} from '../lib/universal-intelligence-planner-v87.js';

export const CAPACITY_CHAT_V87='capacity-chat/v87-universal-intelligence-planner';

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

export default async function capacityChatV87(req,res){
  const original=req.body&&typeof req.body==='object'?req.body:{};
  const plan=planUniversalIntelligence(original);
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
