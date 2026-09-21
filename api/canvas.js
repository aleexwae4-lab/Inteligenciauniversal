import { allowRequest, originAllowed, applyHeaders } from '../lib/security.js';
import { createPremiumCanvas, CANVAS_ENGINE_VERSION } from '../lib/canvas-factory-render-v1.js';

export default async function handler(req, res) {
  applyHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  const fetchSite = String(req.headers?.['sec-fetch-site'] || '');
  if (fetchSite === 'cross-site') return res.status(403).json({ error: 'cross_site_denied' });
  const origin=String(req.headers?.origin || '');
  const host=String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error:'origin_not_allowed' });
    } catch { return res.status(403).json({ error:'invalid_origin' }); }
  }
  if (!allowRequest(req, Number(process.env.WAE_CANVAS_RATE_LIMIT_PER_MINUTE || 6), Number(process.env.WAE_CANVAS_IP_RATE_LIMIT_PER_MINUTE || 6))) {
    return res.status(429).json({ error: 'rate_limited', message: 'Espera un momento antes de crear otro producto.' });
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (typeof body.request !== 'string' || body.request.trim().length < 8 || body.request.length > 3500) {
    return res.status(400).json({ error: 'invalid_brief', message: 'Describe tu producto en al menos ocho caracteres.' });
  }
  if (body.baseHtml != null && (typeof body.baseHtml !== 'string' || body.baseHtml.length > 100_000)) {
    return res.status(413).json({ error: 'canvas_revision_too_large', message: 'La revisión del Canvas supera el límite de 100 KB.' });
  }
  try {
    const result = await createPremiumCanvas({
      request: body.request,
      kind: typeof body.kind === 'string' ? body.kind : undefined,
      brand: typeof body.brand === 'string' ? body.brand : '',
      baseHtml: typeof body.baseHtml === 'string' ? body.baseHtml : '',
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
