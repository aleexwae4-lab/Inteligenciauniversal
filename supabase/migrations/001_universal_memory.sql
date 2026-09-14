create extension if not exists pgcrypto;

create table if not exists public.universal_memory (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  session_id text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  search tsvector generated always as (to_tsvector('spanish', coalesce(content,''))) stored,
  created_at timestamptz not null default now()
);

create index if not exists universal_memory_user_key_idx on public.universal_memory(user_key, created_at desc);
create index if not exists universal_memory_search_idx on public.universal_memory using gin(search);

alter table public.universal_memory enable row level security;

create or replace function public.search_universal_memory(p_user_key text, p_query text, p_limit int default 6)
returns table(content text, metadata jsonb, created_at timestamptz, rank real)
language sql
security definer
set search_path = public
as $$
  select m.content, m.metadata, m.created_at,
         ts_rank(m.search, websearch_to_tsquery('spanish', p_query)) as rank
  from public.universal_memory m
  where m.user_key = p_user_key
    and (m.search @@ websearch_to_tsquery('spanish', p_query) or p_query = '')
  order by rank desc, m.created_at desc
  limit greatest(1, least(p_limit, 20));
$$;

revoke all on function public.search_universal_memory(text,text,int) from public;
