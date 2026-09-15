-- Harden the v52 Universal Core context bridge.
-- Public callers only see explicit RLS-protected snapshots. The refresh primitive
-- remains SECURITY DEFINER but is service_role-only.

create table if not exists public.wae_universal_core_public_context_v52 (
  context_key text primary key,
  payload jsonb not null,
  refreshed_at timestamptz not null default now(),
  constraint wae_universal_core_public_context_v52_key_chk
    check (context_key in ('agent_manifest','library_stats','self_description','stats'))
);

create table if not exists public.wae_library_public_catalog_v52 (
  id uuid primary key,
  source_key text not null,
  title text not null,
  authors text[] not null default '{}',
  publish_year integer,
  subjects text[] not null default '{}',
  description text,
  source_url text,
  rights_class text,
  access_level text,
  content_ingest_allowed boolean not null default false,
  search_document tsvector not null default ''::tsvector,
  refreshed_at timestamptz not null default now()
);
create index if not exists wae_library_public_catalog_v52_search_idx
  on public.wae_library_public_catalog_v52 using gin(search_document);

alter table public.wae_universal_core_public_context_v52 enable row level security;
alter table public.wae_library_public_catalog_v52 enable row level security;
revoke all on public.wae_universal_core_public_context_v52 from anon,authenticated;
revoke all on public.wae_library_public_catalog_v52 from anon,authenticated;
grant select on public.wae_universal_core_public_context_v52 to anon,authenticated,service_role;
grant select on public.wae_library_public_catalog_v52 to anon,authenticated,service_role;

drop policy if exists wae_universal_core_public_context_v52_read on public.wae_universal_core_public_context_v52;
create policy wae_universal_core_public_context_v52_read
  on public.wae_universal_core_public_context_v52 for select to anon,authenticated using (true);
drop policy if exists wae_library_public_catalog_v52_read on public.wae_library_public_catalog_v52;
create policy wae_library_public_catalog_v52_read
  on public.wae_library_public_catalog_v52 for select to anon,authenticated using (true);

create or replace function public.wae_refresh_universal_core_public_context_v52()
returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_temp'
as $$
declare
  v_agent_manifest jsonb; v_library_stats jsonb; v_self jsonb; v_stats jsonb;
  v_agent_count bigint; v_role_count bigint; v_edges bigint;
  v_coverage bigint; v_fulltext bigint; v_local_books bigint; v_local_fulltext bigint; v_chunks bigint;
  v_sources jsonb; v_release jsonb;
begin
  select count(*),count(distinct executive_role) into v_agent_count,v_role_count
  from public.wae_executive_agents where status='active';
  select count(*) into v_edges from public.wae_agent_collaborations c
  join public.wae_executive_agents s on s.id=c.source_agent_id and s.status='active'
  join public.wae_executive_agents t on t.id=c.target_agent_id and t.status='active';

  with latest as (
    select distinct on (executive_role) executive_role,agent_name,mandate
    from public.wae_executive_agents where status='active' order by executive_role,created_at desc
  ), agents as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'role',executive_role,'name',agent_name,'mission',coalesce(mandate->>'mission',''),
      'responsibilities',coalesce(mandate->'responsibilities','[]'::jsonb),
      'frameworks',coalesce(mandate->'frameworks','[]'::jsonb),
      'guardrails',coalesce(mandate->'guardrails','[]'::jsonb),
      'kpis',coalesce(mandate->'kpis','[]'::jsonb)
    ) order by executive_role),'[]'::jsonb) value from latest
  ), pairs as (
    select s.executive_role source_role,t.executive_role target_role,c.collaboration_type,count(*) edge_count
    from public.wae_agent_collaborations c
    join public.wae_executive_agents s on s.id=c.source_agent_id and s.status='active'
    join public.wae_executive_agents t on t.id=c.target_agent_id and t.status='active'
    group by s.executive_role,t.executive_role,c.collaboration_type
  ), edge_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'sourceRole',source_role,'targetRole',target_role,'type',collaboration_type,'weight',edge_count
    ) order by edge_count desc,source_role,target_role),'[]'::jsonb) value from pairs
  )
  select jsonb_build_object(
    'ok',true,'version','wae-db-executive-manifest/v52','activeAgentInstances',v_agent_count,
    'executiveRoles',v_role_count,'collaborationEdges',v_edges,
    'agents',agents.value,'collaborations',edge_json.value
  ) into v_agent_manifest from agents,edge_json;

  select coalesce(sum(metadata_coverage_estimate),0),coalesce(sum(fulltext_coverage_estimate),0)
    into v_coverage,v_fulltext from public.wae_book_sources_v1 where active=true;
  select count(*),count(*) filter(where access_level='fulltext')
    into v_local_books,v_local_fulltext from public.wae_books_catalog_v1;
  select count(*) into v_chunks from public.wae_book_chunks_v1;
  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceKey',source_key,'name',name,'type',source_type,
    'metadataCoverageEstimate',metadata_coverage_estimate,'fulltextCoverageEstimate',fulltext_coverage_estimate,
    'trustScore',trust_score,'lastVerifiedAt',last_verified_at
  ) order by source_key),'[]'::jsonb) into v_sources
  from public.wae_book_sources_v1 where active=true;
  select coalesce(to_jsonb(x),'{}'::jsonb) into v_release from (
    select status,federated_metadata_coverage_estimate,local_books,local_fulltext_books,
           copyright_policy,source_status,created_at
    from public.wae_library_release_audit_v1 order by created_at desc limit 1
  ) x;

  v_library_stats:=jsonb_build_object(
    'ok',true,'version','wae-library-intelligence/v52','federatedMetadataCoverageEstimate',v_coverage,
    'fulltextCoverageEstimate',v_fulltext,'localBooks',v_local_books,'localFulltextBooks',v_local_fulltext,
    'localChunks',v_chunks,'sources',v_sources,'releaseAudit',v_release,
    'claimPolicy',jsonb_build_object(
      'allowed','connected_to_millions_of_bibliographic_records_and_open_collections',
      'forbidden','millions_of_full_copyrighted_books_loaded'
    )
  );
  v_self:=jsonb_build_object(
    'ok',true,'version','wae-universal-core-context/v52',
    'executiveOrchestration',jsonb_build_object('activeAgentInstances',v_agent_count,'executiveRoles',v_role_count,'collaborationEdges',v_edges),
    'library',jsonb_build_object(
      'federatedMetadataCoverageEstimate',v_coverage,'fulltextCoverageEstimate',v_fulltext,
      'localBooks',v_local_books,'localFulltextBooks',v_local_fulltext,'localChunks',v_chunks,
      'sources',v_sources,'rightsStatement','Full text is persisted only when public-domain, open-license, or authorized.'
    )
  );
  v_stats:=jsonb_build_object(
    'ok',true,'version','wae-universal-core-context/v52','activeAgentInstances',v_agent_count,
    'executiveRoles',v_role_count,'collaborationEdges',v_edges,'federatedMetadataCoverageEstimate',v_coverage,
    'fulltextCoverageEstimate',v_fulltext,'localBooks',v_local_books,'localFulltextBooks',v_local_fulltext,'localChunks',v_chunks
  );

  insert into public.wae_universal_core_public_context_v52(context_key,payload,refreshed_at) values
    ('agent_manifest',v_agent_manifest,now()),('library_stats',v_library_stats,now()),
    ('self_description',v_self,now()),('stats',v_stats,now())
  on conflict(context_key) do update set payload=excluded.payload,refreshed_at=excluded.refreshed_at;

  insert into public.wae_library_public_catalog_v52(
    id,source_key,title,authors,publish_year,subjects,description,source_url,rights_class,
    access_level,content_ingest_allowed,search_document,refreshed_at
  )
  select id,source_key,title,coalesce(authors,'{}'),publish_year,coalesce(subjects,'{}'),
         left(coalesce(description,''),4000),source_url,rights_class,access_level,content_ingest_allowed,
         to_tsvector('simple',coalesce(title,'')||' '||coalesce(array_to_string(authors,' '),'')||' '||
           coalesce(array_to_string(subjects,' '),'')||' '||coalesce(description,'')),now()
  from public.wae_books_catalog_v1
  on conflict(id) do update set
    source_key=excluded.source_key,title=excluded.title,authors=excluded.authors,publish_year=excluded.publish_year,
    subjects=excluded.subjects,description=excluded.description,source_url=excluded.source_url,
    rights_class=excluded.rights_class,access_level=excluded.access_level,
    content_ingest_allowed=excluded.content_ingest_allowed,search_document=excluded.search_document,
    refreshed_at=excluded.refreshed_at;
  delete from public.wae_library_public_catalog_v52 p
    where not exists(select 1 from public.wae_books_catalog_v1 b where b.id=p.id);
  return v_stats;
end;
$$;
revoke all on function public.wae_refresh_universal_core_public_context_v52() from public,anon,authenticated;
grant execute on function public.wae_refresh_universal_core_public_context_v52() to service_role;

select public.wae_refresh_universal_core_public_context_v52();

create or replace function public.wae_universal_core_context_v52(
  p_action text,p_query text default '',p_limit integer default 8
)
returns jsonb language plpgsql security invoker
set search_path='public','extensions','pg_temp'
as $$
declare
  v_action text:=lower(trim(coalesce(p_action,'')));
  v_query text:=left(trim(coalesce(p_query,'')),300);
  v_limit integer:=greatest(1,least(coalesce(p_limit,8),12));
  v_payload jsonb;
begin
  if v_action in('agent_manifest','library_stats','self_description','stats') then
    select payload into v_payload from public.wae_universal_core_public_context_v52 where context_key=v_action;
    return coalesce(v_payload,jsonb_build_object('ok',false,'error','snapshot_unavailable'));
  end if;
  if v_action='library_local_search' then
    if length(v_query)<2 then return jsonb_build_object('ok',false,'error','query_required'); end if;
    select jsonb_build_object(
      'ok',true,'version','wae-library-local-search/v52','query',v_query,
      'rows',coalesce(jsonb_agg(to_jsonb(x) order by x.score desc),'[]'::jsonb)
    ) into v_payload from (
      select id,source_key,title,authors,publish_year,subjects,description,source_url,rights_class,
             access_level,content_ingest_allowed,
             ts_rank_cd(search_document,websearch_to_tsquery('simple',v_query)) score
      from public.wae_library_public_catalog_v52
      where search_document @@ websearch_to_tsquery('simple',v_query) or title ilike ('%'||v_query||'%')
      order by score desc limit v_limit
    ) x;
    return coalesce(v_payload,jsonb_build_object('ok',true,'version','wae-library-local-search/v52','query',v_query,'rows','[]'::jsonb));
  end if;
  return jsonb_build_object('ok',false,'error','unsupported_action');
end;
$$;
revoke all on function public.wae_universal_core_context_v52(text,text,integer) from public;
grant execute on function public.wae_universal_core_context_v52(text,text,integer) to anon,authenticated,service_role;
comment on function public.wae_universal_core_context_v52(text,text,integer)
  is 'SECURITY INVOKER read-only API over RLS-protected WAE executive/library snapshots; no tenant IDs, secrets or copyrighted full text.';
