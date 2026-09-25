export const RELEASE_HEALTH_VERSION='v144';

function mb(bytes){
  return Math.round((Number(bytes||0)/1024/1024)*10)/10;
}

function safeRelease(){
  return {
    version:RELEASE_HEALTH_VERSION,
    commit:String(process.env.RENDER_GIT_COMMIT||'').slice(0,40)||null,
    deployment:String(process.env.RENDER_DEPLOY_ID||'').slice(0,120)||null,
    environment:String(process.env.NODE_ENV||'production').slice(0,32)
  };
}

export function releaseHealthSnapshot({health={},operations={}}={}){
  const memory=process.memoryUsage();
  const configuredProviders=Array.isArray(health.providers)
    ? health.providers.filter(provider=>provider?.configured).map(provider=>provider.id)
    : [];
  const providerReady=configuredProviders.length>0;
  const inferenceVerified=operations?.providerInferenceVerified===true;
  const readiness=providerReady
    ? (inferenceVerified?'ready_verified_recently':'ready_upstream_not_probed')
    : 'degraded_no_provider_configured';
  return {
    ok:providerReady,
    status:providerReady?'ready':'degraded',
    readiness,
    release:safeRelease(),
    process:{
      node:process.version,
      uptimeSeconds:Math.floor(process.uptime()),
      rssMb:mb(memory.rss),
      heapUsedMb:mb(memory.heapUsed),
      heapTotalMb:mb(memory.heapTotal)
    },
    checks:{
      nodeHttp:'pass',
      providersConfigured:configuredProviders.length,
      configuredProviderIds:configuredProviders,
      providerInference:inferenceVerified?'verified':'not_run',
      paidInferenceTriggered:false
    },
    checkedAt:new Date().toISOString()
  };
}
