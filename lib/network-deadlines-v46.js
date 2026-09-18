import { AsyncLocalStorage } from 'node:async_hooks';

const nativeFetch = globalThis.fetch?.bind(globalThis);
const requestContext = new AsyncLocalStorage();

const circuits = new Map();
const CIRCUIT_MS = 15_000;

function boundedEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

const EDGE_BOOTSTRAP_MS = boundedEnv('WAE_EDGE_BOOTSTRAP_TIMEOUT_MS', 8_000, 2_000, 20_000);
const EDGE_CHAT_MS = boundedEnv('WAE_EDGE_CHAT_TIMEOUT_MS', 14_000, 6_000, 30_000);
const EDGE_COMPLEX_CHAT_MS = boundedEnv('WAE_EDGE_COMPLEX_CHAT_TIMEOUT_MS', 24_000, 10_000, 40_000);
const EDGE_CONTROL_MS = boundedEnv('WAE_EDGE_CONTROL_TIMEOUT_MS', 8_000, 3_000, 20_000);
const GATEWAY_MS = boundedEnv('WAE_GATEWAY_TIMEOUT_MS', 20_000, 8_000, 40_000);

function hostnameOf(value='') {
  try { return new URL(value).hostname; } catch { return ''; }
}

const SUPABASE_HOSTS = new Set([
  'pbswcbryxawsmltyromd.supabase.co',
  hostnameOf(process.env.SUPABASE_URL),
  hostnameOf(process.env.WAE_SUPABASE_EDGE_URL),
  hostnameOf(process.env.WAE_SUPABASE_GATEWAY_URL),
].filter(Boolean));

export function runWithRequestSignal(signal, task) {
  return requestContext.run({ signal: signal || null }, task);
}

export function currentRequestSignal() {
  return requestContext.getStore()?.signal || null;
}

function parseBody(options={}) {
  try { return typeof options.body === 'string' ? JSON.parse(options.body) : {}; }
  catch { return {}; }
}

export function networkDeadlinePolicy(input, options={}) {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    const url = new URL(raw);
    const body = parseBody(options);
    if (SUPABASE_HOSTS.has(url.hostname)) {
      if (url.pathname.includes('/functions/v1/wae-local-voice-demo-v61')) {
        // A bootstrap can include an Edge cold start plus a database insert. Do not
        // open a shared circuit for it: a cold bootstrap must never suppress a
        // subsequent chat, health check or recovery route.
        if (body?.action === 'bootstrap') return { ms:EDGE_BOOTSTRAP_MS, circuit:null, operation:'bootstrap' };
        if (body?.action === 'chat') {
          const complex = ['research','analysis','code','design','executive'].includes(String(body?.mode || '').toLowerCase()) || body?.web_enabled === true;
          return { ms:complex ? EDGE_COMPLEX_CHAT_MS : EDGE_CHAT_MS, circuit:'supabase-edge-chat', operation:'chat' };
        }
        return { ms:EDGE_CONTROL_MS, circuit:'supabase-edge-control', operation:'control' };
      }
      if (url.pathname.includes('/functions/v1/wae-ai-gateway')) return { ms:GATEWAY_MS, circuit:'supabase-gateway', operation:'gateway' };
      return { ms:EDGE_CONTROL_MS, circuit:'supabase', operation:'supabase' };
    }
    if (/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.x\.ai|openrouter\.ai/i.test(url.hostname)) {
      return { ms:20_000, circuit:null };
    }
  } catch {}
  return null;
}

function openCircuit(key) {
  if (!key) return;
  circuits.set(key, Date.now() + CIRCUIT_MS);
}

function circuitOpen(key) {
  if (!key) return false;
  const until = Number(circuits.get(key) || 0);
  if (until <= Date.now()) { circuits.delete(key); return false; }
  return true;
}

function combinedSignal(explicit, contextual, ms) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException(`network_deadline_${ms}ms`, 'TimeoutError'));
  }, ms);
  const removers = [];
  for (const source of [explicit, contextual]) {
    if (!source || source === controller.signal) continue;
    const relay = () => {
      if (!controller.signal.aborted) controller.abort(source.reason || new DOMException('Aborted','AbortError'));
    };
    if (source.aborted) relay();
    else {
      source.addEventListener('abort', relay, { once:true });
      removers.push(() => source.removeEventListener('abort', relay));
    }
  }
  return {
    signal:controller.signal,
    timedOut:() => timedOut,
    cleanup(){ clearTimeout(timer); for (const remove of removers) remove(); }
  };
}

if (nativeFetch && !globalThis.__WAE_NETWORK_DEADLINES_V47__) {
  globalThis.fetch = async (input, options={}) => {
    const p = networkDeadlinePolicy(input, options);
    const contextual = currentRequestSignal();
    if (!p && !contextual) return nativeFetch(input, options);
    if (p && circuitOpen(p.circuit)) {
      const error = new Error(`network_circuit_open:${p.circuit}`);
      error.code = 'NETWORK_CIRCUIT_OPEN';
      throw error;
    }
    const ms = p?.ms || 120_000;
    const bounded = combinedSignal(options?.signal, contextual, ms);
    try {
      return await nativeFetch(input, { ...options, signal:bounded.signal });
    } catch (error) {
      if (bounded.timedOut()) {
        if (p) openCircuit(p.circuit);
        const e = new Error(`network_deadline_${ms}ms`);
        e.code = 'NETWORK_DEADLINE';
        e.cause = error;
        throw e;
      }
      if (bounded.signal.aborted) {
        const e = new Error('request_cancelled');
        e.code = 'REQUEST_CANCELLED';
        e.cause = error;
        throw e;
      }
      throw error;
    } finally {
      bounded.cleanup();
    }
  };
  globalThis.__WAE_NETWORK_DEADLINES_V46__ = {
    version:'48.0.0',
    supabaseCircuitMs:CIRCUIT_MS,
    requestCancellation:true,
    edgeBootstrapMs:EDGE_BOOTSTRAP_MS,
    edgeChatMs:EDGE_CHAT_MS,
    edgeComplexChatMs:EDGE_COMPLEX_CHAT_MS,
    isolatedCircuits:true,
  };
  globalThis.__WAE_NETWORK_DEADLINES_V47__ = globalThis.__WAE_NETWORK_DEADLINES_V46__;
}
