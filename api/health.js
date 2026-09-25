import { runtimeHealth } from '../lib/runtime.js';
import { runtimeOperations } from '../lib/runtime-observability-v128.js';
import { releaseHealthSnapshot } from '../lib/release-health-v144.js';
import { lifecycleSnapshot } from '../lib/runtime-lifecycle-v145.js';
import { applyHeaders } from '../lib/security.js';

// Health endpoints are deliberately non-billable: they only inspect local
// runtime/configuration state and never call an inference provider.
export default function handler(req,res){
  applyHeaders(res);
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).json({error:'method_not_allowed'});
  const path=new URL(req.url||'/api/health','http://localhost').pathname;
  const lifecycle=lifecycleSnapshot();

  if(path==='/api/health/liveness'){
    const snapshot=releaseHealthSnapshot({health:{providers:[]},operations:{}});
    const status={
      ok:true,
      service:'wae-universal-runtime',
      component:'node-http',
      release:snapshot.release,
      process:snapshot.process,
      lifecycle,
      checkedAt:snapshot.checkedAt
    };
    if(req.method==='HEAD')return res.status(200).end();
    return res.status(200).json(status);
  }

  const health=runtimeHealth();
  const operations=runtimeOperations();
  const diagnostic=releaseHealthSnapshot({health,operations});
  const runtimeReady=diagnostic.ok&&lifecycle.acceptingTraffic;

  if(path==='/api/health/canary'){
    const status={
      ok:runtimeReady,
      service:'wae-universal-runtime',
      component:'release-canary',
      release:diagnostic.release,
      lifecycle,
      checks:{
        startupSafety:lifecycle.startupChecks?.ok===true?'pass':'pending',
        runtimeAcceptingTraffic:lifecycle.acceptingTraffic,
        providersConfigured:diagnostic.checks.providersConfigured,
        paidInferenceTriggered:false
      },
      checkedAt:diagnostic.checkedAt
    };
    const code=runtimeReady?200:503;
    if(req.method==='HEAD')return res.status(code).end();
    return res.status(code).json(status);
  }

  const status={
    ...health,
    ready:runtimeReady,
    ok:runtimeReady,
    component:'runtime-readiness',
    status:lifecycle.phase==='draining'?'draining':lifecycle.phase==='booting'?'booting':diagnostic.status,
    readiness:diagnostic.readiness,
    release:diagnostic.release,
    process:diagnostic.process,
    lifecycle,
    checks:diagnostic.checks,
    providerInferenceVerified:operations.providerInferenceVerified===true,
    operations,
    checkedAt:diagnostic.checkedAt
  };
  const code=runtimeReady?200:503;
  if(req.method==='HEAD')return res.status(code).end();
  return res.status(code).json(status);
}
