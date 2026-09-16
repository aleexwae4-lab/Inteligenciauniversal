create table if not exists public.wae_gpu_lane_metrics_v79 (
  scope_hash text not null,
  lane_id text not null,
  task_class text not null,
  window_date date not null default current_date,
  attempts bigint not null default 0,
  successes bigint not null default 0,
  failures bigint not null default 0,
  rate_limit_failures bigint not null default 0,
  timeout_failures bigint not null default 0,
  upstream_failures bigint not null default 0,
  auth_failures bigint not null default 0,
  saturated_skips bigint not null default 0,
  hedged_attempts bigint not null default 0,
  winner_count bigint not null default 0,
  relative_cost_units bigint not null default 0,
  latency_ewma_ms numeric,
  response_start_ewma_ms numeric,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope_hash,lane_id,task_class,window_date),
  constraint wae_gpu_scope_hash_v79_chk check (scope_hash ~ '^[a-f0-9]{16,64}$'),
  constraint wae_gpu_lane_id_v79_chk check (lane_id ~ '^[a-z0-9_.:-]{1,120}$'),
  constraint wae_gpu_task_v79_chk check (task_class ~ '^[a-z0-9_.:-]{1,80}$')
);

alter table public.wae_gpu_lane_metrics_v79 enable row level security;
revoke all on public.wae_gpu_lane_metrics_v79 from anon, authenticated;
grant select,insert,update on public.wae_gpu_lane_metrics_v79 to service_role;

create or replace function public.wae_gpu_metrics_record_v79(
  p_scope_hash text,p_lane_id text,p_task_class text,p_success boolean,
  p_failure_class text default null,p_latency_ms integer default null,
  p_response_start_ms integer default null,p_relative_cost_units bigint default 0,
  p_hedged boolean default false,p_winner boolean default false,p_saturated boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  if p_scope_hash !~ '^[a-f0-9]{16,64}$' or p_lane_id !~ '^[a-z0-9_.:-]{1,120}$' or p_task_class !~ '^[a-z0-9_.:-]{1,80}$' then
    raise exception 'invalid_gpu_metric_key' using errcode='22023';
  end if;
  insert into public.wae_gpu_lane_metrics_v79 as m (
    scope_hash,lane_id,task_class,window_date,attempts,successes,failures,
    rate_limit_failures,timeout_failures,upstream_failures,auth_failures,saturated_skips,
    hedged_attempts,winner_count,relative_cost_units,latency_ewma_ms,response_start_ewma_ms,
    last_success_at,last_failure_at,updated_at
  ) values (
    p_scope_hash,p_lane_id,p_task_class,current_date,case when p_saturated then 0 else 1 end,
    case when p_success then 1 else 0 end,case when not p_success and not p_saturated then 1 else 0 end,
    case when p_failure_class='rate_limit' then 1 else 0 end,
    case when p_failure_class='timeout' then 1 else 0 end,
    case when p_failure_class='upstream' then 1 else 0 end,
    case when p_failure_class='auth' then 1 else 0 end,
    case when p_saturated then 1 else 0 end,
    case when p_hedged then 1 else 0 end,
    case when p_winner then 1 else 0 end,
    greatest(coalesce(p_relative_cost_units,0),0),
    case when p_latency_ms is null then null else greatest(p_latency_ms,0) end,
    case when p_response_start_ms is null then null else greatest(p_response_start_ms,0) end,
    case when p_success then now() else null end,
    case when not p_success and not p_saturated then now() else null end,
    now()
  )
  on conflict (scope_hash,lane_id,task_class,window_date) do update set
    attempts=m.attempts+excluded.attempts,
    successes=m.successes+excluded.successes,
    failures=m.failures+excluded.failures,
    rate_limit_failures=m.rate_limit_failures+excluded.rate_limit_failures,
    timeout_failures=m.timeout_failures+excluded.timeout_failures,
    upstream_failures=m.upstream_failures+excluded.upstream_failures,
    auth_failures=m.auth_failures+excluded.auth_failures,
    saturated_skips=m.saturated_skips+excluded.saturated_skips,
    hedged_attempts=m.hedged_attempts+excluded.hedged_attempts,
    winner_count=m.winner_count+excluded.winner_count,
    relative_cost_units=m.relative_cost_units+excluded.relative_cost_units,
    latency_ewma_ms=case when excluded.latency_ewma_ms is null then m.latency_ewma_ms when m.latency_ewma_ms is null then excluded.latency_ewma_ms else round((m.latency_ewma_ms*0.75+excluded.latency_ewma_ms*0.25)::numeric,2) end,
    response_start_ewma_ms=case when excluded.response_start_ewma_ms is null then m.response_start_ewma_ms when m.response_start_ewma_ms is null then excluded.response_start_ewma_ms else round((m.response_start_ewma_ms*0.75+excluded.response_start_ewma_ms*0.25)::numeric,2) end,
    last_success_at=coalesce(excluded.last_success_at,m.last_success_at),
    last_failure_at=coalesce(excluded.last_failure_at,m.last_failure_at),
    updated_at=now();
  return jsonb_build_object('ok',true,'version','gpu-metrics/v79');
end;
$$;
revoke all on function public.wae_gpu_metrics_record_v79(text,text,text,boolean,text,integer,integer,bigint,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.wae_gpu_metrics_record_v79(text,text,text,boolean,text,integer,integer,bigint,boolean,boolean,boolean) to service_role;

create or replace function public.wae_gpu_metrics_snapshot_v79(p_scope_hash text)
returns jsonb
language sql
security invoker
set search_path=public
as $$
  select case when coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    then jsonb_build_object('ok',false,'error','service_role_required')
    else jsonb_build_object(
      'ok',true,'version','gpu-metrics/v79',
      'daily_relative_cost_units',coalesce(sum(relative_cost_units) filter(where window_date=current_date),0),
      'rows',coalesce(jsonb_agg(jsonb_build_object(
        'lane_id',lane_id,'task_class',task_class,'window_date',window_date,'attempts',attempts,'successes',successes,'failures',failures,
        'rate_limit_failures',rate_limit_failures,'timeout_failures',timeout_failures,'upstream_failures',upstream_failures,
        'auth_failures',auth_failures,'saturated_skips',saturated_skips,'hedged_attempts',hedged_attempts,'winner_count',winner_count,
        'relative_cost_units',relative_cost_units,'latency_ewma_ms',latency_ewma_ms,'response_start_ewma_ms',response_start_ewma_ms,
        'last_success_at',last_success_at,'last_failure_at',last_failure_at,'updated_at',updated_at
      ) order by window_date desc,lane_id,task_class) filter(where lane_id is not null),'[]'::jsonb)
    ) end
  from public.wae_gpu_lane_metrics_v79
  where scope_hash=p_scope_hash and window_date>=current_date-1;
$$;
revoke all on function public.wae_gpu_metrics_snapshot_v79(text) from public,anon,authenticated;
grant execute on function public.wae_gpu_metrics_snapshot_v79(text) to service_role;

create index if not exists wae_gpu_metrics_v79_updated_idx on public.wae_gpu_lane_metrics_v79(updated_at desc);
create index if not exists wae_gpu_metrics_v79_lane_task_idx on public.wae_gpu_lane_metrics_v79(lane_id,task_class,window_date desc);

comment on table public.wae_gpu_lane_metrics_v79 is 'Aggregated GPU scheduler telemetry only. Never stores prompts, responses, attachments, API keys, or raw tenant/session identifiers.';
