import { runtimeHealth } from '../lib/runtime.js';
import { applyHeaders } from '../lib/security.js';

// Liveness answers whether the Node process can serve requests, regardless of
// AI credentials and temporary upstream capacity. Never run billable inference
// from a health endpoint.
export default function handler(req,res){
  applyHeaders(res);
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).json({error:'method_not_allowed'});
  const path=new URL(req.url||'/api/health','http://localhost').pathname;
  if(path==='/api/health/liveness'){
    const status={ok:true,service:'wae-universal-runtime',component:'node-http',uptimeSeconds:Math.floor(process.uptime()),checkedAt:new Date().toISOString()};
    if(req.method==='HEAD')return res.status(200).end();
    return res.status(200).json(status);
  }
  const health=runtimeHealth();
  const status={
    ...health,
    // Configured environment variables do not prove a working provider.
    providerInferenceVerified:false,
    readiness:health.ready?'providers_configured_not_tested':'no_providers_configured',
    checkedAt:new Date().toISOString()
  };
  const code=health.ready?200:503;
  if(req.method==='HEAD')return res.status(code).end();
  return res.status(code).json(status);
}
