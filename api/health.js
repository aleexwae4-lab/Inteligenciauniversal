import { runtimeHealth } from '../lib/runtime.js';
import { runtimeOperations } from '../lib/runtime-observability-v128.js';
import { applyHeaders } from '../lib/security.js';

// Liveness answers whether the Node process can serve requests, regardless of
// AI credentials and temporary upstream capacity. Never run billable inference
// from a health endpoint.
export default function handler(req,res){
  applyHeaders(res);
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).json({error:'method_not_allowed'});
  const path=new URL(req.url||'/api/health','http://localhost').pathname;
  if(path==='/api/health/liveness'){
    const status={ok:true,service:'wae-universal-runtime',component:'node-http',uptimeSeconds:Math.floor(process.uptime()),checkedAt:new Date().toISOString()};
    if(req.method==='HEAD')return res.status(200).end();
    return res.status(200).json(status);
  }
  const health=runtimeHealth();
  const operations=runtimeOperations();
  const readiness=!health.ready
    ? 'no_providers_configured'
    : operations.providerInferenceVerified
      ? (operations.inferenceFresh?'providers_verified_recently':'providers_configured_last_verified_stale')
      : 'providers_configured_not_tested';
  const status={
    ...health,
    providerInferenceVerified:operations.providerInferenceVerified,
    readiness,
    operations,
    checkedAt:new Date().toISOString()
  };
  const code=health.ready?200:503;
  if(req.method==='HEAD')return res.status(code).end();
  return res.status(code).json(status);
}
