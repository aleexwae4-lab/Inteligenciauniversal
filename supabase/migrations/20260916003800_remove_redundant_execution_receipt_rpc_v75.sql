-- v75 reconciliation: the durable execution audit ledger promoted in
-- 20260916003600_execution_receipt_token_rls_v75.sql uses token-guarded RLS
-- and does not require the temporary SECURITY DEFINER receipt RPC introduced
-- by the parallel 20260916003500 migration.
--
-- Keep migration history intact and remove only the redundant function.
-- The receipt table, RLS policy, grants, constraints, and v63 runtime bridge
-- remain unchanged.

drop function if exists public.wae_record_execution_receipt_v75(text,jsonb);
