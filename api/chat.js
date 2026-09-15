import { executeMission } from '../lib/runtime.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';
import { rescueMission, recoverableRuntimeError } from '../lib/intelligence-rescue.js';
import { normalizeUserIntent } from '../lib/input-intelligence.js';
import { selectProviderRoute, observeProviderOutcome } from '../lib/provider-mesh.js';
import { councilEligible, deliberateMission } from '../lib/deliberation-plane.js';

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

function withDeadline(promise,ms,code){
  let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error(`${code.toLowerCase()}_${ms}ms`);error.code=code;error.statusCode=504;reject(error)},ms)});
  return Promise.race([promise,deadline]).finally(()=>clearTimeout(timer));
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
  const body = req.body || {};
  const userKey = body.userKey || body.sessionId || getClientIp(req);
  const intent=normalizeUserIntent(body.message || body.task || '');
  const runtimeBody=intent.changed?{...body,message:intent.text}:body;
  const budget=responseBudgetMs(runtimeBody);
  res.setHeader('X-WAE-Response-Budget-Ms',String(budget));

  if (protocolFastPathEligible(runtimeBody)) {
    const protocolBody={...runtimeBody,message:canonicalProtocolPrompt(runtimeBody.message || runtimeBody.task || '')};
    const fast = await rescueMission({ payload:protocolBody, userKey, error:{code:'PROTOCOL_FAST_PATH'} });
    if (fast?.resilience?.path === 'deterministic_protocol') {
      res.setHeader('X-WAE-Fast-Path','deterministic-protocol-v4');
      return res.status(200).json({ ...fast, fast_lane:true, fast_lane_version:'server-protocol/v4', input_interpretation:publicIntent(intent) });
    }
  }

  const helpReply=conversationalHelpReply(runtimeBody);
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
      fast_lane_version:'conversational-help/v46',
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

  if(councilEligible({route,body:runtimeBody})){
    try{
      const council=await withDeadline(deliberateMission({body:runtimeBody,userKey,route}),Math.min(10_000,budget),'COUNCIL_DEADLINE');
      if(council){
        res.setHeader('X-WAE-Cognitive-Path','universal-council-v40');
        if(council?.response?.metadata)council.response.metadata={...council.response.metadata,providerMesh:routing};
        return res.status(200).json({...council,input_interpretation:publicIntent(intent),provider_mesh:routing});
      }
    }catch(councilError){
      console.warn('[Universal Council v40]',String(councilError?.message||councilError));
    }
  }

  const routedBody=route.applied?{...runtimeBody,provider:route.selectedProvider}:runtimeBody;
  try {
    const result = await withDeadline(executeMission({ ...routedBody, userKey }),budget,'RUNTIME_DEADLINE');
    observeProviderOutcome({route,result});
    if(result?.response?.metadata)result.response.metadata={...result.response.metadata,providerMesh:routing};
    return res.status(200).json({ ...result, input_interpretation:publicIntent(intent), provider_mesh:routing });
  } catch (error) {
    observeProviderOutcome({route,error});
    if (error?.code !== 'RUNTIME_DEADLINE' && recoverableRuntimeError(error)) {
      try {
        const rescued = await withDeadline(rescueMission({ payload:runtimeBody, userKey, error }),2_500,'RESCUE_DEADLINE');
        if (rescued) {
          res.setHeader('X-WAE-Resilience','recovered');
          return res.status(200).json({ ...rescued, input_interpretation:publicIntent(intent), provider_mesh:routing });
        }
      } catch (rescueError) {
        console.warn('[Universal Core Rescue]', String(rescueError?.message || rescueError));
      }
    }
    const deadline=error?.code==='RUNTIME_DEADLINE';
    if(deadline)res.setHeader('X-WAE-Resilience','deadline-enforced-v46');
    const status = error.statusCode || (error.code === 'NO_PROVIDER' ? 503 : 502);
    return res.status(status).json({ error:error.code || 'runtime_error', message:deadline?'Universal Core agotó el presupuesto de respuesta antes de quedar bloqueado por una dependencia externa.':String(error.message || error), failures:error.failures || undefined, recoverable:true, provider_mesh:routing });
  }
}