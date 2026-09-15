-- Universal Core v63 — Persistent Intelligence Reputation + Scale 20K
-- Shared, privacy-preserving runtime control plane for horizontal scaling.

create table if not exists public.wae_provider_runtime_reputation_v63 (
  provider text not null,
  model text not null default '',
  attempts bigint not null default 0 check (attempts >= 0),
  successes bigint not null default 0 check (successes >= 0),
  failures bigint not null default 0 check (failures >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  ewma_latency_ms numeric(12,2),
  ewma_ttft_ms numeric(12,2),
  ewma_quality numeric(8,2),
  ewma_evidence numeric(8,2),
  ewma_instruction numeric(8,2),
  ewma_cost_microunits numeric(14,2),
  circuit_until timestamptz,
  last_error_class text,
  last_quality_grade text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_quality_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (provider, model)
);

create index if not exists wae_provider_runtime_reputation_v63_updated_idx
  on public.wae_provider_runtime_reputation_v63(updated_at desc);

alter table public.wae_provider_runtime_reputation_v63 enable row level security;
revoke all on public.wae_provider_runtime_reputation_v63 from anon, authenticated;
grant select, insert, update, delete on public.wae_provider_runtime_reputation_v63 to service_role;

create table if not exists public.wae_chat_rate_buckets_v63 (
  principal_hash text not null check (principal_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (principal_hash, window_start)
);
create index if not exists wae_chat_rate_buckets_v63_updated_idx
  on public.wae_chat_rate_buckets_v63(updated_at);
alter table public.wae_chat_rate_buckets_v63 enable row level security;
revoke all on public.wae_chat_rate_buckets_v63 from anon, authenticated;
grant select, insert, update, delete on public.wae_chat_rate_buckets_v63 to service_role;

create table if not exists public.wae_chat_active_leases_v63 (
  lease_id uuid primary key default gen_random_uuid(),
  principal_hash text not null check (principal_hash ~ '^[a-f0-9]{64}$'),
  session_hash text not null unique check (session_hash ~ '^[a-f0-9]{64}$'),
  tenant_hash text check (tenant_hash is null or tenant_hash ~ '^[a-f0-9]{64}$'),
  shard smallint not null check (shard between 0 and 63),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists wae_chat_active_leases_v63_shard_expiry_idx
  on public.wae_chat_active_leases_v63(shard, expires_at);
create index if not exists wae_chat_active_leases_v63_expiry_idx
  on public.wae_chat_active_leases_v63(expires_at);
alter table public.wae_chat_active_leases_v63 enable row level security;
revoke all on public.wae_chat_active_leases_v63 from anon, authenticated;
grant select, insert, update, delete on public.wae_chat_active_leases_v63 to service_role;

insert into wae_private.bridge_credentials(name, token_hash, active, rotated_at)
values ('universal_core_runtime_v63','929d71e50b942c339e58b25644c9ab3d0ba1fe9a24a5a3ec9d7dd5b56b0ac930',true,now())
on conflict (name) do update set token_hash=excluded.token_hash, active=true, rotated_at=now();

create or replace function public.wae_runtime_control_bridge_v63(
  p_action text,
  p_payload jsonb default '{}'::jsonb,
  p_token text default ''::text
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $$
declare
  v_expected text;
  v_action text := lower(coalesce(p_action,''));
  v_now timestamptz := clock_timestamp();
  v_provider text := left(coalesce(nullif(p_payload->>'provider',''),'unknown'),100);
  v_model text := left(coalesce(p_payload->>'model',''),240);
  v_success boolean := lower(coalesce(p_payload->>'success','false')) in ('1','true','yes');
  v_error_class text := left(lower(coalesce(p_payload->>'errorClass','')),40);
  v_quality_grade text := left(coalesce(p_payload->>'qualityGrade',''),20);
  v_latency numeric := case when coalesce(p_payload->>'latencyMs','') ~ '^[0-9]+([.][0-9]+)?$' then (p_payload->>'latencyMs')::numeric else null end;
  v_ttft numeric := case when coalesce(p_payload->>'ttftMs','') ~ '^[0-9]+([.][0-9]+)?$' then (p_payload->>'ttftMs')::numeric else null end;
  v_quality numeric := case when coalesce(p_payload->>'quality','') ~ '^[0-9]+([.][0-9]+)?$' then least(100,greatest(0,(p_payload->>'quality')::numeric)) else null end;
  v_evidence numeric := case when coalesce(p_payload->>'evidence','') ~ '^[0-9]+([.][0-9]+)?$' then least(100,greatest(0,(p_payload->>'evidence')::numeric)) else null end;
  v_instruction numeric := case when coalesce(p_payload->>'instruction','') ~ '^[0-9]+([.][0-9]+)?$' then least(100,greatest(0,(p_payload->>'instruction')::numeric)) else null end;
  v_cost numeric := case when coalesce(p_payload->>'costMicrounits','') ~ '^[0-9]+([.][0-9]+)?$' then greatest(0,(p_payload->>'costMicrounits')::numeric) else null end;
  v_capability text := lower(coalesce(nullif(p_payload->>'capability',''),'general_reasoning'));
  v_limit integer := least(greatest(coalesce(nullif(p_payload->>'limit','')::integer,24),1),40);
  v_rows jsonb;
  v_runtime jsonb;
  v_principal text := lower(coalesce(p_payload->>'principalHash',''));
  v_session text := lower(coalesce(p_payload->>'sessionHash',''));
  v_tenant text := nullif(lower(coalesce(p_payload->>'tenantHash','')),'');
  v_per_minute integer := least(greatest(coalesce(nullif(p_payload->>'perMinute','')::integer,30),1),240);
  v_global_limit integer := least(greatest(coalesce(nullif(p_payload->>'globalConcurrent','')::integer,2048),64),4096);
  v_lease_seconds integer := least(greatest(coalesce(nullif(p_payload->>'leaseSeconds','')::integer,45),15),120);
  v_window timestamptz;
  v_minute_count integer;
  v_shard smallint;
  v_shard_limit integer;
  v_shard_active integer;
  v_lease_id uuid;
  v_release_id uuid;
begin
  select token_hash into v_expected
  from wae_private.bridge_credentials
  where name='universal_core_runtime_v63' and active=true;

  if v_expected is null or encode(digest(coalesce(p_token,''),'sha256'),'hex')<>v_expected then
    raise exception 'bridge_auth_failed' using errcode='28000';
  end if;

  if v_capability not in ('general_reasoning','legal_reasoning','finance','sales','strategy','technology') then
    v_capability := 'general_reasoning';
  end if;

  if v_action in ('health','status') then
    return jsonb_build_object(
      'ok',true,
      'version','universal-runtime-control/v63',
      'subscriber_target',20000,
      'admission_shards',64,
      'provider_rows',(select count(*) from public.wae_provider_runtime_reputation_v63),
      'active_leases',(select count(*) from public.wae_chat_active_leases_v63 where expires_at>v_now),
      'privacy',jsonb_build_object('stores_raw_principal',false,'stores_prompt_content',false,'stores_response_content',false)
    );
  end if;

  if v_action='snapshot' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'provider',r.provider,
      'model',r.model,
      'attempts',r.attempts,
      'successes',r.successes,
      'failures',r.failures,
      'consecutiveFailures',r.consecutive_failures,
      'ewmaLatencyMs',r.ewma_latency_ms,
      'ewmaTtftMs',r.ewma_ttft_ms,
      'ewmaQuality',r.ewma_quality,
      'ewmaEvidence',r.ewma_evidence,
      'ewmaInstruction',r.ewma_instruction,
      'ewmaCostMicrounits',r.ewma_cost_microunits,
      'circuitUntil',r.circuit_until,
      'lastErrorClass',r.last_error_class,
      'lastQualityGrade',r.last_quality_grade,
      'updatedAt',r.updated_at
    ) order by r.updated_at desc),'[]'::jsonb)
    into v_runtime
    from public.wae_provider_runtime_reputation_v63 r;

    with eligible as (
      select r.*,
        case when r.capability=v_capability then 0 else 1 end as fallback_rank
      from public.wae_provider_capability_reputation_v1 r
      where r.capability in (v_capability,'general_reasoning')
        and r.confidence_score >= 20
    ), chosen as (
      select distinct on (provider,model)
        provider,model,capability,reputation_score,confidence_score,samples,quality_score,reliability_score,
        latency_score,evidence_score,avg_latency_ms,fallback_rank
      from eligible
      order by provider,model,fallback_rank asc,confidence_score desc,samples desc
    ), adjusted as (
      select *, round(greatest(-5.5::numeric,least(5.5::numeric,
        ((reputation_score-72)/5.0) * least(1::numeric,confidence_score/70.0)
      )),2) as adjustment
      from chosen
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'provider',provider,'model',model,'capability',capability,'adjustment',adjustment,
      'reputationScore',reputation_score,'confidenceScore',confidence_score,'samples',samples,
      'qualityScore',quality_score,'reliabilityScore',reliability_score,'latencyScore',latency_score,
      'evidenceScore',evidence_score,'avgLatencyMs',avg_latency_ms
    ) order by abs(adjustment) desc,confidence_score desc),'[]'::jsonb)
    into v_rows
    from (select * from adjusted order by abs(adjustment) desc,confidence_score desc limit v_limit) s;

    return jsonb_build_object(
      'ok',true,'version','universal-runtime-control/v63','capability',v_capability,
      'runtime',coalesce(v_runtime,'[]'::jsonb),'capabilityReputation',coalesce(v_rows,'[]'::jsonb),'refreshedAt',v_now
    );
  end if;

  if v_action='observe' then
    if v_provider='unknown' then return jsonb_build_object('ok',false,'error','provider_required'); end if;

    insert into public.wae_provider_runtime_reputation_v63(provider,model,updated_at)
    values(v_provider,v_model,v_now)
    on conflict(provider,model) do nothing;

    if v_success then
      update public.wae_provider_runtime_reputation_v63 r set
        attempts=r.attempts+1,
        successes=r.successes+1,
        consecutive_failures=0,
        ewma_latency_ms=case when v_latency is null then r.ewma_latency_ms else coalesce(r.ewma_latency_ms*.75+v_latency*.25,v_latency) end,
        ewma_ttft_ms=case when v_ttft is null then r.ewma_ttft_ms else coalesce(r.ewma_ttft_ms*.75+v_ttft*.25,v_ttft) end,
        ewma_cost_microunits=case when v_cost is null then r.ewma_cost_microunits else coalesce(r.ewma_cost_microunits*.75+v_cost*.25,v_cost) end,
        circuit_until=null,
        last_error_class=null,
        last_success_at=v_now,
        updated_at=v_now
      where r.provider=v_provider and r.model=v_model;
    else
      update public.wae_provider_runtime_reputation_v63 r set
        attempts=r.attempts+1,
        failures=r.failures+1,
        consecutive_failures=r.consecutive_failures+1,
        circuit_until=case
          when v_error_class='auth' then greatest(coalesce(r.circuit_until,v_now),v_now+interval '60 minutes')
          when v_error_class='rate_limit' then greatest(coalesce(r.circuit_until,v_now),v_now+interval '10 minutes')
          when v_error_class in ('timeout','server') and r.consecutive_failures+1>=3 then greatest(coalesce(r.circuit_until,v_now),v_now+interval '10 minutes')
          else r.circuit_until end,
        last_error_class=nullif(v_error_class,''),
        last_failure_at=v_now,
        updated_at=v_now
      where r.provider=v_provider and r.model=v_model;
    end if;

    if v_quality is not null or v_evidence is not null or v_instruction is not null or v_quality_grade<>'' then
      update public.wae_provider_runtime_reputation_v63 r set
        ewma_quality=case when v_quality is null then r.ewma_quality else coalesce(r.ewma_quality*.70+v_quality*.30,v_quality) end,
        ewma_evidence=case when v_evidence is null then r.ewma_evidence else coalesce(r.ewma_evidence*.70+v_evidence*.30,v_evidence) end,
        ewma_instruction=case when v_instruction is null then r.ewma_instruction else coalesce(r.ewma_instruction*.70+v_instruction*.30,v_instruction) end,
        last_quality_grade=case when v_quality_grade='' then r.last_quality_grade else v_quality_grade end,
        last_quality_at=v_now,
        updated_at=v_now
      where r.provider=v_provider and r.model=v_model;
    end if;

    return jsonb_build_object('ok',true,'version','universal-runtime-control/v63','provider',v_provider,'model',v_model);
  end if;

  if v_action='admit' then
    if v_principal !~ '^[a-f0-9]{64}$' or v_session !~ '^[a-f0-9]{64}$' or (v_tenant is not null and v_tenant !~ '^[a-f0-9]{64}$') then
      return jsonb_build_object('ok',false,'allowed',false,'reason','invalid_hash_contract');
    end if;

    v_window := date_trunc('minute',v_now);
    v_shard := mod(abs(hashtext(v_principal)),64)::smallint;
    v_shard_limit := ceil(v_global_limit::numeric/64)::integer + 2;
    perform pg_advisory_xact_lock(hashtext('wae-chat-v63-'||v_shard::text));

    delete from public.wae_chat_active_leases_v63 where shard=v_shard and expires_at<=v_now;
    delete from public.wae_chat_rate_buckets_v63 where principal_hash=v_principal and window_start < v_window-interval '2 minutes';

    insert into public.wae_chat_rate_buckets_v63(principal_hash,window_start,request_count,updated_at)
    values(v_principal,v_window,1,v_now)
    on conflict(principal_hash,window_start) do update set
      request_count=public.wae_chat_rate_buckets_v63.request_count+1,
      updated_at=excluded.updated_at
    returning request_count into v_minute_count;

    if v_minute_count>v_per_minute then
      return jsonb_build_object('ok',true,'allowed',false,'reason','distributed_rate_limit','retryAfterSeconds',greatest(1,60-extract(second from v_now)::integer),'minuteCount',v_minute_count,'minuteLimit',v_per_minute);
    end if;

    delete from public.wae_chat_active_leases_v63 where session_hash=v_session and expires_at<=v_now;
    if exists(select 1 from public.wae_chat_active_leases_v63 where session_hash=v_session and expires_at>v_now) then
      return jsonb_build_object('ok',true,'allowed',false,'reason','conversation_busy','retryAfterSeconds',1,'minuteCount',v_minute_count,'minuteLimit',v_per_minute);
    end if;

    select count(*)::integer into v_shard_active
    from public.wae_chat_active_leases_v63
    where shard=v_shard and expires_at>v_now;

    if v_shard_active>=v_shard_limit then
      return jsonb_build_object('ok',true,'allowed',false,'reason','distributed_capacity','retryAfterSeconds',1,'shard',v_shard,'shardActive',v_shard_active,'shardLimit',v_shard_limit,'globalTarget',v_global_limit);
    end if;

    insert into public.wae_chat_active_leases_v63(principal_hash,session_hash,tenant_hash,shard,expires_at)
    values(v_principal,v_session,v_tenant,v_shard,v_now+make_interval(secs=>v_lease_seconds))
    returning lease_id into v_lease_id;

    return jsonb_build_object('ok',true,'allowed',true,'leaseId',v_lease_id,'leaseSeconds',v_lease_seconds,'shard',v_shard,'shardActive',v_shard_active+1,'shardLimit',v_shard_limit,'globalTarget',v_global_limit,'minuteCount',v_minute_count,'minuteLimit',v_per_minute);
  end if;

  if v_action='release' then
    if v_session !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'released',false,'reason','invalid_session_hash'); end if;
    begin
      v_release_id := (p_payload->>'leaseId')::uuid;
    exception when others then
      return jsonb_build_object('ok',false,'released',false,'reason','invalid_lease_id');
    end;
    delete from public.wae_chat_active_leases_v63 where lease_id=v_release_id and session_hash=v_session;
    return jsonb_build_object('ok',true,'released',found);
  end if;

  return jsonb_build_object('ok',false,'error','unsupported_action');
exception when others then
  return jsonb_build_object('ok',false,'error','bridge_error','code',sqlstate,'detail',left(sqlerrm,240));
end;
$$;

revoke all on function public.wae_runtime_control_bridge_v63(text,jsonb,text) from public;
grant execute on function public.wae_runtime_control_bridge_v63(text,jsonb,text) to anon, authenticated, service_role;

comment on function public.wae_runtime_control_bridge_v63(text,jsonb,text) is
  'Universal Core v63 distributed runtime control plane. Accepts hashes/aggregate telemetry only; never prompt or response content.';
