import capacityChatV90 from './capacity-chat-v90.js';
import { applyHeaders, originAllowed, allowRequest, getClientIp } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';
import { planSpecialistCopilots, publicSpecialistPlan, runSpecialistCouncilV91, shouldRunSpecialistCouncilV91, SPECIALIST_COPILOT_VERSION } from '../lib/specialist-copilot-arsenal-v91.js';
import { runSpecialistSinglePassV91, shouldRunSpecialistSinglePassV91 } from '../lib/specialist-copilot-runtime-v91.js';

export const CAPACITY_CHAT_V91='capacity-chat/v91-specialist-copilot-arsenal';

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

function publicPlan(plan={},active=false,path='delegated'){
  return{...publicSpecialistPlan(plan),active,path};
}

function decorate(payload={},plan={},active=false,path='delegated'){
  if(!payload||typeof payload!=='object')return payload;
  const specialistPlan=publicPlan(plan,active,path);
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    specialist_copilots:specialistPlan,
    response:{...response,metadata:{...(response.metadata||{}),specialistCopilots:specialistPlan,chatRelease:CAPACITY_CHAT_V91}}
  };
}

function setHeaders(res,plan={},path='delegated'){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V91);
  res.setHeader('X-WAE-Specialist-Copilots',SPECIALIST_COPILOT_VERSION);
  res.setHeader('X-WAE-Specialist-Path',path);
  res.setHeader('X-WAE-Specialist-Count',String(plan?.specialists?.length||0));
}

function authorize(req,res){
  applyHeaders(res);
  if(req.method!=='POST'){res.status(405).json({error:'method_not_allowed'});return false}
  if(!originAllowed(req)){res.status(403).json({error:'origin_not_allowed'});return false}
  if(!allowRequest(req,Number(process.env.WAE_SPECIALIST_RATE_LIMIT_PER_MINUTE||14))){res.status(429).json({error:'specialist_rate_limited'});return false}
  return true;
}

async function delegate(req,res,plan){
  const buffered=bufferedResponse(res);
  await capacityChatV90(req,buffered.proxy);
  if(res.writableEnded||!buffered.hasJson)return;
  setHeaders(res,plan,'evidence-or-runtime-delegated');
  return res.status(buffered.code).json(decorate(buffered.payload,plan,false,'evidence-or-runtime-delegated'));
}

export default async function capacityChatV91(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const plan=planSpecialistCopilots(body);

  const council=shouldRunSpecialistCouncilV91(plan,body);
  const single=shouldRunSpecialistSinglePassV91(plan,body);
  if(!council&&!single)return delegate(req,res,plan);
  if(!authorize(req,res))return;

  const key=String(body.userKey||body.user_id||body.userId||body.sessionId||body.session_id||getClientIp(req)||'anonymous').slice(0,160);
  const slot=tryAcquireChatSlot(`${key}:specialists`.slice(0,180));
  if(!slot.ok){
    const retry=Math.max(1,Math.ceil(slot.retryAfterMs/1000));
    res.setHeader('Retry-After',String(retry));
    return res.status(503).json({error:'CAPACITY_BUSY',message:'Universal Core está coordinando otra tarea intensiva. Reintenta en breve.',recoverable:true,retry_after_ms:slot.retryAfterMs});
  }

  try{
    let result=null,path='';
    if(council){result=await runSpecialistCouncilV91({body,plan}).catch(()=>null);path='parallel-specialist-council-v91'}
    else if(single){result=await runSpecialistSinglePassV91({body,plan}).catch(()=>null);path='single-pass-specialist-v91'}
    if(result){
      setHeaders(res,plan,path);
      return res.status(200).json(decorate(result,plan,true,path));
    }
  }finally{
    slot.release();
  }

  return delegate(req,res,plan);
}

export function capacityChatV91Capabilities(){
  return{
    release:CAPACITY_CHAT_V91,
    specialists:SPECIALIST_COPILOT_VERSION,
    policy:{minimumNecessarySpecialists:true,singlePassByDefault:true,parallelCouncilOnlyWhenExplicit:true,currentFactsDelegateToVerifiedEvidencePipeline:true,explicitProviderContractPreserved:true,noUniversalSuperiorityClaimWithoutBenchmark:true}
  };
}
