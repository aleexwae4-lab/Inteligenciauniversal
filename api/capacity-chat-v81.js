import capacityChatV77 from './capacity-chat-v77.js';
import { chooseOperationalProvider, PROVIDER_HEALTH_VERSION } from '../lib/provider-health-v81.js';
import { rescueMission, researchRescueEligible } from '../lib/intelligence-rescue.js';
import { runWithRequestSignal } from '../lib/network-deadlines-v46.js';

export const CAPACITY_CHAT_V81='capacity-chat/v81-health-aware';

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
function weakPayload(payload={}){
  const provider=String(payload?.provider||'').toLowerCase();
  const model=String(payload?.model||'').toLowerCase();
  const reply=replyOf(payload).toLowerCase();
  return !reply||payload?.degraded===true||payload?.response?.metadata?.degraded===true
    ||/deterministic_rescue|deterministic-rescue|web_recovery|evidence-rescue|continuity_core/.test(`${provider} ${model}`)
    ||/continuity_pass_through|all_models_unavailable|rutas generativas.*(?:saturad|no estuv)|no pude completar/.test(reply);
}
function successful(code,payload){return code>=200&&code<300&&!weakPayload(payload)}
function terminalControlFailure(code,payload={}){
  const error=String(payload?.error||payload?.code||'').toUpperCase();
  return code===403||code===405||code===429||[
    'CAPACITY_BUSY','RATE_LIMITED','ORIGIN_NOT_ALLOWED','METHOD_NOT_ALLOWED','GPU_RATE_LIMITED','LIVE_RATE_LIMITED','KNOWLEDGE_RATE_LIMITED'
  ].includes(error);
}

async function callV77(req,res,body){
  const previous=req.body;
  req.body=body;
  const buffered=bufferedResponse(res);
  try{await capacityChatV77(req,buffered.proxy)}finally{req.body=previous}
  return{code:buffered.code,payload:buffered.payload,hasJson:buffered.hasJson};
}

function setHealthHeaders(res,decision){
  const snapshot=decision?.snapshot;
  res.setHeader('X-WAE-Provider-Health',PROVIDER_HEALTH_VERSION);
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V81);
  if(snapshot){
    res.setHeader('X-WAE-Configured-Providers',String(snapshot.configuredProviderCount));
    res.setHeader('X-WAE-Healthy-Providers',String(snapshot.healthyProviderCount));
    res.setHeader('X-WAE-Eligible-Providers',String(snapshot.eligibleProviderCount));
  }
  if(decision?.overridden)res.setHeader('X-WAE-Operational-Route',String(decision.provider));
}

async function boundedRescue(body,userKey,error){
  const timeoutMs=Math.max(3000,Math.min(14000,Number(process.env.WAE_V81_RESCUE_TIMEOUT_MS||11000)));
  return runWithRequestSignal(AbortSignal.timeout(timeoutMs),()=>rescueMission({payload:body,userKey,error}));
}

export default async function capacityChatV81(req,res){
  const originalBody=req.body&&typeof req.body==='object'?req.body:{};
  const requested=String(originalBody.provider||'auto').toLowerCase();
  const decision=await chooseOperationalProvider({requestedProvider:requested}).catch(()=>({provider:requested,overridden:false,snapshot:null}));
  setHealthHeaders(res,decision);

  const firstBody=decision.overridden?{...originalBody,provider:decision.provider}:originalBody;
  let first=await callV77(req,res,firstBody);
  if(res.writableEnded||!first.hasJson)return;
  if(successful(first.code,first.payload)||terminalControlFailure(first.code,first.payload))return res.status(first.code).json(first.payload);

  if(requested==='auto'&&decision?.snapshot){
    const alternates=decision.snapshot.providers.filter(row=>row.eligible&&row.id!==decision.provider&&row.id!=='wae_edge').slice(0,1);
    for(const alternate of alternates){
      const retry=await callV77(req,res,{...originalBody,provider:alternate.id});
      if(res.writableEnded||!retry.hasJson)return;
      if(successful(retry.code,retry.payload)){
        res.setHeader('X-WAE-Operational-Recovery',alternate.id);
        return res.status(retry.code).json(retry.payload);
      }
      if(!terminalControlFailure(retry.code,retry.payload)&&(!first.payload||weakPayload(first.payload))&&retry.payload)first=retry;
    }
  }

  if(terminalControlFailure(first.code,first.payload))return res.status(first.code).json(first.payload);

  const message=String(originalBody.message||originalBody.task||'').trim();
  const recoverable=first.code>=500||weakPayload(first.payload);
  if(recoverable&&researchRescueEligible(message,originalBody.mode||'general')){
    try{
      const userKey=String(originalBody.userKey||originalBody.sessionId||originalBody.session_id||'anonymous').slice(0,160);
      const rescued=await boundedRescue(originalBody,userKey,first.payload||{error:'provider_unavailable'});
      if(rescued&&replyOf(rescued)){
        res.setHeader('X-WAE-Operational-Recovery','evidence-rescue');
        return res.status(200).json(rescued);
      }
    }catch{}
  }

  return res.status(first.code||503).json(first.payload||{error:'PROVIDER_PATH_EXHAUSTED',recoverable:true});
}
