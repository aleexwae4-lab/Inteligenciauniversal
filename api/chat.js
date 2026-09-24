import { executeMission } from '../lib/runtime.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';
import { rescueMission } from '../lib/intelligence-rescue.js';
import { emergencyGenerate } from '../lib/emergency-generation-v49.js';
import { assuranceRecoveryPlanV101, buildBoundedContinuityV101, markAssuredPayloadV101 } from '../lib/answer-assurance-v101.js';
import { normalizeUserIntent } from '../lib/input-intelligence.js';
import { selectProviderRoute, observeProviderOutcome } from '../lib/provider-mesh.js';
import { councilEligible, deliberateMission } from '../lib/deliberation-plane.js';
import { runWithRequestSignal } from '../lib/network-deadlines-v46.js';
import { userContextStateV92 } from '../lib/user-context-v92.js';
import { classifySelfAwarenessV99, buildSelfAwarenessReplyV99, selfAwarenessSnapshotV99 } from '../lib/self-awareness-v99.js';
import { contextualFollowupV103 } from '../lib/context-integrity-v103.js';

function normalizeFastPath(value='') {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[¿?¡!.,;:]+/g,' ')
    .replace(/\s+/g,' ').trim();
}

function canonicalProtocolPrompt(value='') {
  const q=normalizeFastPath(value);
  if (/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches)(?:\s+(como estas|como te sientes|como andas|que tal))?$/.test(q)) {
    return /como estas|como te sientes|como andas|que tal/.test(q) ? '¿Cómo estás?' : 'Hola';
  }
  if (/^(como estas|como te sientes|como andas|que tal)$/.test(q)) return '¿Cómo estás?';
  if (/^(cuales son tus capacidades|que capacidades tienes|que puedes hacer|como puedes ayudarme|como funcionas)$/.test(q)) return '¿Qué puedes hacer?';
  if (/^(quien eres|que eres|que es universal core)$/.test(q)) return '¿Qué eres?';
  return String(value || '');
}

function protocolFastPathEligible(body={}) {
  const mode=String(body?.mode || 'general').toLowerCase();
  if (!['general','auto'].includes(mode)) return false;
  if (body?.web_enabled === true || (Array.isArray(body?.attachments) && body.attachments.length)) return false;
  const q=normalizeFastPath(body?.message || body?.task || '');
  if (!q) return false;
  if (/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches)(?:\s+(como estas|como te sientes|como andas|que tal))?$/.test(q)) return true;
  if (/^(como estas|como te sientes|como andas|que tal|gracias|muchas gracias|ok|vale|perfecto|listo)$/.test(q)) return true;
  if (/^(que tan inteligente eres|que puedes hacer|cuales son tus capacidades|que capacidades tienes|como puedes ayudarme|como funcionas|quien eres|que eres|que es universal core)$/.test(q)) return true;
  if (/^(responde )?(exactamente |solamente |solo )?(con )?(la )?palabra ok$/.test(q) || /^responde (exactamente|solamente|solo) ok$/.test(q)) return true;
  return false;
}

function conversationalHelpReply(body={}) {
  const mode=String(body?.mode || 'general').toLowerCase();
  if(!['general','auto'].includes(mode) || body?.web_enabled===true || (Array.isArray(body?.attachments)&&body.attachments.length))return null;
  const q=normalizeFastPath(body?.message || body?.task || '');
  const match=q.match(/^(?:me )?(?:puedes|podrias) ayudar(?:me)? (?:con|en|a) (.+)$/);
  if(!match)return null;
  const topic=match[1].trim();
  if(!topic||topic.length>180)return null;
  if(/presidencia.*universidad|universidad.*presidencia/.test(topic)){
    return 'Sí. Puedo ayudarte con la presidencia de tu universidad: estrategia, plan de trabajo, propuestas, discurso, organización, comunicación y toma de decisiones. Dime si buscas ganar la presidencia, preparar una propuesta o dirigirla mejor y avanzamos desde ahí.';
  }
  return `Sí. Puedo ayudarte con ${topic}. Dime qué resultado quieres conseguir, qué contexto ya tienes y qué restricción es la más importante; con eso te propongo el siguiente paso concreto.`;
}

function responseBudgetMs(body={}){
  const mode=String(body?.mode||body?.agent||'general').toLowerCase();
  if(body?.web_enabled===true||mode==='research')return 30_000;
  if(['analysis','code','design','executive'].includes(mode))return 24_000;
  return 18_000;
}

function withAbortableDeadline(task,ms,code,parentSignal){
  const controller=new AbortController();
  let timer=null,settled=false,removeParent=()=>{};
  return new Promise((resolve,reject)=>{
    const finish=(fn,value)=>{
      if(settled)return;
      settled=true;
      if(timer)clearTimeout(timer);
      removeParent();
      fn(value);
    };
    const abortFor=(error)=>{
      if(!controller.signal.aborted)controller.abort(error);
      finish(reject,error);
    };
    if(parentSignal){
      const relay=()=>{
        const error=Object.assign(new Error('request_cancelled'),{code:'REQUEST_CANCELLED',statusCode:499});
        abortFor(error);
      };
      if(parentSignal.aborted)return relay();
      parentSignal.addEventListener('abort',relay,{once:true});
      removeParent=()=>parentSignal.removeEventListener('abort',relay);
    }
    timer=setTimeout(()=>{
      const error=Object.assign(new Error(`${code.toLowerCase()}_${ms}ms`),{code,statusCode:504});
      abortFor(error);
    },ms);
    Promise.resolve()
      .then(()=>runWithRequestSignal(controller.signal,task))
      .then(value=>finish(resolve,value),error=>finish(reject,error));
  });
}

const publicIntent=intent=>intent?.changed?{
  normalized:true,
  domain:intent.domain,
  confidence:intent.confidence,
  corrections:intent.corrections
}:undefined;

const publicRoute=route=>route?{
  contract:route.contract,
  strategy:route.strategy,
  applied:route.applied===true,
  selected_provider:route.selectedProvider,
  task:{category:route.task?.category,path:route.task?.path,risk:route.task?.risk,complexity:route.task?.complexity},
  candidates:Array.isArray(route.candidates)?route.candidates:[]
}:undefined;

export default async function handler(req,res) {
  applyHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
  if (!originAllowed(req)) return res.status(403).json({error:'origin_not_allowed'});
  if (!allowRequest(req)) return res.status(429).json({error:'rate_limited'});

  const clientController=new AbortController();
  const abortClient=()=>{
    if(!clientController.signal.aborted)clientController.abort(new DOMException('Client disconnected','AbortError'));
  };
  req.once?.('aborted',abortClient);
  res.once?.('close',()=>{if(!res.writableEnded)abortClient()});

  const body = req.body || {};
  const headerRequestId=String(req.headers?.['x-wae-request-id']||'').trim();
  const bodyRequestId=String(body.client_request_id||'').trim();
  const clientRequestId=/^[A-Za-z0-9_-]{16,128}$/.test(bodyRequestId)?bodyRequestId:/^[A-Za-z0-9_-]{16,128}$/.test(headerRequestId)?headerRequestId:'wae_'+crypto.randomUUID().replaceAll('-','');
  res.setHeader('X-WAE-Request-Id',clientRequestId);
  const requestBody={...body,client_request_id:clientRequestId};
  const userKey = requestBody.userKey || requestBody.sessionId || getClientIp(req);
  const intent=normalizeUserIntent(requestBody.message || requestBody.task || '');
  const runtimeBody=intent.changed?{...requestBody,message:intent.text}:requestBody;
  const userContext=userContextStateV92(runtimeBody);
  const contextualFollowup=contextualFollowupV103(runtimeBody.message||runtimeBody.task||'',runtimeBody.history||[]);
  const budget=responseBudgetMs(runtimeBody);
  res.setHeader('X-WAE-Response-Budget-Ms',String(budget));
  res.setHeader('X-WAE-Long-Session','abortable-v47');
  res.setHeader('X-WAE-Answer-Assurance','v101');
  res.setHeader('X-WAE-Context-Integrity','v103');

  const awareness=userContext.affectsGeneration?{eligible:false}:classifySelfAwarenessV99(runtimeBody);
  if(awareness.eligible){
    const reply=buildSelfAwarenessReplyV99({kind:awareness.kind});
    const snapshot=selfAwarenessSnapshotV99();
    res.setHeader('X-WAE-Fast-Path','grounded-self-awareness-v103');
    return res.status(200).json({
      success:true,
      reply,
      speech_text:reply,
      response:{content:reply,speechText:reply,metadata:{fastLane:true,fastLaneVersion:'grounded-self-awareness/v103',selfAwareness:snapshot}},
      provider:'universal_core',
      model:'universal-core-self-awareness-v103',
      fast_lane:true,
      fast_lane_version:'grounded-self-awareness/v103',
      web_sources:[],
      self_awareness:snapshot,
      input_interpretation:publicIntent(intent)
    });
  }

  if (!contextualFollowup && !userContext.affectsGeneration && protocolFastPathEligible(runtimeBody)) {
    const protocolBody={...runtimeBody,message:canonicalProtocolPrompt(runtimeBody.message || runtimeBody.task || '')};
    const fast = await rescueMission({ payload:protocolBody, userKey, error:{code:'PROTOCOL_FAST_PATH'} });
    if (fast?.resilience?.path === 'deterministic_protocol') {
      res.setHeader('X-WAE-Fast-Path','deterministic-protocol-v4');
      return res.status(200).json({ ...fast, fast_lane:true, fast_lane_version:'server-protocol/v4', input_interpretation:publicIntent(intent) });
    }
  }

  const helpReply=contextualFollowup||userContext.affectsGeneration?null:conversationalHelpReply(runtimeBody);
  if(helpReply){
    res.setHeader('X-WAE-Fast-Path','conversational-help-v46');
    return res.status(200).json({
      success:true,
      reply:helpReply,
      speech_text:helpReply,
      response:{content:helpReply,speechText:helpReply,metadata:{fastLane:true,fastLaneVersion:'conversational-help/v46'}},
      provider:'universal_core',
      model:'universal-core-conversation-fast-v46',
      fast_lane:true,
      fast_lane_version:'conversational-help-v46',
      web_sources:[],
      input_interpretation:publicIntent(intent)
    });
  }

  const route=selectProviderRoute({
    message:runtimeBody.message || runtimeBody.task || '',
    mode:runtimeBody.mode || runtimeBody.agent || 'general',
    attachments:Array.isArray(runtimeBody.attachments)?runtimeBody.attachments:[],
    requestedProvider:runtimeBody.provider || 'auto'
  });
  const routing=publicRoute(route);

  if(!contextualFollowup&&councilEligible({route,body:runtimeBody})){
    try{
      const council=await withAbortableDeadline(
        ()=>deliberateMission({body:runtimeBody,userKey,route}),
        Math.min(10_000,budget),
        'COUNCIL_DEADLINE',
        clientController.signal
      );
      if(council){
        res.setHeader('X-WAE-Cognitive-Path','universal-council-v40');
        if(council?.response?.metadata)council.response.metadata={...council.response.metadata,providerMesh:routing};
        return res.status(200).json({...council,input_interpretation:publicIntent(intent),provider_mesh:routing});
      }
    }catch(councilError){
      if(councilError?.code==='REQUEST_CANCELLED')return;
      console.warn('[Universal Council v40]',String(councilError?.message||councilError));
    }
  }

  const routedBody=route.applied?{...runtimeBody,provider:route.selectedProvider}:runtimeBody;
  try {
    const result = await withAbortableDeadline(
      ()=>executeMission({ ...routedBody, userKey }),
      budget,
      'RUNTIME_DEADLINE',
      clientController.signal
    );
    observeProviderOutcome({route,result});
    if(result?.response?.metadata)result.response.metadata={...result.response.metadata,providerMesh:routing};
    return res.status(200).json({ ...result, input_interpretation:publicIntent(intent), provider_mesh:routing });
  } catch (error) {
    if(error?.code==='REQUEST_CANCELLED')return;
    observeProviderOutcome({route,error});

    const assurance=assuranceRecoveryPlanV101(error);
    if(assurance.eligible){
      try {
        const rescued = await withAbortableDeadline(
          ()=>rescueMission({ payload:runtimeBody, userKey, error, allowResearch:!assurance.deadline }),
          assurance.rescueBudgetMs,
          'RESCUE_DEADLINE',
          clientController.signal
        );
        if (rescued) {
          res.setHeader('X-WAE-Resilience',assurance.deadline?'deadline-local-recovered-v101':'specialized-recovered-v101');
          const marked=markAssuredPayloadV101(rescued,assurance.deadline?'local_rescue':'specialized_rescue',error);
          return res.status(200).json({ ...marked, input_interpretation:publicIntent(intent), provider_mesh:routing });
        }
      } catch (rescueError) {
        if(rescueError?.code==='REQUEST_CANCELLED')return;
        console.warn('[Universal Core Answer Assurance Rescue v101]', String(rescueError?.message || rescueError));
      }

      try{
        const emergency=await withAbortableDeadline(
          ()=>emergencyGenerate({body:runtimeBody,userKey,failure:error}),
          assurance.emergencyBudgetMs,
          'EMERGENCY_GENERATION_DEADLINE',
          clientController.signal
        );
        if(emergency){
          res.setHeader('X-WAE-Resilience','emergency-generated-v101');
          const marked=markAssuredPayloadV101(emergency,'emergency_generation',error);
          return res.status(200).json({ ...marked, input_interpretation:publicIntent(intent), provider_mesh:routing });
        }
      }catch(emergencyError){
        if(emergencyError?.code==='REQUEST_CANCELLED')return;
        console.warn('[Universal Core Answer Assurance Emergency v101]', String(emergencyError?.message || emergencyError));
      }

      const bounded=buildBoundedContinuityV101({body:runtimeBody,userKey,error});
      if(bounded){
        res.setHeader('X-WAE-Resilience','bounded-continuity-v101');
        return res.status(200).json({ ...bounded, input_interpretation:publicIntent(intent), provider_mesh:routing });
      }
    }

    const deadline=error?.code==='RUNTIME_DEADLINE';
    if(deadline)res.setHeader('X-WAE-Resilience','deadline-enforced-v47');
    const status = error.statusCode || (error.code === 'NO_PROVIDER' ? 503 : 502);
    return res.status(status).json({ error:error.code || 'runtime_error', message:deadline?'Universal Core agotó el presupuesto de respuesta y canceló el trabajo interno antes de quedar bloqueado.':String(error.message || error), failures:error.failures || undefined, recoverable:true, provider_mesh:routing });
  }
}