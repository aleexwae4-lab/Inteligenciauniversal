# Universal Core Execution Receipt Ledger v75

## Objective

v75 closes the production-certification gap discovered after the v74 rollout: `/api/execute` correctly failed closed for unsupported capabilities, but the cryptographic execution receipt could not be persisted when Render did not expose `SUPABASE_SERVICE_ROLE_KEY`.

## Architecture

`/api/execute` -> `Execution Plane v65` -> `Execution Ledger v75` -> PostgreSQL receipt ledger.

Persistence uses two ordered transports:

1. **Service-role direct** when `SUPABASE_SERVICE_ROLE_KEY` is present server-side.
2. **Private-token bridge** when Universal Core has Supabase connectivity plus `WAE_RUNTIME_BRIDGE_TOKEN`.

The fallback invokes `wae_record_execution_receipt_v75` through the centralized v74 internal RPC transport. The database function is `SECURITY DEFINER`, but it validates the private runtime bridge token against the existing hashed credential before inserting a receipt.

## Security properties

- `universal_execution_receipts_v37` keeps RLS enabled.
- No public table policy is added.
- No raw secret is stored in a receipt.
- The RPC accepts only a bounded receipt object and validates status, risk level, side effect, UUID/timestamps and SHA-256 hash contracts.
- An invalid bridge token is rejected before insertion.
- RPC callers can execute the function, but possession of the private runtime token is still required for a successful write.
- The public execution contract remains unchanged.

## Compatibility

The change is additive. `lib/execution-plane.js` keeps its existing behavior and injectable persistence contract. `api/execute.js` injects the v75 ledger, so both `/api/execute` and the v73 backend adapter that delegates to it gain hardened persistence without changing response shape.

## Production gate

The v65+v74 production certification requires an unsupported `computer_use/click` request to:

- return HTTP 422;
- remain `blocked` and fail closed;
- emit `universal-execution-receipt/v1`;
- report `capability_not_executable`;
- use side effect `none`;
- persist the receipt (`audit.persisted === true`).

v75 exists specifically to make that invariant true without weakening RLS or exposing the service-role credential.
