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
  const res = await fetch(url, { ...options, signal:timeout(ms) });
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

async function waeSupabaseResponse({ system, message, history }) {
  const messages = [
    { role:'system', content:system },
    ...cleanHistory(history),
    { role:'user', content:message }
  ];
  const initial = await jsonFetch(gatewayUrl(), {
    method:'POST',
    headers:gatewayHeaders(),
    body:JSON.stringify(gatewayBody('chat', {
      input:message,
      messages,
      wait_ms:12000,
      auto_research:true,
      context:{
        surface:'inteligencia_universal_render',
        channel:'web',
        sensitivity:'INTERNAL',
        system_guidance:system.slice(0,12000)
      }
    }))
  }, 30000);

  const direct = String(initial?.output_text || initial?.answer || '').trim();
  if (direct) {
    return {
      text:direct,
      usage:null,
      responseId:initial?.id || initial?.runtime_request_id || null,
      gatewayMeta:{ status:initial?.status || 'completed', capability:initial?.capability || null }
    };
  }

  const requestId = initial?.runtime_request_id || initial?.request?.id;
  if (!requestId) throw new Error(`WAE Supabase Gateway no devolvió respuesta ni runtime_request_id (${initial?.error || initial?.status || 'unknown'})`);

  const deadline = Date.now() + 24000;
  let last = initial;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 700));
    last = await jsonFetch(gatewayUrl(), {
      method:'POST',
      headers:gatewayHeaders(),
      body:JSON.stringify(gatewayBody('status', { runtime_request_id:requestId }))
    }, 15000);
    const text = String(last?.output_text || last?.answer || '').trim();
    if (text) {
      return {
        text,
        usage:null,
        responseId:requestId,
        gatewayMeta:{ status:last?.status || 'completed', telemetry:last?.telemetry || null }
      };
    }
    if (last?.completed === true || ['failed','cancelled'].includes(String(last?.status || '').toLowerCase())) break;
  }
  throw new Error(`WAE Supabase Gateway no completó la respuesta: ${String(last?.error || last?.status || 'timeout').slice(0,300)}`);
}

export function providerRegistry() {
  return [
    { id:'wae_supabase', configured:gatewayConfigured(), model:'wae-capability-router-v90' },
    { id:'openai', configured:!!process.env.OPENAI_API_KEY, model:process.env.OPENAI_MODEL || 'gpt-5.6-sol' },
    { id:'anthropic', configured:!!process.env.ANTHROPIC_API_KEY, model:process.env.ANTHROPIC_MODEL || 'claude-sonnet-5' },
    { id:'gemini', configured:!!process.env.GEMINI_API_KEY, model:process.env.GEMINI_MODEL || 'gemini-3.8-flash' },
    { id:'xai', configured:!!process.env.XAI_API_KEY, model:process.env.XAI_MODEL || 'grok-4.6' },
    { id:'openrouter', configured:!!process.env.OPENROUTER_API_KEY && !!process.env.OPENROUTER_MODEL, model:process.env.OPENROUTER_MODEL || null }
  ];
}

async function openAIResponse({ model, system, message, history }) {
  const input = [
    { role:'system', content:system },
    ...cleanHistory(history),
    { role:'user', content:message }
  ];
  const data = await jsonFetch('https://api.openai.com/v1/responses', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ model, input })
  });
  const text = textFromOpenAI(data);
  if (!text) throw new Error('OpenAI devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

async function anthropicResponse({ model, system, message, history }) {
  const messages = [...cleanHistory(history), { role:'user', content:message }];
  const data = await jsonFetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'x-api-key':process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01', 'Content-Type':'application/json' },
    body:JSON.stringify({ model, max_tokens:Number(process.env.ANTHROPIC_MAX_TOKENS || 4096), system, messages })
  });
  const text = (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n').trim();
  if (!text) throw new Error('Anthropic devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

async function geminiResponse({ model, system, message, history }) {
  const contents = cleanHistory(history).map(x => ({ role:x.role === 'assistant' ? 'model' : 'user', parts:[{ text:x.content }] }));
  contents.push({ role:'user', parts:[{ text:message }] });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const data = await jsonFetch(url, {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ systemInstruction:{ parts:[{ text:system }] }, contents })
  });
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
  if (!text) throw new Error('Gemini devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usageMetadata || null, responseId:data.responseId || null };
}

async function xaiResponse({ model, system, message, history }) {
  const data = await jsonFetch('https://api.x.ai/v1/responses', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${process.env.XAI_API_KEY}`, 'Content-Type':'application/json' },
    body:JSON.stringify({ model, input:[{role:'system',content:system}, ...cleanHistory(history), {role:'user',content:message}] })
  });
  const text = textFromOpenAI(data);
  if (!text) throw new Error('xAI devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

async function openRouterResponse({ model, system, message, history }) {
  const data = await jsonFetch('https://openrouter.ai/api/v1/chat/completions', {
    method:'POST',
    headers:{
      'Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type':'application/json',
      'HTTP-Referer':process.env.PUBLIC_APP_URL || 'https://wae-inteligencia-universal.onrender.com',
      'X-Title':'WAE Inteligencia Universal'
    },
    body:JSON.stringify({ model, messages:[{role:'system',content:system}, ...cleanHistory(history), {role:'user',content:message}] })
  });
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

const callers = {
  wae_supabase:waeSupabaseResponse,
  openai:openAIResponse,
  anthropic:anthropicResponse,
  gemini:geminiResponse,
  xai:xaiResponse,
  openrouter:openRouterResponse
};

export async function generateWithFallback({ provider='auto', system, message, history=[] }) {
  const registry = providerRegistry();
  const ordered = provider === 'auto'
    ? registry.filter(x => x.configured)
    : [...registry.filter(x => x.id === provider && x.configured), ...registry.filter(x => x.id !== provider && x.configured)];
  if (!ordered.length) {
    const err = new Error('No hay proveedores IA configurados en el servidor');
    err.code = 'NO_PROVIDER';
    throw err;
  }
  const failures = [];
  for (const p of ordered) {
    try {
      const result = await callers[p.id]({ model:p.model, system, message, history });
      return { ...result, provider:p.id, model:p.model, failures };
    } catch (error) {
      failures.push({ provider:p.id, model:p.model, error:String(error.message || error).slice(0,500) });
    }
  }
  const err = new Error('Todos los proveedores configurados fallaron');
  err.code = 'ALL_PROVIDERS_FAILED';
  err.failures = failures;
  throw err;
}
