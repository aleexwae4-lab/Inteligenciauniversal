# Execution Ledger v75 — Rollback

Application rollback is non-destructive: revert the v75 application commit and `/api/execute` returns to its previous injected persistence behavior.

The additive database function `wae_record_execution_receipt_v75(text,jsonb)` may remain deployed safely because no caller uses it after an application rollback. It does not alter the receipt table schema or RLS state.

If removal is later required, drop only that function after confirming no deployed application references it. Do not modify the existing execution receipt table or the v63 runtime bridge credential as part of rollback.
