import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import chatHandler from './api/chat.js';
import continuityHandler from './api/continuity.js';
import performanceHandler from './api/performance.js';
import healthHandler from './api/health.js';
import capabilitiesHandler from './api/capabilities.js';
import tasksHandler from './api/tasks.js';
import orchestrateHandler from './api/orchestrate.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const MAX_BODY_BYTES = Number(process.env.WAE_MAX_BODY_BYTES || 2_000_000);

const apiRoutes = new Map([
  ['/api/chat', chatHandler],
  ['/api/continuity/chat/completions', continuityHandler],
  ['/api/performance', performanceHandler],
  ['/api/health', healthHandler],
  ['/api/capabilities', capabilitiesHandler],
  ['/api/tasks', tasksHandler],
  ['/api/orchestrate', orchestrateHandler],
]);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function attachResponseHelpers(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
    return res;
  };
  return res;
}

async function readJsonBody(req) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method || '')) return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error('request_body_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

async function runApi(req, res, handler) {
  attachResponseHelpers(res);
  try {
    req.body = await readJsonBody(req);
    await handler(req, res);
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = error.statusCode || 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ error: error.message || 'internal_error' }));
    }
  }
}

function safeStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const requested = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  return join(ROOT, normalized);
}

async function serveFile(req, res, pathname) {
  let filePath = safeStaticPath(pathname);
  try {
    let info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath);
    }
    if (!info.isFile()) throw new Error('not_file');
  } catch {
    filePath = join(ROOT, 'index.html');
  }

  const ext = extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=300');

  if (req.method === 'HEAD') return res.end();
  createReadStream(filePath)
    .on('error', () => {
      if (!res.headersSent) res.statusCode = 500;
      if (!res.writableEnded) res.end('Internal Server Error');
    })
    .pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const handler = apiRoutes.get(url.pathname);

  if (handler) return runApi(req, res, handler);

  if (!['GET', 'HEAD'].includes(req.method || '')) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  return serveFile(req, res, url.pathname);
});

server.requestTimeout = Number(process.env.WAE_REQUEST_TIMEOUT_MS || 120_000);
server.headersTimeout = 65_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, HOST, () => {
  console.log(`[WAE Universal Runtime] listening on http://${HOST}:${PORT}`);
});
