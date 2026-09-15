-- WAE Universal Knowledge Fabric v70 — scientific source extension.
-- Non-destructive: reuses the v69 control plane and existing pgvector/FTS/graph stores.

insert into public.wae_knowledge_sources_v1
(source_id,name,category,base_url,api_available,authentication_required,license_summary,full_text,metadata,rate_limit,health,trust_score,certification,domains,capabilities)
values
('europe_pmc','Europe PMC','biomedical_repository','https://www.ebi.ac.uk/europepmc',true,false,'metadata-only by default; full-text rights vary by article',true,true,'public API; backoff required','unknown',0.97,'candidate_integrated',array['medicine','biology','health','science'],jsonb_build_object('search',true,'full_text',false,'citations',false,'license_metadata',true,'scientific_integrity',true))
on conflict (source_id) do update set
  name=excluded.name,
  category=excluded.category,
  base_url=excluded.base_url,
  api_available=excluded.api_available,
  authentication_required=excluded.authentication_required,
  license_summary=excluded.license_summary,
  full_text=excluded.full_text,
  metadata=excluded.metadata,
  rate_limit=excluded.rate_limit,
  trust_score=excluded.trust_score,
  certification=excluded.certification,
  domains=excluded.domains,
  capabilities=excluded.capabilities,
  updated_at=now();
