create or replace view public.iu_adaptive_model_registry_v2 as
select
  v1.id,
  v1.provider,
  v1.model_name,
  v1.enabled,
  v1.access_tier,
  (
    case
      when lower(coalesce(v1.effective_health,'unknown'))='healthy' and coalesce(v1.circuit_state,'CLOSED')='CLOSED' then 0
      when lower(coalesce(v1.effective_health,'unknown'))='unknown' and coalesce(v1.circuit_state,'CLOSED')='CLOSED' then 10000
      when lower(coalesce(v1.effective_health,'unknown'))='degraded' and coalesce(v1.circuit_state,'CLOSED')='CLOSED' then 20000
      when lower(coalesce(v1.effective_health,'unknown'))='healthy' and coalesce(v1.circuit_state,'CLOSED')='HALF_OPEN' then 30000
      when lower(coalesce(v1.effective_health,'unknown'))='unknown' and coalesce(v1.circuit_state,'CLOSED')='HALF_OPEN' then 40000
      else 50000
    end
    + least(greatest(coalesce(v1.consecutive_failures,0),0),999) * 100
    + greatest(coalesce(v1.priority,999),0)
  )::integer as priority,
  v1.registry_health,
  v1.circuit_state,
  v1.effective_health,
  v1.consecutive_failures,
  v1.circuit_open_until,
  v1.last_success_at,
  v1.last_failure_at,
  v1.capabilities,
  v1.cost_profile,
  v1.ewma_latency_ms,
  v1.ewma_ttft_ms,
  v1.reliability_score,
  v1.reliability_health,
  v1.reliability_open_until,
  v1.reliability_updated_at,
  v1.quality_score,
  v1.reputation_reliability_score,
  v1.reputation_score,
  v1.reputation_confidence,
  v1.reputation_samples,
  v1.reputation_refreshed_at,
  v1.eval_score,
  v1.eval_samples,
  v1.last_eval_at,
  v1.reasoning_capable,
  v1.tools_capable,
  v1.vision_capable,
  v1.structured_output_capable,
  v1.streaming_capable,
  v1.web_compatible,
  v1.context_window,
  v1.max_output_tokens,
  v1.eval_latency_ms,
  v1.streaming_claimed,
  v1.streaming_probe_count,
  v1.streaming_success_count,
  v1.streaming_failure_count,
  v1.streaming_last_probe_at,
  v1.last_stream_success_at,
  v1.last_stream_failure_at,
  v1.streaming_last_failure_reason,
  v1.streaming_verified,
  m.supports_sensitive_data,
  m.privacy_class
from public.iu_adaptive_model_registry_v1 v1
join public.wae_ai_models m on m.id=v1.id;
