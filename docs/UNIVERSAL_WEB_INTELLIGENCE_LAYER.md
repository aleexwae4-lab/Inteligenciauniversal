# Universal Web Intelligence Layer v1

Status: IMPLEMENTED on branch `universal-web-intelligence-v1`.

## Runtime pipeline

USER QUERY -> domain/freshness classification -> research plan -> parallel provider discovery -> source registry enrichment -> deduplication -> authority/freshness ranking -> contradiction detection -> citations/provenance -> evidence returned to Universal Core.

The existing `web_search` Tool Fabric contract is preserved. Internally it now routes through Universal Web Intelligence instead of a single Tavily request.

## Implemented components

- `UniversalSourceRegistry`: extensible runtime registry with 60+ initial authority profiles and lifecycle metadata.
- `DynamicSourceDiscovery`: unknown domains become ephemeral candidates; they are not promoted to permanent truth automatically.
- `SourceAuthorityEngine`: explainable trust score using registry trust, primary/official/government/academic signals, freshness, corroboration and community penalties.
- `FreshnessEngine`: STATIC / LOW / MEDIUM / HIGH / REAL_TIME requirements and TTL-aware scoring.
- `EvidenceContradictionEngine`: surfaces high-overlap numeric/date and polarity conflicts.
- `Citation Engine`: URL, title, author/publication, dates, excerpt, DOI/jurisdiction when known, retrieval timestamp and SHA-256 evidence hash.
- `WebResearchPlanner`: domain specialist plan for science/medicine, law, software/cybersecurity, finance/business, recency and cross-checking.
- Multi-provider discovery: Tavily, Brave Search API, Google Custom Search legacy (only when already eligible/configured), DuckDuckGo Instant Answer fallback.
- Prompt-injection sanitization and SSRF/public-URL controls for future direct retrieval connectors.
- In-memory adaptive cache and observability metrics.
- Existing Knowledge Fabric and RAG are preserved; this layer does not replace pgvector/HNSW/FTS or existing scientific connectors.

## API

- `GET /api/web/health`
- `GET /api/web/metrics`
- `GET /api/web/sources?category=law`
- `POST /api/web/search`
- `POST /api/web/research`

Example request:

```json
{"query":"jurisprudencia vigente sobre prueba digital en México","limit":12}
```

## Provider lifecycle

- Bing Search APIs legacy: registered as retired as of 2025-08-11, not advertised as an active connector.
- Google Custom Search JSON API: registered as legacy/sunset; it is only used when existing credentials are configured.
- No HTML scraper is used as an implicit substitute for a retired or restricted provider.

## Security policy

Retrieved text is data, never system instruction. The layer sanitizes common prompt-injection directives. Direct future URL retrieval must pass public URL, DNS and private-address checks. Provider calls use fixed API endpoints.

## Current measured runtime metrics

`/api/web/metrics` reports requests, cache hit rate, average research latency, provider success rate, duplicate ratio, citation coverage, contradictions, source diversity and freshness buckets. Hallucination rate and factual accuracy are explicitly marked as eval-derived rather than fabricated runtime measurements.

## Not yet claimed as implemented

The following remain separate follow-up work and must not be presented as complete: arbitrary-page HTML extraction with robots/TOS enforcement, PDF table/OCR/page citation pipeline, RSS/Atom ingestion, JSON-LD/RDF/SPARQL/OpenAPI auto-extraction, persistent knowledge-graph writes from web evidence, specialized live connectors for every registry entry, full legal vigency resolver for all jurisdictions, retraction aggregation across all scholarly sources, browser rendering for JS-only pages, and persistent distributed cache/telemetry.

## Validation

`tests/web-intelligence-v1.test.js` covers registry extensibility, authority ranking, freshness, security, deduplication, citation hashes, contradiction surfacing, specialist planning, provider normalization, end-to-end research ranking, dynamic discovery and observability.
