# WAEWEB public bridge v126 — premium, free-first

## Verified architecture

WAEWEB's Render service `waeweb` deploys `aleexwae4-lab/Waeweb` on `https://waeweb.onrender.com`. WAEWEB intentionally exposes `GET /api/search?q=...&type=all&collection=web&fresh=1` to anonymous users, including preview mode. This endpoint is **public search, not Connect/v1**.

Universal Core's Render backend, never its browser JavaScript, can now consume that public search directly only when `WAEWEB_PUBLIC_SEARCH_ENABLED=true` on the Universal Core Render service. The URL is a fixed first-party origin, not a user-supplied host. Responses are capped at 256 KiB, have an approximately 6.5s budget, reject redirects, invalid JSON, unavailable providers and unsafe result URLs, and retain attributed title, excerpt, source and publication/retrieval date. No cookies, conversation history, system prompts, attachments, Vault data or machine token are forwarded to WAEWEB.

WAEWEB public response `webCoverage` and `sources[]` are used to label coverage. Wikipedia-only, limited and partially unavailable sources are **not** generalized as fully indexed web knowledge. Zero hits from responding sources are not a backend outage. The old Tavily/public-research route remains available when WAEWEB is slow, down, partial, empty or off-topic. The private Connect/v1 adapter retains precedence when separately configured and live.

The existing private API `/api/connect/v1/*` stays **disabled** until its PostgreSQL admission, per-product secrets and release gate are approved. Public GET was deliberately already allowed in WAEWEB's preview; it is not an auth or quota bypass to privileged APIs. No Vercel files, WAEWEB production flags or PostgreSQL schemas were modified.

## Activation and validation

Set `WAEWEB_PUBLIC_SEARCH_ENABLED=true` **only on the Render Universal Core service**. Do not set `WAEWEB_CONNECT_ENABLED`, invent token values or embed any server credential in the browser. `GET /api/research` reports `waewebPublic.configured=true` and `liveVerified=false`: configured does not mean a verified successful upstream HTTP search. `scripts/waeweb-public-live-canary.mjs` makes a real public search during the release build and emits one of `PASS_PUBLIC_SEARCH`, `WARN_ZERO_RESULTS`, `WARN_NOT_VERIFIED` or `SKIP`. It never fails deployment just because a free source is sleeping or offline.

Inspect the **actual** WAEWEB result provider and source URL on Render's API/normal chat, including freshness, breadth, first-turn behaviour and no-source fallback; only then describe the connection as end-to-end operational. WAEWEB results are indexed source excerpts, not the fetched full article or independently verified truth.

Unsetting `WAEWEB_PUBLIC_SEARCH_ENABLED` is a reversible rollback without affecting existing provider credentials, chat, Canvas, Factory, Workspace or the private Connect/v1 implementation. No recurring ping, new paid service, production DB or external login is required.
