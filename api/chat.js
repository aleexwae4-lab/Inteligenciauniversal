import { executeMission } from '../lib/runtime.js';
import { randomUUID } from 'node:crypto';
import { allowRequest, originAllowed, applyHeaders } from '../lib/security.js';
import { recordChatSuccess, recordChatFailure } from '../lib/runtime-observability-v128.js';

async function tryUniversalCoreContext(body={}) {
  const base=String(process.env.SUPABASE_URL||'').trim().replace(/\/$/,'');
  const key=String(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||'').trim();
  const input=String(body?.message||body?.task||body?.prompt||'').trim();
  if(!base||!key||!input)return null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),Number(process.env.WAE_UNIVERSAL_CORE_CONTEXT_TIMEOUT_MS||6500));
  try{
    const response=await fetch(base+'/functions/v1/universal-core-context',{
      method:'POST',
      headers:{'content-type':'application/json','apikey':key},
      signal:controller.signal,
      body:JSON.stringify({
        query:input,
        user_key:String(body?.sessionId||body?.userKey||'').slice(0,160),
        mode:String(body?.mode||'general').slice(0,40),
        match_count:Number(body?.knowledge_match_count||8),
        similarity_threshold:Number(body?.knowledge_similarity_threshold||0.45)
      })
    });
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok||!String(payload?.context_text||'').trim())return null;
    return payload;
  }catch(error){
    console.warn('[Universal Core Context]',String(error?.message||error));
    return null;
  }finally{clearTimeout(timer);}
}

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
    let runtimeBody = body;
    const universalCoreContext = await tryUniversalCoreContext(body);
    if (universalCoreContext?.context_text) {
      runtimeBody = {
        ...body,
        message: `Consulta del usuario:\n${String(body.message||body.task||body.prompt||'').trim()}\n\nContexto del Universal Core AI:\n${universalCoreContext.context_text}\n\nUsa este contexto como evidencia interna pertinente. No inventes hechos que el contexto no respalda y, si falta evidencia, indícalo.`,
        universal_core_context: universalCoreContext.context_text
      };
      res.setHeader('X-WAE-Universal-Core','supabase-context-v1');
      res.setHeader('X-WAE-Universal-Core-Retrieval-Id',String(universalCoreContext.retrieval_id||''));
      res.setHeader('X-WAE-Universal-Core-Matches',String(universalCoreContext.match_count||0));
    }
    const result = await executeMission({ ...runtimeBody, userKey:typeof body.sessionId==='string' ? body.sessionId : '' });
    if(result?.response?.metadata&&typeof result.response.metadata==='object')result.response.metadata.requestId=requestId;
    result.request_id=requestId;
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