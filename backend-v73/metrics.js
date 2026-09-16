import { backendConfig } from './config.js';

const counters = new Map();
const latencies = new Map();
const startedAt = Date.now();

function routeKey(method, route, status) {
  return `${String(method || 'GET').toUpperCase()} ${route || 'unknown'} ${Number(status || 0)}`;
}

function latencyKey(method, route) {
  return `${String(method || 'GET').toUpperCase()} ${route || 'unknown'}`;
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * q) - 1));
  return sorted[index];
}

export function observeRequest({ method, route, status, durationMs }) {
  const key = routeKey(method, route, status);
  counters.set(key, (counters.get(key) || 0) + 1);

  const lKey = latencyKey(method, route);
  const values = latencies.get(lKey) || [];
  values.push(Math.max(0, Math.round(Number(durationMs) || 0)));
  const max = backendConfig().metricsWindow;
  if (values.length > max) values.splice(0, values.length - max);
  latencies.set(lKey, values);
}

export function metricsSnapshot() {
  const requestCounters = [...counters.entries()].map(([key, count]) => ({ key, count }));
  const routeLatency = [...latencies.entries()].map(([key, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, value) => acc + value, 0);
    return {
      key,
      samples: sorted.length,
      avgMs: sorted.length ? Math.round(sum / sorted.length) : 0,
      p50Ms: quantile(sorted, 0.5),
      p95Ms: quantile(sorted, 0.95),
      p99Ms: quantile(sorted, 0.99),
      maxMs: sorted.at(-1) || 0,
    };
  });

  return {
    schema: 'wae-backend-metrics/v1',
    startedAt: new Date(startedAt).toISOString(),
    uptimeMs: Date.now() - startedAt,
    requests: requestCounters,
    latency: routeLatency,
  };
}

export function resetMetricsForTests() {
  counters.clear();
  latencies.clear();
}
