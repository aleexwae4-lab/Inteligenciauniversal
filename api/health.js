import { runtimeHealth } from '../lib/runtime.js';
import { generateWithFallback, providerRegistry } from '../lib/providers.js';
import { runtimeOperations } from '../lib/runtime-observability-v128.js';
import { releaseHealthSnapshot } from '../lib/release-health-v144.js';
import { lifecycleSnapshot } from '../lib/runtime-lifecycle-v145.js';
import { applyHeaders } from '../lib/security.js';

export default async function handler(req,res){
  applyHeaders(res);
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).json({error:'method_not_allowed'});
  const requestUrl=new URL(req.url||'/api/health','http://localhost');
  const path=requestUrl.pathname;
  const lifecycle=lifecycleSnapshot();

  if(path==='/api/health/liveness'){
    const snapshot=releaseHealthSnapshot({health:{providers:[]},operations:{}});
    const status={ok:true,service:'wae-universal-runtime',component:'node-http',release:snapshot.release,process:snapshot.process,lifecycle,checkedAt:snapshot.checkedAt};
    if(req.method==='HEAD')return res.status(200).end();
    return res.status(200).json(status);
  }

  if(path==='/api/health/generative'){
    const configured=providerRegistry().filter(p=>p.configured).map(p=>({id:p.id,model:p.model,streaming:!!p.streaming,providerFamily:p.providerFamily||null}));
    const probe=requestUrl.searchParams.get('probe')==='1';
    if(!probe){
      const status={ok:configured.length>0,service:'wae-universal-runtime',component:'generative-router',
        GENERATIONAL_STATUS:configured.length>0?'configured':'no_provider_configured',provider_selected:null,
        provider_reachable:null,model_selected:null,request_sent:false,response_received:false,
        fallback_reason:configured.length?'probe_not_requested':'no_provider_configured',latency:0,
        configured_providers:configured,probe_required:true};
      if(req.method==='HEAD')return res.status(status.ok?200:503).end();
      return res.status(status.ok?200:503).json(status);
    }
    const started=Date.now();let requestSent=false;let responseReceived=false;
    try{
      requestSent=true;
      const generated=await generateWithFallback({
        provider:'auto',
        system:'Eres un canario de salud de Universal Core. Responde únicamente con OK.',
        message:'Responde únicamente: OK',
        history:[],mode:'general',webEnabled:false,budgetMs:12000,attemptTimeoutMs:4000
      });
      responseReceived=Boolean(String(generated?.text||'').trim());
      const latency=Date.now()-started;
      const status={ok:responseReceived,service:'wae-universal-runtime',component:'generative-router',
        GENERATIONAL_STATUS:responseReceived?'operational':'empty_response',
        provider_selected:generated.provider||null,provider_reachable:responseReceived,
        model_selected:generated.model||null,request_sent:requestSent,response_received:responseReceived,
        fallback_reason:generated.failures?.length?generated.failures.map(x=>({provider:x.provider,model:x.model,error:x.error})):null,
        latency,degraded:false};
      if(req.method==='HEAD')return res.status(status.ok?200:503).end();
      return res.status(status.ok?200:503).json(status);
    }catch(error){
      const latency=Date.now()-started;
      const failures=Array.isArray(error?.failures)?error.failures:[];
      const status={ok:false,service:'wae-universal-runtime',component:'generative-router',
        GENERATIONAL_STATUS:'all_providers_failed',provider_selected:null,provider_reachable:false,
        model_selected:null,request_sent:requestSent,response_received:responseReceived,
        fallback_reason:failures.length?failures.map(x=>({provider:x.provider,model:x.model,error:x.error})):String(error?.code||'generation_failed'),latency};
      if(req.method==='HEAD')return res.status(503).end();
      return res.status(503).json(status);
    }
  }

  const health=runtimeHealth();
  const operations=runtimeOperations();
  const diagnostic=releaseHealthSnapshot({health,operations});
  const runtimeReady=diagnostic.ok&&lifecycle.acceptingTraffic;

  if(path==='/api/health/canary'){
    const status={ok:runtimeReady,service:'wae-universal-runtime',component:'release-canary',release:diagnostic.release,lifecycle,
      checks:{startupSafety:lifecycle.startupChecks?.ok===true?'pass':'pending',runtimeAcceptingTraffic:lifecycle.acceptingTraffic,
        providersConfigured:diagnostic.checks.providersConfigured,paidInferenceTriggered:false},checkedAt:diagnostic.checkedAt};
    const code=runtimeReady?200:503;
    if(req.method==='HEAD')return res.status(code).end();
    return res.status(code).json(status);
  }

  const status={...health,ready:runtimeReady,ok:runtimeReady,component:'runtime-readiness',
    status:lifecycle.phase==='draining'?'draining':lifecycle.phase==='booting'?'booting':diagnostic.status,
    readiness:diagnostic.readiness,release:diagnostic.release,process:diagnostic.process,lifecycle,
    checks:diagnostic.checks,providerInferenceVerified:operations.providerInferenceVerified===true,operations,checkedAt:diagnostic.checkedAt};
  const code=runtimeReady?200:503;
  if(req.method==='HEAD')return res.status(code).end();
  return res.status(code).json(status);
}