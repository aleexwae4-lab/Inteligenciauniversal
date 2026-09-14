create or replace view public.iu_adaptive_model_registry_v1
with (security_invoker = true) as
with rep as (
  select provider, model,
    avg(quality_score)::numeric(6,2) quality_score,
    avg(reliability_score)::numeric(6,2) reputation_reliability_score,
    avg(reputation_score)::numeric(6,2) reputation_score,
    avg(confidence_score)::numeric(6,2) reputation_confidence,
    sum(samples)::bigint reputation_samples,
    max(refreshed_at) reputation_refreshed_at
  from public.wae_provider_capability_reputation_v1 group by provider,model
), ev as (
  select actual_provider provider,actual_model model,
    avg(score)::numeric(6,2) eval_score,count(*)::bigint eval_samples,max(completed_at) last_eval_at,
    avg(latency_ms)::integer eval_latency_ms
  from public.wae_intelligence_benchmark_results_v1 where status='passed'
  group by actual_provider,actual_model
)
select m.id,m.provider,m.model_name,m.enabled,m.access_tier,m.priority,m.health_status registry_health,
  case when lower(coalesce(m.health_status,''))='offline' then 'OPEN'
    when greatest(coalesce(m.circuit_open_until,'epoch'::timestamptz),coalesce(r.open_until,'epoch'::timestamptz))>now() then 'OPEN'
    when coalesce(m.consecutive_failures,0)>0 and coalesce(m.last_failure_at,'epoch'::timestamptz)>coalesce(m.last_success_at,'epoch'::timestamptz)
      and not (lower(coalesce(r.health_snapshot,''))='healthy' and r.updated_at>now()-interval '6 hours') then 'HALF_OPEN'
    else 'CLOSED' end circuit_state,
  case when lower(coalesce(m.health_status,''))='offline' then 'offline'
    when lower(coalesce(r.health_snapshot,''))='healthy' and r.updated_at>now()-interval '6 hours' then 'healthy'
    else lower(coalesce(m.health_status,'unknown')) end effective_health,
  m.consecutive_failures,m.circuit_open_until,m.last_success_at,m.last_failure_at,m.capabilities,m.cost_profile,
  coalesce(r.ewma_latency_ms,ev.eval_latency_ms) ewma_latency_ms,r.ewma_ttft_ms,r.score_snapshot reliability_score,r.health_snapshot reliability_health,r.open_until reliability_open_until,r.updated_at reliability_updated_at,
  rep.quality_score,rep.reputation_reliability_score,rep.reputation_score,rep.reputation_confidence,rep.reputation_samples,rep.reputation_refreshed_at,
  ev.eval_score,ev.eval_samples,ev.last_eval_at,
  coalesce((m.capabilities->>'reasoning')::boolean,false) reasoning_capable,
  coalesce((m.capabilities->>'tool_calling')::boolean,false) tools_capable,
  coalesce((m.capabilities->>'multimodal')::boolean,false) vision_capable,
  coalesce((m.capabilities->>'structured_output')::boolean,false) structured_output_capable,
  (coalesce((m.capabilities->>'streaming')::boolean,false) or m.capabilities->>'api_style'='openai_compatible_chat') streaming_capable,
  (coalesce((m.capabilities->>'google_search')::boolean,false) or coalesce((m.capabilities->>'url_context')::boolean,false) or m.capabilities ? 'base_url') web_compatible,
  coalesce(nullif(m.capabilities->>'context_tokens','')::integer,nullif(m.capabilities->>'context_window_size','')::integer,8192) context_window,
  coalesce(nullif(m.capabilities->>'max_output_tokens','')::integer,1600) max_output_tokens,
  ev.eval_latency_ms
from public.wae_ai_models m
left join public.wae_provider_reliability_ledger_v1 r on r.provider=m.provider and r.model=m.model_name
left join rep on rep.provider=m.provider and rep.model=m.model_name
left join ev on ev.provider=m.provider and ev.model=m.model_name
where m.organization_id is null;
revoke all on public.iu_adaptive_model_registry_v1 from public,anon,authenticated;
grant select on public.iu_adaptive_model_registry_v1 to service_role;
