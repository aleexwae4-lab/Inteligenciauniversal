import capacityChatV87 from './capacity-chat-v87.js';
import { planUniversalIntelligence, publicUniversalIntelligencePlan } from '../lib/universal-intelligence-planner-v87.js';
import { shouldFuseUniversalKnowledge, runKnowledgeFusion, KNOWLEDGE_FUSION_VERSION } from '../lib/knowledge-fusion-v88.js';
import { OPEN_SOURCE_CAPABILITY_MESH_VERSION } from '../lib/open-source-capability-mesh-v88.js';
import { applyHeaders, originAllowed, allowRequest, getClientIp } from '../lib/security.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';

export const CAPACITY_CHAT_V88='capacity-chat/v88-knowledge-fusion-open-source-mesh';

function setHeaders(res,plan={},fusion=false){
  res.setHeader('X-WAE-Chat-Release',CAPACITY_CHAT_V88);
  res.setHeader('X-WAE-Knowledge-Fusion',fusion?KNOWLEDGE_FUSION_VERSION:'bypass');
  res.setHeader('X-WAE-Open-Source-Mesh',OPEN_SOURCE_CAPABILITY_MESH_VERSION);
  res.setHeader('X-WAE-Intelligence-Route',String(plan.route||'standard'));
}

function decorate(payload={},plan={},fusion=null){
  if(!payload||typeof payload!=='object')return payload;
  const publicPlan=publicUniversalIntelligencePlan(plan);
  const response=payload.response&&typeof payload.response==='object'?payload.response:{};
  return{
    ...payload,
    intelligence_plan:publicPlan,
    ...(fusion?{knowledge_fusion:fusion}:{}),
    response:{
      ...response,
      metadata:{
        ...(response.metadata||{}),
        universalIntelligencePlanner:publicPlan,
        ...(fusion?{knowledgeFusion:fusion}:{})
      }
    }
  };
}

export default async function capacityChatV88(req,res){
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const plan=planUniversalIntelligence(body);
  const fusionIntent=shouldFuseUniversalKnowledge(body,plan);
  if(!fusionIntent){
    setHeaders(res,plan,false);
    return capacityChatV87(req,res);
  }

  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_FUSION_RATE_LIMIT_PER_MINUTE||8)))return res.status(429).json({error:'fusion_rate_limited'});

  const userKey=String(body.userKey||body.user_id||body.userId||body.sessionId||body.session_id||getClientIp(req)).slice(0,500);
  const sessionId=String(body.sessionId||body.session_id||body.conversationId||body.conversation_id||'').slice(0,500);
  const slot=tryAcquireChatSlot(`${userKey}:fusion`.slice(0,180));
  if(!slot.ok){
    const retry=Math.max(1,Math.ceil(slot.retryAfterMs/1000));
    res.setHeader('Retry-After',String(retry));
    return res.status(503).json({error:'CAPACITY_BUSY',message:'Universal Core está fusionando múltiples fuentes de conocimiento. El turno puede reintentarse.',recoverable:true,retry_after_ms:slot.retryAfterMs});
  }

  try{
    const fusion=await runKnowledgeFusion({body,plan,userKey,sessionId});
    if(fusion?.accepted&&fusion.payload){
      setHeaders(res,plan,true);
      res.setHeader('X-WAE-Factuality-Status','PASS');
      res.setHeader('X-WAE-Factuality-Path','knowledge-fusion-v88');
      return res.status(200).json(decorate(fusion.payload,plan,fusion.payload.knowledge_fusion));
    }
  }catch(error){
    console.warn('[Knowledge Fusion v88]',String(error?.message||error).slice(0,240));
  }finally{
    slot.release();
  }

  setHeaders(res,plan,false);
  return capacityChatV87(req,res);
}
