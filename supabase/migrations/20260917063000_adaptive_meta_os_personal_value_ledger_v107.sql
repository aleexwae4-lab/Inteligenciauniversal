create table if not exists public.wae_personal_value_ledger_v107 (
  id uuid primary key default gen_random_uuid(),
  user_key_hash text not null,
  session_id text null,
  conversation_id text null,
  interaction_hash text not null,
  category text not null check (category in (
    'revenue_generated','cost_savings','time_savings','risk_reduction',
    'productivity_gain','knowledge_asset','automation_created','opportunity_created'
  )),
  status text not null default 'candidate' check (status in ('candidate','verified','realized','rejected')),
  amount_mxn numeric null check (amount_mxn is null or amount_mxn >= 0),
  hours_saved numeric null check (hours_saved is null or hours_saved >= 0),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  evidence jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wae_personal_value_ledger_v107_unique_turn unique (user_key_hash, interaction_hash, category),
  constraint wae_personal_value_ledger_v107_verified_measurement check (
    status not in ('verified','realized') or amount_mxn is not null or hours_saved is not null
  )
);

create index if not exists wae_personal_value_ledger_v107_user_time_idx
  on public.wae_personal_value_ledger_v107 (user_key_hash, occurred_at desc);
create index if not exists wae_personal_value_ledger_v107_user_category_idx
  on public.wae_personal_value_ledger_v107 (user_key_hash, category, status);

alter table public.wae_personal_value_ledger_v107 enable row level security;
revoke all on table public.wae_personal_value_ledger_v107 from anon, authenticated;
grant all on table public.wae_personal_value_ledger_v107 to service_role;

comment on table public.wae_personal_value_ledger_v107 is
'Universal Core v107 personal value intelligence. Candidate signals never count as realized ROI; verified/realized rows require measurable evidence.';
comment on column public.wae_personal_value_ledger_v107.user_key_hash is
'SHA-256 scoped user key; raw user identifier is never persisted here.';
comment on column public.wae_personal_value_ledger_v107.status is
'candidate signals are hypotheses only; verified/realized require a numeric amount or time measurement.';
