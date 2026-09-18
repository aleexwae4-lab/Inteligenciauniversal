# Universal Web Intelligence Layer v2

Status: IMPLEMENTED on branch `universal-web-intelligence-v2` pending production gate.

## Architecture

USER QUERY
-> domain + freshness classification
-> parallel general + specialist discovery
-> optional scientific Knowledge Fabric federation
-> source registry enrichment
-> deduplication
-> authority ranking
-> direct retrieval of top independent hosts
-> robots/SSRF/redirect/size security
-> HTML / JSON-LD / JSON / XML / RSS / Atom / PDF extraction
-> contradiction analysis
-> page/section-aware citations
-> governed evidence promotion
-> Universal Core Tool Fabric

## Direct retrieval

`POST /api/web/retrieve` accepts a public HTTPS URL and retrieves it using the same security boundary used by research.

Controls:
- HTTPS only.
- DNS resolution rejects private/reserved targets.
- Every redirect is revalidated.
- Response bodies are bounded.
- Robots.txt is checked before the target page.
- Explicit Disallow blocks retrieval.
- Only one page per host is directly enriched in a single research pass.
- Retrieved page text is untrusted evidence, never instructions.

Supported content:
- HTML
- JSON and JSON-LD
- XML
- RSS / Atom
- plain text
- PDF

## PDF Intelligence

PDF v2 extracts text, metadata and page-level text using `pdf-parse`. Query-relevant pages are ranked and citations can contain a page number. Table extraction is opt-in because it costs more CPU. Image-only/scanned PDFs are detected as `ocrRequired=true`; OCR itself is not claimed as implemented.

## Structured Data

HTML extraction identifies canonical URL, language, author, publication/update dates, headings, links, bounded tables and Schema.org/JSON-LD. RSS/Atom entries and JSON/XML payloads are normalized before they enter evidence ranking.

## Specialist discovery

The planner currently has source packs for:
- Law
- Medicine
- Science
- Software
- Cybersecurity
- Finance
- Business

Specialist queries supplement the original query; they do not replace it. Science and medicine also federate the existing Universal Knowledge Fabric so PubMed/OpenAlex/Crossref/arXiv/etc. remain first-class evidence sources.

## Persistence

High-trust extracted evidence can be promoted through `wae_web_ingest_document_v2` into the existing:
- `wae_global_domains_v1`
- `wae_global_documents_v1`
- `wae_global_document_evidence_v1`

The RPC is SECURITY DEFINER but executable only by `service_role`. The runtime refuses persistence unless:
- `WAE_WEB_PERSIST_EVIDENCE=1`
- service-role transport is configured
- source trust >= 80
- source is primary/official/government/academic
- source is not community/social
- URL is HTTPS
- extracted content is non-trivial
- SHA-256 provenance is valid

Full HTML and raw credentials are prohibited by both the runtime and database constraints.

## APIs

- `GET /api/web/health`
- `GET /api/web/metrics`
- `GET /api/web/sources`
- `POST /api/web/search`
- `POST /api/web/research`
- `POST /api/web/retrieve`

## Configuration

- `WAE_WEB_DIRECT_RETRIEVAL=1`
- `WAE_WEB_DIRECT_LIMIT=4`
- `WAE_WEB_DIRECT_TIMEOUT_MS=6500`
- `WAE_WEB_PERSIST_EVIDENCE=0|1`

Discovery providers remain credential-driven. The system does not invent Brave/Tavily/Google credentials.

## Explicit limitations

Not claimed as complete:
- OCR for scanned/image-only PDFs (detection exists).
- Browser rendering of JavaScript-only pages.
- Authentication/paywall bypass.
- Generic copying/republishing of copyrighted content.
- Full Terms-of-Service machine interpretation.
- Cross-request distributed crawl-delay scheduler.
- Universal legal vigency resolution for every jurisdiction.
- Perfect contradiction detection; current engine surfaces lexical/numeric/polarity conflicts and requires synthesis logic to resolve them.

These are follow-up capabilities, not silently simulated features.
