import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';
import { normalizeUserIntent } from '../lib/input-intelligence.js';
import { tryAcquireChatSlot } from '../lib/concurrency-governor.js';
import { runExecutiveOrchestration, EXECUTIVE_ORCHESTRATION_VERSION, EXECUTIVE_RESILIENCE_VERSION } from '../lib/executive-orchestration-v52.js';
import { ORCHESTRATOR_VERSION } from '../lib/orchestrator.js';
import { runWithRequestSignal } from '../lib/network-deadlines-v46.js';
import { callIaGratisChat, iaGratisConfigured, IA_GRATIS_PROVIDER_VERSION } from '../lib/ia-gratis-v84.js';

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

function externalExecutiveRecoveryAllowed(body={}){
  if(!iaGratisConfigured()||body.disable_external_recovery===true)return false;
  if(body.sensitive===true||body.sensitive_data===true||body.contains_sensitive_data===true)return false;
  const sensitivity=String(body.sensitivity||body.data_sensitivity||body.classification||'').toUpperCase();
  if(/PRIVATE|CONFIDENTIAL|SECRET|RESTRICTED|SENSITIVE|PII|PHI/.test(sensitivity))return false;
  if(Array.isArray(body.attachments)&&body.attachments.length>0)return false;
  const mode=String(body.mode||body.agent||'general').toLowerCase();
  const q=String(body.message||body.task||'').toLowerCase();
  if(body.web_enabled===true||mode==='research'||/\b(latest|today|currently|current|news|price|hoy|actual|noticias|precio|cotizaci[oó]n|ley vigente|jurisprudencia reciente)\b/.test(q))return false;
  return true;
}

async function runIaGratisExecutiveRecovery({body={},message='',reason='orchestration_unavailable'}={}){
  if(!externalExecutiveRecoveryAllowed(body))return null;
  const started=Date.now();
  const generated=await callIaGratisChat({
    system:'Eres Universal Core en modo de recuperación ejecutiva. Responde directamente a la solicitud con criterio senior, precisión y utilidad. No inventes acciones ejecutadas, fuentes ni datos actuales. No menciones proveedores, modelos, rutas internas ni esta recuperación.',
    message,
    history:Array.isArray(body.history)?body.history:[],
  });
  const reply=String(generated.reply||'').trim();
  if(!reply)return null;
  const latencyMs=Date.now()-started;
  return{
    success:true,
    reply,
    response:{
      content:reply,
      metadata:{
        executiveOrchestration:true,
        degraded:true,
        recovery:'ia-gratis-v84',
        recoveryReason:String(reason||'orchestration_unavailable').slice(0,120),
        resilience:IA_GRATIS_PROVIDER_VERSION,
        latencyMs,
      },
    },
    speech_text:reply,
    components:[],
    actions:[],
    provider:'ia_gratis',
    model:generated.model,
    web_sources:[],
    degraded:true,
    latencyMs,
    deep:true,
    orchestration:{
      version:'executive-recovery/v84',
      db_backed:false,
      active_agent_instances:0,
      executive_roles:0,
      collaboration_edges:0,
      strategy:'bounded-single-provider-executive-recovery',
      roles:['Universal Core Recovery'],
      max_specialists:1,
      specialists:[{role:'Universal Core Recovery',ok:true,latencyMs,evidence_count:0,error:null}],
      synthesis:'Universal Core',
      resilience:IA_GRATIS_PROVIDER_VERSION,
    },
    evidence_router:{degraded:true,routes:[]},
    library:{degraded:true},
  };
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

  const sendResult=(result,recovery=false)=>{
    res.setHeader('X-WAE-Multi-Agent',recovery?'degraded-executive-recovery-v84':'database-backed-v52');
    res.setHeader('X-WAE-Orchestrator',ORCHESTRATOR_VERSION);
    res.setHeader('X-WAE-Orchestrator-Implementation',EXECUTIVE_ORCHESTRATION_VERSION);
    res.setHeader('X-WAE-Executive-Resilience',recovery?IA_GRATIS_PROVIDER_VERSION:EXECUTIVE_RESILIENCE_VERSION);
    if(recovery)res.setHeader('X-WAE-Executive-Recovery','ia-gratis-v84');
    return res.status(200).json(publicOrchestrationResult(result,intent));
  };

  try{
    const signal=AbortSignal.timeout(Number(process.env.WAE_ORCHESTRATION_DEADLINE_MS||24_000));
    const result=await runWithRequestSignal(signal,()=>runExecutiveOrchestration({body:{...body,message,multiagent:true,deep:true},userKey:rootKey,sessionId}));
    if(result)return sendResult(result,false);
    try{
      const recovered=await runIaGratisExecutiveRecovery({body:{...body,message},message,reason:'orchestration_unavailable'});
      if(recovered)return sendResult(recovered,true);
    }catch{}
    return res.status(503).json({error:'orchestration_unavailable',message:'El registro ejecutivo no estuvo disponible para este turno.',recoverable:true});
  }catch(error){
    try{
      const recovered=await runIaGratisExecutiveRecovery({body:{...body,message},message,reason:error?.message||'deep_orchestration_failed'});
      if(recovered)return sendResult(recovered,true);
    }catch{}
    return res.status(503).json({error:'deep_orchestration_failed',message:'El comité liberó el turno antes de quedar bloqueado. Puedes reintentarlo.',recoverable:true,detail:String(error?.message||error).slice(0,180)});
  }finally{
    slot.release();
  }
}
