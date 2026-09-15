-- $0 deployment path: use PostgREST RPC instead of consuming another Edge Function slot.
-- The RPC is callable through the publishable API surface but is fail-closed behind
-- the existing cryptographically stored worker token validator.

create or replace function public.wae_record_trusted_supremacy_v54(
  p_worker_token text,
  p_certification jsonb,
  p_entries jsonb,
  p_target_id text,
  p_reference_id text,
  p_commit_sha text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_run_id uuid;
  v_version text := coalesce(p_certification->>'version','');
  v_aggregate jsonb := coalesce(p_certification->'aggregate','{}'::jsonb);
  v_regressions jsonb := coalesce(p_certification->'regressions','[]'::jsonb);
  v_reg jsonb;
  v_case text;
  v_hash text;
  v_tags jsonb;
  v_key text;
  v_category text;
  v_severity text;
  v_evaluated integer := coalesce((p_certification->>'evaluatedCases')::integer,0);
  v_claim boolean := coalesce((p_certification->>'claimAllowed')::boolean,false);
  v_open bigint := 0;
  v_critical bigint := 0;
  v_high bigint := 0;
  v_trusted bigint := 0;
  v_release text := 'HOLD';
  v_superiority text := 'HOLD';
begin
  if coalesce(p_worker_token,'') = '' or public.wae_validate_worker_token(p_worker_token) is distinct from true then
    raise exception 'worker_auth_required';
  end if;
  if v_version <> 'universal-supremacy-benchmark/v53' then raise exception 'benchmark_version_mismatch'; end if;
  if coalesce(trim(p_target_id),'') = '' or coalesce(trim(p_reference_id),'') = '' or p_target_id = p_reference_id then raise exception 'invalid_reference'; end if;
  if p_reference_id in ('baseline','reference') then raise exception 'named_external_reference_required'; end if;
  if coalesce(p_certification->>'targetId','') <> p_target_id or coalesce(p_certification->>'referenceId','') <> p_reference_id then raise exception 'certification_identity_mismatch'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) <> v_evaluated or v_evaluated < 1 or v_evaluated > 32 then raise exception 'entry_count_mismatch'; end if;
  if jsonb_typeof(v_regressions) <> 'array' then raise exception 'invalid_regressions'; end if;

  insert into public.wae_supremacy_runs_v54(
    actor_user_id,benchmark_version,target_id,reference_id,commit_sha,attestation_level,trusted_for_promotion,
    evaluated_cases,wins,ties,losses,adjusted_win_rate,critical_failure_rate,claim_allowed,verdict,certification
  ) values (
    null,v_version,p_target_id,p_reference_id,nullif(trim(p_commit_sha),''),'trusted_worker',true,
    v_evaluated,coalesce((v_aggregate->>'wins')::integer,0),coalesce((v_aggregate->>'ties')::integer,0),coalesce((v_aggregate->>'losses')::integer,0),
    coalesce((v_aggregate->>'adjustedWinRate')::numeric,0),coalesce((v_aggregate->>'criticalFailureRate')::numeric,0),v_claim,
    coalesce(p_certification->>'verdict','NOT_PROVEN'),p_certification
  ) returning id into v_run_id;

  for v_reg in select value from jsonb_array_elements(v_regressions) loop
    v_case := left(coalesce(v_reg->>'caseId',''),120);
    if v_case = '' then continue; end if;
    select left(coalesce(e->>'promptHash',''),128) into v_hash from jsonb_array_elements(p_entries) e where e->>'caseId'=v_case limit 1;
    if coalesce(v_hash,'') = '' then raise exception 'regression_prompt_hash_missing'; end if;
    v_tags := case when jsonb_typeof(v_reg->'failureTags')='array' then v_reg->'failureTags' when jsonb_typeof(v_reg->'requiredRegression')='array' then v_reg->'requiredRegression' else '[]'::jsonb end;
    v_category := case split_part(v_case,'-',1)
      when 'instruction' then 'instruction_contract' when 'structured' then 'structured_exact' when 'reasoning' then 'reasoning_math'
      when 'research' then 'research_evidence' when 'engineering' then 'engineering' when 'noisy' then 'noisy_multilingual_intent'
      when 'adversarial' then 'document_adversarial' when 'efficiency' then 'operational_efficiency' else 'unknown' end;
    v_severity := case when v_case like 'adversarial-%' or lower(v_tags::text) ~ '(safety:|internal_leak|forbidden)' then 'critical'
      when lower(v_tags::text) ~ '(assertion:|requirement:)' then 'high' else 'medium' end;
    v_key := encode(extensions.digest('trusted|'||v_version||'|'||v_case||'|'||v_tags::text,'sha256'),'hex');

    insert into public.wae_supremacy_regression_backlog_v54(
      regression_key,actor_user_id,case_id,prompt_hash,category,failure_tags,severity,status,trusted,first_seen_run_id,last_seen_run_id,
      occurrence_count,last_target_score,last_reference_score,source_benchmark_version,first_seen_at,last_seen_at,metadata
    ) values (
      v_key,null,v_case,v_hash,v_category,v_tags,v_severity,'open',true,v_run_id,v_run_id,1,
      nullif(v_reg->>'targetScore','')::numeric,nullif(v_reg->>'referenceScore','')::numeric,v_version,now(),now(),jsonb_build_object('source','continuous-improvement/v54','attestation','trusted_worker')
    ) on conflict (regression_key) do update set
      status='open',severity=excluded.severity,failure_tags=excluded.failure_tags,last_seen_run_id=v_run_id,
      occurrence_count=public.wae_supremacy_regression_backlog_v54.occurrence_count+1,
      last_target_score=excluded.last_target_score,last_reference_score=excluded.last_reference_score,last_seen_at=now(),resolved_at=null,resolved_by_commit_sha=null;
  end loop;

  update public.wae_supremacy_regression_backlog_v54 b set status='resolved',resolved_at=now(),resolved_by_commit_sha=nullif(trim(p_commit_sha),'')
  where b.trusted=true and b.status='open' and b.case_id in (
    select e->>'caseId' from jsonb_array_elements(p_entries) e
    except select r->>'caseId' from jsonb_array_elements(v_regressions) r
  );

  select count(*) into v_trusted from public.wae_supremacy_runs_v54 where trusted_for_promotion=true;
  select count(*) into v_open from public.wae_supremacy_regression_backlog_v54 where trusted=true and status='open';
  select count(*) into v_critical from public.wae_supremacy_regression_backlog_v54 where trusted=true and status='open' and severity='critical';
  select count(*) into v_high from public.wae_supremacy_regression_backlog_v54 where trusted=true and status='open' and severity='high';
  v_release := case when v_critical>0 then 'BLOCK' when v_high>0 then 'CAUTION' else 'PASS' end;
  v_superiority := case when v_claim and v_critical=0 and v_high=0 then 'CERTIFIED' else 'HOLD' end;

  insert into public.wae_supremacy_public_status_v54(context_key,benchmark_version,trusted_runs,last_reference_id,last_adjusted_win_rate,last_claim_allowed,open_regressions,critical_open,high_open,release_gate,superiority_claim_gate,last_commit_sha,updated_at)
  values('global',v_version,v_trusted,p_reference_id,coalesce((v_aggregate->>'adjustedWinRate')::numeric,0),v_claim,v_open,v_critical,v_high,v_release,v_superiority,nullif(trim(p_commit_sha),''),now())
  on conflict(context_key) do update set benchmark_version=excluded.benchmark_version,trusted_runs=excluded.trusted_runs,last_reference_id=excluded.last_reference_id,
    last_adjusted_win_rate=excluded.last_adjusted_win_rate,last_claim_allowed=excluded.last_claim_allowed,open_regressions=excluded.open_regressions,
    critical_open=excluded.critical_open,high_open=excluded.high_open,release_gate=excluded.release_gate,superiority_claim_gate=excluded.superiority_claim_gate,
    last_commit_sha=excluded.last_commit_sha,updated_at=excluded.updated_at;

  return jsonb_build_object('ok',true,'run_id',v_run_id,'trusted_for_promotion',true,'regressions_recorded',jsonb_array_length(v_regressions),
    'release_gate',v_release,'superiority_claim_gate',v_superiority,'open_regressions',v_open,'critical_open',v_critical,'high_open',v_high);
end;
$$;

revoke all on function public.wae_record_trusted_supremacy_v54(text,jsonb,jsonb,text,text,text) from public;
grant execute on function public.wae_record_trusted_supremacy_v54(text,jsonb,jsonb,text,text,text) to anon, authenticated;
