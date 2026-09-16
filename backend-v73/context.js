import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage();
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

function firstHeader(req, name) {
  const value = req?.headers?.[name];
  if (Array.isArray(value)) return value[0] || '';
  return String(value || '');
}

export function requestIdFor(req) {
  const incoming = firstHeader(req, 'x-request-id').trim();
  return SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

export function createRequestContext(req, pathname) {
  const requestId = requestIdFor(req);
  const body = req?.body && typeof req.body === 'object' ? req.body : {};
  return {
    requestId,
    pathname,
    method: String(req?.method || 'GET').toUpperCase(),
    startedAt: Date.now(),
    tenantId: String(body.tenantId || body.tenant_id || body.organizationId || body.organization_id || '').slice(0, 160),
    principalId: String(body.userKey || body.userId || body.user_id || body.sessionId || body.session_id || '').slice(0, 180),
  };
}

export function runWithRequestContext(context, fn) {
  return storage.run(context, fn);
}

export function currentRequestContext() {
  return storage.getStore() || null;
}
