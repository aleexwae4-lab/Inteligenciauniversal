-- Intelligence Arena v2 security hardening.
-- Generated after Supabase Security Advisor detected SECURITY DEFINER view
-- and mutable search_path regressions introduced by the new benchmark layer.

ALTER VIEW public.wae_intelligence_superiority_gate_v2
  SET (security_invoker = true);

ALTER VIEW public.wae_production_promotion_gate_v2
  SET (security_invoker = true);

ALTER FUNCTION public.wae_try_parse_json_v2(text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.wae_exact_json_score_v2(jsonb, jsonb)
  SET search_path = public, pg_catalog;

REVOKE ALL ON FUNCTION public.wae_schedule_production_intelligence_v2(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wae_finalize_production_intelligence_v2(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wae_start_production_intelligence_v2()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.wae_schedule_production_intelligence_v2(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.wae_finalize_production_intelligence_v2(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.wae_start_production_intelligence_v2()
  TO service_role;

REVOKE ALL ON public.wae_intelligence_superiority_gate_v2
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.wae_production_promotion_gate_v2
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.wae_intelligence_superiority_gate_v2 TO service_role;
GRANT SELECT ON public.wae_production_promotion_gate_v2 TO service_role;
