create or replace function public.wae_record_execution_receipt_v75(
  p_token text,
  p_receipt jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_expected text;
  v_id uuid;
  v_created_at timestamptz;
  v_finished_at timestamptz;
  v_capability text := left(coalesce(p_receipt->>'capability_id',''),120);
  v_domain text := nullif(left(coalesce(p_receipt->>'domain_id',''),120),'');
  v_adapter text := left(coalesce(p_receipt->>'adapter',''),160);
  v_action text := left(coalesce(p_receipt->>'action',''),120);
  v_status text := lower(left(coalesce(p_receipt->>'status',''),32));
  v_risk text := lower(left(coalesce(p_receipt->>'risk_level','low'),32));
  v_side text := lower(left(coalesce(p_receipt->>'side_effect','none'),32));
  v_request_hash text := lower(left(coalesce(p_receipt->>'request_hash',''),64));
  v_response_hash text := nullif(lower(left(coalesce(p_receipt->>'response_hash',''),64)),'');
  v_user_hash text := nullif(lower(left(coalesce(p_receipt->>'user_key_hash',''),64)),'');
  v_session_hash text := nullif(lower(left(coalesce(p_receipt->>'session_key_hash',''),64)),'');
  v_latency integer;
  v_metadata jsonb := case when jsonb_typeof(p_receipt->'metadata')='object' then p_receipt->'metadata' else '{}'::jsonb end;
begin
  select token_hash into v_expected
  from wae_private.bridge_credentials
  where name='universal_core_runtime_v63' and active=true;

  if v_expected is null
     or encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') <> v_expected then
    raise exception 'bridge_auth_failed' using errcode='28000';
  end if;

  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then
    return jsonb_build_object('ok',false,'error','receipt_object_required');
  end if;
  if pg_column_size(p_receipt) > 65536 then
    return jsonb_build_object('ok',false,'error','receipt_too_large');
  end if;
  if v_capability='' or v_adapter='' or v_action='' then
    return jsonb_build_object('ok',false,'error','receipt_identity_required');
  end if;
  if v_status not in ('started','completed','failed','blocked') then
    return jsonb_build_object('ok',false,'error','invalid_receipt_status');
  end if;
  if v_risk not in ('low','medium','high','critical') then
    return jsonb_build_object('ok',false,'error','invalid_risk_level');
  end if;
  if v_side not in ('none','read','write','external_write') then
    return jsonb_build_object('ok',false,'error','invalid_side_effect');
  end if;
  if v_request_hash !~ '^[a-f0-9]{64}$'
     or (v_response_hash is not null and v_response_hash !~ '^[a-f0-9]{64}$')
     or (v_user_hash is not null and v_user_hash !~ '^[a-f0-9]{64}$')
     or (v_session_hash is not null and v_session_hash !~ '^[a-f0-9]{64}$') then
    return jsonb_build_object('ok',false,'error','invalid_hash_contract');
  end if;

  begin
    v_id := coalesce(nullif(p_receipt->>'id','')::uuid, gen_random_uuid());
  exception when others then
    return jsonb_build_object('ok',false,'error','invalid_receipt_id');
  end;
  begin
    v_created_at := coalesce(nullif(p_receipt->>'created_at','')::timestamptz, clock_timestamp());
  exception when others then
    return jsonb_build_object('ok',false,'error','invalid_created_at');
  end;
  begin
    v_finished_at := nullif(p_receipt->>'finished_at','')::timestamptz;
  exception when others then
    return jsonb_build_object('ok',false,'error','invalid_finished_at');
  end;
  begin
    v_latency := case when coalesce(p_receipt->>'latency_ms','') ~ '^[0-9]+$' then least(3600000,(p_receipt->>'latency_ms')::integer) else null end;
  exception when others then
    v_latency := null;
  end;

  insert into public.universal_execution_receipts_v37(
    id,created_at,finished_at,capability_id,domain_id,adapter,action,status,
    risk_level,side_effect,approval_required,approved,request_hash,response_hash,
    user_key_hash,session_key_hash,latency_ms,error_code,metadata
  ) values (
    v_id,v_created_at,v_finished_at,v_capability,v_domain,v_adapter,v_action,v_status,
    v_risk,v_side,
    lower(coalesce(p_receipt->>'approval_required','false')) in ('1','true','yes','on'),
    lower(coalesce(p_receipt->>'approved','false')) in ('1','true','yes','on'),
    v_request_hash,v_response_hash,v_user_hash,v_session_hash,v_latency,
    nullif(left(coalesce(p_receipt->>'error_code',''),160),''),v_metadata
  )
  on conflict (id) do nothing;

  return jsonb_build_object('ok',true,'version','execution-receipt-ledger/v75','receipt_id',v_id,'persisted',true);
exception when others then
  return jsonb_build_object('ok',false,'error','receipt_persist_failed','code',sqlstate,'detail',left(sqlerrm,180));
end;
$function$;

revoke all on function public.wae_record_execution_receipt_v75(text,jsonb) from public;
grant execute on function public.wae_record_execution_receipt_v75(text,jsonb) to anon, authenticated, service_role;
comment on function public.wae_record_execution_receipt_v75(text,jsonb) is 'WAE v75 server bridge for immutable execution receipts. Requires the private runtime bridge token; does not expose table access.';
