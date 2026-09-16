import { runtimeHealth } from '../lib/runtime.js';
import { applyHeaders } from '../lib/security.js';
import { operationalProviderSnapshot, PROVIDER_HEALTH_VERSION } from '../lib/provider-health-v81.js';

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const base=runtimeHealth();
  const operational=await operationalProviderSnapshot().catch(()=>null);
  const generativeEligible=operational?operational.generativeEligibleNow:base.generativeReady===true;
  const health={
    ...base,
    ready:base.ready===true&&generativeEligible,
    configuredGenerativeReady:base.generativeReady===true,
    generativeReady:generativeEligible,
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
  return res.status(health.ready?200:503).json(health);
}
