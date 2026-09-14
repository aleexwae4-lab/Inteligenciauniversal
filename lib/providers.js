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
  return history.slice(-limit).filter(x => x && ['user','assistant'].includes(x.role) && typeof x.text === 'string')
    .map(x => ({ role: x.role, content: x.text.slice(0, 12000) }));
}

async function jsonFetch(url, options) {
  const res = await fetch(url, { ...options, signal: timeout(60000) });
  const raw = await res.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!res.ok) {
    const detail = data?.error?.message || data?.message || data?.raw || `HTTP ${res.status}`;
    throw new Error(`${res.status}: ${String(detail).slice(0, 500)}`);
  }
  return data;
}

export function providerRegistry() {
  return [
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
      'HTTP-Referer':process.env.PUBLIC_APP_URL || 'https://vercel.app',
      'X-Title':'WAE Inteligencia Universal'
    },
    body:JSON.stringify({ model, messages:[{role:'system',content:system}, ...cleanHistory(history), {role:'user',content:message}] })
  });
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter devolvió una respuesta sin texto utilizable');
  return { text, usage:data.usage || null, responseId:data.id || null };
}

const callers = { openai:openAIResponse, anthropic:anthropicResponse, gemini:geminiResponse, xai:xaiResponse, openrouter:openRouterResponse };

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
