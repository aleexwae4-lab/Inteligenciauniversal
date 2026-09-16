import chatHandler from '../api/capacity-chat-v63.js';
import capabilitiesHandler from '../api/capabilities.js';
import executeHandler from '../api/execute.js';
import orchestrateHandler from '../api/orchestrate.js';
import tasksHandler from '../api/tasks.js';
import toolsHandler from '../api/tools.js';
import evalsHandler from '../api/evals.js';
import { runtimeHealth } from '../lib/runtime.js';
import { BACKEND_VERSION, publicBackendConfig } from './config.js';
import { metricsSnapshot } from './metrics.js';
import { securityState } from './security.js';

function liveHandler(req, res) {
  return res.status(200).json({
    ok: true,
    service: 'wae-universal-core-backend',
    version: BACKEND_VERSION,
    state: 'live',
    now: new Date().toISOString(),
  });
}

function readyHandler(req, res) {
  const runtime = runtimeHealth();
  const ready = runtime?.ready === true;
  return res.status(ready ? 200 : 503).json({
    ok: ready,
    service: 'wae-universal-core-backend',
    version: BACKEND_VERSION,
    state: ready ? 'ready' : 'not_ready',
    runtime,
  });
}

function statusHandler(req, res) {
  const runtime = runtimeHealth();
  return res.status(200).json({
    ok: true,
    schema: 'wae-backend-status/v1',
    backend: publicBackendConfig(),
    security: securityState(),
    runtime: {
      service: runtime.service,
      version: runtime.version,
      responseSchema: runtime.responseSchema,
      ready: runtime.ready,
      generativeReady: runtime.generativeReady,
      providerCount: Array.isArray(runtime.providers) ? runtime.providers.length : 0,
      toolCount: Array.isArray(runtime.tools) ? runtime.tools.length : 0,
      memory: runtime.memory,
      smartRouting: runtime.smartRouting,
    },
  });
}

function metricsHandler(req, res) {
  return res.status(200).json(metricsSnapshot());
}

function configHandler(req, res) {
  return res.status(200).json({ backend: publicBackendConfig(), security: securityState() });
}

const registry = new Map([
  ['/api/v73/health/live', { methods: ['GET'], handler: liveHandler, rateLimit: 600, access: 'public' }],
  ['/api/v73/health/ready', { methods: ['GET'], handler: readyHandler, rateLimit: 600, access: 'public' }],
  ['/api/v73/status', { methods: ['GET'], handler: statusHandler, rateLimit: 180, access: 'public' }],
  ['/api/v73/chat', { methods: ['POST'], handler: chatHandler, rateLimit: 60, access: 'public' }],
  ['/api/v73/capabilities', { methods: ['GET'], handler: capabilitiesHandler, rateLimit: 180, access: 'public' }],
  ['/api/v73/execute', { methods: ['POST'], handler: executeHandler, rateLimit: 60, access: 'public' }],
  ['/api/v73/orchestrate', { methods: ['POST'], handler: orchestrateHandler, rateLimit: 40, access: 'public' }],
  ['/api/v73/tasks', { methods: ['GET', 'POST'], handler: tasksHandler, rateLimit: 80, access: 'public' }],
  ['/api/v73/tools', { methods: ['GET', 'POST'], handler: toolsHandler, rateLimit: 80, access: 'public' }],
  ['/api/v73/evals', { methods: ['GET', 'POST'], handler: evalsHandler, rateLimit: 30, access: 'public' }],
  ['/api/v73/admin/metrics', { methods: ['GET'], handler: metricsHandler, rateLimit: 60, access: 'admin' }],
  ['/api/v73/admin/config', { methods: ['GET'], handler: configHandler, rateLimit: 60, access: 'admin' }],
]);

export function resolveBackendRoute(pathname) {
  return registry.get(pathname) || null;
}

export function backendRouteManifest() {
  return [...registry.entries()].map(([path, route]) => ({
    path,
    methods: [...route.methods],
    access: route.access,
    rateLimit: route.rateLimit,
  }));
}
