import { backendConfig } from './config.js';

export function augmentResponse(res) {
  if (typeof res.status !== 'function') {
    res.status = code => {
      res.statusCode = Number(code) || 500;
      return res;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = payload => {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (!res.writableEnded) res.end(JSON.stringify(payload));
      return res;
    };
  }
  return res;
}

export async function readJsonBody(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return undefined;
  if (req.body !== undefined) return req.body;

  const maxBodyBytes = backendConfig().maxBodyBytes;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error('request_body_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

export function safeErrorPayload(error, requestId) {
  const status = Number(error?.statusCode || error?.status || 500);
  const publicMessage = status >= 500 ? 'internal_error' : String(error?.message || 'request_failed');
  return {
    status,
    payload: {
      error: publicMessage,
      request_id: requestId,
      recoverable: status === 408 || status === 409 || status === 429 || status >= 500,
    },
  };
}
