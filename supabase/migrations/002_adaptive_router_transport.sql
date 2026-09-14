-- WAE Adaptive Intelligence Router v2
-- Separates provider/model health from verified streaming transport capability.

create table if not exists public.iu_model_transport_capabilities_v1 (
  provider text not null,
  model_name text not null,
  streaming_verified boolean not null default false,
  probe_count integer not null default 0,
  streaming_success_count integer not null default 0,
  streaming_failure_count integer not null default 0,
  ewma_ttft_ms integer,
  last_probe_at timestamptz,
  last_stream_success_at timestamptz,
  last_stream_failure_at timestamptz,
  last_failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (provider, model_name)
);

alter table public.iu_model_transport_capabilities_v1 enable row level security;
revoke all on table public.iu_model_transport_capabilities_v1 from anon, authenticated;
grant select, insert, update, delete on table public.iu_model_transport_capabilities_v1 to service_role;

create or replace view public.iu_adaptive_model_registry_v1 as
with rep as (
  select provider, model,
    avg(quality_score)::numeric(6,2) as quality_score,
    avg(reliability_score)::numeric(6,2) as reputation_reliability_score,
    avg(reputation_score)::numeric(6,2) as reputation_score,
    avg(confidence_score)::numeric(6,2) as reputation_confidence,
    sum(samples) as reputation_samples,
    max(refreshed_at) as reputation_refreshed_at
  from public.wae_provider_capability_reputation_v1
  group by provider, model
), ev as (
  select actual_provider as provider, actual_model as model,
    avg(score)::numeric(6,2) as eval_score,
    count(*) as eval_samples,
    max(completed_at) as last_eval_at,
    avg(latency_ms)::integer as eval_latency_ms
  from public.wae_intelligence_benchmark_results_v1
  where status='passed'
  group by actual_provider, actual_model
)
select
  m.id,m.provider,m.model_name,m.enabled,m.access_tier,m.priority,
  m.health_status as registry_health,
  case
    when lower(coalesce(m.health_status,''))='offline' then 'OPEN'
    when greatest(coalesce(m.circuit_open_until,'1970-01-01'::timestamptz),coalesce(r.open_until,'1970-01-01'::timestamptz))>now() then 'OPEN'
    when coalesce(m.consecutive_failures,0)>0
      and coalesce(m.last_failure_at,'1970-01-01'::timestamptz)>coalesce(m.last_success_at,'1970-01-01'::timestamptz)
      and not(lower(coalesce(r.health_snapshot,''))='healthy' and r.updated_at>now()-interval '6 hours') then 'HALF_OPEN'
    else 'CLOSED'
  end as circuit_state,
  case
    when lower(coalesce(m.health_status,''))='offline' then 'offline'
    when lower(coalesce(r.health_snapshot,''))='healthy' and r.updated_at>now()-interval '6 hours' then 'healthy'
    else lower(coalesce(m.health_status,'unknown'))
  end as effective_health,
  m.consecutive_failures,m.circuit_open_until,m.last_success_at,m.last_failure_at,
  m.capabilities,m.cost_profile,
  coalesce(r.ewma_latency_ms,ev.eval_latency_ms) as ewma_latency_ms,
  coalesce(t.ewma_ttft_ms,r.ewma_ttft_ms) as ewma_ttft_ms,
  r.score_snapshot as reliability_score,
  r.health_snapshot as reliability_health,
  r.open_until as reliability_open_until,
  r.updated_at as reliability_updated_at,
  rep.quality_score,rep.reputation_reliability_score,rep.reputation_score,
  rep.reputation_confidence,rep.reputation_samples,rep.reputation_refreshed_at,
  ev.eval_score,ev.eval_samples,ev.last_eval_at,
  coalesce((m.capabilities->>'reasoning')::boolean,false) as reasoning_capable,
  coalesce((m.capabilities->>'tool_calling')::boolean,false) as tools_capable,
  coalesce((m.capabilities->>'multimodal')::boolean,false) as vision_capable,
  coalesce((m.capabilities->>'structured_output')::boolean,false) as structured_output_capable,
  (coalesce((m.capabilities->>'streaming')::boolean,false) or (m.capabilities->>'api_style')='openai_compatible_chat') as streaming_capable,
  coalesce((m.capabilities->>'google_search')::boolean,false)
    or coalesce((m.capabilities->>'url_context')::boolean,false)
    or m.capabilities ? 'base_url' as web_compatible,
  coalesce(nullif(m.capabilities->>'context_tokens','')::integer,nullif(m.capabilities->>'context_window_size','')::integer,8192) as context_window,
  coalesce(nullif(m.capabilities->>'max_output_tokens','')::integer,1600) as max_output_tokens,
  ev.eval_latency_ms,
  (coalesce((m.capabilities->>'streaming')::boolean,false) or (m.capabilities->>'api_style')='openai_compatible_chat') as streaming_claimed,
  t.probe_count as streaming_probe_count,
  t.streaming_success_count,
  t.streaming_failure_count,
  t.last_probe_at as streaming_last_probe_at,
  t.last_stream_success_at,
  t.last_stream_failure_at,
  t.last_failure_reason as streaming_last_failure_reason,
  coalesce(t.streaming_verified,false) as streaming_verified
from public.wae_ai_models m
left join public.wae_provider_reliability_ledger_v1 r on r.provider=m.provider and r.model=m.model_name
left join rep on rep.provider=m.provider and rep.model=m.model_name
left join ev on ev.provider=m.provider and ev.model=m.model_name
left join public.iu_model_transport_capabilities_v1 t on t.provider=m.provider and t.model_name=m.model_name
where m.organization_id is null;
