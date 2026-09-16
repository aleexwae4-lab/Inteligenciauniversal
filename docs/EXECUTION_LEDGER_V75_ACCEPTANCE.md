# Execution Ledger v75 — Acceptance Matrix

| Gate | Required result |
| --- | --- |
| Syntax | `lib/execution-ledger-v75.js` and dependent APIs parse under Node 20+ |
| Unit | Direct service-role path persists |
| Unit | Publishable + private bridge token path persists via RPC |
| Unit | Invalid/unconfigured transport never reports a false persistence success |
| API | Unsupported execution remains HTTP 422 / blocked |
| Database | Receipt table RLS remains enabled |
| Database | Invalid private token cannot insert through v75 RPC |
| Production | Render deploy is live on exact merged SHA |
| Certification | Unsupported execution returns `audit.persisted === true` |
| Regression | Existing v73/v74 health, identity, tenant and Tool Fabric contracts remain green |
