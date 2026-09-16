import capacityChatV84 from './capacity-chat-v84.js';
import { applyAnswerIntelligence, ANSWER_INTELLIGENCE_VERSION } from '../lib/answer-intelligence-v60.js';
import { applyQualityReliability, QUALITY_RELIABILITY_VERSION } from '../lib/quality-reliability-v61.js';
import { runFocusedFactualAnswer, focusedFactualEligible, FOCUSED_FACTUAL_VERSION } from '../lib/knowledge/focused-factual-v83.js';
import { runKnowledgeAnswer, KNOWLEDGE_ANSWER_VERSION } from '../lib/knowledge/knowledge-answer-v1.js';
import { classifyFactualityRequest, factualityDecision, factualityHoldText, FACTUALITY_GATE_VERSION } from '../lib/factuality-gate-v86.js';
import { buildPremiumRepairBodyV100, premiumRepairDecisionV100, publicPremiumRepairV100, PREMIUM_RESPONSE_REPAIR_V100 } from '../lib/premium-response-repair-v100.js';

export const CAPACITY_CHAT_V86='capacity-chat/v86-verify-before-accept';

const SCIENTIFIC_RX=/\b(m[eé]dic|salud|farmacol|biolog|gen[eé]tic|f[ií]sic|qu[ií]mic|cient[ií]fic|paper|estudio|evidencia cl[ií]nica|meta.?an[aá]lisis|pubmed|arxiv)\b/i;

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

async function callV84(req,res,body){
  const previous=req.body;
  req.body=body;
  const buffered=bufferedResponse(res);
  try{await capacityChatV84(req,buffered.proxy)}finally{req.body=previous}
  return{code:buffered.code,payload:buffered.payload,hasJson:buffered.hasJson};
}

function verifyPayload(payload={},body={}){
  let next=applyAnswerIntelligence(payload);
  next=applyQualityReliability(next,{prompt:body.message||body.task||body.prompt||''});
  return next;
}

function decorate(payload={},decision={},path='accepted'){
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    accuracy_verified:decision.accept===true,
    factuality_gate:{
      version:FACTUALITY_GATE_VERSION,
      status:decision.accept===true?'PASS':'HOLD',
      path,
      reasons:decision.reasons||[],
      source_count:decision.source_count||0,
      citation_coverage:decision.citation_coverage??null,
      upstream_gate:decision.upstream_gate||null,
      profile:decision.profile
    },
    response:{
      ...response,
      metadata:{
        ...(response.metadata||{}),
        factualityGate:{
          version:FACTUALITY_GATE_VERSION,
          status:decision.accept===true?'PASS':'HOLD',
          path,
          reasons:decision.reasons||[],
          sourceCount:decision.source_count||0,
          citationCoverage:decision.citation_coverage??null,
          upstreamGate:decision.upstream_gate||null
        }
      }
    }
  };
}

function decoratePremiumRepair(payload={},repairState={}){
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    premium_response_repair:repairState,
    response:{
      ...response,
      metadata:{...(response.metadata||{}),premiumResponseRepair:repairState}
    }
  };
}

function holdPayload(payload={},decision={}){
  const reply=factualityHoldText(decision);
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  const held={
    ...payload,
    success:true,
    reply,
    speech_text:reply,
    components:[],
    actions:[],
    degraded:true,
    accuracy_verified:false,
    blocked_inaccurate_answer:true,
    provider:'universal_core',
    model:FACTUALITY_GATE_VERSION,
    response:{
      ...response,
      content:reply,
      speechText:reply,
      components:[],
      actions:[],
      metadata:{...(response.metadata||{}),degraded:true,blockedInaccurateAnswer:true}
    }
  };
  return decorate(held,decision,'fail-closed');
}

async function withTimeout(promise,ms){
  let timer;
  const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve(null),ms)});
  try{return await Promise.race([promise,timeout])}finally{if(timer)clearTimeout(timer)}
}

async function focusedRepair(body){
  if(!focusedFactualEligible(body))return null;
  const timeout=Math.max(2500,Math.min(9000,Number(process.env.WAE_V86_FOCUSED_TIMEOUT_MS||6000)));
  return withTimeout(runFocusedFactualAnswer({body}),timeout);
}

async function knowledgeRepair(body,userKey){
  const timeout=Math.max(4000,Math.min(15000,Number(process.env.WAE_V86_KNOWLEDGE_TIMEOUT_MS||9000)));
  return withTimeout(runKnowledgeAnswer({body:{...body,mode:'research',knowledge:true,web_enabled:false,provider:'auto'},userKey}),timeout);
}

async function forcedResearchRepair(req,res,body){
  const researchBody={
    ...body,
    mode:'research',
    web_enabled:true,
    provider:'auto',
    factuality_repair:true,
    disable_gpu_fabric:true
  };
  return callV84(req,res,researchBody);
}

async function premiumInstructionRepair(req,res,body,repairPlan){
  const repairBody=buildPremiumRepairBodyV100(body,repairPlan);
  const timeout=Math.max(2500,Math.min(12000,Number(process.env.WAE_V100_PREMIUM_REPAIR_TIMEOUT_MS||7000)));
  return withTimeout(callV84(req,res,repairBody),timeout);
}

function setHeaders(res,status,path){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V86);
  res.setHeader('X-WAE-Factuality-Gate',FACTUALITY_GATE_VERSION);
  res.setHeader('X-WAE-Answer-Intelligence',ANSWER_INTELLIGENCE_VERSION);
  res.setHeader('X-WAE-Quality-Reliability',QUALITY_RELIABILITY_VERSION);
  res.setHeader('X-WAE-Premium-Repair',PREMIUM_RESPONSE_REPAIR_V100);
  res.setHeader('X-WAE-Factuality-Status',status);
  if(path)res.setHeader('X-WAE-Factuality-Path',path);
}

export default async function capacityChatV86(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const first=await callV84(req,res,body);
  if(res.writableEnded||!first.hasJson)return;
  if(first.code>=400||!first.payload||typeof first.payload!=='object'||!replyOf(first.payload)){
    setHeaders(res,'BYPASS','upstream-error');
    return res.status(first.code||503).json(first.payload||{error:'EMPTY_UPSTREAM_RESPONSE',recoverable:true});
  }

  let candidate=verifyPayload(first.payload,body);
  let decision=factualityDecision(candidate,body);
  const profile=classifyFactualityRequest(body);
  const premiumRepairPlan=premiumRepairDecisionV100(candidate,body);
  if(decision.accept&&!premiumRepairPlan.attempt){
    setHeaders(res,'PASS','upstream-verified');
    return res.status(first.code).json(decorate(candidate,decision,'upstream-verified'));
  }

  if(premiumRepairPlan.attempt&&!profile.requires_verification){
    try{
      const repair=await premiumInstructionRepair(req,res,body,premiumRepairPlan);
      if(repair?.hasJson&&repair.code<400&&replyOf(repair.payload)){
        const verified=verifyPayload(repair.payload,body);
        const repairedDecision=factualityDecision(verified,body);
        const secondPlan=premiumRepairDecisionV100(verified,{...body,quality_repair_v100:true});
        if(repairedDecision.accept&&secondPlan.instructionBlockers.length===0){
          const repairState=publicPremiumRepairV100(premiumRepairPlan,'accepted');
          setHeaders(res,'PASS','premium-instruction-repair-v100');
          return res.status(200).json(decorate(decoratePremiumRepair({...verified,degraded:false},repairState),repairedDecision,'premium-instruction-repair-v100'));
        }
        candidate=verified;
        decision=repairedDecision;
      }
    }catch{}
  }

  const userKey=String(body.userKey||body.sessionId||body.session_id||'anonymous').slice(0,160);

  if(profile.preferred_repair==='focused_factual'){
    try{
      const focused=await focusedRepair(body);
      if(focused&&replyOf(focused)){
        const verified=verifyPayload(focused,body);
        const focusedDecision=factualityDecision(verified,body);
        if(focusedDecision.accept){
          setHeaders(res,'PASS','focused-factual');
          res.setHeader('X-WAE-Factual-Recovery',FOCUSED_FACTUAL_VERSION);
          return res.status(200).json(decorate({...verified,degraded:false},focusedDecision,'focused-factual'));
        }
      }
    }catch{}
  }

  try{
    const research=await forcedResearchRepair(req,res,body);
    if(research.hasJson&&research.code<400&&replyOf(research.payload)){
      const verified=verifyPayload(research.payload,body);
      const researchDecision=factualityDecision(verified,{...body,mode:'research',web_enabled:true});
      if(researchDecision.accept){
        setHeaders(res,'PASS','forced-research');
        return res.status(200).json(decorate(verified,researchDecision,'forced-research'));
      }
      candidate=verified;
      decision=researchDecision;
    }
  }catch{}

  if((profile.research||profile.high_risk||SCIENTIFIC_RX.test(profile.message||''))&&!profile.current){
    try{
      const knowledge=await knowledgeRepair(body,userKey);
      if(knowledge&&replyOf(knowledge)){
        const verified=verifyPayload(knowledge,body);
        const knowledgeDecision=factualityDecision(verified,{...body,mode:'research'});
        if(knowledgeDecision.accept){
          setHeaders(res,'PASS','knowledge-evidence');
          res.setHeader('X-WAE-Knowledge-Answer',KNOWLEDGE_ANSWER_VERSION);
          return res.status(200).json(decorate({...verified,degraded:false},knowledgeDecision,'knowledge-evidence'));
        }
        candidate=verified;
        decision=knowledgeDecision;
      }
    }catch{}
  }

  setHeaders(res,'HOLD','fail-closed');
  return res.status(200).json(holdPayload(candidate,decision));
}
