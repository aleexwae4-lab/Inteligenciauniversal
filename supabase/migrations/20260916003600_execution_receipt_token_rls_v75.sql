alter table public.universal_execution_receipts_v37
  add constraint universal_execution_receipts_v37_request_hash_sha256_check
    check (request_hash ~ '^[a-f0-9]{64}$'),
  add constraint universal_execution_receipts_v37_response_hash_sha256_check
    check (response_hash is null or response_hash ~ '^[a-f0-9]{64}$'),
  add constraint universal_execution_receipts_v37_user_hash_sha256_check
    check (user_key_hash is null or user_key_hash ~ '^[a-f0-9]{64}$'),
  add constraint universal_execution_receipts_v37_session_hash_sha256_check
    check (session_key_hash is null or session_key_hash ~ '^[a-f0-9]{64}$'),
  add constraint universal_execution_receipts_v37_capability_length_check
    check (length(capability_id) between 1 and 120),
  add constraint universal_execution_receipts_v37_domain_length_check
    check (domain_id is null or length(domain_id) between 1 and 120),
  add constraint universal_execution_receipts_v37_adapter_length_check
    check (length(adapter) between 1 and 160),
  add constraint universal_execution_receipts_v37_action_length_check
    check (length(action) between 1 and 120),
  add constraint universal_execution_receipts_v37_error_length_check
    check (error_code is null or length(error_code) between 1 and 160),
  add constraint universal_execution_receipts_v37_metadata_size_check
    check (pg_column_size(metadata) <= 16384);

revoke all on table public.universal_execution_receipts_v37 from anon;
grant insert on table public.universal_execution_receipts_v37 to anon;

drop policy if exists wae_execution_receipts_runtime_insert_v75 on public.universal_execution_receipts_v37;
create policy wae_execution_receipts_runtime_insert_v75
on public.universal_execution_receipts_v37
for insert
to anon
with check (
  coalesce(
    (
      public.wae_runtime_control_bridge_v63(
        'health',
        '{}'::jsonb,
        coalesce(
          nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-wae-runtime-token',
          ''
        )
      ) ->> 'ok'
    )::boolean,
    false
  )
);

comment on policy wae_execution_receipts_runtime_insert_v75 on public.universal_execution_receipts_v37 is
  'Allows insert-only execution audit receipts from the Universal Core runtime when x-wae-runtime-token is validated by wae_runtime_control_bridge_v63. No anon SELECT/UPDATE/DELETE privileges are granted.';
