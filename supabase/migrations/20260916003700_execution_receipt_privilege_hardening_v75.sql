revoke all on table public.universal_execution_receipts_v37 from authenticated;

comment on table public.universal_execution_receipts_v37 is
  'Universal Core execution audit ledger. Direct authenticated access is revoked. service_role retains privileged access; anon receives only token-guarded INSERT through RLS policy wae_execution_receipts_runtime_insert_v75.';
