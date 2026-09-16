import { identitySecurityState } from './identity-v74.js';
import { internalSupabaseTransportState } from './internal-supabase-rpc-v74.js';

export const CONTROL_PLANE_VERSION = 'universal-core-control-plane/v74';

export function controlPlaneState() {
  const identity = identitySecurityState();
  const transport = internalSupabaseTransportState();
  return {
    version: CONTROL_PLANE_VERSION,
    identity,
    internalRpc: transport,
    tenantTrust: {
      source: 'supabase_rls_membership',
      authenticatedBinding: true,
      anonymousTenantTrusted: false,
      enforcement: identity.tenantEnforcement,
    },
    promotionGate: {
      dbExecuteRevocationReady: transport.leastPrivilegeReady,
      requirement: 'service_role transport must be verified in production before revoking anon/authenticated EXECUTE on internal RPCs',
    },
  };
}
