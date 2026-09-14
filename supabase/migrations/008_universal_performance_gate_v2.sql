create or replace function public.iu_performance_gate_v2(
  p_window_hours integer default 6,
  p_min_ok integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
with params as (
  select greatest(1, least(coalesce(p_window_hours,6), 168))::int as hours,
         greatest(5, least(coalesce(p_min_ok,20), 1000))::int as min_ok
), traces as (
  select router_variant, status, total_latency_ms, nullif(ttft_ms,0) as ttft_ms
  from public.iu_request_traces, params
  where kind='chat'
    and created_at >= now() - make_interval(hours => params.hours)
    and router_variant in ('control','candidate')
), agg as (
  select router_variant,
         count(*) filter (where status='ok')::int as ok_count,
         count(*) filter (where status<>'ok')::int as error_count,
         count(*)::int as total_count,
         percentile_cont(0.5) within group (order by total_latency_ms) filter (where status='ok') as p50_ms,
         percentile_cont(0.95) within group (order by total_latency_ms) filter (where status='ok') as p95_ms,
         avg(total_latency_ms) filter (where status='ok') as avg_ms,
         avg(ttft_ms) filter (where status='ok' and ttft_ms is not null) as avg_ttft_ms
  from traces group by router_variant
), control as (select * from agg where router_variant='control'),
candidate as (select * from agg where router_variant='candidate'),
stream_state as (
  select count(*)::int as ready_count,
         min(ewma_ttft_ms) filter (where streaming_verified=true and circuit_state='CLOSED' and effective_health='healthy') as best_ttft_ms
  from public.iu_adaptive_model_registry_v1
  where enabled=true and streaming_verified=true and circuit_state='CLOSED' and effective_health='healthy'
    and coalesce(ewma_ttft_ms,999999) <= 2500
), fast_state as (
  select count(*)::int as ready_count
  from public.iu_adaptive_model_registry_v1
  where enabled=true and circuit_state='CLOSED' and effective_health='healthy'
    and coalesce(ewma_latency_ms,999999) <= 3000
    and coalesce((capabilities->>'runtime'),'server') <> 'browser'
), vals as (
  select params.hours, params.min_ok,
    coalesce(control.ok_count,0) control_ok, coalesce(control.error_count,0) control_errors, coalesce(control.total_count,0) control_total,
    round(coalesce(control.p50_ms,0))::int control_p50_ms, round(coalesce(control.p95_ms,0))::int control_p95_ms,
    round(coalesce(control.avg_ms,0))::int control_avg_ms, round(coalesce(control.avg_ttft_ms,0))::int control_avg_ttft_ms,
    coalesce(candidate.ok_count,0) candidate_ok, coalesce(candidate.error_count,0) candidate_errors, coalesce(candidate.total_count,0) candidate_total,
    round(coalesce(candidate.p50_ms,0))::int candidate_p50_ms, round(coalesce(candidate.p95_ms,0))::int candidate_p95_ms,
    round(coalesce(candidate.avg_ms,0))::int candidate_avg_ms, round(coalesce(candidate.avg_ttft_ms,0))::int candidate_avg_ttft_ms,
    coalesce(stream_state.ready_count,0) stream_ready_count, round(coalesce(stream_state.best_ttft_ms,0))::int best_stream_ttft_ms,
    coalesce(fast_state.ready_count,0) fast_ready_count
  from params left join control on true left join candidate on true cross join stream_state cross join fast_state
), decision as (
  select *,
    case when control_total=0 then null else control_errors::numeric/control_total end control_error_rate,
    case when candidate_total=0 then null else candidate_errors::numeric/candidate_total end candidate_error_rate,
    (control_ok >= min_ok and candidate_ok >= min_ok and candidate_total>0 and control_total>0
      and candidate_errors::numeric/candidate_total <= control_errors::numeric/control_total
      and candidate_p95_ms>0 and control_p95_ms>0 and candidate_p95_ms <= control_p95_ms*0.95) candidate_promotable
  from vals
)
select jsonb_build_object(
  'schema','universal-performance-gate/v2','generated_at',now(),'window_hours',hours,'min_ok_samples',min_ok,
  'candidate_promotable',candidate_promotable,
  'routing_state',case when control_ok<min_ok or candidate_ok<min_ok then 'INSUFFICIENT_DATA' when candidate_promotable then 'PROMOTE' else 'HOLD' end,
  'stream_ready',stream_ready_count>0,'stream_ready_count',stream_ready_count,'best_stream_ttft_ms',best_stream_ttft_ms,
  'fast_lane_ready',fast_ready_count>0,'fast_lane_ready_count',fast_ready_count,
  'control',jsonb_build_object('ok',control_ok,'errors',control_errors,'error_rate',case when control_error_rate is null then null else round(control_error_rate*100,2) end,'p50_ms',control_p50_ms,'p95_ms',control_p95_ms,'avg_ms',control_avg_ms,'avg_ttft_ms',control_avg_ttft_ms),
  'candidate',jsonb_build_object('ok',candidate_ok,'errors',candidate_errors,'error_rate',case when candidate_error_rate is null then null else round(candidate_error_rate*100,2) end,'p50_ms',candidate_p50_ms,'p95_ms',candidate_p95_ms,'avg_ms',candidate_avg_ms,'avg_ttft_ms',candidate_avg_ttft_ms),
  'policy',jsonb_build_object('candidate_error_rate_lte_control',true,'candidate_p95_improvement_required_pct',5,'stream_ttft_ceiling_ms',2500,'fast_lane_latency_ceiling_ms',3000)
) from decision;
$$;

revoke all on function public.iu_performance_gate_v2(integer,integer) from public, anon, authenticated;
grant execute on function public.iu_performance_gate_v2(integer,integer) to service_role;
