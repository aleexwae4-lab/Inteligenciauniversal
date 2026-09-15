import { executeMission } from '../lib/runtime.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';
import { rescueMission, recoverableRuntimeError } from '../lib/intelligence-rescue.js';
import { normalizeUserIntent } from '../lib/input-intelligence.js';
import { selectProviderRoute, observeProviderOutcome } from '../lib/provider-mesh.js';

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
  if (mode !== 'general') return false;
  if (body?.web_enabled === true || (Array.isArray(body?.attachments) && body.attachments.length)) return false;
  const q=normalizeFastPath(body?.message || body?.task || '');
  if (!q) return false;
  if (/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches)(?:\s+(como estas|como te sientes|como andas|que tal))?$/.test(q)) return true;
  if (/^(como estas|como te sientes|como andas|que tal|gracias|muchas gracias|ok|vale|perfecto|listo)$/.test(q)) return true;
  if (/^(que tan inteligente eres|que puedes hacer|cuales son tus capacidades|que capacidades tienes|como puedes ayudarme|como funcionas|quien eres|que eres|que es universal core)$/.test(q)) return true;
  if (/^(responde )?(exactamente |solamente |solo )?(con )?(la )?palabra ok$/.test(q) || /^responde (exactamente|solamente|solo) ok$/.test(q)) return true;
  return false;
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

  if (protocolFastPathEligible(runtimeBody)) {
    const protocolBody={...runtimeBody,message:canonicalProtocolPrompt(runtimeBody.message || runtimeBody.task || '')};
    const fast = await rescueMission({ payload:protocolBody, userKey, error:{code:'PROTOCOL_FAST_PATH'} });
    if (fast?.resilience?.path === 'deterministic_protocol') {
      res.setHeader('X-WAE-Fast-Path','deterministic-protocol-v3');
      return res.status(200).json({ ...fast, fast_lane:true, fast_lane_version:'server-protocol/v3', input_interpretation:publicIntent(intent) });
    }
  }

  const route=selectProviderRoute({
    message:runtimeBody.message || runtimeBody.task || '',
    mode:runtimeBody.mode || runtimeBody.agent || 'general',
    attachments:Array.isArray(runtimeBody.attachments)?runtimeBody.attachments:[],
    requestedProvider:runtimeBody.provider || 'auto'
  });
  const routedBody=route.applied?{...runtimeBody,provider:route.selectedProvider}:runtimeBody;

  try {
    const result = await executeMission({ ...routedBody, userKey });
    observeProviderOutcome({route,result});
    const routing=publicRoute(route);
    if(result?.response?.metadata)result.response.metadata={...result.response.metadata,providerMesh:routing};
    return res.status(200).json({ ...result, input_interpretation:publicIntent(intent), provider_mesh:routing });
  } catch (error) {
    observeProviderOutcome({route,error});
    if (recoverableRuntimeError(error)) {
      try {
        const rescued = await rescueMission({ payload:runtimeBody, userKey, error });
        if (rescued) {
          res.setHeader('X-WAE-Resilience','recovered');
          return res.status(200).json({ ...rescued, input_interpretation:publicIntent(intent), provider_mesh:publicRoute(route) });
        }
      } catch (rescueError) {
        console.warn('[Universal Core Rescue]', String(rescueError?.message || rescueError));
      }
    }
    const status = error.statusCode || (error.code === 'NO_PROVIDER' ? 503 : 502);
    return res.status(status).json({ error:error.code || 'runtime_error', message:String(error.message || error), failures:error.failures || undefined, recoverable:recoverableRuntimeError(error), provider_mesh:publicRoute(route) });
  }
}
