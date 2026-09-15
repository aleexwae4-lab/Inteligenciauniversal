-- Universal Core v54 — Continuous Improvement Gate
-- Stores benchmark certifications and regression backlog without exposing candidate answers.
-- User-submitted runs are auditable but can never affect the trusted promotion snapshot.

create table if not exists public.wae_supremacy_runs_v54 (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null,
  benchmark_version text not null,
  target_id text not null,
  reference_id text not null,
  commit_sha text,
  attestation_level text not null default 'user_submitted'
    check (attestation_level in ('user_submitted','trusted_worker')),
  trusted_for_promotion boolean not null default false,
  evaluated_cases integer not null default 0 check (evaluated_cases between 0 and 64),
  wins integer not null default 0 check (wins >= 0),
  ties integer not null default 0 check (ties >= 0),
  losses integer not null default 0 check (losses >= 0),
  adjusted_win_rate numeric not null default 0 check (adjusted_win_rate between 0 and 1),
  critical_failure_rate numeric not null default 0 check (critical_failure_rate between 0 and 1),
  claim_allowed boolean not null default false,
  verdict text not null default 'NOT_PROVEN',
  certification jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wae_supremacy_runs_v54_created_idx
  on public.wae_supremacy_runs_v54(created_at desc);
create index if not exists wae_supremacy_runs_v54_trusted_idx
  on public.wae_supremacy_runs_v54(trusted_for_promotion, created_at desc);
create index if not exists wae_supremacy_runs_v54_actor_idx
  on public.wae_supremacy_runs_v54(actor_user_id, created_at desc);

create table if not exists public.wae_supremacy_regression_backlog_v54 (
  id uuid primary key default gen_random_uuid(),
  regression_key text not null unique,
  actor_user_id uuid null,
  case_id text not null,
  prompt_hash text not null,
  category text not null default 'unknown',
  failure_tags jsonb not null default '[]'::jsonb,
  severity text not null default 'medium'
    check (severity in ('critical','high','medium','low')),
  status text not null default 'open'
    check (status in ('open','resolved','waived')),
  trusted boolean not null default false,
  first_seen_run_id uuid references public.wae_supremacy_runs_v54(id) on delete set null,
  last_seen_run_id uuid references public.wae_supremacy_runs_v54(id) on delete set null,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  last_target_score numeric,
  last_reference_score numeric,
  source_benchmark_version text not null,
  resolved_by_commit_sha text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists wae_supremacy_regression_v54_open_idx
  on public.wae_supremacy_regression_backlog_v54(trusted, status, severity, last_seen_at desc);
create index if not exists wae_supremacy_regression_v54_case_idx
  on public.wae_supremacy_regression_backlog_v54(case_id, trusted, status);
create index if not exists wae_supremacy_regression_v54_actor_idx
  on public.wae_supremacy_regression_backlog_v54(actor_user_id, status, last_seen_at desc);

create table if not exists public.wae_supremacy_public_status_v54 (
  context_key text primary key default 'global' check (context_key = 'global'),
  benchmark_version text not null default 'universal-supremacy-benchmark/v53',
  trusted_runs bigint not null default 0,
  last_reference_id text,
  last_adjusted_win_rate numeric,
  last_claim_allowed boolean not null default false,
  open_regressions bigint not null default 0,
  critical_open bigint not null default 0,
  high_open bigint not null default 0,
  release_gate text not null default 'HOLD'
    check (release_gate in ('PASS','CAUTION','BLOCK','HOLD')),
  superiority_claim_gate text not null default 'HOLD'
    check (superiority_claim_gate in ('CERTIFIED','HOLD')),
  last_commit_sha text,
  updated_at timestamptz not null default now()
);

insert into public.wae_supremacy_public_status_v54(context_key)
values ('global')
on conflict (context_key) do nothing;

alter table public.wae_supremacy_runs_v54 enable row level security;
alter table public.wae_supremacy_regression_backlog_v54 enable row level security;
alter table public.wae_supremacy_public_status_v54 enable row level security;

-- Private ledgers: no anon/authenticated policies. service_role bypasses RLS.
revoke all on public.wae_supremacy_runs_v54 from anon, authenticated;
revoke all on public.wae_supremacy_regression_backlog_v54 from anon, authenticated;

-- Only a sanitized aggregate is public-readable.
revoke all on public.wae_supremacy_public_status_v54 from anon, authenticated;
grant select on public.wae_supremacy_public_status_v54 to anon, authenticated;

drop policy if exists wae_supremacy_public_status_v54_read on public.wae_supremacy_public_status_v54;
create policy wae_supremacy_public_status_v54_read
  on public.wae_supremacy_public_status_v54
  for select
  to anon, authenticated
  using (context_key = 'global');

create or replace function public.wae_refresh_supremacy_public_status_v54()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  latest public.wae_supremacy_runs_v54%rowtype;
  trusted_count bigint := 0;
  open_count bigint := 0;
  critical_count bigint := 0;
  high_count bigint := 0;
  release_state text := 'HOLD';
  claim_state text := 'HOLD';
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  select count(*) into trusted_count
  from public.wae_supremacy_runs_v54
  where trusted_for_promotion = true;

  select * into latest
  from public.wae_supremacy_runs_v54
  where trusted_for_promotion = true
  order by created_at desc
  limit 1;

  select count(*) into open_count
  from public.wae_supremacy_regression_backlog_v54
  where trusted = true and status = 'open';

  select count(*) into critical_count
  from public.wae_supremacy_regression_backlog_v54
  where trusted = true and status = 'open' and severity = 'critical';

  select count(*) into high_count
  from public.wae_supremacy_regression_backlog_v54
  where trusted = true and status = 'open' and severity = 'high';

  release_state := case
    when trusted_count = 0 then 'HOLD'
    when critical_count > 0 then 'BLOCK'
    when high_count > 0 then 'CAUTION'
    else 'PASS'
  end;

  claim_state := case
    when trusted_count > 0
      and latest.claim_allowed = true
      and critical_count = 0
      and high_count = 0
      then 'CERTIFIED'
    else 'HOLD'
  end;

  insert into public.wae_supremacy_public_status_v54(
    context_key, benchmark_version, trusted_runs, last_reference_id,
    last_adjusted_win_rate, last_claim_allowed, open_regressions,
    critical_open, high_open, release_gate, superiority_claim_gate,
    last_commit_sha, updated_at
  ) values (
    'global',
    coalesce(latest.benchmark_version,'universal-supremacy-benchmark/v53'),
    trusted_count,
    latest.reference_id,
    latest.adjusted_win_rate,
    coalesce(latest.claim_allowed,false),
    open_count,
    critical_count,
    high_count,
    release_state,
    claim_state,
    latest.commit_sha,
    now()
  )
  on conflict (context_key) do update set
    benchmark_version = excluded.benchmark_version,
    trusted_runs = excluded.trusted_runs,
    last_reference_id = excluded.last_reference_id,
    last_adjusted_win_rate = excluded.last_adjusted_win_rate,
    last_claim_allowed = excluded.last_claim_allowed,
    open_regressions = excluded.open_regressions,
    critical_open = excluded.critical_open,
    high_open = excluded.high_open,
    release_gate = excluded.release_gate,
    superiority_claim_gate = excluded.superiority_claim_gate,
    last_commit_sha = excluded.last_commit_sha,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok',true,
    'trusted_runs',trusted_count,
    'open_regressions',open_count,
    'critical_open',critical_count,
    'high_open',high_count,
    'release_gate',release_state,
    'superiority_claim_gate',claim_state
  );
end;
$$;

revoke all on function public.wae_refresh_supremacy_public_status_v54() from public, anon, authenticated;
grant execute on function public.wae_refresh_supremacy_public_status_v54() to service_role;
