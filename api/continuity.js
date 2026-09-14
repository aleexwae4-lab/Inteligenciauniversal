import { allowRequest, applyHeaders } from '../lib/security.js';
import { openAIContinuityResponse } from '../lib/continuity.js';

const MAX_MESSAGES = 40;

export default async function continuityHandler(req, res) {
  applyHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'method_not_allowed' } });
  if (!allowRequest(req, Number(process.env.WAE_CONTINUITY_RATE_LIMIT_PER_MINUTE || 120))) {
    return res.status(429).json({ error: { message: 'rate_limited' } });
  }

  const body = req.body || {};
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
    return res.status(422).json({ error: { message: 'messages_required' } });
  }

  const response = openAIContinuityResponse(body);
  res.setHeader('X-WAE-Core', 'continuity-v1');
  return res.status(200).json(response);
}
