import { createHash, timingSafeEqual } from 'node:crypto';
import { backendConfig } from './config.js';

const buckets = new Map();

function header(req, name) {
  const value = req?.headers?.[name];
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '');
}

function constantTimeEqual(left, right) {
  const a = createHash('sha256').update(String(left || '')).digest();
  const b = createHash('sha256').update(String(right || '')).digest();
  return timingSafeEqual(a, b);
}

export function clientIp(req) {
  const config = backendConfig();
  const forwarded = config.trustProxy ? header(req, 'x-forwarded-for').split(',')[0].trim() : '';
  return forwarded || String(req?.socket?.remoteAddress || 'unknown');
}

export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cache-Control', 'no-store');
}

export function applyCors(req, res) {
  const origin = header(req, 'origin');
  const allowed = backendConfig().allowedOrigins;
  if (!origin) return true;
  if (!allowed.length) return true;
  if (!allowed.includes(origin)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-WAE-Worker-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  return true;
}

export function allowGatewayRequest(req, routeKey, limit = backendConfig().rateLimitPerMinute) {
  const now = Date.now();
  const key = `${clientIp(req)}:${routeKey}`;
  const current = buckets.get(key) || { start: now, count: 0 };
  if (now - current.start >= 60_000) {
    current.start = now;
    current.count = 0;
  }
  current.count += 1;
  buckets.set(key, current);

  if (buckets.size > 15_000) {
    for (const [bucketKey, value] of buckets) {
      if (now - value.start > 120_000) buckets.delete(bucketKey);
    }
  }
  return current.count <= Math.max(1, Number(limit) || 1);
}

export function authorizeAdmin(req) {
  const expected = String(process.env.WAE_ADMIN_API_KEY || '');
  if (!expected) return false;
  const bearer = header(req, 'authorization').replace(/^Bearer\s+/i, '').trim();
  const direct = header(req, 'x-wae-admin-key').trim();
  return constantTimeEqual(bearer || direct, expected);
}

export function securityState() {
  const config = backendConfig();
  return {
    schema: 'wae-backend-security/v1',
    corsAllowlistConfigured: config.allowedOrigins.length > 0,
    trustProxy: config.trustProxy,
    adminApiKeyConfigured: config.adminApiKeyConfigured,
    rateLimitPerMinute: config.rateLimitPerMinute,
  };
}
