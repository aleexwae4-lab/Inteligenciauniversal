# Universal Core v75 — Concurrent Release Reconciliation

Two v75 implementations landed close together on `main`.

The canonical production contract is the integrated implementation introduced by commit `776dfaf6037684ebdee17679a0d2c98e910da560`:

- `execution-audit-ledger/v75` is owned by `lib/execution-plane.js`.
- persistence modes are `service_role` or `token_guarded_rls`;
- the publishable-key fallback writes directly to `universal_execution_receipts_v37` through the token-guarded INSERT-only RLS policy;
- production certification verifies both blocked and completed receipts are durable.

A later parallel merge temporarily injected an alternate receipt persist function from `api/execute.js`. That injection used a different version/mode vocabulary and could cause the production certification contract to diverge even though both implementations attempted to solve the same durability gap.

This hotfix removes only that injection and restores `api/execute.js` to the integrated v75 contract. It does not roll back the stronger v75 RLS hardening, receipt constraints, grants, or certification workflow.

Database migration history is preserved. A follow-up migration removes the redundant temporary SECURITY DEFINER RPC after the token-guarded RLS path is confirmed active. No receipt-table policy or privilege from the canonical v75 is weakened.
