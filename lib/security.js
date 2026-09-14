const buckets = new Map();

export function getClientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

export function allowRequest(req, limit = Number(process.env.WAE_RATE_LIMIT_PER_MINUTE || 30)) {
  const now = Date.now();
  const key = getClientIp(req);
  const bucket = buckets.get(key) || { start:now, count:0 };
  if (now - bucket.start > 60000) { bucket.start = now; bucket.count = 0; }
  bucket.count += 1; buckets.set(key,bucket);
  if (buckets.size > 5000) for (const [k,v] of buckets) if (now-v.start > 120000) buckets.delete(k);
  return bucket.count <= limit;
}

export function originAllowed(req) {
  const configured = (process.env.WAE_ALLOWED_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean);
  if (!configured.length) return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  return configured.includes(origin);
}

export function applyHeaders(res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
}
