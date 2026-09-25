import { streamOpenAI, streamAnthropic, streamGemini, streamOpenAICompatible, VERIFIED_STREAMING_PROVIDERS } from './provider-streaming-v134.js';
import { providerCircuitOpen, providerCircuitSuccess, providerCircuitFailure, providerCircuitSnapshot } from './provider-breaker-v134.js';

const timeout = (ms = 60000) => AbortSignal.timeout(ms);

function textFromOpenAI(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const out = [];
  for (const item of data?.output || []) {
    for (const part of item?.content || []) if (part?.type === 'output_text' && part?.text) out.push(part.text);
  }
  return out.join('\n').trim();
}

function cleanHistory(history = [], limit = 12) {
  return history.slice(-limit).filter(x => x && ['user','assistant'].includes(x.role) && typeof (x.text ?? x.content) === 'string')
    .map(x => ({ role:x.role, content:String(x.text ?? x.content).slice(0,12000) }));
}

async function jsonFetch(url, options, ms = 60000) {
  const {signal:parentSignal,...rest}=options||{};
  const signal=parentSignal?AbortSignal.any([parentSignal,timeout(ms)]):timeout(ms);
  const res = await fetch(url, { ...rest, signal });
  const raw = await res.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!res.ok) {
    const detail = data?.error?.message || data?.detail || data?.error || data?.message || data?.raw || `HTTP ${res.status}`;
    const err = new Error(`${res.status}: ${String(detail).slice(0,500)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function edgeConfigured() {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_PUBLISHABLE_KEY;
}

function edgeUrl() {
  return process.env.WAE_SUPABASE_EDGE_URL || `${String(process.env.SUPABASE_URL || '').replace(/\/$/,'')}/functions/v1/wae-local-voice-demo-v61`;
}

function edgeHeaders() {
  return {
    'Content-Type':'application/json',
    'apikey':process.env.SUPABASE_PUBLISHABLE_KEY,
    'Origin':process.env.PUBLIC_APP_URL || 'https://wae-inteligencia-universal.onrender.com',
    'X-Client-Info':'wae-inteligencia-universal-render-fallback/1.0'
  };
}

async function waeUniversalEdgeResponse({ system, message, history, mode='general', webEnabled=false, signal}) {
  const boot = await jsonFetch(edgeUrl(), {
    signal, method:'POST', headers:edgeHeaders(), body:JSON.stringify({ action:'bootstrap' })
  }, 20000);
  if (!boot?.session_id || !boot?.session_secret) throw new Error('Supabase Universal Runtime no creó sesión');

  const recent = cleanHistory(history, 8).map(x => `${x.role.toUpperCase()}: ${x.content}`).join('\n');
  // Preserve specialist guidance even for the first turn.
  // Edge builds its own trusted system policy. Keep the user's message clean so
  // fallback requests never persist runtime prompts as if the user had written them.
  const internalContext = recent ? `Conversación previa del chat:\n${recent}` : '';

  const data = await jsonFetch(edgeUrl(), {
    signal, method:'POST',
    headers:edgeHeaders(),
    body:JSON.stringify({
      action:'chat',
      session_id:boot.session_id,
      session_secret:boot.session_secret,
      message:String(message||'').slice(0,24000),
      internal_context:internalContext,
      mode,
      web_enabled:webEnabled,
      attachments:[]
    })
  }, 60000);
  const text = String(data?.reply || '').trim();
  if (!text) throw new Error('Supabase Universal Runtime devolvió respuesta vacía');
  return {
    text,
    usage:null,
    responseId:data.conversation_id || null,
    provider:data.provider || 'wae_edge',
    model:data.model || 'iu-gpt-runtime-v11',
    edgeRuntime:data.runtime || null,
    sources:Array.isArray(data.web_sources) ? data.web_sources : []
  };
}

function gatewayConfigured() {
  return !!process.env.WAE_SUPABASE_MACHINE_KEY && !!(process.env.WAE_SUPABASE_GATEWAY_URL || process.env.SUPABASE_URL);
}

function gatewayUrl() {
  return process.env.WAE_SUPABASE_GATEWAY_URL || `${String(process.env.SUPABASE_URL || '').replace(/\/$/,'')}/functions/v1/wae-ai-gateway`;
}

function gatewayHeaders() {
  return {
    'Authorization':`Bearer ${process.env.WAE_SUPABASE_MACHINE_KEY}`,
    'Content-Type':'application/json',
    'X-Client-Info':'wae-inteligencia-universal-render/1.0'
  };
}

function gatewayBody(action, extras = {}) {
  return {
    action,
    organization_id:process.env.WAE_SUPABASE_ORGANIZATION_ID,
    product_key:process.env.WAE_SUPABASE_PRODUCT_KEY || 'wae_os_enterprise',
    ...extras
  };
}

async function waeSupabaseResponse({ system, message, history, signal}) {
  const messages = [
    { role:'system', content:system },
    ...cleanHistory(history),
    { role:'user', content:message }
  ];
  const initial = await jsonFetch(gatewayUrl(), {
    signal, method:'POST',
    headers:gatewayHeaders(),
    body:JSON.stringify(gatewayBody('chat', {
      input:message,
      messages,
      wait_ms:12000,
      auto_research:true,
      context:{ surface:'inteligencia_universal_render', channel:'web', sensitivity:'INTERNAL', system_guidance:system.slice(0,12000) }
    }))
  }, 30000);

  const direct = String(initial?.output_text || initial?.answer || '').trim();
  if (direct) return { text:direct, usage:null, responseId:initial?.id || initial?.runtime_request_id || null, sources:Array.isArray(initial?.sources)?initial.sources:[] };

  const requestId = initial?.runtime_request_id || initial?.request?.id;
  if (!requestId) throw new Error(`WAE Supabase Gateway no devolvió respuesta ni runtime_request_id (${initial?.error || initial?.status || 'unknown'})`);
  const deadline = Date.now() + 24000;
  let last = initial;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve,700));
    last = await jsonFetch(gatewayUrl(), {
    signal, method:'POST', headers:gatewayHeaders(), body:JSON.stringify(gatewayBody('status',{ runtime_request_id:requestId }))
    },15000);
    const text = String(last?.output_text || last?.answer || '').trim();
    if (text) return { text, usage:null, responseId:requestId, sources:Array.isArray(last?.sources)?last.sources:[] };
    if (last?.completed === true || ['failed','cancelled'].includes(String(last?.status || '').toLowerCase())) break;
  }
  throw new Error(`WAE Supabase Gateway no completó la respuesta: ${String(last?.error || last?.status || 'timeout').slice(0,300)}`);
}

export function providerRegistry() {
  return [
    { id:'wae_edge', configured:edgeConfigured(), model:'iu-gpt-runtime-v11', streaming:false },
    { id:'wae_supabase', configured:gatewayConfigured(), model:'wae-capability-router-v90', streaming:false },
    { id:'openai', configured:!!process.env.OPENAI_API_KEY, model:process.env.OPENAI_MODEL || 'gpt-5.6-sol', streaming:true },
    { id:'anthropic', configured:!!process.env.ANTHROPIC_API_KEY, model:process.env.ANTHROPIC_MODEL || 'claude-sonnet-5', streaming:true },
    { id:'gemini', configured:!!process.env.GEMINI_API_KEY, model:process.env.GEMINI_MODEL || 'gemini-3.8-flash', streaming:true },
    { id:'xai', configured:!!process.env.XAI_API_KEY, model:process.env.XAI_MODEL || 'grok-4.6', streaming:true },
    { id:'openrouter', configured:!!process.env.OPENROUTER_API_KEY && !!process.env.OPENROUTER_MODEL, model:process.env.OPENROUTER_MODEL || null, streaming:true }
  ];
}

export function providerOperationalSnapshot(){return providerCircuitSnapshot(providerRegistry())}

async function openAIResponse({ model, system, message, history, signal}) {
  const input = [{role:'system',content:system},...cleanHistory(history),{role:'user',content:message}];
  const data = await jsonFetch('https://api.openai.com/v1/responses', {
    signal, method:'POST', headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'}, body:JSON.stringify({model,input})
  });
  const text = textFromOpenAI(data);
  if (!text) throw new Error('OpenAI devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

async function anthropicResponse({ model, system, message, history, signal}) {
  const messages = [...cleanHistory(history),{role:'user',content:message}];
  const data = await jsonFetch('https://api.anthropic.com/v1/messages', {
    signal, method:'POST', headers:{'x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','Content-Type':'application/json'},
    body:JSON.stringify({model,max_tokens:Number(process.env.ANTHROPIC_MAX_TOKENS || 4096),system,messages})
  });
  const text = (data.content || []).filter(x=>x.type==='text').map(x=>x.text).join('\n').trim();
  if (!text) throw new Error('Anthropic devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

async function geminiResponse({ model, system, message, history, signal}) {
  const contents = cleanHistory(history).map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]}));
  contents.push({role:'user',parts:[{text:message}]});
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const data = await jsonFetch(url,{signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents})});
  const text = (data.candidates?.[0]?.content?.parts || []).map(p=>p.text || '').join('\n').trim();
  if (!text) throw new Error('Gemini devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usageMetadata || null, responseId:data.responseId || null };
}

async function xaiResponse({ model, system, message, history, signal}) {
  const data = await jsonFetch('https://api.x.ai/v1/responses',{signal,method:'POST',headers:{'Authorization':`Bearer ${process.env.XAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'system',content:system},...cleanHistory(history),{role:'user',content:message}]})});
  const text = textFromOpenAI(data);
  if (!text) throw new Error('xAI devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

async function openRouterResponse({ model, system, message, history, signal}) {
  const data = await jsonFetch('https://openrouter.ai/api/v1/chat/completions',{signal,method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':process.env.PUBLIC_APP_URL || 'https://wae-inteligencia-universal.onrender.com','X-Title':'WAE Inteligencia Universal'},body:JSON.stringify({model,messages:[{role:'system',content:system},...cleanHistory(history),{role:'user',content:message}]})});
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

const callers = { wae_edge:waeUniversalEdgeResponse, wae_supabase:waeSupabaseResponse, openai:openAIResponse, anthropic:anthropicResponse, gemini:geminiResponse, xai:xaiResponse, openrouter:openRouterResponse };

function degradedAnswer(text='') {
  const value=String(text||'').trim();
  if (!value) return 'empty_answer';
  const plain=value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
  const blocked = [
    /la ruta generativa avanzada no esta disponible/,
    /no existe evidencia publica suficiente para responder sin inventar/,
    /intenta nuevamente\.?$/,
    /rutas? generativas? (?:estan|esta) temporalmente (?:saturadas?|no disponibles?)/,
    /universal core sigue operativo, pero ninguna ruta alcanzo el umbral minimo/,
    /prefiero no entregar contenido mediocre o inventado/
  ];
  if (blocked.some(rule=>rule.test(plain))) return 'degraded_runtime_placeholder';
  if (value.length < 24 && /(?:no disponible|intenta|reintenta|error|fallo)/i.test(value)) return 'low_information_failure';
  return '';
}

export async function generateWithFallback({ provider='auto', system, message, history=[], mode='general', webEnabled=false, qualityGate=null, budgetMs=46000, retryColdStart=false, attemptTimeoutMs=38000 }) {
  const registry = providerRegistry();
  const ordered = provider === 'auto'
    ? registry.filter(x=>x.configured)
    : [...registry.filter(x=>x.id===provider&&x.configured),...registry.filter(x=>x.id!==provider&&x.configured)];
  if (!ordered.length) {
    const err = new Error('No hay proveedores IA configurados en el servidor'); err.code='NO_PROVIDER'; throw err;
  }
  const failures = [];
  // Only a timed-out read-only Edge conversation may receive one warm retry.
  // Other configured providers get their chance first. A quality rejection,
  // auth error or failed mutation must never cause an invisible replay.
  const edge=ordered.find(p=>p.id==='wae_edge');
  const queue=[...ordered,...(retryColdStart&&edge?[edge]:[])];
  let edgeTimedOut=false;
  const deadline=Date.now()+Math.min(55000,Math.max(6000,Number(budgetMs)||46000));
  for (let index=0;index<queue.length;index++) {
    const p=queue[index];
    if(index>=ordered.length&&!edgeTimedOut)continue;
    const remaining=deadline-Date.now();
    if(remaining<1500)break;
    const controller=new AbortController();
    const maxAttempt=Math.min(40000,Math.max(20,Number(attemptTimeoutMs)||38000));
    const timer=setTimeout(()=>controller.abort(),Math.min(maxAttempt,remaining));
    try {
      const result = await callers[p.id]({model:p.model,system,message,history,mode,webEnabled,signal:controller.signal});
      const qualityFailure = degradedAnswer(result?.text) || (typeof qualityGate==='function' ? qualityGate(result?.text) : '');
      if (qualityFailure) {
        failures.push({provider:p.id,model:p.model,error:qualityFailure});
        continue;
      }
      return { ...result, provider:result.provider || p.id, model:result.model || p.model, failures };
    } catch (error) {
      const code=controller.signal.aborted?'provider_timeout':String(error?.code||error?.status||error?.name||'provider_error').slice(0,80);
      if(p.id==='wae_edge'&&code==='provider_timeout')edgeTimedOut=true;
      failures.push({provider:p.id,model:p.model,error:code});
    } finally {clearTimeout(timer)}
  }
  const err = new Error('Todos los proveedores configurados fallaron'); err.code='ALL_PROVIDERS_FAILED'; err.failures=failures; throw err;
}
