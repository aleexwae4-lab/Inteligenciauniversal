import { classifyUniversalKnowledge } from './universal-knowledge-mesh-v89.js';
import { classifyFactualityRequest } from './factuality-gate-v86.js';

export const LATENCY_GOVERNOR_VERSION='latency-governor/v90';
export const LATENCY_GOVERNOR_SCHEMA='universal-latency-plan/v1';

const text=(value,max=6000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const DEEP_RX=/\b(profund|exhaustiv|investiga|investigacion|benchmark|estado del arte|multiagente|comite|audita|arquitectura completa|plan estrategico|evidencia cientifica|revision sistematica|meta.?analisis)\b/i;
const MEMORY_RX=/\b(recuerda|memoria|conversacion anterior|lo que te dije|mis documentos|mis archivos)\b/i;
const CASUAL_RX=/^(hola|hey|buen(?:os|as)?\s+(?:dias|tardes|noches)|gracias|ok|vale|perfecto)[.!?\s]*$/i;

const PROFILES=Object.freeze({
  bypass:{
    target_class:'ordinary_chat',focused_timeout_ms:0,live_timeout_ms:0,library_timeout_ms:0,knowledge_timeout_ms:0,memory_timeout_ms:0,multiagent_timeout_ms:0,max_sources:0,per_source:0,record_limit:0
  },
  fast_factual:{
    target_class:'fast_verified_fact',focused_timeout_ms:2200,live_timeout_ms:0,library_timeout_ms:2400,knowledge_timeout_ms:3000,memory_timeout_ms:1500,multiagent_timeout_ms:0,max_sources:3,per_source:2,record_limit:8
  },
  standard_factual:{
    target_class:'verified_fact',focused_timeout_ms:0,live_timeout_ms:3800,library_timeout_ms:3200,knowledge_timeout_ms:4600,memory_timeout_ms:1800,multiagent_timeout_ms:0,max_sources:4,per_source:3,record_limit:10
  },
  live_current:{
    target_class:'fresh_verified_fact',focused_timeout_ms:0,live_timeout_ms:4800,library_timeout_ms:3000,knowledge_timeout_ms:4400,memory_timeout_ms:1800,multiagent_timeout_ms:0,max_sources:4,per_source:3,record_limit:10
  },
  deep_research:{
    target_class:'deep_evidence_synthesis',focused_timeout_ms:0,live_timeout_ms:6500,library_timeout_ms:4800,knowledge_timeout_ms:6800,memory_timeout_ms:2500,multiagent_timeout_ms:8500,max_sources:6,per_source:4,record_limit:14
  },
  executive:{
    target_class:'parallel_executive_synthesis',focused_timeout_ms:0,live_timeout_ms:6000,library_timeout_ms:4500,knowledge_timeout_ms:6200,memory_timeout_ms:2400,multiagent_timeout_ms:8000,max_sources:5,per_source:4,record_limit:12
  }
});

export function planLatencyV90(body={},intelligencePlan={}){
  const message=text(body.message||body.task||body.prompt||body.query||'');
  const q=norm(message);
  const knowledge=classifyUniversalKnowledge(body);
  const factual=classifyFactualityRequest(body);
  const attachments=Array.isArray(body.attachments)&&body.attachments.length>0;
  const memory=body.memory===true||MEMORY_RX.test(q);
  const multiagent=intelligencePlan?.needs?.multiagent===true||body.multiagent===true||body.orchestrate===true;
  const deep=body.deep===true||String(body.mode||'').toLowerCase()==='research'||DEEP_RX.test(q);
  const casual=CASUAL_RX.test(q);
  let profile='bypass';
  if(!casual&&knowledge.eligible){
    if(multiagent)profile='executive';
    else if(factual.current)profile='live_current';
    else if(deep||factual.research||attachments||memory)profile='deep_research';
    else if(factual.precise_fact&&message.length<=260&&!factual.high_risk)profile='fast_factual';
    else profile='standard_factual';
  }
  const budgets=PROFILES[profile];
  return{
    schema:LATENCY_GOVERNOR_SCHEMA,
    version:LATENCY_GOVERNOR_VERSION,
    profile,
    budgets:{...budgets},
    signals:{knowledge:knowledge.eligible,current:factual.current,research:factual.research,precise_fact:factual.precise_fact,high_risk:factual.high_risk,attachments,memory,multiagent,deep,casual},
    policy:{parallelEvidence:true,parallelMultiagent:true,fastFactualPrimary:true,qualityGatePreserved:true,verificationPreserved:true,timeoutIsBudgetNotAccuracyOverride:true},
    comparative_claim:{status:'UNVERIFIED',requiresExternalBenchmark:true}
  };
}

export function shouldAttemptFastFactualV90(plan={}){
  return plan?.profile==='fast_factual'&&Number(plan?.budgets?.focused_timeout_ms||0)>0;
}

export async function withinLatencyBudget(ms,factory){
  const budget=Math.max(25,Number(ms)||25);
  let timer;
  const controller=new AbortController();
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>{controller.abort(new Error('latency_budget_exceeded'));resolve(null)},budget)});
  try{return await Promise.race([Promise.resolve().then(()=>factory(controller.signal)),timeout])}
  finally{if(timer)clearTimeout(timer)}
}

export function fetchWithParentSignal(parentSignal,baseFetch=fetch){
  return (url,init={})=>{
    const child=init?.signal;
    let signal=parentSignal;
    if(child&&parentSignal){
      if(typeof AbortSignal.any==='function')signal=AbortSignal.any([child,parentSignal]);
      else signal=child.aborted?child:parentSignal;
    }else if(child)signal=child;
    return baseFetch(url,{...init,signal});
  };
}

export function publicLatencyPlanV90(plan={}){
  return{version:plan.version||LATENCY_GOVERNOR_VERSION,profile:plan.profile||'bypass',target_class:plan?.budgets?.target_class||'ordinary_chat',budgets:plan.budgets||{},policy:plan.policy||{}};
}

export function latencyGovernorCapabilitiesV90(){
  return{
    version:LATENCY_GOVERNOR_VERSION,
    schema:LATENCY_GOVERNOR_SCHEMA,
    profiles:Object.keys(PROFILES),
    fastFactualPrimary:true,
    parallelEvidence:true,
    parallelMultiagent:true,
    preservesVerifyBeforeAccept:true,
    measuredProductionAdvantage:false,
    comparativeCertificationRequired:true,
    targetPolicy:{fast_lane_p95_ms:3000,stream_ttft_ceiling_ms:2500,quality_regression_allowed:false},
    superiorityClaim:false
  };
}
