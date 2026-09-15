create or replace view public.iu_adaptive_model_registry_v2 as
select v1.*, m.supports_sensitive_data, m.privacy_class
from public.iu_adaptive_model_registry_v1 v1
join public.wae_ai_models m on m.id=v1.id;

create or replace view public.iu_free_intelligence_mesh_v2 as
select
  v2.id,v2.provider,v2.model_name,v2.enabled,v2.access_tier,v2.priority,
  v2.registry_health,v2.circuit_state,v2.effective_health,v2.reliability_score,v2.quality_score,
  v2.reasoning_capable,v2.tools_capable,v2.vision_capable,v2.structured_output_capable,
  v2.streaming_capable,v2.streaming_verified,v2.context_window,v2.max_output_tokens,
  v2.supports_sensitive_data,v2.privacy_class,v2.cost_profile,v2.capabilities
from public.iu_adaptive_model_registry_v2 v2
where v2.access_tier in ('FREE','LOCAL');
