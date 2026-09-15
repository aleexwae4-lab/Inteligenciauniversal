# WAE Universal Knowledge Fabric — Audit v1

Baseline: `main` after Universal Core v68. This document records verified components; it is not a capability claim.

## Runtime / stack

| Area | Verified state | Classification |
|---|---|---|
| Runtime | Node.js >=20, ESM, custom `node:http` server | EXISTING / REUSABLE |
| API | Handler modules under `api/`, exact route map in `server.js` | EXISTING / REUSABLE |
| Database | Supabase Postgres 17 | EXISTING / REUSABLE |
| Vector storage | `wae_rag_chunks.embedding` and `.semantic_embedding` are pgvector `vector` columns | EXISTING / REUSABLE |
| Lexical search | `wae_global_documents_v1.search_document` and library catalog use `tsvector` | EXISTING / REUSABLE |
| RAG chunks | `wae_rag_chunks` with org/document/version/hash/model metadata | EXISTING / REUSABLE |
| Knowledge graph | `wae_knowledge_entities`, `wae_knowledge_relationships`, `wae_knowledge_edges` | EXISTING / REUSABLE |
| Index queue | `wae_knowledge_index_queue` | EXISTING / REUSABLE |
| Manifests | `wae_knowledge_manifests` | EXISTING / REUSABLE |
| Research provenance | `wae_research_runs`, `wae_research_evidence` | EXISTING / REUSABLE |
| Public catalog | `wae_library_public_catalog_v52` | EXISTING / REUSABLE |
| Live web | `live-data-mesh/v58` (GDELT + optional Tavily) | EXISTING / REUSABLE, keep separate |
| Library retrieval | rights-aware local/Open Library path | EXISTING / REUSABLE |
| Context injection defense | typed context trust plane + output firewall; new retrieval gateway added in Fabric v1 | EXISTING + EXTENDED |
| Tenant fields | RAG/graph/research tables are `organization_id` scoped | EXISTING; RLS/policy certification still required |
| Legacy embeddings | generic `embeddings`, `vectors`, `wae_semantic_documents.embedding` store JSONB vectors | DUPLICATED / DO NOT EXPAND |
| Universal source connector contract | no uniform source abstraction existed | MISSING -> CREATED IN v1 |
| License registry | library had rights flags but no universal per-record license ledger | MISSING -> CREATED IN v1 |
| Source health registry | no unified knowledge-source health contract | MISSING -> CREATED IN v1 |
| Universal cross-source dedupe | scattered source-specific logic | MISSING -> CREATED FOUNDATION IN v1 |
| Citation object contract | source-specific citations existed | PARTIAL -> UNIFIED FOUNDATION IN v1 |
| Research integrity/retraction service | Crossref/PubMed signals exist but no complete service | MISSING / NEXT GATE |
| Entity resolution | graph exists; identifier-aware merge engine not yet certified | MISSING / NEXT GATE |
| Full hybrid BM25 + vector + graph reranker | components exist separately | PARTIAL / NEXT GATE |
| Deep research agents | executive agents exist, research-specific committee not yet certified | PARTIAL / NEXT GATE |

## v1 source certification scope

`candidate_integrated` means code exists and deterministic tests exist. A source is not promoted to production-certified until live API retrieval and production endpoint verification pass.

Candidate connectors: OpenAlex, Crossref, Wikidata, Wikipedia, PubMed, arXiv, Open Library, Zenodo.

Explicitly not certified in v1: CORE (auth required), DOAJ (endpoint/usage gate pending), SciELO (API/license gate pending), Project Gutenberg (bulk/mirror/jurisdiction policy gate pending).

## Storage decision

No new document store, vector database, graph database, or search engine is introduced. Fabric v1 adds only control-plane tables for source definitions, license decisions, retrieval provenance, and source-health observations. Existing pgvector/tsvector/graph tables remain the data plane.
