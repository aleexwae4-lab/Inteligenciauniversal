create or replace function public.iu_sync_free_model_registry_v1(p_max_models integer default 250)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $$
declare
  v_limit integer := greatest(1,least(coalesce(p_max_models,250),500));
  v_staged integer := 0;
  v_groq integer := 0;
begin
  with ranked as (
    select c.*,
           row_number() over(order by coalesce(c.quality_score,0) desc,coalesce(c.context_tokens,0) desc,c.model_name) as rn
    from public.wae_ai_model_discovery_candidates c
    where c.provider='openrouter'
      and c.access_class='FREE'
      and c.model_name like '%:free'
      and coalesce((c.pricing->>'prompt')::numeric,0)=0
      and coalesce((c.pricing->>'completion')::numeric,0)=0
      and lower(c.model_name) not like '%safety%'
      and lower(c.model_name) not like '%guard%'
    order by coalesce(c.quality_score,0) desc,coalesce(c.context_tokens,0) desc,c.model_name
    limit v_limit
  )
  insert into public.wae_ai_models(
    organization_id,provider,model_name,model_type,capabilities,cost_profile,status,access_tier,priority,enabled,
    supports_sensitive_data,privacy_class,health_status,consecutive_failures,discovery_managed,metadata
  )
  select
    null,'openrouter',r.model_name,'chat',
    jsonb_build_object(
      'base_url','https://openrouter.ai/api/v1',
      'api_style','openai_compatible_chat',
      'api_key_env','OPENROUTER_API_KEY',
      'endpoint_path','/chat/completions',
      'requires_api_key',true,
      'timeout_ms',case when coalesce(r.context_tokens,0)>=1000000 then 30000 else 18000 end,
      'max_output_tokens',2200,
      'temperature',0.1,
      'text_generation',true,
      'tool_calling',coalesce((r.capabilities->>'tool_calling')::boolean,false),
      'reasoning',coalesce((r.capabilities->>'reasoning')::boolean,false),
      'structured_output',coalesce((r.capabilities->>'structured_output')::boolean,false),
      'multimodal',(coalesce(r.capabilities->'input_modalities','[]'::jsonb) ?| array['image','video','audio']),
      'context_tokens',coalesce(r.context_tokens,131072),
      'supported_parameters',coalesce(r.capabilities->'supported_parameters','[]'::jsonb)
    ),
    jsonb_build_object('currency','USD','free_route_only',true,'input_per_million',0,'output_per_million',0,'catalog_verified_zero_price',true),
    'pending_configuration','FREE',120+r.rn::integer,false,false,'external_free','unknown',0,true,
    jsonb_build_object(
      'free_mesh','v1','source','wae_ai_model_discovery_candidates','discovery_candidate_id',r.id,
      'quality_score',r.quality_score,'candidate_status',r.candidate_status,'last_seen_at',r.last_seen_at,
      'requires_probe',true,'staged',true,'zero_cost_catalog_verified',true
    )
  from ranked r
  on conflict (provider,model_name) where organization_id is null do update
  set capabilities=coalesce(public.wae_ai_models.capabilities,'{}'::jsonb)||excluded.capabilities,
      cost_profile=excluded.cost_profile,
      access_tier='FREE',
      priority=least(public.wae_ai_models.priority,excluded.priority),
      discovery_managed=true,
      metadata=coalesce(public.wae_ai_models.metadata,'{}'::jsonb)||excluded.metadata,
      status=case when public.wae_ai_models.enabled then public.wae_ai_models.status else 'pending_configuration' end;
  get diagnostics v_staged=row_count;

  with groq_models(model_name,priority,reasoning,structured,tools,context_tokens,max_output_tokens) as (
    values
      ('openai/gpt-oss-120b',52,true,true,true,131072,8192),
      ('openai/gpt-oss-20b',53,true,true,true,131072,8192),
      ('qwen/qwen3.6-27b',54,true,true,true,131072,8192),
      ('qwen/qwen3.8-27b',55,true,true,true,131042,8192),
      ('groq/compound',56,true,true,true,131072,8192),
      ('groq/compound-mini',57,true,true,true,131072,8192)
  )
  insert into public.wae_ai_models(
    organization_id,provider,model_name,model_type,capabilities,cost_profile,status,access_tier,priority,enabled,
    supports_sensitive_data,privacy_class,health_status,consecutive_failures,discovery_managed,metadata
  )
  select null,'groq',g.model_name,'chat',
    jsonb_build_object(
      'base_url','https://api.groq.com/openai/v1','api_style','openai_compatible_chat','api_key_env','GROQ_API_KEY',
      'endpoint_path','/chat/completions','requires_api_key',true,'timeout_ms',18000,'max_output_tokens',g.max_output_tokens,
      'temperature',0.1,'text_generation',true,'tool_calling',g.tools,'reasoning',g.reasoning,'structured_output',g.structured,
      'context_tokens',g.context_tokens
    ),
    jsonb_build_object('currency','USD','free_plan_quota',true,'zero_cost_when_account_free_plan',true,'hard_spend_guard_required',true),
    'pending_configuration','FREE',g.priority,true,false,'external_free','unknown',0,false,
    jsonb_build_object('free_mesh','v1','source','groq_official_models_2026_09','free_plan_required',true,'requires_health_probe',true)
  from groq_models g
  on conflict (provider,model_name) where organization_id is null do update
  set capabilities=excluded.capabilities,
      cost_profile=excluded.cost_profile,
      access_tier='FREE',
      priority=excluded.priority,
      enabled=true,
      metadata=coalesce(public.wae_ai_models.metadata,'{}'::jsonb)||excluded.metadata;
  get diagnostics v_groq=row_count;

  update public.wae_ai_models
     set enabled=false,
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('deprecated_by_free_mesh_v1',true,'deprecated_at','2026-08-16','replacement','openai/gpt-oss-120b')
   where organization_id is null and provider='groq' and model_name in ('llama-3.1-8b-instant','llama-3.3-70b-versatile');

  return jsonb_build_object(
    'contract','universal-free-intelligence-mesh/v1',
    'synced_at',now(),
    'openrouter_rows_staged_or_refreshed',v_staged,
    'groq_routes_registered',v_groq,
    'promotion_policy','isolated_probe_then_enable',
    'router_learning','production_outcome_reputation',
    'base_model_weights_changed',false
  );
end;
$$;

create or replace function wae_private.invoke_next_free_candidate_probe_v1()
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  project_url text;
  worker_token text;
  publishable_key text;
  model_id uuid;
  request_id bigint;
begin
  select m.id into model_id
  from public.wae_ai_models m
  where m.organization_id is null
    and m.provider='openrouter'
    and m.access_tier='FREE'
    and m.discovery_managed=true
    and m.enabled=false
    and m.status='pending_configuration'
    and lower(m.model_name) not like '%safety%'
    and lower(m.model_name) not like '%guard%'
    and coalesce((m.metadata->>'quality_score')::numeric,0)>=80
    and (m.circuit_open_until is null or m.circuit_open_until<=now())
  order by coalesce((m.metadata->>'quality_score')::numeric,0) desc,m.priority asc,m.created_at asc
  limit 1;
  if model_id is null then return null; end if;

  select decrypted_secret into project_url from vault.decrypted_secrets where name='wae_project_url' limit 1;
  select decrypted_secret into worker_token from vault.decrypted_secrets where name='wae_agent_worker_token' limit 1;
  select decrypted_secret into publishable_key from vault.decrypted_secrets where name='wae_publishable_key' limit 1;
  if project_url is null or worker_token is null or publishable_key is null then
    raise exception 'wae_free_model_probe_scheduler_secret_missing';
  end if;

  select net.http_post(
    url => rtrim(project_url,'/') || '/functions/v1/wae-model-probe-v73',
    body => jsonb_build_object('source','free_intelligence_mesh_v1','model_id',model_id,'force',true,'invoked_at',now()),
    headers => jsonb_build_object('Content-Type','application/json','apikey',publishable_key,'x-wae-worker-token',worker_token),
    timeout_milliseconds => 45000
  ) into request_id;
  return request_id;
end;
$$;

create or replace view public.iu_free_intelligence_mesh_v1 as
select
  id,provider,model_name,enabled,access_tier,priority,registry_health,circuit_state,effective_health,
  reliability_score,quality_score,reasoning_capable,tools_capable,vision_capable,structured_output_capable,
  streaming_capable,streaming_verified,context_window,max_output_tokens,cost_profile,capabilities
from public.iu_adaptive_model_registry_v1
where access_tier in ('FREE','LOCAL');

select public.iu_sync_free_model_registry_v1(250);

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname in ('wae-free-model-sync-v1','wae-free-model-promotion-v1','wae-model-discovery-free-mesh-v1') loop
    perform cron.unschedule(j.jobid);
  end loop;
  perform cron.schedule('wae-free-model-sync-v1','*/30 * * * *','select public.iu_sync_free_model_registry_v1(250);');
  perform cron.schedule('wae-free-model-promotion-v1','*/10 * * * *','select wae_private.invoke_next_free_candidate_probe_v1();');
  perform cron.schedule('wae-model-discovery-free-mesh-v1','23 */6 * * *','select wae_private.invoke_model_discovery(''free_mesh_v1'');');
end $$;
