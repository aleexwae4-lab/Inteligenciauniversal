create or replace function public.wae_web_ingest_document_v2(
  p_url text,
  p_origin text,
  p_host text,
  p_title text,
  p_description text,
  p_excerpt text,
  p_index_text text,
  p_content_hash text,
  p_evidence_hash text,
  p_http_status integer,
  p_content_type text,
  p_word_count integer,
  p_link_count integer,
  p_source_class text,
  p_authority_score double precision,
  p_freshness_score double precision,
  p_quality_score double precision,
  p_robots_status text,
  p_robots_hash text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := coalesce(auth.role(),'');
  v_doc_id uuid;
  v_host text := lower(left(trim(coalesce(p_host,'')),255));
  v_robots_status text;
  v_authority double precision := greatest(0.0,least(coalesce(p_authority_score,0.0),1.0));
  v_freshness double precision := greatest(0.0,least(coalesce(p_freshness_score,0.5),1.0));
  v_quality double precision := greatest(0.0,least(coalesce(p_quality_score,0.5),1.0));
begin
  if v_role <> 'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  if coalesce(p_url,'') !~ '^https://' or coalesce(p_origin,'') !~ '^https://' then
    raise exception 'https_required' using errcode='22023';
  end if;
  if v_host='' or position('/' in v_host)>0 or position(':' in v_host)>0 then
    raise exception 'invalid_host' using errcode='22023';
  end if;
  if coalesce(p_content_hash,'') !~ '^[0-9a-f]{64}$' or coalesce(p_evidence_hash,'') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_sha256' using errcode='22023';
  end if;
  if p_robots_hash is not null and p_robots_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_robots_hash' using errcode='22023';
  end if;

  v_robots_status := case lower(coalesce(p_robots_status,'unknown'))
    when 'allowed' then 'allowed'
    when 'restricted' then 'restricted'
    when 'unavailable' then 'unavailable'
    when 'error' then 'error'
    else 'unknown'
  end;

  insert into public.wae_global_domains_v1(
    host,robots_status,robots_hash,robots_fetched_at,updated_at
  ) values (
    v_host,v_robots_status,p_robots_hash,
    case when v_robots_status <> 'unknown' then now() else null end,
    now()
  )
  on conflict (host) do update set
    robots_status = case
      when excluded.robots_status='unknown' then public.wae_global_domains_v1.robots_status
      else excluded.robots_status
    end,
    robots_hash = coalesce(excluded.robots_hash,public.wae_global_domains_v1.robots_hash),
    robots_fetched_at = coalesce(excluded.robots_fetched_at,public.wae_global_domains_v1.robots_fetched_at),
    updated_at = now();

  insert into public.wae_global_documents_v1(
    url,origin,host,title,description,excerpt,search_document,content_hash,
    http_status,content_type,word_count,link_count,page_rank,authority_score,
    source_kind,fetched_at,first_seen_at,last_seen_at,full_html_persisted,
    raw_credentials_persisted,freshness_score,quality_score,ranking_version,
    institutional_authority_score,temporal_freshness_score,structural_quality_score
  ) values (
    left(p_url,2048),left(p_origin,512),v_host,left(coalesce(p_title,''),500),
    left(coalesce(p_description,''),2000),left(coalesce(p_excerpt,''),4000),
    to_tsvector('simple',left(coalesce(p_index_text,''),80000)),p_content_hash,
    greatest(100,least(coalesce(p_http_status,200),599)),left(coalesce(p_content_type,''),160),
    greatest(0,least(coalesce(p_word_count,0),1000000)),
    greatest(0,least(coalesce(p_link_count,0),100000)),
    0,v_authority,'browser',now(),now(),now(),false,false,v_freshness,v_quality,
    'web_intelligence_v2',v_authority,v_freshness,v_quality
  )
  on conflict (url) do update set
    origin=excluded.origin,
    host=excluded.host,
    title=case when excluded.title<>'' then excluded.title else public.wae_global_documents_v1.title end,
    description=case when excluded.description<>'' then excluded.description else public.wae_global_documents_v1.description end,
    excerpt=case when excluded.excerpt<>'' then excluded.excerpt else public.wae_global_documents_v1.excerpt end,
    search_document=excluded.search_document,
    content_hash=excluded.content_hash,
    http_status=excluded.http_status,
    content_type=excluded.content_type,
    word_count=excluded.word_count,
    link_count=excluded.link_count,
    authority_score=greatest(public.wae_global_documents_v1.authority_score,excluded.authority_score),
    source_kind='browser',
    fetched_at=now(),
    last_seen_at=now(),
    full_html_persisted=false,
    raw_credentials_persisted=false,
    freshness_score=excluded.freshness_score,
    quality_score=greatest(public.wae_global_documents_v1.quality_score,excluded.quality_score),
    ranking_version='web_intelligence_v2',
    institutional_authority_score=greatest(public.wae_global_documents_v1.institutional_authority_score,excluded.institutional_authority_score),
    temporal_freshness_score=excluded.temporal_freshness_score,
    structural_quality_score=greatest(public.wae_global_documents_v1.structural_quality_score,excluded.structural_quality_score)
  returning id into v_doc_id;

  insert into public.wae_global_document_evidence_v1(
    document_id,host,source_class,authority_seed_score,content_hash,evidence_hash,
    full_html_persisted,raw_credentials_persisted,created_at,updated_at
  ) values (
    v_doc_id,v_host,left(coalesce(p_source_class,'unclassified'),80),v_authority,
    p_content_hash,p_evidence_hash,false,false,now(),now()
  )
  on conflict (document_id) do update set
    host=excluded.host,
    source_class=excluded.source_class,
    authority_seed_score=greatest(public.wae_global_document_evidence_v1.authority_seed_score,excluded.authority_seed_score),
    content_hash=excluded.content_hash,
    evidence_hash=excluded.evidence_hash,
    full_html_persisted=false,
    raw_credentials_persisted=false,
    updated_at=now();

  return jsonb_build_object(
    'persisted',true,
    'document_id',v_doc_id,
    'content_hash',p_content_hash,
    'evidence_hash',p_evidence_hash,
    'source_class',left(coalesce(p_source_class,'unclassified'),80)
  );
end;
$$;

revoke all on function public.wae_web_ingest_document_v2(
  text,text,text,text,text,text,text,text,text,integer,text,integer,integer,text,
  double precision,double precision,double precision,text,text
) from public, anon, authenticated;

grant execute on function public.wae_web_ingest_document_v2(
  text,text,text,text,text,text,text,text,text,integer,text,integer,integer,text,
  double precision,double precision,double precision,text,text
) to service_role;

comment on function public.wae_web_ingest_document_v2(
  text,text,text,text,text,text,text,text,text,integer,text,integer,integer,text,
  double precision,double precision,double precision,text,text
) is 'Universal Web Intelligence v2 governed ingestion. Service-role only; stores normalized evidence metadata/text index, never full HTML or credentials.';
