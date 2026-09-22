import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import chatHandler from './api/chat.js';
import researchHandler from './api/research.js';
import collaborationHandler from './api/collaboration.js';
import visionHandler from './api/vision.js';
import healthHandler from './api/health.js';
import capabilitiesHandler from './api/capabilities.js';
import tasksHandler from './api/tasks.js';
import exportHandler from './api/export.js';
import canvasHandler from './api/canvas.js';
import factoryProjectHandler from './api/factory-project.js';
import researchHandler from './api/research.js';
import collaborationHandler from './api/collaboration.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const MAX_BODY_BYTES = Number(process.env.WAE_MAX_BODY_BYTES || 2_000_000);

const apiRoutes = new Map([
  ['/api/chat', chatHandler],
  ['/api/research', researchHandler],
  ['/api/collaboration', collaborationHandler],
  ['/api/vision', visionHandler],
  ['/api/health', healthHandler],
  ['/api/health/liveness', healthHandler],
  ['/api/health/readiness', healthHandler],
  ['/api/capabilities', capabilitiesHandler],
  ['/api/tasks', tasksHandler],
  ['/api/export', exportHandler],
  ['/api/canvas', canvasHandler],
  ['/api/factory-project', factoryProjectHandler],
  ['/api/research', researchHandler],
  ['/api/collaboration', collaborationHandler],
]);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
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
  let decoded;
  try{decoded=decodeURIComponent(pathname)}catch{return null}
  if(decoded==='/'||decoded==='/index.html')return join(ROOT,'index.html');
  // Static hosting is deliberately not a source-code or config file browser.
  // Never serve backend code, tests, build scripts or server configuration.
  if(!decoded.startsWith('/')||decoded.includes('\\')||decoded.includes('\0'))return null;
  const segments=decoded.split('/').filter(Boolean);
  if(!segments.length||segments.some(part=>part==='..'||part.startsWith('.')))return null;
  const requested=segments.join('/');
  if(/^(?:api|lib|scripts|tests|node_modules|\.github|\.git)(?:\/|$)/i.test(requested))return null;
  if(/^(?:server\.js|package(?:-lock)?\.json|yarn\.lock|README\.md)$/i.test(requested))return null;
  if(segments.length>1&&segments[0]!=='assets')return null;
  const ext=extname(requested).toLowerCase();
  if(!contentTypes[ext])return null;
  if(segments[0]==='assets'&&!/^\.(?:svg|png|jpg|jpeg|webp|ico|woff|woff2)$/.test(ext))return null;
  return join(ROOT,normalize(requested));
}

async function serveFile(req,res,pathname) {
  const filePath=safeStaticPath(pathname);
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  if(!filePath){res.statusCode=404;res.setHeader('Cache-Control','no-store');return res.end(req.method==='HEAD'?'':'Not Found')}
  let info;
  try{info=await stat(filePath);if(!info.isFile())throw new Error('not_file')}
  catch{res.statusCode=404;res.setHeader('Cache-Control','no-store');return res.end(req.method==='HEAD'?'':'Not Found')}
  const ext=extname(filePath).toLowerCase();
  res.statusCode=200;
  res.setHeader('Content-Type',contentTypes[ext]||'application/octet-stream');
  res.setHeader('Cache-Control',ext==='.html'?'no-cache':'public, max-age=300');
  if(req.method==='HEAD')return res.end();
  createReadStream(filePath)
    .on('error',()=>{if(!res.headersSent)res.statusCode=500;if(!res.writableEnded)res.end('Internal Server Error')})
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
