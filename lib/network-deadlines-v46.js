import { AsyncLocalStorage } from 'node:async_hooks';

const nativeFetch = globalThis.fetch?.bind(globalThis);
const requestContext = new AsyncLocalStorage();

const circuits = new Map();
const SUPABASE_HOST = 'pbswcbryxawsmltyromd.supabase.co';
const CIRCUIT_MS = 15_000;

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

function policy(input, options={}) {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
    const url = new URL(raw);
    const body = parseBody(options);
    if (url.hostname === SUPABASE_HOST) {
      if (url.pathname.includes('/functions/v1/wae-local-voice-demo-v61')) {
        if (body?.action === 'bootstrap') return { ms:1_800, circuit:'supabase-edge' };
        if (body?.action === 'chat') return { ms:12_000, circuit:'supabase-edge' };
        return { ms:5_000, circuit:'supabase-edge' };
      }
      if (url.pathname.includes('/functions/v1/wae-ai-gateway')) return { ms:8_000, circuit:'supabase-edge' };
      return { ms:8_000, circuit:'supabase' };
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
    const p = policy(input, options);
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
  globalThis.__WAE_NETWORK_DEADLINES_V46__ = { version:'47.0.0', supabaseCircuitMs:CIRCUIT_MS, requestCancellation:true };
  globalThis.__WAE_NETWORK_DEADLINES_V47__ = globalThis.__WAE_NETWORK_DEADLINES_V46__;
}
