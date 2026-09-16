import capacityChatV89 from './capacity-chat-v89.js';
import { planUniversalIntelligence } from '../lib/universal-intelligence-planner-v87.js';
import { runFocusedFactualAnswer } from '../lib/knowledge/focused-factual-v83.js';
import { applyAnswerIntelligence } from '../lib/answer-intelligence-v60.js';
import { applyQualityReliability } from '../lib/quality-reliability-v61.js';
import { factualityDecision, FACTUALITY_GATE_VERSION } from '../lib/factuality-gate-v86.js';
import { planLatencyV90, publicLatencyPlanV90, shouldAttemptFastFactualV90, withinLatencyBudget, fetchWithParentSignal, latencyGovernorCapabilitiesV90, LATENCY_GOVERNOR_VERSION } from '../lib/latency-governor-v90.js';
import { runKnowledgeFusionV90, KNOWLEDGE_FUSION_V90 } from '../lib/knowledge-fusion-v90.js';
import { knowledgeExpansionCapabilitiesV90, KNOWLEDGE_EXPANSION_VERSION } from '../lib/knowledge-expansion-v90.js';
import { applyHeaders, originAllowed, getClientIp } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';

export const CAPACITY_CHAT_V90='capacity-chat/v90.1-latency-autonomous-knowledge';

function setHeaders(res,latencyPlan,path='fallback'){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V90);
  res.setHeader('X-WAE-Latency-Governor',LATENCY_GOVERNOR_VERSION);
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
    runtime_control:{...(payload.runtime_control||{}),release:CAPACITY_CHAT_V90,path,latency_governor:LATENCY_GOVERNOR_VERSION,profile:latencyPlan.profile},
    response:{...response,metadata:{...(response.metadata||{}),latencyGovernor:publicPlan,chatRelease:CAPACITY_CHAT_V90,latencyPath:path}}
  };
}

function userKey(req,body={}){
  return String(body.userKey||body.user_id||body.userId||body.sessionId||body.session_id||getClientIp(req)||'anonymous').slice(0,500);
}

function hasExplicitProvider(body={}){
  const provider=String(body.provider||'').trim().toLowerCase();
  return Boolean(provider&&provider!=='auto');
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

export default async function capacityChatV90(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const intelligencePlan=planUniversalIntelligence(body);
  const latencyPlan=planLatencyV90(body,intelligencePlan);
  setHeaders(res,latencyPlan,'planning');

  if(req.method!=='POST')return capacityChatV89(req,res);
  applyHeaders(res);
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});

  // Explicit provider selection is a caller contract. Do not spend time in the
  // automatic v90 retrieval/fusion planner before honoring that choice.
  if(hasExplicitProvider(body)){
    setHeaders(res,latencyPlan,'explicit-provider-v89');
    return capacityChatV89(req,res);
  }

  if(latencyPlan.profile==='bypass'){
    setHeaders(res,latencyPlan,'direct-v89-bypass');
    return capacityChatV89(req,res);
  }

  const key=userKey(req,body);
  const slot=tryAcquireChatSlot(`${key}:v90`.slice(0,180));
  if(!slot.ok){
    const retry=Math.max(1,Math.ceil(slot.retryAfterMs/1000));
    res.setHeader('Retry-After',String(retry));
    return res.status(503).json({error:'CAPACITY_BUSY',message:'Universal Core está procesando otra tarea intensiva. Reintenta en breve.',recoverable:true,retry_after_ms:slot.retryAfterMs});
  }

  try{
    if(shouldAttemptFastFactualV90(latencyPlan)){
      const fast=await tryFastFactual(body,latencyPlan).catch(()=>null);
      if(fast){
        setHeaders(res,latencyPlan,'fast-factual-v90');
        res.setHeader('X-WAE-Factuality-Status','PASS');
        return res.status(200).json(fast);
      }
    }

    const v90Body={...body,universal_knowledge:true,knowledge:true,fusion:true,...(latencyPlan.profile==='live_current'?{web_enabled:true}:{})};
    const fusion=await runKnowledgeFusionV90({body:v90Body,plan:intelligencePlan,userKey:key,sessionId:String(body.sessionId||body.session_id||body.conversationId||body.conversation_id||'').slice(0,500)}).catch(()=>null);
    if(fusion?.accepted&&fusion.payload){
      setHeaders(res,latencyPlan,'parallel-fusion-v90');
      res.setHeader('X-WAE-Knowledge-Fusion',KNOWLEDGE_FUSION_V90);
      res.setHeader('X-WAE-Factuality-Status','PASS');
      return res.status(200).json(decorate(fusion.payload,latencyPlan,'parallel-fusion-v90'));
    }
  }finally{
    slot.release();
  }

  setHeaders(res,latencyPlan,'v89-fallback');
  return capacityChatV89(req,res);
}

export function capacityChatV90Capabilities(){
  return{
    release:CAPACITY_CHAT_V90,
    latency:latencyGovernorCapabilitiesV90(),
    knowledgeExpansion:knowledgeExpansionCapabilitiesV90(),
    knowledgeFusion:KNOWLEDGE_FUSION_V90,
    policy:{explicitProviderBypassesAutomaticPlanner:true,fastVerifiedFacts:true,directBypassWithoutResearchAdmission:true,parallelEvidence:true,parallelMultiagent:true,abortExpiredFocusedRetrieval:true,verifyBeforeAcceptPreserved:true,externalBenchmarkRequiredForSuperiorityClaim:true,superiorityClaim:false}
  };
}
