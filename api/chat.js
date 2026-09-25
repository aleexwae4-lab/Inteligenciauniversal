import { executeMission } from '../lib/runtime.js';
import { randomUUID } from 'node:crypto';
import { allowRequest, originAllowed, applyHeaders } from '../lib/security.js';
import { recordChatSuccess, recordChatFailure } from '../lib/runtime-observability-v128.js';

export default async function handler(req,res) {
  applyHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
  if (!originAllowed(req)) return res.status(403).json({error:'origin_not_allowed'});
  if (!allowRequest(req)) return res.status(429).json({error:'rate_limited'});
  const started=Date.now(), requestId=randomUUID();
  res.setHeader('X-WAE-Request-ID',requestId);
  res.setHeader('Cache-Control','no-store');
  try {
    const body = req.body || {};
    // Never use a shared public IP or a caller-selected cross-user key as a memory identity.
    const result = await executeMission({ ...body, userKey:typeof body.sessionId==='string' ? body.sessionId : '' });
    const latencyMs=Date.now()-started;
    recordChatSuccess(result,latencyMs);
    res.setHeader('Server-Timing',`wae;dur=${latencyMs}`);
    console.info('[WAE Chat]',JSON.stringify({requestId,outcome:'ok',provider:String(result.provider||'unknown').slice(0,55),grounded:!!result.grounded,latencyMs,fallbackCount:result.fallbackFailures?.length||0,e2eStatus:result.e2e?.status||null,recoveryCount:result.e2e?.recoveryCount||0}));
    return res.status(200).json(result);
  } catch (error) {
    const latencyMs=Date.now()-started;
    const status = error.statusCode || (error.code === 'NO_PROVIDER' ? 503 : 502);
    // Request ID is diagnostic; no prompt, conversation, session, credentials or upstream raw errors enter logs.
    const code=String(error.code||'runtime_error').slice(0,80);
    recordChatFailure(code,latencyMs);
    res.setHeader('Server-Timing',`wae;dur=${latencyMs}`);
    console.warn('[WAE Chat]',JSON.stringify({requestId,outcome:'error',code,latencyMs,e2eStatus:error.e2e?.status||null,failedStageCount:error.e2e?.failedStageCount||0,attempts:error.failures?.map(x=>({provider:x.provider,error:String(x.error||'failed').slice(0,60)}))||[]}));
    return res.status(status).json({error:code,requestId,...(error.e2e?{e2e:error.e2e}:{})});
  }
}