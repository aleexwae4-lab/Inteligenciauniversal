import { runtimeHealth } from '../lib/runtime.js';
import { applyHeaders } from '../lib/security.js';
import { operationalProviderSnapshot, PROVIDER_HEALTH_VERSION } from '../lib/provider-health-v81.js';

export const HEALTH_READINESS_POLICY_V90='service-readiness-separated-from-generative-health/v90';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const base=runtimeHealth();
  const operational=await operationalProviderSnapshot().catch(()=>null);
  const serviceReady=base.ready===true;
  const generativeEligible=operational?operational.generativeEligibleNow:base.generativeReady===true;
  const health={
    ...base,
    ready:serviceReady,
    serviceReady,
    readinessPolicy:HEALTH_READINESS_POLICY_V90,
    configuredGenerativeReady:base.generativeReady===true,
    generativeReady:generativeEligible,
    generativeDegraded:generativeEligible!==true,
    generativeHealthyNow:operational?.generativeHealthyNow??null,
    providerHealth:operational?{
      version:PROVIDER_HEALTH_VERSION,
      persistentAvailable:operational.persistentAvailable,
      configuredProviderCount:operational.configuredProviderCount,
      healthyProviderCount:operational.healthyProviderCount,
      eligibleProviderCount:operational.eligibleProviderCount,
      preferredProvider:operational.preferredProvider,
      providers:operational.providers
    }:null
  };
  res.setHeader('X-WAE-Provider-Health',PROVIDER_HEALTH_VERSION);
  res.setHeader('X-WAE-Readiness-Policy',HEALTH_READINESS_POLICY_V90);
  return res.status(serviceReady?200:503).json(health);
}
