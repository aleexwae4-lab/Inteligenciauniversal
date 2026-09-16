import capacityChatV89 from './capacity-chat-v89.js';
import baseCapacityChatHandler from './capacity-chat.js';
import { planUniversalIntelligence } from '../lib/universal-intelligence-planner-v87.js';
import { runFocusedFactualAnswer } from '../lib/knowledge/focused-factual-v83.js';
import { applyAnswerIntelligence } from '../lib/answer-intelligence-v60.js';
import { applyQualityReliability } from '../lib/quality-reliability-v61.js';
import { factualityDecision, FACTUALITY_GATE_VERSION } from '../lib/factuality-gate-v86.js';
import { planLatencyV90, publicLatencyPlanV90, shouldAttemptFastFactualV90, withinLatencyBudget, fetchWithParentSignal, latencyGovernorCapabilitiesV90, LATENCY_GOVERNOR_VERSION } from '../lib/latency-governor-v90.js';
import { runKnowledgeFusionV90, KNOWLEDGE_FUSION_V90 } from '../lib/knowledge-fusion-v90.js';
import { knowledgeExpansionCapabilitiesV90, KNOWLEDGE_EXPANSION_VERSION } from '../lib/knowledge-expansion-v90.js';
import { recordLatencyV94 } from '../lib/latency-metrics-v94.js';
import { applyHeaders, originAllowed, getClientIp } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';

export const CAPACITY_CHAT_V90='capacity-chat/v90.2-latency-autonomous-knowledge';
export const LATENCY_CORE_V94='latency-core/v94-hedged-verified';

const hedgeDelayMs=()=>Math.max(80,Math.min(800,Number(process.env.WAE_FAST_FACTUAL_HEDGE_DELAY_MS||240)));

function setHeaders(res,latencyPlan,path='fallback'){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V90);
  res.setHeader('X-WAE-Latency-Governor',LATENCY_GOVERNOR_VERSION);
  res.setHeader('X-WAE-Latency-Core',LATENCY_CORE_V94);
  res.setHeader('X-WAE-Latency-Profile',String(latencyPlan?.profile||'bypass'));
  res.setHeader('X-WAE-Latency-Path',path);
  res.setHeader('X-WAE-Knowledge-Expansion',KNOWLEDGE_EXPANSION_VERSION);
}

function decorate(payload={},latencyPlan={},path='v90'){
  if(!payload||typeof payload!=='object')return payload;
  const publicPlan=publicLatencyPlanV90(latencyPlan);
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    degraded:false,
    latency_governor:publicPlan,
    runtime_control:{...(payload.runtime_control||{}),release:CAPACITY_CHAT_V90,path,latency_core:LATENCY_CORE_V94,latency_governor:LATENCY_GOVERNOR_VERSION,profile:latencyPlan.profile},
    response:{...response,metadata:{...(response.metadata||{}),latencyGovernor:publicPlan,latencyCore:LATENCY_CORE_V94,chatRelease:CAPACITY_CHAT_V90,latencyPath:path}}
  };
}

function userKey(req,body={}){
  return String(body.userKey||body.user_id||body.userId||body.sessionId||body.session_id||getClientIp(req)||'anonymous').slice(0,500);
}

function hasExplicitProvider(body={}){
  const provider=String(body.provider||'').trim().toLowerCase();
  return Boolean(provider&&provider!=='auto');
}

function hasExplicitContinuityProvider(body={}){
  const provider=String(body.provider||'').trim().toLowerCase();
  return provider==='continuity_core'||provider==='universal_continuity_core';
}

function record(started,res,route,success){
  recordLatencyV94({route,durationMs:Date.now()-started,statusCode:res.statusCode||200,success});
}

async function delegateMeasured(handler,req,res,started,route){
  try{
    const value=await handler(req,res);
    record(started,res,route,(res.statusCode||200)<500);
    return value;
  }catch(error){
    record(started,res,route,false);
    throw error;
  }
}

async function tryFastFactual(body,latencyPlan){
  const result=await withinLatencyBudget(latencyPlan.budgets.focused_timeout_ms,signal=>runFocusedFactualAnswer({body,fetchImpl:fetchWithParentSignal(signal)}));
  if(!result)return null;
  let payload=applyAnswerIntelligence({...result,degraded:false});
  payload=applyQualityReliability(payload,{prompt:String(body.message||body.task||body.prompt||'')});
  const decision=factualityDecision(payload,body);
  if(!decision.accept)return null;
  return decorate({...payload,accuracy_verified:true,factuality_gate:{version:FACTUALITY_GATE_VERSION,status:'PASS',path:'fast-factual-v90',reasons:[],source_count:decision.source_count,citation_coverage:decision.citation_coverage,upstream_gate:decision.upstream_gate,profile:decision.profile}},latencyPlan,'fast-factual-v90');
}

function firstAccepted(promises=[]){
  return new Promise(resolve=>{
    let pending=promises.length,settled=false;
    if(!pending)return resolve(null);
    const done=value=>{
      if(settled)return;
      if(value){settled=true;resolve(value);return}
      pending--;
      if(pending<=0){settled=true;resolve(null)}
    };
    for(const promise of promises)Promise.resolve(promise).then(done,()=>done(null));
  });
}

async function hedgedVerifiedFastPath({body,intelligencePlan,latencyPlan,key}){
  const fastPromise=tryFastFactual(body,latencyPlan).catch(()=>null);
  const delay=hedgeDelayMs();
  const first=await Promise.race([
    fastPromise.then(value=>({kind:'fast',value})),
    new Promise(resolve=>setTimeout(()=>resolve({kind:'hedge'}),delay))
  ]);
  if(first.kind==='fast'){
    if(first.value)return{kind:'fast',payload:first.value};
    const fusion=await tryFusion(body,intelligencePlan,latencyPlan,key);
    return fusion?{kind:'fusion',payload:fusion}:null;
  }
  const fusionPromise=tryFusion(body,intelligencePlan,latencyPlan,key);
  const winner=await firstAccepted([
    fastPromise.then(payload=>payload?{kind:'fast',payload}:null),
    fusionPromise.then(payload=>payload?{kind:'fusion',payload}:null)
  ]);
  return winner;
}

export default async function capacityChatV90(req,res){
  const started=Date.now();
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const intelligencePlan=planUniversalIntelligence(body);
  const latencyPlan=planLatencyV90(body,intelligencePlan);
  setHeaders(res,latencyPlan,'planning');

  if(req.method!=='POST')return delegateMeasured(capacityChatV89,req,res,started,'method-delegated-v89');
  applyHeaders(res);
  if(!originAllowed(req)){
    record(started,res,'origin-denied',false);
    return res.status(403).json({error:'origin_not_allowed'});
  }

  if(hasExplicitContinuityProvider(body)){
    setHeaders(res,latencyPlan,'explicit-continuity-direct');
    return baseCapacityChatHandler(req,res);
  }

  if(hasExplicitProvider(body)){
    setHeaders(res,latencyPlan,'explicit-provider-v89');
    return delegateMeasured(capacityChatV89,req,res,started,'explicit-provider-v89');
  }

  if(latencyPlan.profile==='bypass'){
    setHeaders(res,latencyPlan,'direct-v89-bypass');
    return delegateMeasured(capacityChatV89,req,res,started,'direct-v89-bypass');
  }

  const key=userKey(req,body);
  const slot=tryAcquireChatSlot(`${key}:v90`.slice(0,180));
  if(!slot.ok){
    const retry=Math.max(1,Math.ceil(slot.retryAfterMs/1000));
    res.setHeader('Retry-After',String(retry));
    record(started,res,'capacity-busy',false);
    return res.status(503).json({error:'CAPACITY_BUSY',message:'Universal Core está procesando otra tarea intensiva. Reintenta en breve.',recoverable:true,retry_after_ms:slot.retryAfterMs});
  }

  try{
    if(shouldAttemptFastFactualV90(latencyPlan)){
      const winner=await hedgedVerifiedFastPath({body,intelligencePlan,latencyPlan,key});
      if(winner?.payload){
        const path=winner.kind==='fast'?'fast-factual-v90':'parallel-fusion-v90';
        setHeaders(res,latencyPlan,path);
        res.setHeader('X-WAE-Latency-Hedge',winner.kind==='fast'?'focused-won-v94':'fusion-won-v94');
        if(winner.kind==='fusion')res.setHeader('X-WAE-Knowledge-Fusion',KNOWLEDGE_FUSION_V90);
        res.setHeader('X-WAE-Factuality-Status','PASS');
        record(started,res,`hedged-${winner.kind}-v94`,true);
        return res.status(200).json(winner.payload);
      }
    }else{
      const fusion=await tryFusion(body,intelligencePlan,latencyPlan,key);
      if(fusion){
        setHeaders(res,latencyPlan,'parallel-fusion-v90');
        res.setHeader('X-WAE-Knowledge-Fusion',KNOWLEDGE_FUSION_V90);
        res.setHeader('X-WAE-Factuality-Status','PASS');
        record(started,res,'parallel-fusion-v90',true);
        return res.status(200).json(fusion);
      }
    }
  }finally{
    slot.release();
  }

  setHeaders(res,latencyPlan,'v89-fallback');
  return delegateMeasured(capacityChatV89,req,res,started,'v89-fallback');
}

// Keep the fusion primitive physically below provider/continuity bypass and
// concurrency admission. Besides preserving the architectural invariant, this
// makes it impossible for a future refactor to execute fusion before those gates.
async function tryFusion(body,intelligencePlan,latencyPlan,key){
  const v90Body={...body,universal_knowledge:true,knowledge:true,fusion:true,...(latencyPlan.profile==='live_current'?{web_enabled:true}:{})};
  const fusion=await runKnowledgeFusionV90({body:v90Body,plan:intelligencePlan,userKey:key,sessionId:String(body.sessionId||body.session_id||body.conversationId||body.conversation_id||'').slice(0,500)}).catch(()=>null);
  if(!fusion?.accepted||!fusion.payload)return null;
  return decorate(fusion.payload,latencyPlan,'parallel-fusion-v90');
}

export function capacityChatV90Capabilities(){
  return{
    release:CAPACITY_CHAT_V90,
    latencyCore:LATENCY_CORE_V94,
    latency:latencyGovernorCapabilitiesV90(),
    knowledgeExpansion:knowledgeExpansionCapabilitiesV90(),
    knowledgeFusion:KNOWLEDGE_FUSION_V90,
    policy:{explicitContinuityProviderDirect:true,explicitProviderBypassesAutomaticPlanner:true,fastVerifiedFacts:true,hedgedVerifiedFastPath:true,hedgeDelayMs:hedgeDelayMs(),directBypassWithoutResearchAdmission:true,parallelEvidence:true,parallelMultiagent:true,abortExpiredFocusedRetrieval:true,verifyBeforeAcceptPreserved:true,qualityGatePreserved:true,externalBenchmarkRequiredForSuperiorityClaim:true,superiorityClaim:false}
  };
}
