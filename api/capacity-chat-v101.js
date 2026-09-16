import capacityChatV91 from './capacity-chat-v91.js';
import baseCapacityChat from './capacity-chat.js';
import { applyHeaders, originAllowed, allowRequest } from '../lib/security.js';
import { emergencyGenerate, EMERGENCY_GENERATION_VERSION } from '../lib/emergency-generation-v49.js';
import { getUniversalSelfDescription } from '../lib/universal-context-v52.js';
import { operationalProviderSnapshot } from '../lib/provider-health-v81.js';
import { toolFabricSnapshot } from '../lib/tool-fabric.js';
import { capabilitySnapshot } from '../lib/capability-kernel.js';
import { classifySelfAwarenessV101, buildSelfAwarenessSnapshotV101, buildSelfAwarenessReplyV101, SELF_AWARENESS_V101 } from '../lib/self-awareness-v101.js';
import { answerIsUsableV101, shouldRecoverAnswerV101, continuityEnvelopeV101, ANSWER_CONTINUITY_V101 } from '../lib/answer-continuity-v101.js';

export const CAPACITY_CHAT_V101='capacity-chat/v101-grounded-self-model-continuity';

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

async function callBuffered(handler,req,res,body){
  req.body={...(body||{})};
  const buffered=bufferedResponse(res);
  try{await handler(req,buffered.proxy)}catch(error){return{code:500,payload:{error:'UPSTREAM_THROW',message:String(error?.message||error).slice(0,240),recoverable:true},hasJson:true,error}}
  return{code:buffered.code,payload:buffered.payload,hasJson:buffered.hasJson};
}

function domainCount(kernel={}){
  if(Array.isArray(kernel?.domains))return kernel.domains.length;
  if(kernel?.domains&&typeof kernel.domains==='object')return Object.keys(kernel.domains).length;
  return 0;
}

async function bounded(ms,task){
  return Promise.race([
    Promise.resolve().then(task),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('v101_timeout')),ms))
  ]);
}

async function selfAwarenessFastPath(req,res,body){
  const intent=classifySelfAwarenessV101(body);
  if(!intent.eligible)return false;
  applyHeaders(res);
  if(req.method!=='POST'){res.status(405).json({error:'method_not_allowed'});return true}
  if(!originAllowed(req)){res.status(403).json({error:'origin_not_allowed'});return true}
  if(!allowRequest(req)){res.status(429).json({error:'rate_limited'});return true}

  let stats={},operational=null;
  try{
    [stats,operational]=await bounded(2400,()=>Promise.all([
      getUniversalSelfDescription().catch(()=>({})),
      operationalProviderSnapshot().catch(()=>null),
    ]));
  }catch{}
  const tools=toolFabricSnapshot();
  const kernel=capabilitySnapshot();
  const snapshot=buildSelfAwarenessSnapshotV101({
    stats:stats||{},
    operational,
    toolCount:Array.isArray(tools?.tools)?tools.tools.length:0,
    capabilityDomains:domainCount(kernel),
  });
  const reply=buildSelfAwarenessReplyV101({kind:intent.kind,snapshot});
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V101);
  res.setHeader('X-WAE-Self-Awareness',SELF_AWARENESS_V101);
  res.setHeader('X-WAE-Answer-Continuity',ANSWER_CONTINUITY_V101);
  return res.status(200).json({
    success:true,
    reply,
    speech_text:reply,
    response:{content:reply,speechText:reply,components:[],metadata:{chatRelease:CAPACITY_CHAT_V101,selfAwarenessVersion:SELF_AWARENESS_V101,selfAwarenessKind:intent.kind,groundedCapabilityModel:true}},
    provider:'universal_core',
    model:'universal-core-self-awareness-v101',
    degraded:snapshot?.operational?.generative==='degraded'||snapshot?.operational?.generative==='unavailable',
    self_awareness:snapshot,
    comparative_claim:{status:'UNVERIFIED',certificationEndpoint:'/api/benchmark/v98'},
    web_sources:[]
  }),true;
}

function decorate(payload={},path='primary'){
  if(!payload||typeof payload!=='object')return payload;
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    answer_continuity:{...(payload.answer_continuity||{}),version:ANSWER_CONTINUITY_V101,path},
    response:{...response,metadata:{...(response.metadata||{}),chatRelease:CAPACITY_CHAT_V101,answerContinuity:{version:ANSWER_CONTINUITY_V101,path}}}
  };
}

async function recoverAnswer({req,res,body,primary}){
  const base=await callBuffered(baseCapacityChat,req,res,body);
  if(base.hasJson&&answerIsUsableV101(base.code,base.payload)){
    res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V101);
    res.setHeader('X-WAE-Answer-Continuity',`${ANSWER_CONTINUITY_V101}:base-recovery`);
    return res.status(200).json(decorate({...base.payload,degraded:base.payload?.degraded===true},'base-recovery'));
  }

  try{
    const emergency=await bounded(6500,()=>emergencyGenerate({
      body,
      userKey:String(body?.userKey||body?.user_id||body?.userId||body?.sessionId||body?.session_id||'anonymous').slice(0,180),
      failure:primary?.payload||base?.payload||{error:'terminal_recovery'},
    }));
    if(emergency&&answerIsUsableV101(200,emergency)){
      res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V101);
      res.setHeader('X-WAE-Answer-Continuity',`${ANSWER_CONTINUITY_V101}:emergency-generation`);
      res.setHeader('X-WAE-Resilience',EMERGENCY_GENERATION_VERSION);
      return res.status(200).json(decorate(emergency,'emergency-generation'));
    }
  }catch{}

  const fallback=continuityEnvelopeV101({body,reason:'all_generators_unavailable',failure:primary?.payload||base?.payload});
  if(fallback){
    res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V101);
    res.setHeader('X-WAE-Answer-Continuity',`${ANSWER_CONTINUITY_V101}:local-safe-continuity`);
    return res.status(200).json(decorate(fallback,'local-safe-continuity'));
  }
  return res.status(primary?.code||503).json(primary?.payload||{error:'continuity_unavailable'});
}

export default async function capacityChatV101(req,res){
  const body=req.body&&typeof req.body==='object'?{...req.body}:{};
  if(await selfAwarenessFastPath(req,res,body))return;

  const primary=await callBuffered(capacityChatV91,req,res,body);
  if(res.writableEnded)return;
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V101);
  res.setHeader('X-WAE-Answer-Continuity',ANSWER_CONTINUITY_V101);

  if(primary.hasJson&&answerIsUsableV101(primary.code,primary.payload)){
    return res.status(primary.code).json(decorate(primary.payload,'primary-v91'));
  }
  if(primary.hasJson&&!shouldRecoverAnswerV101(primary.code,primary.payload)){
    return res.status(primary.code).json(primary.payload);
  }
  return recoverAnswer({req,res,body,primary});
}

export function capacityChatV101Capabilities(){
  return{
    release:CAPACITY_CHAT_V101,
    selfAwareness:SELF_AWARENESS_V101,
    answerContinuity:ANSWER_CONTINUITY_V101,
    policy:{
      capabilityClaimsGroundedInRuntime:true,
      noEmptyTerminalAnswer:true,
      recoverAdvancedRouteFailureToBaseCore:true,
      recoverBaseFailureToEmergencyGeneration:true,
      finalLocalSafeContinuity:true,
      authorizationAndSecurityFailuresRemainFailClosed:true,
      currentFactsNeverFabricatedDuringDegradation:true,
      superiorityRequiresSignedBenchmark:true,
    }
  };
}
