-- Universal Core v98 — premium superiority regression status.
-- Exposes only aggregate trusted benchmark/regression state. No prompts, answers or user data.

create or replace function public.wae_premium_regression_status_v98()
returns jsonb
language sql
stable
security definer
set search_path to 'public','pg_catalog'
as $function$
with runs as (
  select count(*)::int trusted_runs,
         max(created_at) last_run_at,
         (array_agg(reference_id order by created_at desc))[1] last_reference_id,
         (array_agg(commit_sha order by created_at desc))[1] last_commit_sha
  from public.wae_supremacy_runs_v54
  where trusted_for_promotion=true
    and benchmark_version='verified-gpt-arena/v93'
), backlog as (
  select count(*) filter(where status='open')::int open_regressions,
         count(*) filter(where status='open' and severity='critical')::int critical_open,
         count(*) filter(where status='open' and severity='high')::int high_open
  from public.wae_supremacy_regression_backlog_v54
  where trusted=true
    and source_benchmark_version='verified-gpt-arena/v93'
)
select jsonb_build_object(
  'version','premium-superiority-gate/v98',
  'benchmark_version','verified-gpt-arena/v93',
  'trusted_runs',runs.trusted_runs,
  'last_run_at',runs.last_run_at,
  'last_reference_id',runs.last_reference_id,
  'last_commit_sha',runs.last_commit_sha,
  'open_regressions',backlog.open_regressions,
  'critical_open',backlog.critical_open,
  'high_open',backlog.high_open,
  'release_gate',case
    when runs.trusted_runs=0 then 'HOLD'
    when backlog.critical_open>0 then 'BLOCK'
    when backlog.high_open>0 then 'CAUTION'
    else 'PASS'
  end,
  'privacy',jsonb_build_object(
    'raw_prompts_exposed',false,
    'raw_answers_exposed',false,
    'user_data_exposed',false
  ),
  'checked_at',now()
)
from runs cross join backlog;
$function$;

revoke all on function public.wae_premium_regression_status_v98() from public;
grant execute on function public.wae_premium_regression_status_v98() to anon, authenticated, service_role;

comment on function public.wae_premium_regression_status_v98()
is 'Privacy-safe aggregate release status for the v98 premium superiority gate; contains no benchmark prompts or answers.';
