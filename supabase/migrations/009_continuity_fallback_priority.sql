-- Universal Core continuity must remain a last-resort safety lane that is
-- actually reachable by the runtime's bounded execution window.
-- Premium generative lanes keep priority 1/2; continuity is moved ahead of
-- heavily degraded providers, not ahead of the primary healthy model.

update public.wae_ai_models
set priority = 5
where provider = 'universal_core'
  and model_name = 'universal-core-continuity-v1'
  and organization_id is null;
