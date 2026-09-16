-- Universal Core Reliability Plane v3
-- Fixes two production defects:
-- 1) pool routing sync activated every duplicate global rule at once, violating
--    the partial unique index for active global task routes;
-- 2) verified provider recovery recorded in the reliability ledger could not
--    rehabilitate the model registry, leaving usable free providers OPEN.

create or replace function public.wae_sync_ai_pool_routing_rules()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_catalog'
as $function$
declare
  r record;
  v_ids uuid[];
  v_preferred uuid;
  v_fallback jsonb;
  v_task_type text;
  v_rule_id uuid;
  v_updated integer:=0;
begin
  for r in
    select pool_key,workload_class,id
    from public.wae_ai_model_pools
    where organization_id is null and product_key='*' and enabled
    order by workload_class
  loop
    select array_agg(x.model_id order by x.rank) into v_ids
    from (
      select pm.model_id,pm.rank
      from public.wae_ai_model_pool_members pm
      join public.wae_ai_models m on m.id=pm.model_id
      where pm.pool_id=r.id and pm.enabled
        and m.enabled and m.status='active' and m.health_status='healthy'
        and (m.circuit_open_until is null or m.circuit_open_until<=now())
      order by pm.rank,m.priority
      limit 4
    ) x;

    v_task_type:='user_task_'||lower(r.workload_class);
    if coalesce(array_length(v_ids,1),0)=0 then
      update public.wae_model_routing_rules
         set active=false
       where organization_id is null and task_type=v_task_type and active;
      continue;
    end if;

    v_preferred:=v_ids[1];
    select coalesce(jsonb_agg(v_ids[i]::text order by i),'[]'::jsonb)
      into v_fallback
    from generate_subscripts(v_ids,1) g(i)
    where i>1;

    -- Keep one canonical row for the partial unique active route. Historical
    -- duplicates remain inactive for auditability and never block health sync.
    select rr.id into v_rule_id
      from public.wae_model_routing_rules rr
     where rr.organization_id is null and rr.task_type=v_task_type
     order by rr.active desc, rr.created_at asc, rr.id
     limit 1;

    if v_rule_id is null then
      insert into public.wae_model_routing_rules(
        organization_id,task_type,preferred_model_id,fallback_models,routing_policy,active
      ) values(
        null,v_task_type,v_preferred,v_fallback,
        jsonb_build_object(
          'strategy','workload_pool_health_gated_v2',
          'pool_key',r.pool_key,
          'workload_class',r.workload_class,
          'health_gate','active_healthy_only',
          'max_candidates',4,
          'synced_at',now()
        ),true
      ) returning id into v_rule_id;
    else
      update public.wae_model_routing_rules
         set active=false
       where organization_id is null and task_type=v_task_type
         and id<>v_rule_id and active;

      update public.wae_model_routing_rules
         set preferred_model_id=v_preferred,
             fallback_models=v_fallback,
             routing_policy=jsonb_build_object(
               'strategy','workload_pool_health_gated_v2',
               'pool_key',r.pool_key,
               'workload_class',r.workload_class,
               'health_gate','active_healthy_only',
               'max_candidates',4,
               'synced_at',now()
             ),
             active=true
       where id=v_rule_id;
    end if;
    v_updated:=v_updated+1;
  end loop;

  return jsonb_build_object('status','synced','active_routes',v_updated,'version','v2');
end;
$function$;

create or replace function public.iu_reconcile_provider_health_v3(p_window_minutes integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_window integer := greatest(5, least(coalesce(p_window_minutes,30),180));
  v_probe_window integer := least(15, v_window);
  v_probe_healed integer := 0;
  v_base jsonb;
  v_prev jsonb;
begin
  -- Preserve the existing production-trace reconciliation contract.
  v_base := public.iu_reconcile_provider_health_v2(v_window);

  -- Additionally trust a fresh verified provider success only when it is newer
  -- than the registry failure and the reliability ledger has zero failure debt.
  for r in
    select
      m.id,m.provider,m.model_name,m.health_status,m.consecutive_failures,m.circuit_open_until,
      m.last_success_at as registry_last_success,m.last_failure_at,
      l.last_success_at as verified_probe_success,l.updated_at as ledger_updated,
      l.score_snapshot,l.ewma_latency_ms,l.ewma_ttft_ms
    from public.wae_ai_models m
    join public.wae_provider_reliability_ledger_v1 l
      on l.provider=m.provider and l.model=m.model_name
    where m.organization_id is null
      and m.enabled=true
      and lower(coalesce(l.health_snapshot,''))='healthy'
      and coalesce(l.consecutive_failures,0)=0
      and l.last_success_at is not null
      and l.last_success_at > coalesce(m.last_failure_at,'epoch'::timestamptz)
      and l.last_success_at > now()-make_interval(mins=>v_probe_window)
      and l.updated_at > now()-make_interval(mins=>v_probe_window)
      and (
        coalesce(m.consecutive_failures,0)>0
        or m.circuit_open_until is not null
        or lower(coalesce(m.health_status,''))<>'healthy'
      )
  loop
    v_prev := jsonb_build_object(
      'health_status',r.health_status,
      'consecutive_failures',r.consecutive_failures,
      'circuit_open_until',r.circuit_open_until,
      'last_success_at',r.registry_last_success,
      'last_failure_at',r.last_failure_at
    );

    update public.wae_ai_models
       set health_status='healthy',
           consecutive_failures=0,
           circuit_open_until=null,
           last_success_at=greatest(coalesce(last_success_at,'epoch'::timestamptz),r.verified_probe_success),
           last_health_check_at=now(),
           metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
             'reliability_plane','v3',
             'probe_reconciled_at',now(),
             'probe_success_at',r.verified_probe_success,
             'probe_score_snapshot',r.score_snapshot,
             'probe_ewma_latency_ms',r.ewma_latency_ms,
             'probe_ewma_ttft_ms',r.ewma_ttft_ms
           )
     where id=r.id;

    insert into public.iu_reliability_events_v2(
      event_type,provider,model_name,previous_state,observed_state,reason
    ) values(
      'probe_circuit_reconciled',r.provider,r.model_name,v_prev,
      jsonb_build_object(
        'health_status','healthy',
        'last_success_at',r.verified_probe_success,
        'source','verified_reliability_ledger'
      ),
      'fresh verified provider success is newer than the registry failure and carries zero failure debt'
    );
    v_probe_healed:=v_probe_healed+1;
  end loop;

  return jsonb_build_object(
    'schema','universal-reliability-plane/v3',
    'reconciled_at',now(),
    'window_minutes',v_window,
    'probe_window_minutes',v_probe_window,
    'probe_circuits_healed',v_probe_healed,
    'production_reconciliation',v_base
  );
end;
$function$;

revoke all on function public.iu_reconcile_provider_health_v3(integer) from public, anon, authenticated;
grant execute on function public.iu_reconcile_provider_health_v3(integer) to postgres, service_role;

do $block$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
    from cron.job
   where jobname='iu-reliability-reconcile-v2'
   order by jobid
   limit 1;
  if v_job_id is not null then
    perform cron.alter_job(
      v_job_id,
      command := 'select public.iu_reconcile_provider_health_v3(30);'
    );
  end if;
end;
$block$;
