import { executeMission } from '../lib/runtime.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';
import { rescueMission, recoverableRuntimeError } from '../lib/intelligence-rescue.js';
import { normalizeUserIntent } from '../lib/input-intelligence.js';

function normalizeFastPath(value='') {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[¿?¡!.,;:]+/g,' ')
    .replace(/\s+/g,' ').trim();
}

function protocolFastPathEligible(body={}) {
  const mode=String(body?.mode || 'general').toLowerCase();
  if (mode !== 'general') return false;
  if (body?.web_enabled === true || (Array.isArray(body?.attachments) && body.attachments.length)) return false;
  const q=normalizeFastPath(body?.message || body?.task || '');
  if (!q) return false;
  if (/^(hola|hey|buenas|buenos dias|buenas tardes|buenas noches|como estas|que tal|gracias|muchas gracias|ok|vale|perfecto|listo)$/.test(q)) return true;
  if (/\b(que tan inteligente eres|que puedes hacer|quien eres|que eres)\b/.test(q)) return true;
  if (/^(responde )?(exactamente |solamente |solo )?(con )?(la )?palabra ok$/.test(q) || /^responde (exactamente|solamente|solo) ok$/.test(q)) return true;
  return false;
}

const publicIntent=intent=>intent?.changed?{
  normalized:true,
  domain:intent.domain,
  confidence:intent.confidence,
  corrections:intent.corrections
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
    const fast = await rescueMission({ payload:runtimeBody, userKey, error:{code:'PROTOCOL_FAST_PATH'} });
    if (fast?.resilience?.path === 'deterministic_protocol') {
      res.setHeader('X-WAE-Fast-Path','deterministic-protocol-v1');
      return res.status(200).json({ ...fast, fast_lane:true, fast_lane_version:'server-protocol/v1', input_interpretation:publicIntent(intent) });
    }
  }

  try {
    const result = await executeMission({ ...runtimeBody, userKey });
    return res.status(200).json({ ...result, input_interpretation:publicIntent(intent) });
  } catch (error) {
    if (recoverableRuntimeError(error)) {
      try {
        const rescued = await rescueMission({ payload:runtimeBody, userKey, error });
        if (rescued) {
          res.setHeader('X-WAE-Resilience','recovered');
          return res.status(200).json({ ...rescued, input_interpretation:publicIntent(intent) });
        }
      } catch (rescueError) {
        console.warn('[Universal Core Rescue]', String(rescueError?.message || rescueError));
      }
    }
    const status = error.statusCode || (error.code === 'NO_PROVIDER' ? 503 : 502);
    return res.status(status).json({ error:error.code || 'runtime_error', message:String(error.message || error), failures:error.failures || undefined, recoverable:recoverableRuntimeError(error) });
  }
}
