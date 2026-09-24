# Universal Core → WAEWEB Connect/v1 (Render)

## What was actually integrated

The production Render branch now has a **server-only, opt-in** WAEWEB Connect/v1 consumer, sourced from the pre-existing reviewed Universal Core feature branch and matched to the WAEWEB API contract in `aleexwae4-lab/Waeweb/docs/openapi-connect-v1.yaml`. It sends public research queries by authenticated POST to `/api/connect/v1/search`; results retain title, URL, snippet, upstream source, date, partial/complete coverage and failed-source metadata. The assistant receives **untrusted public evidence, not instructions**.

When a research request is eligible, the authenticated WAEWEB adapter is tried before Tavily. If WAEWEB reports partial coverage, returns no relevant hits or fails, existing configured search/public research paths remain available. When WAEWEB supplies complete relevant hits, redundant Tavily searching is skipped. Ordinary chat stays on the existing Supabase-first route unless the Render capabilities endpoint confirms the adapter is configured. Nothing is sent from the browser directly to WAEWEB.

This does **not** turn WAEWEB into remote Chromium: it is public web search and source metadata only. `/retrieve` and SSE are not exposed through the chat tool. A provider's extract is not independent verification.

## Production activation — not completed by a GitHub merge

WAEWEB's currently reviewed implementation is **disabled by default**. Its Vercel preview/release gate rejects Connect/private POST until the full release gate permits it, and its production admission requires initialized PostgreSQL and server-side secrets. Do not bypass this security boundary by embedding tokens in the frontend, marking readiness true without authenticated status, or routing machine calls through an anonymous endpoint.

Once WAEWEB backend has a verified HTTPS origin and its release gate is GO, complete WAEWEB's own checklist in `docs/WAEWEB_CONNECT_V1.md` (including `WAE_CONNECT_ENABLED=true`, `WAE_CONNECT_CLIENTS_JSON` with a unique random 32+ character token for `inteligenciauniversal`, and shared PostgreSQL admission).

Set **only on Universal Core's Render server**:
- `WAEWEB_CONNECT_ENABLED=true`
- `WAEWEB_CONNECT_BASE_URL=https://<verified-WAEWEB-origin>/`
- `WAEWEB_CONNECT_CLIENT_ID=inteligenciauniversal`
- `WAEWEB_CONNECT_TOKEN=<matching-unique-server-only-token>`

Never log, commit, quote or place the token in URLs or browser storage. Prefer a secret-manager environment entry. Other WAE products need distinct tokens. Restart and confirm `GET /api/research` reports `waewebConnect.configured=true`; this is **configuration**, not an authenticated/live connectivity certificate.

Verify an authenticated `GET /api/connect/v1/status` server-to-server, then an actual public query via the Render chat and `/api/research`, source relevance, source date/coverage, failure fallback, first-turn continuity and the absence of token leakage. An empty result from a responsive source is not an outage; a 503 is not a successful empty search.

## Boundaries

No Vercel project, account, paid plan, PostgreSQL production schema, or credential was created by this consumer patch. If upstream is not activated, the WAEWEB tool remains disabled and Universal Core keeps its existing providers and chat behaviour. No claim of an end-to-end LIVE connection is made until verified against both deployed backends.
