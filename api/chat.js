import { executeMission, publicMissionResult } from '../lib/runtime.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';

export default async function handler(req,res) {
  applyHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
  if (!originAllowed(req)) return res.status(403).json({error:'origin_not_allowed'});
  if (!allowRequest(req)) return res.status(429).json({error:'rate_limited'});
  try {
    const body = req.body || {};
    const result = await executeMission({ ...body, userKey:body.userKey || body.sessionId || getClientIp(req) });
    return res.status(200).json(publicMissionResult(result));
  } catch (error) {
    const status = error.statusCode || (error.code === 'NO_PROVIDER' ? 503 : 502);
    const message = status < 500 ? String(error.message || error) : 'No pude completar la solicitud en este intento.';
    return res.status(status).json({ error:error.code || 'runtime_error', message });
  }
}
