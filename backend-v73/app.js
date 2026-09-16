import { BACKEND_VERSION, backendConfig } from './config.js';
import { createRequestContext, requestIdFor, runWithRequestContext } from './context.js';
import { augmentResponse, readJsonBody, safeErrorPayload } from './http.js';
import { observeRequest } from './metrics.js';
import { allowGatewayRequest, applyCors, applySecurityHeaders, authorizeAdmin } from './security.js';
import { resolveBackendRoute } from './routes.js';
import { IDENTITY_VERSION, resolveRequestIdentity } from '../lib/identity-v74.js';

export const CONTROL_PLANE_VERSION = 'universal-core-control-plane/v74';

export function isPremiumBackendPath(pathname = '') {
  return String(pathname).startsWith('/api/v73/');
}

export async function handlePremiumBackend(req, res) {
  augmentResponse(res);
  applySecurityHeaders(res);
  res.setHeader('X-WAE-Backend', BACKEND_VERSION);
  res.setHeader('X-WAE-Control-Plane', CONTROL_PLANE_VERSION);
  res.setHeader('X-WAE-Identity', IDENTITY_VERSION);

  const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
  const pathname = url.pathname;
  const requestId = requestIdFor(req);
  res.setHeader('X-Request-Id', requestId);

  if (typeof res.setTimeout === 'function') {
    res.setTimeout(backendConfig().requestTimeoutMs, () => {
      if (res.writableEnded) return;
      if (!res.headersSent) {
        res.statusCode = 504;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify({ error: 'request_timeout', request_id: requestId, recoverable: true }));
    });
  }

  if (!applyCors(req, res)) {
    return res.status(403).json({ error: 'origin_not_allowed', request_id: requestId });
  }

  if (String(req.method || 'GET').toUpperCase() === 'OPTIONS') {
    return res.status(204).end();
  }

  const route = resolveBackendRoute(pathname);
  if (!route) {
    return res.status(404).json({ error: 'route_not_found', request_id: requestId });
  }

  const method = String(req.method || 'GET').toUpperCase();
  if (!route.methods.includes(method)) {
    res.setHeader('Allow', route.methods.join(', '));
    return res.status(405).json({ error: 'method_not_allowed', request_id: requestId });
  }

  if (!allowGatewayRequest(req, pathname, route.rateLimit)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'gateway_rate_limited', request_id: requestId, recoverable: true });
  }

  if (route.access === 'admin' && !authorizeAdmin(req)) {
    return res.status(403).json({ error: 'admin_auth_required', request_id: requestId });
  }

  const started = Date.now();
  let observed = false;
  const observe = () => {
    if (observed) return;
    observed = true;
    observeRequest({ method, route: pathname, status: res.statusCode || 200, durationMs: Date.now() - started });
  };
  if (typeof res.once === 'function') res.once('finish', observe);

  try {
    req.body = await readJsonBody(req);

    let identity = null;
    if (route.access !== 'admin') {
      identity = await resolveRequestIdentity(req, req.body && typeof req.body === 'object' ? req.body : {});
      req.waeIdentity = identity;
      if (!identity.allowed) {
        const status = identity.authPresent && identity.authenticated ? 403 : 401;
        return res.status(status).json({
          error: identity.authenticated ? 'tenant_access_denied' : 'authentication_failed',
          reason: identity.reason,
          request_id: requestId,
        });
      }
    }

    const context = createRequestContext(req, pathname);
    context.requestId = requestId;
    context.identity = identity;
    if (identity?.tenantTrusted) {
      context.tenantId = identity.tenantId;
      context.principalId = identity.userId;
    }
    await runWithRequestContext(context, () => route.handler(req, res));
    if (!res.writableEnded && !res.headersSent) {
      res.status(204).end();
    }
  } catch (error) {
    const { status, payload } = safeErrorPayload(error, requestId);
    if (!res.writableEnded) {
      if (!res.headersSent) res.statusCode = status;
      res.json(payload);
    }
  } finally {
    if (typeof res.once !== 'function') observe();
  }
}
