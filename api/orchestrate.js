import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';
import { normalizeUserIntent } from '../lib/input-intelligence.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';
import { runExecutiveOrchestration, EXECUTIVE_ORCHESTRATION_VERSION, EXECUTIVE_RESILIENCE_VERSION } from '../lib/executive-orchestration-v52.js';
import { ORCHESTRATOR_VERSION } from '../lib/orchestrator.js';
import { runWithRequestSignal } from '../lib/network-deadlines-v46.js';

export function publicResponse(response={}){
  const metadata={...(response.metadata||{})};
  delete metadata.provider;delete metadata.model;
  return{...response,metadata};
}

export function publicOrchestrationResult(result={},intent={}){
  const internal=result.orchestration||{};
  const specialists=Array.isArray(internal.specialists)?internal.specialists:[];
  const orchestration={
    ...internal,
    schema:ORCHESTRATOR_VERSION,
    implementationVersion:EXECUTIVE_ORCHESTRATION_VERSION,
    synthesis:'executive',
    synthesisStatus:internal.synthesis||null,
    specialists
  };
  const payload={
    ...result,
    orchestration,
    response:publicResponse(result.response||{}),
    input_interpretation:intent.changed?{normalized:true,domain:intent.domain,confidence:intent.confidence,corrections:intent.corrections}:undefined,
    agent:{id:'universal-executive-committee',name:'Universal Core Executive Committee'}
  };
  delete payload.provider;delete payload.model;delete payload.fallbackFailures;
  return payload;
}

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req,Number(process.env.WAE_DEEP_RATE_LIMIT_PER_MINUTE||6)))return res.status(429).json({error:'deep_rate_limited'});

  const body=req.body||{};
  const rawMessage=String(body.message||body.task||'').trim();
  if(!rawMessage)return res.status(400).json({error:'message_required'});
  if(rawMessage.length>30000)return res.status(413).json({error:'message_too_large'});
  const intent=normalizeUserIntent(rawMessage);
  const message=intent.changed?intent.text:rawMessage;
  const sessionId=String(body.sessionId||body.session_id||'').slice(0,160);
  const rootKey=String(body.userKey||sessionId||getClientIp(req)).slice(0,160);
  const slot=tryAcquireChatSlot(`${rootKey}:orchestrate`.slice(0,160));
  if(!slot.ok){
    res.setHeader('Retry-After',String(Math.max(1,Math.ceil(slot.retryAfterMs/1000))));
    return res.status(503).json({error:'CAPACITY_BUSY',message:'El comité ejecutivo está absorbiendo una ráfaga de concurrencia. La misión fue rechazada de forma controlada antes de quedar bloqueada.',recoverable:true,retry_after_ms:slot.retryAfterMs});
  }

  try{
    const signal=AbortSignal.timeout(Number(process.env.WAE_ORCHESTRATION_DEADLINE_MS||24_000));
    const result=await runWithRequestSignal(signal,()=>runExecutiveOrchestration({body:{...body,message,multiagent:true,deep:true},userKey:rootKey,sessionId}));
    if(!result)return res.status(503).json({error:'orchestration_unavailable',message:'El registro ejecutivo no estuvo disponible para este turno.',recoverable:true});
    res.setHeader('X-WAE-Multi-Agent','database-backed-v52');
    res.setHeader('X-WAE-Orchestrator',ORCHESTRATOR_VERSION);
    res.setHeader('X-WAE-Orchestrator-Implementation',EXECUTIVE_ORCHESTRATION_VERSION);
    res.setHeader('X-WAE-Executive-Resilience',EXECUTIVE_RESILIENCE_VERSION);
    return res.status(200).json(publicOrchestrationResult(result,intent));
  }catch(error){
    return res.status(503).json({error:'deep_orchestration_failed',message:'El comité liberó el turno antes de quedar bloqueado. Puedes reintentarlo.',recoverable:true,detail:String(error?.message||error).slice(0,180)});
  }finally{
    slot.release();
  }
}
