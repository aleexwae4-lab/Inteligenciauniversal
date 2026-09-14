-- WAE System Arena v3.
-- Private, service-role-only evidence ledger for production E2E capabilities.

create schema if not exists wae_eval_private;
revoke all on schema wae_eval_private from public, anon, authenticated;
grant usage on schema wae_eval_private to service_role;

create table if not exists wae_eval_private.system_arena_runs_v3 (
  id uuid primary key default gen_random_uuid(),
  suite_key text not null default 'wae_system_capabilities_v3',
  runtime text not null,
  status text not null check (status in ('running','passed','failed','partial')),
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists wae_eval_private.system_arena_results_v3 (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references wae_eval_private.system_arena_runs_v3(id) on delete cascade,
  capability_key text not null,
  status text not null check (status in ('passed','failed','unavailable')),
  score numeric(6,2) not null default 0,
  latency_ms integer,
  provider text,
  model_name text,
  expected jsonb not null default '{}'::jsonb,
  actual jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(run_id, capability_key)
);

revoke all on all tables in schema wae_eval_private from public, anon, authenticated;
grant select, insert, update, delete on wae_eval_private.system_arena_runs_v3 to service_role;
grant select, insert, update, delete on wae_eval_private.system_arena_results_v3 to service_role;

create or replace function wae_eval_private.system_gate_v3()
returns table(
  run_id uuid,
  total_capabilities integer,
  passed_capabilities integer,
  avg_score numeric,
  p95_latency_ms double precision,
  verdict text
)
language sql
security invoker
set search_path = wae_eval_private, pg_catalog
as $function$
  with latest as (
    select r.id
    from wae_eval_private.system_arena_runs_v3 r
    order by r.started_at desc
    limit 1
  ), agg as (
    select
      l.id as run_id,
      count(res.*)::int as total_capabilities,
      count(*) filter (where res.status='passed')::int as passed_capabilities,
      round(avg(res.score),2) as avg_score,
      percentile_cont(0.95) within group (order by res.latency_ms) as p95_latency_ms,
      count(*) filter (where res.status<>'passed')::int as failures
    from latest l
    left join wae_eval_private.system_arena_results_v3 res on res.run_id=l.id
    group by l.id
  )
  select
    a.run_id,
    a.total_capabilities,
    a.passed_capabilities,
    a.avg_score,
    a.p95_latency_ms,
    case
      when a.total_capabilities >= 2 and a.failures=0 and a.avg_score=100 then 'PASS_SYSTEM_GATE'
      else 'HOLD_SYSTEM_GATE'
    end as verdict
  from agg a;
$function$;

revoke all on function wae_eval_private.system_gate_v3() from public, anon, authenticated;
grant execute on function wae_eval_private.system_gate_v3() to service_role;
