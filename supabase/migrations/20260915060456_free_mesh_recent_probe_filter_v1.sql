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
    and coalesce((m.metadata->>'last_seen_at')::timestamptz,'epoch'::timestamptz) >= now()-interval '48 hours'
    and (m.circuit_open_until is null or m.circuit_open_until<=now())
  order by coalesce((m.metadata->>'quality_score')::numeric,0) desc,
           coalesce((m.metadata->>'last_seen_at')::timestamptz,'epoch'::timestamptz) desc,
           m.priority asc,m.created_at asc
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
