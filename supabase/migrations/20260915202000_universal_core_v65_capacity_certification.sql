-- Universal Core v66 — Capacity Certification & Autopilot
-- Internal ledger identifiers retain v65 compatibility. Stores only aggregate load evidence.
-- stores_prompt_content=false; stores_response_content=false.

create table if not exists public.wae_capacity_certifications_v65 (
  id uuid primary key default gen_random_uuid(),
  certification_version text not null,
  policy_version text not null,
  evidence_hash text not null check (evidence_hash ~ '^[a-f0-9]{64}$'),
  verdict text not null check (verdict in ('PRODUCTION_PEAK_CERTIFIED')),
  concurrency integer not null check (concurrency >= 512),
  requests bigint not null check (requests >= 5000),
  success_rate numeric(8,6) not null check (success_rate between 0 and 1),
  error_rate numeric(8,6) not null check (error_rate between 0 and 1),
  p95_ms integer not null check (p95_ms > 0),
  p99_ms integer not null check (p99_ms > 0),
  lifecycle_false_failure_rate numeric(8,6) not null default 0 check (lifecycle_false_failure_rate between 0 and 1),
  overload_replay_violations integer not null default 0 check (overload_replay_violations >= 0),
  all_stages_pass boolean not null default false,
  created_at timestamptz not null default now(),
  unique (evidence_hash, policy_version)
);

create index if not exists wae_capacity_certifications_v65_created_idx
  on public.wae_capacity_certifications_v65(created_at desc);

alter table public.wae_capacity_certifications_v65 enable row level security;
revoke all on public.wae_capacity_certifications_v65 from anon, authenticated;
grant select, insert, update, delete on public.wae_capacity_certifications_v65 to service_role;

create or replace function public.wae_capacity_control_bridge_v65(
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
  v_evidence_hash text := lower(coalesce(p_payload->>'evidenceHash',''));
  v_version text := left(coalesce(p_payload->>'version',''),80);
  v_policy text := left(coalesce(p_payload->>'policyVersion',''),80);
  v_verdict text := left(coalesce(p_payload->>'verdict',''),80);
  v_concurrency integer := case when coalesce(p_payload->>'concurrency','') ~ '^[0-9]+$' then (p_payload->>'concurrency')::integer else 0 end;
  v_requests bigint := case when coalesce(p_payload->>'requests','') ~ '^[0-9]+$' then (p_payload->>'requests')::bigint else 0 end;
  v_success numeric := case when coalesce(p_payload->>'successRate','') ~ '^[0-9]+([.][0-9]+)?$' then (p_payload->>'successRate')::numeric else 0 end;
  v_error numeric := case when coalesce(p_payload->>'errorRate','') ~ '^[0-9]+([.][0-9]+)?$' then (p_payload->>'errorRate')::numeric else 1 end;
  v_p95 integer := case when coalesce(p_payload->>'p95Ms','') ~ '^[0-9]+([.][0-9]+)?$' then round((p_payload->>'p95Ms')::numeric)::integer else 0 end;
  v_p99 integer := case when coalesce(p_payload->>'p99Ms','') ~ '^[0-9]+([.][0-9]+)?$' then round((p_payload->>'p99Ms')::numeric)::integer else 0 end;
  v_false_failure numeric := case when coalesce(p_payload->>'lifecycleFalseFailureRate','') ~ '^[0-9]+([.][0-9]+)?$' then (p_payload->>'lifecycleFalseFailureRate')::numeric else 1 end;
  v_replay integer := case when coalesce(p_payload->>'overloadReplayViolations','') ~ '^[0-9]+$' then (p_payload->>'overloadReplayViolations')::integer else 1 end;
  v_all boolean := lower(coalesce(p_payload->>'allStagesPass','false')) in ('1','true','yes');
  v_id uuid;
  v_latest jsonb;
begin
  select token_hash into v_expected
  from wae_private.bridge_credentials
  where name='universal_core_runtime_v63' and active=true;

  if v_expected is null or encode(digest(coalesce(p_token,''),'sha256'),'hex')<>v_expected then
    raise exception 'bridge_auth_failed' using errcode='28000';
  end if;

  if v_action in ('health','status') then
    return jsonb_build_object(
      'ok',true,
      'version','capacity-certification/v66',
      'policyVersion','capacity-slo/v1',
      'records',(select count(*) from public.wae_capacity_certifications_v65),
      'stores_prompt_content',false,
      'stores_response_content',false
    );
  end if;

  if v_action='latest' then
    select jsonb_build_object(
      'id',c.id,
      'version',c.certification_version,
      'policyVersion',c.policy_version,
      'evidenceHash',c.evidence_hash,
      'verdict',c.verdict,
      'concurrency',c.concurrency,
      'requests',c.requests,
      'successRate',c.success_rate,
      'errorRate',c.error_rate,
      'p95Ms',c.p95_ms,
      'p99Ms',c.p99_ms,
      'createdAt',c.created_at,
      'currentInfrastructureLoadCertified',true
    ) into v_latest
    from public.wae_capacity_certifications_v65 c
    order by c.created_at desc
    limit 1;
    return jsonb_build_object('ok',true,'version','capacity-certification/v66','certification',v_latest);
  end if;

  if v_action='record' then
    if v_evidence_hash !~ '^[a-f0-9]{64}$' then
      return jsonb_build_object('ok',false,'error','invalid_evidence_hash');
    end if;

    if v_version not in ('capacity-certification/v65','capacity-certification/v66')
      or v_policy<>'capacity-slo/v1'
      or v_verdict<>'PRODUCTION_PEAK_CERTIFIED'
      or v_concurrency<512
      or v_requests<5000
      or v_success<0.995
      or v_error>0.005
      or v_p95<=0 or v_p95>18000
      or v_p99<=0 or v_p99>32000
      or v_false_failure<>0
      or v_replay<>0
      or v_all is not true then
      return jsonb_build_object('ok',false,'error','capacity_thresholds_not_met');
    end if;

    insert into public.wae_capacity_certifications_v65(
      certification_version,policy_version,evidence_hash,verdict,concurrency,requests,
      success_rate,error_rate,p95_ms,p99_ms,lifecycle_false_failure_rate,overload_replay_violations,all_stages_pass
    ) values (
      v_version,v_policy,v_evidence_hash,v_verdict,v_concurrency,v_requests,
      v_success,v_error,v_p95,v_p99,v_false_failure,v_replay,v_all
    )
    on conflict(evidence_hash,policy_version) do update set
      certification_version=excluded.certification_version,
      verdict=excluded.verdict,
      concurrency=excluded.concurrency,
      requests=excluded.requests,
      success_rate=excluded.success_rate,
      error_rate=excluded.error_rate,
      p95_ms=excluded.p95_ms,
      p99_ms=excluded.p99_ms,
      lifecycle_false_failure_rate=excluded.lifecycle_false_failure_rate,
      overload_replay_violations=excluded.overload_replay_violations,
      all_stages_pass=excluded.all_stages_pass,
      created_at=now()
    returning id into v_id;

    return jsonb_build_object('ok',true,'id',v_id,'version','capacity-certification/v66','recorded',true,'evidenceHash',v_evidence_hash);
  end if;

  return jsonb_build_object('ok',false,'error','unsupported_capacity_action');
end;
$$;

revoke all on function public.wae_capacity_control_bridge_v65(text,jsonb,text) from public;
grant execute on function public.wae_capacity_control_bridge_v65(text,jsonb,text) to anon, authenticated, service_role;
