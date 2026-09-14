import { executeMission } from '../lib/runtime.js';
import { allowRequest, originAllowed, applyHeaders, getClientIp } from '../lib/security.js';

export default async function handler(req,res) {
  applyHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
  if (!originAllowed(req)) return res.status(403).json({error:'origin_not_allowed'});
  if (!allowRequest(req)) return res.status(429).json({error:'rate_limited'});
  try {
    const body = req.body || {};
    const result = await executeMission({ ...body, userKey:body.userKey || body.sessionId || getClientIp(req) });
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || (error.code === 'NO_PROVIDER' ? 503 : 502);
    return res.status(status).json({ error:error.code || 'runtime_error', message:String(error.message || error), failures:error.failures || undefined });
  }
}
