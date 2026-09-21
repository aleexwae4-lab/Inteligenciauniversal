import { allowRequest, originAllowed, applyHeaders } from '../lib/security.js';
import { createPremiumCanvas, CANVAS_ENGINE_VERSION } from '../lib/canvas-engine-v1.js';

export default async function handler(req, res) {
  applyHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (!allowRequest(req, Number(process.env.WAE_CANVAS_RATE_LIMIT_PER_MINUTE || 6))) {
    return res.status(429).json({ error: 'rate_limited', message: 'Espera un momento antes de crear otro producto.' });
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (typeof body.request !== 'string' || body.request.trim().length < 8 || body.request.length > 10000) {
    return res.status(400).json({ error: 'invalid_brief', message: 'Describe tu producto en al menos ocho caracteres.' });
  }
  try {
    const result = await createPremiumCanvas({
      request: body.request,
      kind: typeof body.kind === 'string' ? body.kind : undefined,
      brand: typeof body.brand === 'string' ? body.brand : '',
      provider: 'auto'
    });
    return res.status(200).json({ status: 'completed', ...result });
  } catch (error) {
    const status = error.statusCode || (error.code === 'NO_PROVIDER' ? 503 : 502);
    return res.status(status).json({
      error: error.code || 'canvas_generation_failed',
      message: String(error.message || 'No se pudo crear el producto.').slice(0, 300),
      version: CANVAS_ENGINE_VERSION
    });
  }
}
