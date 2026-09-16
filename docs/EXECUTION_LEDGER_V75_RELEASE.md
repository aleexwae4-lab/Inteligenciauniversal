# v75 Release Criteria

Universal Core v75 is eligible for merge only when the exact PR head passes the repository CI/regression gates and preserves the existing v73/v74 public contracts.

Production acceptance requires:

- Render deploy status `live` for the merged SHA.
- `/api/v73/health/live` and `/api/v73/health/ready` remain healthy.
- v74 identity and tenant binding invariants remain unchanged.
- Unsupported execution remains HTTP 422 and fail-closed.
- The same blocked execution returns `audit.persisted === true` through Execution Ledger v75.
- No new public table policy, no client-visible service-role secret, and no relaxation of mutation policy.

A deployment is not called certified until the production certification workflow passes on the merged production SHA.
