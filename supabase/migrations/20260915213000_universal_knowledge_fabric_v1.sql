-- WAE Universal Knowledge Fabric v1 control plane.
-- Reuses existing wae_rag_chunks (pgvector), wae_global_documents_v1 (tsvector),
-- wae_knowledge_entities/relationships and wae_research_* tables.
-- This migration intentionally does NOT create a second document/vector/graph store.

create table if not exists public.wae_knowledge_sources_v1 (
  source_id text primary key,
  name text not null,
  category text not null,
  base_url text not null,
  api_available boolean not null default false,
  authentication_required boolean not null default false,
  license_summary text not null default 'unknown',
  full_text boolean not null default false,
  metadata boolean not null default true,
  rate_limit text,
  health text not null default 'unknown' check (health in ('healthy','degraded','rate_limited','offline','disabled','license_blocked','unknown')),
  trust_score numeric(5,4) not null default 0 check (trust_score between 0 and 1),
  certification text not null default 'not_certified',
  domains text[] not null default '{}',
  capabilities jsonb not null default '{}'::jsonb,
  last_check timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wae_license_registry_v1 (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.wae_knowledge_sources_v1(source_id) on delete restrict,
  source_record_id text not null,
  canonical_url text,
  license text not null default 'unknown',
  license_class text not null default 'unknown',
  copyright_status text not null default 'unknown',
  ingestion_permission text not null default 'metadata_only',
  storage_permission boolean not null default false,
  embedding_permission boolean not null default false,
  redistribution_permission boolean not null default false,
  model_training_permission boolean not null default false,
  retrieved_at timestamptz not null default now(),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, source_record_id)
);

create table if not exists public.wae_knowledge_retrieval_ledger_v1 (
  request_id uuid primary key,
  organization_id uuid,
  query text not null,
  sources_used text[] not null default '{}',
  documents_retrieved integer not null default 0,
  documents_used integer not null default 0,
  ranking_scores jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  models_used text[] not null default '{}',
  tools_used text[] not null default '{}',
  retrieval_time_ms integer not null default 0,
  generation_time_ms integer not null default 0,
  total_latency_ms integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.wae_knowledge_source_health_v1 (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.wae_knowledge_sources_v1(source_id) on delete cascade,
  status text not null check (status in ('healthy','degraded','rate_limited','offline','disabled','license_blocked','unknown')),
  latency_ms integer,
  result_count integer,
  detail text,
  checked_at timestamptz not null default now()
);

create index if not exists idx_wae_license_registry_source on public.wae_license_registry_v1(source_id, source_record_id);
create index if not exists idx_wae_retrieval_ledger_org_created on public.wae_knowledge_retrieval_ledger_v1(organization_id, created_at desc);
create index if not exists idx_wae_source_health_source_checked on public.wae_knowledge_source_health_v1(source_id, checked_at desc);

alter table public.wae_knowledge_sources_v1 enable row level security;
alter table public.wae_license_registry_v1 enable row level security;
alter table public.wae_knowledge_retrieval_ledger_v1 enable row level security;
alter table public.wae_knowledge_source_health_v1 enable row level security;

-- No anon/authenticated write policies are created. Writes remain service-role only.
-- Public source discovery is served through the controlled Render API, not direct table access.

insert into public.wae_knowledge_sources_v1
(source_id,name,category,base_url,api_available,authentication_required,license_summary,full_text,metadata,rate_limit,health,trust_score,certification,domains,capabilities)
values
('openalex','OpenAlex','academic_graph','https://api.openalex.org',true,false,'CC0 metadata; work-location licenses vary',false,true,'provider-managed; identify when possible','unknown',0.92,'candidate_integrated',array['science','medicine','biology','physics','computer_science','mathematics','economics','engineering'],jsonb_build_object('search',true,'full_text',false)),
('crossref','Crossref','scholarly_metadata','https://api.crossref.org',true,false,'bibliographic metadata reusable; abstracts excluded by WAE v1',false,true,'public/polite pool; backoff required','unknown',0.96,'candidate_integrated',array['science','medicine','biology','physics','computer_science','mathematics','economics','engineering'],jsonb_build_object('search',true,'full_text',false)),
('wikidata','Wikidata','structured_knowledge','https://www.wikidata.org',true,false,'CC0 structured data',false,true,'Wikimedia API etiquette','unknown',0.84,'candidate_integrated',array['history','biography','philosophy','literature','general_knowledge','science'],jsonb_build_object('search',true,'entities',true)),
('wikipedia','Wikipedia','encyclopedia','https://www.wikipedia.org',true,false,'CC BY-SA; WAE v1 uses transient excerpts',true,true,'Wikimedia API etiquette','unknown',0.76,'candidate_integrated',array['history','biography','philosophy','literature','general_knowledge','science'],jsonb_build_object('search',true,'full_text',false,'transient_excerpt',true)),
('pubmed','PubMed','biomedical_metadata','https://eutils.ncbi.nlm.nih.gov',true,false,'metadata-only in WAE v1; article rights vary',false,true,'3 req/s without NCBI API key','unknown',0.98,'candidate_integrated',array['medicine','biology','health'],jsonb_build_object('search',true,'full_text',false)),
('arxiv','arXiv','preprints','https://export.arxiv.org',true,false,'metadata-only in WAE v1; item licenses vary',false,true,'API delay/backoff required','unknown',0.78,'candidate_integrated',array['physics','computer_science','mathematics','statistics','engineering','economics'],jsonb_build_object('search',true,'full_text',false)),
('open_library','Open Library','books','https://openlibrary.org',true,false,'metadata-only; low-volume API usage',false,true,'1 req/s unidentified; 3 req/s identified','unknown',0.80,'candidate_integrated',array['literature','history','biography','philosophy','general_knowledge','books'],jsonb_build_object('search',true,'bulk_backend',false)),
('zenodo','Zenodo','research_repository','https://zenodo.org/api',true,false,'metadata CC0; files use per-record license',false,true,'provider-managed; backoff required','unknown',0.88,'candidate_integrated',array['science','datasets','software','engineering','general_knowledge'],jsonb_build_object('search',true,'full_text',false)),
('core','CORE','academic_aggregator','https://api.core.ac.uk',true,true,'per-record rights vary',true,true,'API-key plan dependent','disabled',0.88,'auth_required_not_certified',array['science','medicine','computer_science','general_knowledge'],jsonb_build_object('search',false)),
('doaj','DOAJ','open_access_directory','https://doaj.org/api',true,false,'article licenses vary',false,true,'endpoint not certified in WAE v1','disabled',0.91,'pending_endpoint_certification',array['science','medicine','biology','general_knowledge'],jsonb_build_object('search',false)),
('scielo','SciELO','scholarly_repository','https://www.scielo.org',false,false,'per-journal/article license varies',true,true,'connector not certified','disabled',0.91,'pending_api_and_license_certification',array['medicine','biology','science','latam','general_knowledge'],jsonb_build_object('search',false)),
('project_gutenberg','Project Gutenberg','public_domain_books','https://www.gutenberg.org',false,false,'public-domain focus; jurisdiction/per-item check required',true,true,'bulk/mirror policy required','disabled',0.90,'pending_bulk_connector_certification',array['literature','history','books'],jsonb_build_object('search',false))
on conflict (source_id) do update set
  name=excluded.name, category=excluded.category, base_url=excluded.base_url,
  api_available=excluded.api_available, authentication_required=excluded.authentication_required,
  license_summary=excluded.license_summary, full_text=excluded.full_text, metadata=excluded.metadata,
  rate_limit=excluded.rate_limit, trust_score=excluded.trust_score, certification=excluded.certification,
  domains=excluded.domains, capabilities=excluded.capabilities, updated_at=now();
