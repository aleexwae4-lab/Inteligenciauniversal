create or replace function public.wae_universal_core_context_v52(
  p_action text,
  p_query text default '',
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path = 'public','extensions','pg_temp'
as $$
declare
  v_action text := lower(trim(coalesce(p_action,'')));
  v_query text := left(trim(coalesce(p_query,'')),300);
  v_limit integer := greatest(1,least(coalesce(p_limit,8),12));
  v_agents jsonb := '[]'::jsonb;
  v_edges jsonb := '[]'::jsonb;
  v_sources jsonb := '[]'::jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_agent_count bigint := 0;
  v_role_count bigint := 0;
  v_collaboration_count bigint := 0;
  v_coverage bigint := 0;
  v_fulltext_coverage bigint := 0;
  v_local_books bigint := 0;
  v_local_fulltext bigint := 0;
  v_local_chunks bigint := 0;
  v_release jsonb := '{}'::jsonb;
begin
  if v_action in ('agent_manifest','stats','self_description') then
    select count(*),count(distinct executive_role)
      into v_agent_count,v_role_count
    from public.wae_executive_agents
    where status='active';

    select count(*) into v_collaboration_count
    from public.wae_agent_collaborations c
    join public.wae_executive_agents s on s.id=c.source_agent_id and s.status='active'
    join public.wae_executive_agents t on t.id=c.target_agent_id and t.status='active';

    if v_action='agent_manifest' then
      with latest as (
        select distinct on (executive_role)
          executive_role,agent_name,mandate
        from public.wae_executive_agents
        where status='active'
        order by executive_role,created_at desc
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'role',executive_role,
        'name',agent_name,
        'mission',coalesce(mandate->>'mission',''),
        'responsibilities',coalesce(mandate->'responsibilities','[]'::jsonb),
        'frameworks',coalesce(mandate->'frameworks','[]'::jsonb),
        'guardrails',coalesce(mandate->'guardrails','[]'::jsonb),
        'kpis',coalesce(mandate->'kpis','[]'::jsonb)
      ) order by executive_role),'[]'::jsonb)
      into v_agents from latest;

      with pairs as (
        select s.executive_role source_role,t.executive_role target_role,
               c.collaboration_type,count(*) edge_count
        from public.wae_agent_collaborations c
        join public.wae_executive_agents s on s.id=c.source_agent_id and s.status='active'
        join public.wae_executive_agents t on t.id=c.target_agent_id and t.status='active'
        group by s.executive_role,t.executive_role,c.collaboration_type
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'sourceRole',source_role,'targetRole',target_role,
        'type',collaboration_type,'weight',edge_count
      ) order by edge_count desc,source_role,target_role),'[]'::jsonb)
      into v_edges from pairs;

      return jsonb_build_object(
        'ok',true,'version','wae-db-executive-manifest/v52',
        'activeAgentInstances',v_agent_count,'executiveRoles',v_role_count,
        'collaborationEdges',v_collaboration_count,
        'agents',v_agents,'collaborations',v_edges
      );
    end if;
  end if;

  if v_action in ('library_stats','stats','self_description') then
    select coalesce(sum(metadata_coverage_estimate),0),coalesce(sum(fulltext_coverage_estimate),0)
      into v_coverage,v_fulltext_coverage
    from public.wae_book_sources_v1 where active=true;

    select count(*),count(*) filter(where access_level='fulltext')
      into v_local_books,v_local_fulltext
    from public.wae_books_catalog_v1;

    select count(*) into v_local_chunks from public.wae_book_chunks_v1;

    select coalesce(jsonb_agg(jsonb_build_object(
      'sourceKey',source_key,'name',name,'type',source_type,
      'metadataCoverageEstimate',metadata_coverage_estimate,
      'fulltextCoverageEstimate',fulltext_coverage_estimate,
      'trustScore',trust_score,'lastVerifiedAt',last_verified_at
    ) order by source_key),'[]'::jsonb)
    into v_sources from public.wae_book_sources_v1 where active=true;

    select coalesce(to_jsonb(x),'{}'::jsonb) into v_release from (
      select status,federated_metadata_coverage_estimate,local_books,local_fulltext_books,
             copyright_policy,source_status,created_at
      from public.wae_library_release_audit_v1
      order by created_at desc limit 1
    ) x;

    if v_action='library_stats' then
      return jsonb_build_object(
        'ok',true,'version','wae-library-intelligence/v52',
        'federatedMetadataCoverageEstimate',v_coverage,
        'fulltextCoverageEstimate',v_fulltext_coverage,
        'localBooks',v_local_books,'localFulltextBooks',v_local_fulltext,
        'localChunks',v_local_chunks,'sources',v_sources,'releaseAudit',v_release,
        'claimPolicy',jsonb_build_object(
          'allowed','connected_to_millions_of_bibliographic_records_and_open_collections',
          'forbidden','millions_of_full_copyrighted_books_loaded'
        )
      );
    end if;
  end if;

  if v_action='library_local_search' then
    if length(v_query)<2 then return jsonb_build_object('ok',false,'error','query_required'); end if;
    with q as (select websearch_to_tsquery('simple',v_query) tsq),
    hits as (
      select b.id,b.source_key,b.title,b.authors,b.publish_year,b.subjects,b.description,
             b.source_url,b.rights_class,b.access_level,b.content_ingest_allowed,
             null::text snippet,
             ts_rank_cd(b.search_document,q.tsq) score
      from public.wae_books_catalog_v1 b,q
      where b.search_document @@ q.tsq or b.title ilike ('%'||v_query||'%')
      union all
      select b.id,b.source_key,b.title,b.authors,b.publish_year,b.subjects,b.description,
             b.source_url,b.rights_class,b.access_level,b.content_ingest_allowed,
             left(c.content,1200) snippet,
             ts_rank_cd(c.search_document,q.tsq) score
      from public.wae_book_chunks_v1 c
      join public.wae_books_catalog_v1 b on b.id=c.book_id,q
      where c.search_document @@ q.tsq
        and c.rights_snapshot in('public_domain','open_license','authorized')
    )
    select coalesce(jsonb_agg(to_jsonb(x) order by x.score desc),'[]'::jsonb)
      into v_rows
    from (select * from hits order by score desc limit v_limit) x;
    return jsonb_build_object('ok',true,'version','wae-library-local-search/v52','query',v_query,'rows',v_rows);
  end if;

  if v_action='self_description' then
    return jsonb_build_object(
      'ok',true,'version','wae-universal-core-context/v52',
      'executiveOrchestration',jsonb_build_object(
        'activeAgentInstances',v_agent_count,'executiveRoles',v_role_count,
        'collaborationEdges',v_collaboration_count
      ),
      'library',jsonb_build_object(
        'federatedMetadataCoverageEstimate',v_coverage,
        'fulltextCoverageEstimate',v_fulltext_coverage,
        'localBooks',v_local_books,'localFulltextBooks',v_local_fulltext,
        'localChunks',v_local_chunks,'sources',v_sources,
        'rightsStatement','Full text is persisted only when public-domain, open-license, or authorized.'
      )
    );
  end if;

  if v_action='stats' then
    return jsonb_build_object(
      'ok',true,'version','wae-universal-core-context/v52',
      'activeAgentInstances',v_agent_count,'executiveRoles',v_role_count,
      'collaborationEdges',v_collaboration_count,
      'federatedMetadataCoverageEstimate',v_coverage,
      'fulltextCoverageEstimate',v_fulltext_coverage,
      'localBooks',v_local_books,'localFulltextBooks',v_local_fulltext,'localChunks',v_local_chunks
    );
  end if;

  return jsonb_build_object('ok',false,'error','unsupported_action');
end;
$$;

revoke all on function public.wae_universal_core_context_v52(text,text,integer) from public;
grant execute on function public.wae_universal_core_context_v52(text,text,integer) to anon, authenticated, service_role;
comment on function public.wae_universal_core_context_v52(text,text,integer) is 'Read-only safe projection of WAE executive-agent orchestration and rights-aware library intelligence for Universal Core v52. No tenant IDs, secrets or unrestricted copyrighted full text are returned.';
