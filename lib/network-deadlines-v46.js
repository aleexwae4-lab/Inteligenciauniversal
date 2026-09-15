const nativeFetch = globalThis.fetch?.bind(globalThis);

const circuits = new Map();
const SUPABASE_HOST = 'pbswcbryxawsmltyromd.supabase.co';
const CIRCUIT_MS = 15_000;

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

function combinedSignal(existing, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException(`network_deadline_${ms}ms`, 'TimeoutError')), ms);
  let remove = () => {};
  if (existing) {
    const relay = () => controller.abort(existing.reason || new DOMException('Aborted','AbortError'));
    if (existing.aborted) relay();
    else {
      existing.addEventListener('abort', relay, { once:true });
      remove = () => existing.removeEventListener('abort', relay);
    }
  }
  return { signal:controller.signal, cleanup(){ clearTimeout(timer); remove(); } };
}

if (nativeFetch && !globalThis.__WAE_NETWORK_DEADLINES_V46__) {
  globalThis.fetch = async (input, options={}) => {
    const p = policy(input, options);
    if (!p) return nativeFetch(input, options);
    if (circuitOpen(p.circuit)) {
      const error = new Error(`network_circuit_open:${p.circuit}`);
      error.code = 'NETWORK_CIRCUIT_OPEN';
      throw error;
    }
    const bounded = combinedSignal(options?.signal, p.ms);
    try {
      return await nativeFetch(input, { ...options, signal:bounded.signal });
    } catch (error) {
      const timedOut = bounded.signal.aborted && !(options?.signal?.aborted);
      if (timedOut) {
        openCircuit(p.circuit);
        const e = new Error(`network_deadline_${p.ms}ms`);
        e.code = 'NETWORK_DEADLINE';
        e.cause = error;
        throw e;
      }
      throw error;
    } finally {
      bounded.cleanup();
    }
  };
  globalThis.__WAE_NETWORK_DEADLINES_V46__ = { version:'46.0.0', supabaseCircuitMs:CIRCUIT_MS };
}
