import { runtimeHealth } from '../lib/runtime.js';
import { runtimeOperations } from '../lib/runtime-observability-v128.js';
import { releaseHealthSnapshot } from '../lib/release-health-v144.js';
import { applyHeaders } from '../lib/security.js';

// Health endpoints are deliberately non-billable: they only inspect local
// runtime/configuration state and never call an inference provider.
export default function handler(req,res){
  applyHeaders(res);
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).json({error:'method_not_allowed'});
  const path=new URL(req.url||'/api/health','http://localhost').pathname;

  if(path==='/api/health/liveness'){
    const snapshot=releaseHealthSnapshot({health:{providers:[]},operations:{}});
    const status={
      ok:true,
      service:'wae-universal-runtime',
      component:'node-http',
      release:snapshot.release,
      process:snapshot.process,
      checkedAt:snapshot.checkedAt
    };
    if(req.method==='HEAD')return res.status(200).end();
    return res.status(200).json(status);
  }

  const health=runtimeHealth();
  const operations=runtimeOperations();
  const diagnostic=releaseHealthSnapshot({health,operations});
  const status={
    ...health,
    ok:diagnostic.ok,
    component:'runtime-readiness',
    status:diagnostic.status,
    readiness:diagnostic.readiness,
    release:diagnostic.release,
    process:diagnostic.process,
    checks:diagnostic.checks,
    providerInferenceVerified:operations.providerInferenceVerified===true,
    operations,
    checkedAt:diagnostic.checkedAt
  };
  const code=diagnostic.ok?200:503;
  if(req.method==='HEAD')return res.status(code).end();
  return res.status(code).json(status);
}
