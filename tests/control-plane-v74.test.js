import test from 'node:test';
import assert from 'node:assert/strict';
import { controlPlaneState, CONTROL_PLANE_VERSION } from '../lib/control-plane-v74.js';
import { internalSupabaseCredentialMode, internalSupabaseTransportState } from '../lib/internal-supabase-rpc-v74.js';
import { resolveRequestIdentity, IDENTITY_VERSION } from '../lib/identity-v74.js';

function preserve(names) {
  const values = Object.fromEntries(names.map(name => [name, process.env[name]]));
  return () => {
    for (const name of names) {
      if (values[name] === undefined) delete process.env[name];
      else process.env[name] = values[name];
    }
  };
}

test('control plane exposes no credential material', () => {
  const restore = preserve(['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY']);
  try {
    process.env.SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-private';
    assert.equal(internalSupabaseCredentialMode(), 'service_role');
    assert.equal(internalSupabaseTransportState().leastPrivilegeReady, true);
    const publicState = JSON.stringify(controlPlaneState());
    assert.equal(publicState.includes('test-public'), false);
    assert.equal(publicState.includes('test-private'), false);
    assert.equal(publicState.includes('credentialMode'), false);
    assert.equal(controlPlaneState().version, CONTROL_PLANE_VERSION);
  } finally { restore(); }
});

test('publishable fallback remains explicitly non-ready for DB privilege revocation', () => {
  const restore = preserve(['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY']);
  try {
    process.env.SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-public';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(internalSupabaseCredentialMode(), 'publishable_compat');
    assert.equal(internalSupabaseTransportState().leastPrivilegeReady, false);
    assert.equal(controlPlaneState().promotionGate.dbExecuteRevocationReady, false);
  } finally { restore(); }
});

test('anonymous tenant context is not trusted in compatibility mode', async () => {
  const restore = preserve(['WAE_V74_TENANT_ENFORCEMENT']);
  try {
    process.env.WAE_V74_TENANT_ENFORCEMENT = 'authenticated';
    const identity = await resolveRequestIdentity({ headers:{} }, { tenantId:'tenant-test' });
    assert.equal(identity.version, IDENTITY_VERSION);
    assert.equal(identity.authenticated, false);
    assert.equal(identity.tenantTrusted, false);
    assert.equal(identity.allowed, true);
    assert.equal(identity.reason, 'anonymous_tenant_untrusted');
  } finally { restore(); }
});

test('strict tenant mode rejects anonymous tenant claims', async () => {
  const restore = preserve(['WAE_V74_TENANT_ENFORCEMENT']);
  try {
    process.env.WAE_V74_TENANT_ENFORCEMENT = 'strict';
    const identity = await resolveRequestIdentity({ headers:{} }, { organizationId:'tenant-test' });
    assert.equal(identity.authenticated, false);
    assert.equal(identity.tenantTrusted, false);
    assert.equal(identity.allowed, false);
  } finally { restore(); }
});
