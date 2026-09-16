export const IDENTITY_VERSION = 'universal-identity/v74';

function header(req, name) {
  const value = req?.headers?.[String(name).toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '');
}

function bearerToken(req) {
  const raw = header(req, 'authorization').trim();
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function requestedTenant(body={}) {
  return String(body.tenantId || body.tenant_id || body.organizationId || body.organization_id || '').trim().slice(0, 160);
}

function publicKey() {
  return String(process.env.SUPABASE_PUBLISHABLE_KEY || '');
}

function baseUrl() {
  return String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
}

function enforcementMode() {
  const mode = String(process.env.WAE_V74_TENANT_ENFORCEMENT || 'authenticated').toLowerCase();
  return ['observe','authenticated','strict'].includes(mode) ? mode : 'authenticated';
}

async function verifySupabaseUser(token) {
  const base = baseUrl(), apikey = publicKey();
  if (!base || !apikey) return { ok:false, error:'identity_provider_unconfigured' };
  try {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: { apikey, Authorization: `Bearer ${token}`, 'X-Client-Info':'wae-universal-identity-v74' },
      signal: AbortSignal.timeout(2_500),
    });
    const payload = await response.json().catch(()=>null);
    if (!response.ok || !payload?.id) return { ok:false, error:'invalid_access_token', status:response.status };
    return { ok:true, user:{ id:String(payload.id), email:payload.email ? String(payload.email) : null } };
  } catch {
    return { ok:false, error:'identity_provider_unavailable' };
  }
}

async function verifyTenantMembership({ token, userId, tenantId }) {
  const base = baseUrl(), apikey = publicKey();
  if (!base || !apikey) return { ok:false, error:'identity_provider_unconfigured' };
  const query = new URLSearchParams({
    select:'organization_id,role_id',
    organization_id:`eq.${tenantId}`,
    user_id:`eq.${userId}`,
    deleted_at:'is.null',
    limit:'1',
  });
  try {
    const response = await fetch(`${base}/rest/v1/organization_members?${query.toString()}`, {
      headers: { apikey, Authorization:`Bearer ${token}`, Accept:'application/json', 'X-Client-Info':'wae-universal-identity-v74' },
      signal: AbortSignal.timeout(2_500),
    });
    const payload = await response.json().catch(()=>[]);
    if (!response.ok) return { ok:false, error:'tenant_membership_lookup_failed', status:response.status };
    const row = Array.isArray(payload) ? payload[0] : null;
    if (!row?.organization_id) return { ok:false, error:'tenant_access_denied' };
    return { ok:true, organizationId:String(row.organization_id), roleId:row.role_id ? String(row.role_id) : null };
  } catch {
    return { ok:false, error:'tenant_membership_unavailable' };
  }
}

export function identitySecurityState() {
  return {
    version: IDENTITY_VERSION,
    provider: 'supabase_auth',
    configured: Boolean(baseUrl() && publicKey()),
    tenantEnforcement: enforcementMode(),
    anonymousCompatibility: enforcementMode() !== 'strict',
  };
}

export async function resolveRequestIdentity(req, body={}) {
  const token = bearerToken(req);
  const tenantId = requestedTenant(body);
  const mode = enforcementMode();

  if (!token) {
    return {
      version: IDENTITY_VERSION,
      authenticated: false,
      authPresent: false,
      tenantId: tenantId || null,
      tenantBound: false,
      tenantTrusted: false,
      enforcement: mode,
      allowed: mode !== 'strict' || !tenantId,
      reason: tenantId ? 'anonymous_tenant_untrusted' : 'anonymous',
    };
  }

  const verified = await verifySupabaseUser(token);
  if (!verified.ok) {
    return { version:IDENTITY_VERSION, authenticated:false, authPresent:true, tenantId:tenantId||null, tenantBound:false, tenantTrusted:false, enforcement:mode, allowed:false, reason:verified.error };
  }

  if (!tenantId) {
    return { version:IDENTITY_VERSION, authenticated:true, authPresent:true, userId:verified.user.id, email:verified.user.email, tenantId:null, tenantBound:false, tenantTrusted:false, enforcement:mode, allowed:true, reason:'authenticated_no_tenant' };
  }

  const membership = await verifyTenantMembership({ token, userId:verified.user.id, tenantId });
  if (!membership.ok) {
    const enforce = mode === 'authenticated' || mode === 'strict';
    return { version:IDENTITY_VERSION, authenticated:true, authPresent:true, userId:verified.user.id, email:verified.user.email, tenantId, tenantBound:false, tenantTrusted:false, enforcement:mode, allowed:!enforce, reason:membership.error };
  }

  return {
    version: IDENTITY_VERSION,
    authenticated:true,
    authPresent:true,
    userId:verified.user.id,
    email:verified.user.email,
    tenantId:membership.organizationId,
    roleId:membership.roleId,
    tenantBound:true,
    tenantTrusted:true,
    enforcement:mode,
    allowed:true,
    reason:'tenant_membership_verified',
  };
}
