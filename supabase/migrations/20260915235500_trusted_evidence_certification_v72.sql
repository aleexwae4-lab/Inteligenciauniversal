-- Universal Core v72 — trusted adversarial evidence certification ledger
-- Append-only, hash-based evidence. Full model answers are intentionally not persisted.

create table if not exists public.wae_evidence_runs_v72 (
  id uuid primary key default gen_random_uuid(),
  benchmark_version text not null,
  suite_hash text not null,
  entries_hash text not null,
  certification_hash text not null,
  target_id text not null,
  reference_id text not null,
  commit_sha text,
  attestation_level text not null default 'trusted_worker',
  trusted_for_promotion boolean not null default true,
  evaluated_cases integer not null,
  wins integer not null default 0,
  ties integer not null default 0,
  losses integer not null default 0,
  adjusted_win_rate numeric not null default 0,
  critical_failure_rate numeric not null default 0,
  target_mean_score numeric,
  reference_mean_score numeric,
  mean_score_delta numeric,
  wilson_lower_bound_95 numeric,
  claim_allowed boolean not null default false,
  verdict text not null default 'NOT_PROVEN',
  metrics jsonb not null default '{}'::jsonb,
  thresholds jsonb not null default '{}'::jsonb,
  gates jsonb not null default '{}'::jsonb,
  certification jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint wae_evidence_runs_v72_version check (benchmark_version='universal-adversarial-evidence/v72'),
  constraint wae_evidence_runs_v72_cases check (evaluated_cases between 1 and 64),
  constraint wae_evidence_runs_v72_suite_hash check (suite_hash ~ '^[0-9a-f]{64}$'),
  constraint wae_evidence_runs_v72_entries_hash check (entries_hash ~ '^[0-9a-f]{64}$'),
  constraint wae_evidence_runs_v72_cert_hash check (certification_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.wae_evidence_case_attestations_v72 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.wae_evidence_runs_v72(id) on delete restrict,
  case_id text not null,
  prompt_hash text not null,
  target_answer_hash text not null,
  reference_answer_hash text not null,
  target_score numeric,
  reference_score numeric,
  winner_id text,
  critical boolean not null default false,
  created_at timestamptz not null default now(),
  unique(run_id,case_id),
  constraint wae_evidence_case_prompt_hash check (prompt_hash ~ '^[0-9a-f]{64}$'),
  constraint wae_evidence_case_target_hash check (target_answer_hash ~ '^[0-9a-f]{64}$'),
  constraint wae_evidence_case_reference_hash check (reference_answer_hash ~ '^[0-9a-f]{64}$')
);

create table if not exists public.wae_evidence_regressions_v72 (
  id uuid primary key default gen_random_uuid(),
  regression_key text not null unique,
  case_id text not null,
  category text not null default 'unknown',
  severity text not null default 'high',
  status text not null default 'open',
  first_seen_run_id uuid references public.wae_evidence_runs_v72(id) on delete restrict,
  last_seen_run_id uuid references public.wae_evidence_runs_v72(id) on delete restrict,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_commit_sha text,
  metadata jsonb not null default '{}'::jsonb,
  constraint wae_evidence_regression_status check (status in ('open','resolved')),
  constraint wae_evidence_regression_severity check (severity in ('critical','high','medium'))
);

create table if not exists public.wae_evidence_public_status_v72 (
  context_key text primary key default 'global',
  benchmark_version text not null default 'universal-adversarial-evidence/v72',
  trusted_runs bigint not null default 0,
  last_run_id uuid references public.wae_evidence_runs_v72(id) on delete set null,
  last_reference_id text,
  last_suite_hash text,
  last_adjusted_win_rate numeric,
  last_claim_allowed boolean not null default false,
  open_regressions bigint not null default 0,
  critical_open bigint not null default 0,
  high_open bigint not null default 0,
  release_gate text not null default 'HOLD',
  comparative_claim_gate text not null default 'HOLD',
  last_commit_sha text,
  updated_at timestamptz not null default now()
);

create index if not exists wae_evidence_runs_v72_created_idx on public.wae_evidence_runs_v72(created_at desc);
create index if not exists wae_evidence_runs_v72_reference_idx on public.wae_evidence_runs_v72(reference_id,created_at desc);
create index if not exists wae_evidence_cases_v72_run_idx on public.wae_evidence_case_attestations_v72(run_id);
create index if not exists wae_evidence_regressions_v72_open_idx on public.wae_evidence_regressions_v72(status,severity,last_seen_at desc);

alter table public.wae_evidence_runs_v72 enable row level security;
alter table public.wae_evidence_case_attestations_v72 enable row level security;
alter table public.wae_evidence_regressions_v72 enable row level security;
alter table public.wae_evidence_public_status_v72 enable row level security;

revoke all on public.wae_evidence_runs_v72 from public, anon, authenticated;
revoke all on public.wae_evidence_case_attestations_v72 from public, anon, authenticated;
revoke all on public.wae_evidence_regressions_v72 from public, anon, authenticated;
revoke all on public.wae_evidence_public_status_v72 from public, anon, authenticated;

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
begin
  if coalesce(p_worker_token,'')='' or public.wae_validate_worker_token(p_worker_token) is distinct from true then raise exception 'worker_auth_required'; end if;
  if v_version<>'universal-adversarial-evidence/v72' then raise exception 'benchmark_version_mismatch'; end if;
  if v_evaluated<>64 then raise exception 'complete_64_case_suite_required'; end if;
  if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)<>64 then raise exception 'entry_count_mismatch'; end if;
  if (select count(distinct e->>'caseId') from jsonb_array_elements(p_entries)e)<>64 then raise exception 'duplicate_or_missing_case'; end if;
  if v_suite_hash!~'^[0-9a-f]{64}$' then raise exception 'invalid_suite_hash'; end if;
  if v_target='' or v_reference='' or v_target=v_reference then raise exception 'invalid_reference'; end if;
  if lower(v_reference) in ('reference','baseline','gpt','chatgpt','claude','gemini','grok') or v_reference!~'[0-9]' or v_reference!~'^[A-Za-z0-9._:/+-]+$' then raise exception 'versioned_external_reference_required'; end if;
  if coalesce(p_certification->>'targetId','')<>v_target or coalesce(p_certification->>'referenceId','')<>v_reference then raise exception 'certification_identity_mismatch'; end if;
  if jsonb_typeof(v_regressions)<>'array' then raise exception 'invalid_regressions'; end if;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    if coalesce(v_entry->>'caseId','')='' then raise exception 'case_id_missing'; end if;
    if coalesce(v_entry->>'promptHash','')!~'^[0-9a-f]{64}$' then raise exception 'prompt_hash_invalid'; end if;
    if coalesce(v_entry->>'targetAnswerHash','')!~'^[0-9a-f]{64}$' then raise exception 'target_answer_hash_invalid'; end if;
    if coalesce(v_entry->>'referenceAnswerHash','')!~'^[0-9a-f]{64}$' then raise exception 'reference_answer_hash_invalid'; end if;
  end loop;

  v_entries_hash:=encode(extensions.digest(p_entries::text,'sha256'),'hex');
  v_certification_hash:=encode(extensions.digest(p_certification::text,'sha256'),'hex');

  insert into public.wae_evidence_runs_v72(
    benchmark_version,suite_hash,entries_hash,certification_hash,target_id,reference_id,commit_sha,
    attestation_level,trusted_for_promotion,evaluated_cases,wins,ties,losses,adjusted_win_rate,critical_failure_rate,
    target_mean_score,reference_mean_score,mean_score_delta,wilson_lower_bound_95,claim_allowed,verdict,metrics,thresholds,gates,certification
  ) values(
    v_version,v_suite_hash,v_entries_hash,v_certification_hash,v_target,v_reference,nullif(trim(p_commit_sha),''),
    'trusted_worker',true,v_evaluated,coalesce((v_aggregate->>'wins')::integer,0),coalesce((v_aggregate->>'ties')::integer,0),coalesce((v_aggregate->>'losses')::integer,0),coalesce((v_aggregate->>'adjustedWinRate')::numeric,0),coalesce((v_aggregate->>'criticalFailureRate')::numeric,0),
    nullif(v_metrics->>'targetMeanScore','')::numeric,nullif(v_metrics->>'referenceMeanScore','')::numeric,nullif(v_metrics->>'meanScoreDelta','')::numeric,nullif(v_metrics->>'wilsonLowerBound95','')::numeric,
    v_claim,v_verdict,v_metrics,v_thresholds,v_gates,p_certification
  ) returning id into v_run_id;

  for v_entry in select value from jsonb_array_elements(p_entries) loop
    insert into public.wae_evidence_case_attestations_v72(run_id,case_id,prompt_hash,target_answer_hash,reference_answer_hash,target_score,reference_score,winner_id,critical)
    values(v_run_id,left(v_entry->>'caseId',120),v_entry->>'promptHash',v_entry->>'targetAnswerHash',v_entry->>'referenceAnswerHash',nullif(v_entry->>'targetScore','')::numeric,nullif(v_entry->>'referenceScore','')::numeric,left(coalesce(v_entry->>'winnerId',''),120),coalesce((v_entry->>'critical')::boolean,false));
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
  values('global',v_version,v_trusted,v_run_id,v_reference,v_suite_hash,coalesce((v_aggregate->>'adjustedWinRate')::numeric,0),v_claim,v_open,v_critical,v_high,v_release,v_claim_gate,nullif(trim(p_commit_sha),''),now())
  on conflict(context_key) do update set benchmark_version=excluded.benchmark_version,trusted_runs=excluded.trusted_runs,last_run_id=excluded.last_run_id,last_reference_id=excluded.last_reference_id,last_suite_hash=excluded.last_suite_hash,last_adjusted_win_rate=excluded.last_adjusted_win_rate,last_claim_allowed=excluded.last_claim_allowed,open_regressions=excluded.open_regressions,critical_open=excluded.critical_open,high_open=excluded.high_open,release_gate=excluded.release_gate,comparative_claim_gate=excluded.comparative_claim_gate,last_commit_sha=excluded.last_commit_sha,updated_at=excluded.updated_at;

  return jsonb_build_object('ok',true,'run_id',v_run_id,'trusted_for_promotion',true,'entries_hash',v_entries_hash,'certification_hash',v_certification_hash,'suite_hash',v_suite_hash,'release_gate',v_release,'comparative_claim_gate',v_claim_gate,'open_regressions',v_open,'critical_open',v_critical,'high_open',v_high);
end;
$$;

revoke all on function public.wae_record_trusted_evidence_v72(text,jsonb,jsonb,text,text,text) from public;
grant execute on function public.wae_record_trusted_evidence_v72(text,jsonb,jsonb,text,text,text) to anon, authenticated;

comment on table public.wae_evidence_runs_v72 is 'Trusted append-only 64-case adversarial evidence benchmark runs. Stores hashes and metrics, not full candidate answers.';
comment on function public.wae_record_trusted_evidence_v72 is 'Worker-token-gated recorder for Universal Core v72 adversarial evidence certifications.';
