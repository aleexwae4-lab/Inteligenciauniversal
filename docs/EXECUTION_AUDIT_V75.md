# Universal Core Execution Audit Ledger v75

## Purpose

v75 closes the production gap discovered after the v74 rollout: the Execution Plane correctly failed closed, but durable receipt persistence depended exclusively on `SUPABASE_SERVICE_ROLE_KEY` being present in Render. Production intentionally does not expose that credential, so blocked and completed executions could return a receipt while `audit.persisted` remained false.

v75 adds a least-exposure fallback without copying the service-role credential into Render.

## Transport order

The Execution Plane selects receipt persistence in this order:

1. `service_role` when `SUPABASE_SERVICE_ROLE_KEY` is explicitly configured server-side.
2. `token_guarded_rls` when `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `WAE_RUNTIME_BRIDGE_TOKEN` are available.
3. `unconfigured` otherwise.

The fallback sends only the execution receipt to PostgREST with the publishable API key and `x-wae-runtime-token`. No raw prompt or raw response content is stored by the receipt schema; request/response and identity fields are SHA-256 hashes.

## Database perimeter

`universal_execution_receipts_v37` has RLS enabled.

v75 hardening provides:

- `anon`: INSERT only.
- `authenticated`: no direct table privileges.
- `service_role`: privileged access retained.
- No anon SELECT, UPDATE, or DELETE grant.
- A single anon INSERT policy, `wae_execution_receipts_runtime_insert_v75`.
- The policy calls the already-existing `wae_runtime_control_bridge_v63('health', ...)` using the request header token and permits insertion only when the bridge returns `ok=true`.
- No new public `SECURITY DEFINER` function is introduced.

## Receipt constraints

The ledger rejects malformed records at the database boundary:

- request hash: required 64-character lowercase/uppercase hexadecimal SHA-256 representation;
- response/user/session hashes: nullable, otherwise 64-character hexadecimal;
- capability/domain/adapter/action/error lengths are bounded;
- metadata is limited to 16 KiB;
- existing status, risk, side-effect, and non-negative latency constraints remain active.

## Security tradeoff

`token_guarded_rls` is intentionally narrower than copying a service-role key into Render, but it is not equivalent to removing the bridge's current `anon` EXECUTE grant. The bridge token remains a privileged server secret. If it is compromised, an attacker could attempt allowed bridge operations and receipt writes until the token is rotated.

Therefore `controlPlane.promotionGate.dbExecuteRevocationReady` remains false while the internal RPC plane still runs in publishable compatibility mode. v75 solves durable execution auditing; it does not claim completion of all database least-privilege work.

## Production certification

The production gate now requires:

- `execution-audit-ledger/v75` exposed by the Execution Plane;
- durable ledger state configured;
- raw content storage disabled;
- hashed identities only;
- a blocked unsupported action returns HTTP 422 **and** persists its receipt;
- a safe local read-only primitive returns HTTP 200 **and** persists its receipt;
- audit mode is either `service_role` or `token_guarded_rls`.

A release is not certified merely because CI passes; these probes must succeed against the deployed Render service.
