import { executeMission } from '../lib/runtime.js';
import { randomUUID } from 'node:crypto';
import { allowRequest, originAllowed, applyHeaders } from '../lib/security.js';
import { recordChatSuccess, recordChatFailure } from '../lib/runtime-observability-v128.js';
import { progressiveContract } from '../lib/progressive-intelligence-v133.js';

function sse(res,event,payload){
  if(res.writableEnded)return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

export default async function handler(req,res){
  applyHeaders(res);
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!originAllowed(req))return res.status(403).json({error:'origin_not_allowed'});
  if(!allowRequest(req))return res.status(429).json({error:'rate_limited'});

  const started=Date.now(),requestId=randomUUID();
  res.statusCode=200;
  res.setHeader('Content-Type','text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-transform');
  res.setHeader('Connection','keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.setHeader('X-WAE-Request-ID',requestId);
  res.flushHeaders?.();

  const contract=progressiveContract();
  sse(res,'ready',{requestId,...contract});

  try{
    const body=req.body||{};
    const result=await executeMission(
      {...body,userKey:typeof body.sessionId==='string'?body.sessionId:''},
      {onProgress:event=>sse(res,'progress',event)}
    );
    if(result?.response?.metadata&&typeof result.response.metadata==='object')result.response.metadata.requestId=requestId;
    result.request_id=requestId;
    result.progressive=contract;
    const latencyMs=Date.now()-started;
    recordChatSuccess(result,latencyMs);
    console.info('[WAE Chat Stream]',JSON.stringify({
      requestId,outcome:'ok',provider:String(result.provider||'unknown').slice(0,55),
      grounded:!!result.grounded,latencyMs,fallbackCount:result.fallbackFailures?.length||0,
      e2eStatus:result.e2e?.status||null,recoveryCount:result.e2e?.recoveryCount||0
    }));
    sse(res,'result',result);
    sse(res,'done',{requestId,latencyMs});
    return res.end();
  }catch(error){
    const latencyMs=Date.now()-started;
    const code=String(error.code||'runtime_error').slice(0,80);
    recordChatFailure(code,latencyMs);
    console.warn('[WAE Chat Stream]',JSON.stringify({
      requestId,outcome:'error',code,latencyMs,e2eStatus:error.e2e?.status||null,
      failedStageCount:error.e2e?.failedStageCount||0,
      attempts:error.failures?.map(x=>({provider:x.provider,error:String(x.error||'failed').slice(0,60)}))||[]
    }));
    sse(res,'error',{error:code,requestId,...(error.e2e?{e2e:error.e2e}:{})});
    return res.end();
  }
}
