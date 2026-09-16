-- Universal Core v72 hardening — independently verify comparative certification invariants in PostgreSQL.
-- This replaces only the recorder function. Existing v72 tables/data remain intact.

create or replace function public.wae_record_trusted_evidence_v72(
  p_worker_token text,
  p_certification jsonb,
  p_entries jsonb,
  p_target_id text,
  p_reference_id text,
  p_commit_sha text default null
) returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare
  v_run_id uuid;
  v_version text:=coalesce(p_certification->>'version','');
  v_suite_hash text:=lower(coalesce(p_certification->>'suiteHash',''));
  v_target text:=trim(coalesce(p_target_id,''));
  v_reference text:=trim(coalesce(p_reference_id,''));
  v_evaluated integer:=coalesce((p_certification->>'evaluatedCases')::integer,0);
  v_claim boolean:=coalesce((p_certification->>'claimAllowed')::boolean,false);
  v_verdict text:=coalesce(p_certification->>'verdict','NOT_PROVEN');
  v_aggregate jsonb:=coalesce(p_certification->'aggregate','{}'::jsonb);
  v_metrics jsonb:=coalesce(p_certification->'metrics','{}'::jsonb);
  v_thresholds jsonb:=coalesce(p_certification->'thresholds','{}'::jsonb);
  v_gates jsonb:=coalesce(p_certification->'gates','{}'::jsonb);
  v_regressions jsonb:=coalesce(p_certification->'regressions','[]'::jsonb);
  v_entries_hash text;
  v_certification_hash text;
  v_entry jsonb;
  v_reg jsonb;
  v_case text;
  v_key text;
  v_severity text;
  v_open bigint:=0;
  v_critical bigint:=0;
  v_high bigint:=0;
  v_trusted bigint:=0;
  v_release text:='HOLD';
  v_claim_gate text:='HOLD';
  v_calc_wins integer:=0;
  v_calc_ties integer:=0;
  v_calc_losses integer:=0;
  v_calc_critical integer:=0;
  v_target_sum numeric:=0;
  v_reference_sum numeric:=0;
  v_score_count integer:=0;
  v_calc_target_mean numeric:=0;
  v_calc_reference_mean numeric:=0;
  v_calc_delta numeric:=0;
  v_calc_critical_rate numeric:=0;
  v_reported_wins integer:=coalesce((v_aggregate->>'wins')::integer,0);
  v_reported_ties integer:=coalesce((v_aggregate->>'ties')::integer,0);
  v_reported_losses integer:=coalesce((v_aggregate->>'losses')::integer,0);
  v_reported_adjusted numeric:=coalesce((v_aggregate->>'adjustedWinRate')::numeric,0);
  v_reported_critical_rate numeric:=coalesce((v_aggregate->>'criticalFailureRate')::numeric,0);
  v_reported_target_mean numeric:=coalesce(nullif(v_metrics->>'targetMeanScore','')::numeric,0);
  v_reported_reference_mean numeric:=coalesce(nullif(v_metrics->>'referenceMeanScore','')::numeric,0);
  v_reported_delta numeric:=coalesce(nullif(v_metrics->>'meanScoreDelta','')::numeric,0);
  v_reported_wilson numeric:=coalesce(nullif(v_metrics->>'wilsonLowerBound95','')::numeric,0);
  v_reported_min_cases integer:=coalesce(nullif(v_thresholds->>'minimumCases','')::integer,0);
  v_reported_min_win numeric:=coalesce(nullif(v_thresholds->>'minimumWinRate','')::numeric,0);
  v_reported_max_critical numeric:=coalesce(nullif(v_thresholds->>'maxCriticalFailureRate','')::numeric,1);
  v_reported_min_wilson numeric:=coalesce(nullif(v_thresholds->>'minimumWilsonLowerBound','')::numeric,0);
  v_reported_min_delta numeric:=coalesce(nullif(v_thresholds->>'minimumMeanScoreDelta','')::numeric,0);
  v_reported_min_target numeric:=coalesce(nullif(v_thresholds->>'minimumTargetMeanScore','')::numeric,0);
begin
  if coalesce(p_worker_token,'')='' or public.wae_validate_worker_token(p_worker_token) is distinct from true then raise exception 'worker_auth_required'; end if;
  if pg_column_size(p_certification)>1048576 then raise exception 'certification_payload_too_large'; end if;
  if pg_column_size(p_entries)>2097152 then raise exception 'entries_payload_too_large'; end if;
  if v_version<>'universal-adversarial-evidence/v72' then raise exception 'benchmark_version_mismatch'; end if;
  if v_evaluated<>64 then raise exception 'complete_64_case_suite_required'; end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)<>64 then raise exception 'entry_count_mismatch'; end if;
  if (select count(distinct e->>'caseId') from jsonb_array_elements(p_entries)e)<>64 then raise exception 'duplicate_or_missing_case'; end if;
  if v_suite_hash!~'^[0-9a-f]{64}$' then raise exception 'invalid_suite_hash'; end if;
  if v_target='' or v_reference='' or v_target=v_reference then raise exception 'invalid_reference'; end if;
  if lower(v_reference) in ('reference','baseline','gpt','chatgpt','claude','gemini','grok') or v_reference!~'[0-9]' or v_reference!~'^[A-Za-z0-9._:/+-]+$' then raise exception 'versioned_external_reference_required'; end if;
  if coalesce(p_certification->>'targetId','')<>v_target or coalesce(p_certification->>'referenceId','')<>v_reference then raise exception 'certification_identity_mismatch'; end if;
  if jsonb_typeof(v_regressions)<>'array' then raise exception 'invalid_regressions'; end if;
  if p_commit_sha is not null and trim(p_commit_sha)<>'' and trim(p_commit_sha)!~'^[0-9a-fA-F]{7,40}$' then raise exception 'invalid_commit_sha'; end if;

  -- The benchmark contract itself is fixed. A caller cannot silently lower thresholds.
  if v_reported_min_cases<>64 or abs(v_reported_min_win-0.70)>0.000001 or abs(v_reported_max_critical-0)>0.000001 or abs(v_reported_min_wilson-0.55)>0.000001 or abs(v_reported_min_delta-0.02)>0.000001 or abs(v_reported_min_target-0.84)>0.000001 then
    raise exception 'benchmark_threshold_contract_mismatch';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    if coalesce(v_entry->>'caseId','')='' then raise exception 'case_id_missing'; end if;
    if coalesce(v_entry->>'promptHash','')!~'^[0-9a-f]{64}$' then raise exception 'prompt_hash_invalid'; end if;
    if coalesce(v_entry->>'targetAnswerHash','')!~'^[0-9a-f]{64}$' then raise exception 'target_answer_hash_invalid'; end if;
    if coalesce(v_entry->>'referenceAnswerHash','')!~'^[0-9a-f]{64}$' then raise exception 'reference_answer_hash_invalid'; end if;
    if coalesce(v_entry->>'winnerId','') not in (v_target,v_reference,'tie') then raise exception 'invalid_case_winner'; end if;
    if coalesce(v_entry->>'critical','false') not in ('true','false') then raise exception 'invalid_case_critical'; end if;

    if v_entry->>'winnerId'=v_target then v_calc_wins:=v_calc_wins+1;
    elsif v_entry->>'winnerId'='tie' then v_calc_ties:=v_calc_ties+1;
    else v_calc_losses:=v_calc_losses+1;
    end if;
    if coalesce((v_entry->>'critical')::boolean,false) then v_calc_critical:=v_calc_critical+1; end if;

    if nullif(v_entry->>'targetScore','') is not null and nullif(v_entry->>'referenceScore','') is not null then
      v_target_sum:=v_target_sum+(v_entry->>'targetScore')::numeric;
      v_reference_sum:=v_reference_sum+(v_entry->>'referenceScore')::numeric;
      v_score_count:=v_score_count+1;
    end if;
  end loop;

  if v_calc_wins+v_calc_ties+v_calc_losses<>64 then raise exception 'case_outcome_count_mismatch'; end if;
  if v_reported_wins<>v_calc_wins or v_reported_ties<>v_calc_ties or v_reported_losses<>v_calc_losses then raise exception 'aggregate_outcome_mismatch'; end if;
  if abs(v_reported_adjusted-((v_calc_wins+(v_calc_ties*0.5))/64.0))>0.00011 then raise exception 'adjusted_win_rate_mismatch'; end if;
  v_calc_critical_rate:=v_calc_critical/64.0;
  if abs(v_reported_critical_rate-v_calc_critical_rate)>0.00011 then raise exception 'critical_failure_rate_mismatch'; end if;

  if v_score_count<>64 then raise exception 'complete_case_scores_required'; end if;
  v_calc_target_mean:=v_target_sum/64.0;
  v_calc_reference_mean:=v_reference_sum/64.0;
  v_calc_delta:=v_calc_target_mean-v_calc_reference_mean;
  if abs(v_reported_target_mean-v_calc_target_mean)>0.00011 then raise exception 'target_mean_score_mismatch'; end if;
  if abs(v_reported_reference_mean-v_calc_reference_mean)>0.00011 then raise exception 'reference_mean_score_mismatch'; end if;
  if abs(v_reported_delta-v_calc_delta)>0.00011 then raise exception 'mean_score_delta_mismatch'; end if;

  -- A comparative claim is fail-closed and independently gated again in PostgreSQL.
  if v_claim then
    if v_verdict<>'BENCHMARK_ADVANTAGE_CERTIFIED' then raise exception 'claim_verdict_mismatch'; end if;
    if coalesce((v_gates->>'versionedReference')::boolean,false) is distinct from true
      or coalesce((v_gates->>'fullPairedSuite')::boolean,false) is distinct from true
      or coalesce((v_gates->>'coverage')::boolean,false) is distinct from true
      or coalesce((v_gates->>'categories')::boolean,false) is distinct from true
      or coalesce((v_gates->>'score')::boolean,false) is distinct from true
      or coalesce((v_gates->>'statistical')::boolean,false) is distinct from true
      or coalesce((v_gates->>'noInvalidEntries')::boolean,false) is distinct from true then raise exception 'claim_gate_inconsistency'; end if;
    if v_calc_critical<>0 or v_reported_adjusted<0.70 or v_reported_target_mean<0.84 or v_reported_delta<0.02 or v_reported_wilson<0.55 then raise exception 'claim_metric_threshold_failure'; end if;
    if jsonb_array_length(v_regressions)<>0 then raise exception 'claim_with_open_regressions_forbidden'; end if;
  elsif v_verdict='BENCHMARK_ADVANTAGE_CERTIFIED' then
    raise exception 'certified_verdict_without_claim_forbidden';
  end if;

  v_entries_hash:=encode(extensions.digest(p_entries::text,'sha256'),'hex');
  v_certification_hash:=encode(extensions.digest(p_certification::text,'sha256'),'hex');

  insert into public.wae_evidence_runs_v72(
    benchmark_version,suite_hash,entries_hash,certification_hash,target_id,reference_id,commit_sha,
    attestation_level,trusted_for_promotion,evaluated_cases,wins,ties,losses,adjusted_win_rate,critical_failure_rate,
    target_mean_score,reference_mean_score,mean_score_delta,wilson_lower_bound_95,claim_allowed,verdict,metrics,thresholds,gates,certification
  ) values(
    v_version,v_suite_hash,v_entries_hash,v_certification_hash,v_target,v_reference,nullif(trim(p_commit_sha),''),
    'trusted_worker',true,v_evaluated,v_calc_wins,v_calc_ties,v_calc_losses,v_reported_adjusted,v_calc_critical_rate,
    v_calc_target_mean,v_calc_reference_mean,v_calc_delta,v_reported_wilson,
    v_claim,v_verdict,v_metrics,v_thresholds,v_gates,p_certification
  ) returning id into v_run_id;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    insert into public.wae_evidence_case_attestations_v72(run_id,case_id,prompt_hash,target_answer_hash,reference_answer_hash,target_score,reference_score,winner_id,critical)
    values(v_run_id,left(v_entry->>'caseId',120),v_entry->>'promptHash',v_entry->>'targetAnswerHash',v_entry->>'referenceAnswerHash',(v_entry->>'targetScore')::numeric,(v_entry->>'referenceScore')::numeric,left(v_entry->>'winnerId',120),(v_entry->>'critical')::boolean);
  end loop;

  for v_reg in select value from jsonb_array_elements(v_regressions) loop
    v_case:=left(coalesce(v_reg->>'caseId',''),120); if v_case='' then continue; end if;
    v_severity:=case when v_case like 'attack-%' then 'critical' else 'high' end;
    v_key:=encode(extensions.digest('v72|'||v_suite_hash||'|'||v_case,'sha256'),'hex');
    insert into public.wae_evidence_regressions_v72(regression_key,case_id,category,severity,status,first_seen_run_id,last_seen_run_id,metadata)
    values(v_key,v_case,split_part(v_case,'-',1),v_severity,'open',v_run_id,v_run_id,jsonb_build_object('benchmark_version',v_version,'reference_id',v_reference))
    on conflict(regression_key) do update set status='open',severity=excluded.severity,last_seen_run_id=v_run_id,last_seen_at=now(),occurrence_count=public.wae_evidence_regressions_v72.occurrence_count+1,resolved_at=null,resolved_by_commit_sha=null;
  end loop;

  update public.wae_evidence_regressions_v72 b set status='resolved',resolved_at=now(),resolved_by_commit_sha=nullif(trim(p_commit_sha),'')
  where b.status='open' and b.case_id in(select e->>'caseId' from jsonb_array_elements(p_entries)e except select r->>'caseId' from jsonb_array_elements(v_regressions)r);

  select count(*) into v_trusted from public.wae_evidence_runs_v72 where trusted_for_promotion=true;
  select count(*) into v_open from public.wae_evidence_regressions_v72 where status='open';
  select count(*) into v_critical from public.wae_evidence_regressions_v72 where status='open' and severity='critical';
  select count(*) into v_high from public.wae_evidence_regressions_v72 where status='open' and severity='high';
  v_release:=case when v_critical>0 then 'BLOCK' when v_high>0 then 'CAUTION' else 'PASS' end;
  v_claim_gate:=case when v_claim and v_critical=0 and v_high=0 then 'CERTIFIED' else 'HOLD' end;

  insert into public.wae_evidence_public_status_v72(context_key,benchmark_version,trusted_runs,last_run_id,last_reference_id,last_suite_hash,last_adjusted_win_rate,last_claim_allowed,open_regressions,critical_open,high_open,release_gate,comparative_claim_gate,last_commit_sha,updated_at)
  values('global',v_version,v_trusted,v_run_id,v_reference,v_suite_hash,v_reported_adjusted,v_claim,v_open,v_critical,v_high,v_release,v_claim_gate,nullif(trim(p_commit_sha),''),now())
  on conflict(context_key) do update set benchmark_version=excluded.benchmark_version,trusted_runs=excluded.trusted_runs,last_run_id=excluded.last_run_id,last_reference_id=excluded.last_reference_id,last_suite_hash=excluded.last_suite_hash,last_adjusted_win_rate=excluded.last_adjusted_win_rate,last_claim_allowed=excluded.last_claim_allowed,open_regressions=excluded.open_regressions,critical_open=excluded.critical_open,high_open=excluded.high_open,release_gate=excluded.release_gate,comparative_claim_gate=excluded.comparative_claim_gate,last_commit_sha=excluded.last_commit_sha,updated_at=excluded.updated_at;

  return jsonb_build_object('ok',true,'run_id',v_run_id,'trusted_for_promotion',true,'entries_hash',v_entries_hash,'certification_hash',v_certification_hash,'suite_hash',v_suite_hash,'release_gate',v_release,'comparative_claim_gate',v_claim_gate,'open_regressions',v_open,'critical_open',v_critical,'high_open',v_high);
end;
$$;

revoke all on function public.wae_record_trusted_evidence_v72(text,jsonb,jsonb,text,text,text) from public;
grant execute on function public.wae_record_trusted_evidence_v72(text,jsonb,jsonb,text,text,text) to anon, authenticated;

comment on function public.wae_record_trusted_evidence_v72 is 'Worker-token-gated v72 recorder. Recomputes outcomes/means and independently enforces comparative-claim thresholds before persisting hashed attestations.';
