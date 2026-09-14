-- Evidence-driven routing performance policy.
-- Baseline run 3bf044b5-36db-4029-a0fa-0fd43569c32e:
-- score 100/100, 5/5 passed, avg 32595 ms, p95 44898.4 ms.
-- Candidate run 0337899f-e03c-4956-842c-f83f614d9bc6:
-- score 100/100, 5/5 passed, avg 4966 ms, p95 7564 ms.
-- Promotion gate: PASS_PROMOTE.
-- Improvement: -84.76% avg latency, -83.15% p95, 6.56x avg speedup.

UPDATE public.wae_ai_models
SET priority = 1
WHERE organization_id IS NULL
  AND provider = 'google_gemma'
  AND model_name = 'gemma-4-26b-a4b-it'
  AND enabled = true;

UPDATE public.wae_ai_models
SET priority = 2
WHERE organization_id IS NULL
  AND provider = 'wae_unified'
  AND model_name = 'wae-unified-v1'
  AND enabled = true;

-- These exact free routes were removed from production after repeated permanent
-- HTTP 404 responses. Keep them disabled until a separately evaluated model
-- slug is registered and passes the promotion gate.
UPDATE public.wae_ai_models
SET enabled = false,
    health_status = 'offline',
    circuit_open_until = greatest(coalesce(circuit_open_until, now()), now() + interval '30 days')
WHERE organization_id IS NULL
  AND (
    (provider = 'openrouter' AND model_name = 'openai/gpt-oss-20b:free')
    OR
    (provider = 'groq' AND model_name = 'llama-3.3-70b-versatile')
  );
