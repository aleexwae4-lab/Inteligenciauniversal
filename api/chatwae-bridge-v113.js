import { randomUUID } from 'node:crypto';

const DEFAULT_ENGINE_URL = 'https://waeosgreen.onrender.com/api/chat';
const ENGINE_URL = String(process.env.WAE_CHATWAE_ENGINE_URL || DEFAULT_ENGINE_URL).replace(/\/+$/, '');
const ENGINE_TIMEOUT_MS = Math.max(15_000, Number(process.env.WAE_CHATWAE_ENGINE_TIMEOUT_MS || 115_000));
const MAX_HISTORY_ROWS = 18;
const MAX_HISTORY_CHARS = 40_000;

function uuid(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : randomUUID();
}

function text(value, max = 20_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeMode(value) {
  const mode = String(value || '').toLowerCase();
  if (['fast', 'reasoning', 'research', 'creative', 'execution'].includes(mode)) return mode;
  if (mode === 'general' || mode === 'analysis' || mode === 'code') return 'reasoning';
  if (mode === 'design') return 'creative';
  if (mode === 'executive') return 'execution';
  return 'reasoning';
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const rows = [];
  let chars = 0;
  for (const raw of value.slice(-MAX_HISTORY_ROWS)) {
    const role = raw?.role === 'assistant' ? 'assistant' : raw?.role === 'user' ? 'user' : '';
    const content = text(raw?.content ?? raw?.text, 5_000);
    if (!role || !content) continue;
    if (chars + content.length > MAX_HISTORY_CHARS) break;
    rows.push({ role, content });
    chars += content.length;
  }
  return rows;
}

function buildPayload(body = {}) {
  const message = text(body?.userMessage?.content ?? body?.message);
  if (!message) throw Object.assign(new Error('message_required'), { statusCode: 400 });

  const suppliedHistory = body.clientHistory ?? body.history;
  const mode = normalizeMode(body.mode);
  const userMessage = body.userMessage && typeof body.userMessage === 'object'
    ? {
        id: uuid(body.userMessage.id),
        content: message,
        ...(typeof body.userMessage.image === 'string' ? { image: body.userMessage.image } : {}),
        ...(body.userMessage.file && typeof body.userMessage.file === 'object' ? { file: body.userMessage.file } : {})
      }
    : { id: uuid(body.userMessageId), content: message };

  return {
    conversationId: uuid(body.conversationId || body.conversation_id || body.sessionId || body.session_id),
    userMessage,
    assistantMessageId: uuid(body.assistantMessageId),
    mode,
    webSearch: body.webSearch === true || body.web_enabled === true || mode === 'research',
    clientHistory: normalizeHistory(suppliedHistory)
  };
}

function bearer(req) {
  const authorization = String(req.headers?.authorization || '');
  return authorization.toLowerCase().startsWith('bearer ') ? authorization : '';
}

export default async function chatwaeBridgeHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const authorization = bearer(req);
  if (!authorization) {
    return res.status(401).json({ error: 'supabase_session_required', authRequired: true });
  }

  let payload;
  try {
    payload = buildPayload(req.body || {});
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'invalid_request' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('chatwae_engine_timeout'), ENGINE_TIMEOUT_MS);
  const started = Date.now();

  try {
    const upstream = await fetch(ENGINE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        'X-WAE-Bridge': 'universal-core/chatwae-v113'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      let upstreamError = raw;
      try {
        const parsed = JSON.parse(raw);
        upstreamError = parsed?.error || raw;
      } catch {}
      return res.status(upstream.status).json({
        error: text(upstreamError, 1_000) || `chatwae_upstream_${upstream.status}`,
        authRequired: upstream.status === 401
      });
    }

    const reply = raw.trim();
    if (!reply) return res.status(502).json({ error: 'chatwae_empty_response' });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-WAE-Universal-Engine', 'chatwaeosgreen-v113');
    res.setHeader('X-WAE-Universal-Conversation', payload.conversationId);
    res.setHeader('X-WAE-Universal-Latency-Ms', String(Date.now() - started));
    const upstreamEngine = upstream.headers.get('x-wae-conversation-engine');
    const upstreamQuality = upstream.headers.get('x-wae-quality-status');
    if (upstreamEngine) res.setHeader('X-WAE-Upstream-Engine', upstreamEngine);
    if (upstreamQuality) res.setHeader('X-WAE-Upstream-Quality', upstreamQuality);

    return res.status(200).json({
      reply,
      conversationId: payload.conversationId,
      engine: 'chatwaeosgreen-v113',
      latencyMs: Date.now() - started
    });
  } catch (error) {
    const timeout = error?.name === 'AbortError' || String(error?.message || '').includes('timeout');
    return res.status(timeout ? 504 : 502).json({
      error: timeout ? 'chatwae_engine_timeout' : 'chatwae_engine_unavailable'
    });
  } finally {
    clearTimeout(timer);
  }
}
