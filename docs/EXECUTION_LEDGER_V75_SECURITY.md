# Execution Ledger v75 — Security Invariants

The v75 receipt bridge is intentionally narrower than direct table access.

1. `universal_execution_receipts_v37` keeps RLS enabled.
2. The application does not receive a new table policy for anonymous or authenticated direct writes.
3. The RPC verifies the existing private WAE runtime bridge credential by SHA-256 before insertion.
4. Receipt fields are bounded and contract-validated before persistence.
5. Invalid authentication, malformed hashes, invalid UUIDs, invalid status/risk/side-effect values, or oversized receipt objects fail closed.
6. Service-role direct persistence remains preferred when available.
7. The fallback exists only to preserve server-side audit durability when Render is configured with publishable Supabase transport plus the private runtime bridge token.
8. No credential value is included in public status, receipt metadata, logs, or response payloads.
