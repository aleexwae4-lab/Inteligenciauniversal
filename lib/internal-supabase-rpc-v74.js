export const INTERNAL_SUPABASE_RPC_VERSION = 'internal-supabase-rpc/v74';

function cleanBase(value='') {
  return String(value || '').trim().replace(/\/$/, '');
}

function safeText(value, max=180) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, max);
}

export function internalSupabaseCredentialMode() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return 'service_role';
  if (process.env.SUPABASE_PUBLISHABLE_KEY) return 'publishable_compat';
  return 'unconfigured';
}

export function internalSupabaseTransportState() {
  return {
    version: INTERNAL_SUPABASE_RPC_VERSION,
    configured: Boolean(process.env.SUPABASE_URL) && internalSupabaseCredentialMode() !== 'unconfigured',
    credentialMode: internalSupabaseCredentialMode(),
    leastPrivilegeReady: internalSupabaseCredentialMode() === 'service_role',
    secretExposed: false,
  };
}

export async function callInternalSupabaseRpc({
  functionName,
  body = {},
  timeoutMs = 1_500,
  clientInfo = 'wae-universal-core-v74',
} = {}) {
  const base = cleanBase(process.env.SUPABASE_URL);
  const mode = internalSupabaseCredentialMode();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '');
  const rpc = String(functionName || '').trim();

  if (!base || !key) return { ok: false, unconfigured: true, error: 'supabase_internal_transport_unconfigured', mode };
  if (!/^[a-z0-9_]{3,120}$/i.test(rpc)) return { ok: false, error: 'invalid_rpc_name', mode };

  const headers = {
    'Content-Type': 'application/json',
    apikey: key,
    'X-Client-Info': safeText(clientInfo, 100),
  };
  if (mode === 'service_role') headers.Authorization = `Bearer ${key}`;

  try {
    const response = await fetch(`${base}/rest/v1/rpc/${encodeURIComponent(rpc)}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body && typeof body === 'object' ? body : {}),
      signal: AbortSignal.timeout(Math.max(250, Math.min(15_000, Number(timeoutMs) || 1_500))),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        error: 'supabase_internal_rpc_rejected',
        status: response.status,
        mode,
        detail: safeText(payload?.message || payload?.error || '', 160),
      };
    }
    return { ok: true, status: response.status, mode, payload };
  } catch (error) {
    return {
      ok: false,
      error: 'supabase_internal_rpc_unavailable',
      mode,
      detail: safeText(error?.message || error, 140),
    };
  }
}
