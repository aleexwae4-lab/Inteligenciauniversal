# Universal Core Backend v73

Universal Core Backend v73 is the canonical HTTP/backend perimeter for WAE Inteligencia Universal.

## Objectives

- Preserve compatibility with the existing v58-v72 intelligence runtime.
- Introduce a stable `/api/v73/*` namespace for new clients.
- Centralize request IDs, JSON limits, CORS, security headers, rate limiting and safe errors.
- Expose independent liveness/readiness probes.
- Provide bounded operational telemetry without storing prompts, answers, secrets or client IPs.
- Reuse the existing provider mesh, capability kernel, execution plane, orchestration, Tool Fabric, tasks and evaluation plane instead of duplicating them.

## Canonical routes

| Route | Purpose | Access |
| --- | --- | --- |
| `GET /api/v73/health/live` | Process liveness | public |
| `GET /api/v73/health/ready` | Runtime readiness | public |
| `GET /api/v73/status` | Sanitized backend/runtime status | public |
| `POST /api/v73/chat` | Universal Core chat | public + existing chat controls |
| `GET /api/v73/capabilities` | Capability registry | public |
| `POST /api/v73/execute` | Execution plane | public + downstream policy |
| `POST /api/v73/orchestrate` | Multi-agent orchestration | public + downstream policy |
| `GET/POST /api/v73/tasks` | Task plane | public + downstream policy |
| `GET/POST /api/v73/tools` | Tool Fabric | public + downstream policy |
| `GET/POST /api/v73/evals` | Evaluation plane | public + endpoint-specific worker gates |
| `GET /api/v73/admin/metrics` | Bounded HTTP metrics | admin bearer/key |
| `GET /api/v73/admin/config` | Sanitized configuration | admin bearer/key |

## Security model

The gateway never returns configured API keys. Admin endpoints fail closed unless `WAE_ADMIN_API_KEY` is configured and supplied through `Authorization: Bearer ...` or `X-WAE-Admin-Key`.

When `WAE_ALLOWED_ORIGINS` is configured, cross-origin requests must match the allowlist. Same-origin/server-to-server requests without an `Origin` header continue to work.

The telemetry layer stores only route/method/status counters and bounded latency samples. It does not persist prompts, generated answers, tokens, API keys or IP addresses.

## Environment

Optional v73 controls:

```text
WAE_V73_MAX_BODY_BYTES=2000000
WAE_V73_REQUEST_TIMEOUT_MS=45000
WAE_V73_RATE_LIMIT_PER_MINUTE=120
WAE_V73_METRICS_WINDOW=512
WAE_V73_EXPOSE_DIAGNOSTICS=0
WAE_ADMIN_API_KEY=
WAE_TRUST_PROXY=1
```

Existing provider, Supabase, knowledge, distributed admission and Tool Fabric variables remain authoritative.

## Deployment strategy

v73 is additive. Legacy endpoints remain available while clients migrate to `/api/v73/*`. Do not remove the v58-v72 compatibility aliases until production traffic and evals confirm that all active clients have migrated.
