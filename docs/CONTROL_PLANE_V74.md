# Universal Core Enterprise Control Plane v74

## Purpose

v74 hardens the existing v73 backend without changing its public namespace. It introduces verified user identity, tenant trust derived from Supabase RLS membership, and a centralized server-only transport for privileged Supabase RPC calls.

## Compatibility contract

- `/api/v73/*` remains the stable public API namespace.
- Anonymous chat remains compatible under the default `authenticated` enforcement mode.
- A request that presents an invalid bearer token fails closed.
- If an authenticated request claims an organization/tenant, v74 verifies membership through `organization_members` using that user's bearer token. A mismatch fails closed.
- Anonymous tenant values are explicitly marked untrusted and are not upgraded into trusted request context.
- Admin endpoints continue to use the v73 admin-key contract and do not treat that key as a Supabase user token.

## Internal RPC least privilege

`lib/internal-supabase-rpc-v74.js` centralizes server-to-Supabase RPC calls.

Credential order:

1. `SUPABASE_SERVICE_ROLE_KEY` when configured.
2. `SUPABASE_PUBLISHABLE_KEY` only as a compatibility fallback.
3. Unconfigured/fail-safe state when neither is present.

The transport never returns or logs credential material. Public backend status exposes only whether the internal RPC plane is configured and whether least-privilege promotion is ready. The exact credential mode is available only to code paths that explicitly request the administrative view.

## Database privilege promotion gate

Supabase security advisors currently report SECURITY DEFINER functions exposed to `anon`/`authenticated`. Some of those functions, including the runtime-control bridge, also enforce a private custom token internally. v74 intentionally does **not** revoke their database EXECUTE grants yet.

Revocation is permitted only after production proves that internal RPC traffic is running with service-role transport. The sequence is:

1. Deploy v74 with service-role preference.
2. Verify `controlPlane.promotionGate.dbExecuteRevocationReady === true` in production and confirm runtime-control/certification regressions remain green.
3. Trace each target RPC caller.
4. Apply a narrow migration revoking `anon` and `authenticated` only for confirmed server-internal RPCs and granting `service_role`.
5. Re-run CI, production certification, runtime admission, benchmark persistence and rollback checks.

No bulk revocation is allowed.

## Tenant enforcement modes

`WAE_V74_TENANT_ENFORCEMENT` accepts:

- `observe`: verify when possible but do not reject tenant mismatch.
- `authenticated` (default): authenticated tenant claims must match RLS membership; anonymous compatibility remains available.
- `strict`: tenant claims require an authenticated, verified membership.

The default is intentionally progressive so the existing public chat is not broken during rollout.

## Security properties

- User identity is verified against Supabase Auth server-side.
- Tenant trust is never derived solely from request JSON.
- Membership is checked with the user's JWT, so existing RLS remains authoritative.
- Service-role material is server-only and never included in status/config payloads.
- Internal RPC names are constrained before dispatch.
- Network calls use hard timeouts and sanitized failure payloads.
- Existing custom bridge tokens remain in place as defense in depth during migration.
