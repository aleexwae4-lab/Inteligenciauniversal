import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { backendConfig, publicBackendConfig, BACKEND_VERSION } from '../backend-v73/config.js';
import { observeRequest, metricsSnapshot, resetMetricsForTests } from '../backend-v73/metrics.js';
import { applySecurityHeaders, securityState } from '../backend-v73/security.js';
import { backendRouteManifest } from '../backend-v73/routes.js';
import { handlePremiumBackend } from '../backend-v73/app.js';

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = new Map();
    this.statusCode = 200;
    this.headersSent = false;
    this.writableEnded = false;
    this.body = '';
  }
  setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); }
  getHeader(name) { return this.headers.get(String(name).toLowerCase()); }
  end(chunk = '') {
    this.body = String(chunk || '');
    this.headersSent = true;
    this.writableEnded = true;
    this.emit('finish');
    return this;
  }
}

function request(url, method = 'GET', headers = {}) {
  return { url, method, headers: { host: 'localhost', ...headers }, socket: { remoteAddress: '127.0.0.1' } };
}

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test('public config never exposes secrets', () => {
  const originalAdmin = process.env.WAE_ADMIN_API_KEY;
  const originalProvider = process.env.OPENAI_API_KEY;
  try {
    process.env.WAE_ADMIN_API_KEY = 'super-secret-value';
    process.env.OPENAI_API_KEY = 'provider-secret';
    const output = JSON.stringify(publicBackendConfig());
    assert.equal(output.includes('super-secret-value'), false);
    assert.equal(output.includes('provider-secret'), false);
    assert.equal(backendConfig().version, BACKEND_VERSION);
  } finally {
    restoreEnv('WAE_ADMIN_API_KEY', originalAdmin);
    restoreEnv('OPENAI_API_KEY', originalProvider);
  }
});

test('security headers establish an API perimeter', () => {
  const res = new MockResponse();
  applySecurityHeaders(res);
  assert.equal(res.getHeader('x-content-type-options'), 'nosniff');
  assert.equal(res.getHeader('x-frame-options'), 'DENY');
  assert.equal(res.getHeader('cache-control'), 'no-store');
  assert.equal(typeof securityState().rateLimitPerMinute, 'number');
});

test('metrics keep latency percentiles and counters', () => {
  resetMetricsForTests();
  for (const durationMs of [10, 20, 30, 40, 100]) observeRequest({ method: 'GET', route: '/api/v73/status', status: 200, durationMs });
  const snapshot = metricsSnapshot();
  const latency = snapshot.latency.find(item => item.key === 'GET /api/v73/status');
  assert.equal(latency.samples, 5);
  assert.equal(latency.p50Ms, 30);
  assert.equal(latency.p95Ms, 100);
});

test('route manifest exposes the premium execution surface', () => {
  const manifest = backendRouteManifest();
  const paths = new Set(manifest.map(route => route.path));
  assert.equal(paths.has('/api/v73/chat'), true);
  assert.equal(paths.has('/api/v73/execute'), true);
  assert.equal(paths.has('/api/v73/orchestrate'), true);
  assert.equal(paths.has('/api/v73/health/ready'), true);
  assert.equal(paths.has('/api/v73/admin/metrics'), true);
});

test('liveness endpoint responds with backend identity', async () => {
  const req = request('/api/v73/health/live');
  const res = new MockResponse();
  await handlePremiumBackend(req, res);
  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.version, BACKEND_VERSION);
  assert.match(String(res.getHeader('x-request-id')), /.+/);
});

test('admin telemetry is fail-closed without a valid key', async () => {
  const original = process.env.WAE_ADMIN_API_KEY;
  try {
    process.env.WAE_ADMIN_API_KEY = 'expected-key';
    const req = request('/api/v73/admin/metrics');
    const res = new MockResponse();
    await handlePremiumBackend(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(JSON.parse(res.body).error, 'admin_auth_required');
  } finally {
    restoreEnv('WAE_ADMIN_API_KEY', original);
  }
});
