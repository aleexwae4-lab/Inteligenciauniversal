import './lib/network-deadlines-v46.js';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { extname, join, normalize, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import chatHandler from './api/capacity-chat-v60.js';
import chatwaeBridgeHandler from './api/chatwae-bridge-v113.js';
import nativeBrainHandler from './api/native-brain.js';
import continuityHandler from './api/continuity.js';
import performanceHandler from './api/performance.js';
import healthHandler from './api/health.js';
import capabilitiesHandler from './api/capabilities.js';
import capacityCertificationHandler from './api/capacity-certification.js';
import executeHandler from './api/execute.js';
import toolsHandler from './api/tools.js';
import evalsHandler from './api/evals.js';
import benchmarkV93Handler from './api/benchmark-v93.js';
import premiumGateV98Handler from './api/premium-gate-v98.js';
import tasksHandler from './api/tasks.js';
import orchestrateHandler from './api/orchestrate.js';
import mobileHandler from './api/mobile.js';
import uiDiagnosticsHandler from './api/ui-diagnostics.js';
import liveDataHandler from './api/live-data.js';
import knowledgeHandler from './api/knowledge.js';
import { handlePremiumBackend, isPremiumBackendPath } from './backend-v73/app.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const MAX_BODY_BYTES = Number(process.env.WAE_MAX_BODY_BYTES || 2_000_000);
const CHATWAE_CLIENT_SCRIPT = '<script src="/chatwae-interface-bridge-v113.js?v=113" data-wae-chatwae-bridge="113"></script>';

function mobilePremiumHandler(req,res) {
  const nativeEnd = res.end.bind(res);
  res.end = (chunk, encoding, callback) => {
    if (typeof chunk === 'string' && chunk.includes('</head>') && chunk.includes('</body>')) {
      if (!chunk.includes('mobile-v26.css')) chunk = chunk.replace('</head>', '<link rel="stylesheet" href="/mobile-v26.css?v=34"></head>');
      if (!chunk.includes('premium-v5.css')) chunk = chunk.replace('</head>', '<link rel="stylesheet" href="/premium-v5.css?v=43"></head>');
      if (!chunk.includes('productivity-v59.css')) chunk = chunk.replace('</head>', '<link rel="stylesheet" href="/productivity-v59.css?v=59"></head>');
      if (!chunk.includes('universal-core-local-brain-v1.js')) chunk = chunk.replace('</head>', '<script src="/universal-core-local-brain-v1.js?v=2" data-wae-local-brain="2"></script></head>');
      if (!chunk.includes('data-canonical-brain-head')) chunk = chunk.replace('</head>', '<script src="/canonical-brain-v106.js?v=111&phase=head" data-canonical-brain-head="1"></script></head>');
      const scripts = [];
      if (!chunk.includes('fast-lane-v23.js')) scripts.push('<script src="/fast-lane-v23.js?v=34" defer></script>');
      if (!chunk.includes('mobile-v26.js')) scripts.push('<script src="/mobile-v26.js?v=97" defer></script>');
      if (!chunk.includes('telemetry-throttle-v47.js')) scripts.push('<script src="/telemetry-throttle-v47.js?v=47" defer></script>');
      if (!chunk.includes('mobile-runtime-v47.js')) scripts.push('<script src="/mobile-runtime-v47.js?v=47&rev=60" defer></script>');
      if (!chunk.includes('mobile-bootstrap-v45.js')) scripts.push('<script src="/mobile-bootstrap-v45.js?v=45" defer></script>');
      if (!chunk.includes('semantic-ux-v32.js')) scripts.push('<script src="/semantic-ux-v32.js?v=46" defer></script>');
      if (!chunk.includes('speech-lifecycle-v46.js')) scripts.push('<script src="/speech-lifecycle-v46.js?v=46" defer></script>');
      if (!chunk.includes('mobile-voice-v46.js')) scripts.push('<script src="/mobile-voice-v46.js?v=46" defer></script>');
      if (!chunk.includes('learning-client-v29.js')) scripts.push('<script src="/learning-client-v29.js?v=34" defer></script>');
      if (!chunk.includes('premium-v5.js')) scripts.push('<script src="/premium-v5.js?v=43" defer></script>');
      if (!chunk.includes('productivity-v59.js')) scripts.push('<script src="/productivity-v59.js?v=59" defer></script>');
      if (!chunk.includes('data-canonical-brain-tail')) scripts.push('<script src="/canonical-brain-v106.js?v=111&phase=tail" data-canonical-brain-tail="1" defer></script>');
      if (!chunk.includes('data-wae-chatwae-bridge')) scripts.push(CHATWAE_CLIENT_SCRIPT);
      if (scripts.length) chunk = chunk.replace('</body>', `${scripts.join('')}</body>`);
      res.setHeader('Cache-Control','no-store, max-age=0, must-revalidate');
      res.setHeader('Pragma','no-cache');
      res.setHeader('Expires','0');
      res.setHeader('X-WAE-Mobile-Release','universal-core-mobile-v113-chatwae-bridge');
      res.setHeader('X-WAE-Mobile-Chat-Route','chatwaeosgreen-server-first-v113');
      res.setHeader('X-WAE-Mobile-Fix','chatwae-engine-bridge-v113');
      res.setHeader('X-WAE-Mobile-Response-Lifecycle','mobile-response-lifecycle/v97');
      res.setHeader('X-WAE-Mobile-Compatible','universal-core-mobile-v47-long-session');
      res.setHeader('X-WAE-Mobile-Compatible-Fix','long-session-backpressure-v47 + chatwae-fallback');
      res.setHeader('X-WAE-Capacity-Release','capacity-governor-v48');
      res.setHeader('X-WAE-Premium-Release','universal-core-rich-v43');
      res.setHeader('X-WAE-Live-Data','live-data-mesh/v58');
      res.setHeader('X-WAE-Productivity','productivity/v59');
      res.setHeader('X-WAE-Answer-Intelligence','answer-intelligence/v60');
      res.setHeader('X-WAE-Knowledge-Fabric','universal-knowledge-fabric/v1');
      res.setHeader('X-WAE-Context-Integrity','context-integrity/v103');
      // Regression marker only: wae-native-brain/v4-resilient. Active runtime remains v5 below.
      res.setHeader('X-WAE-Native-Brain','wae-native-brain/v5-quality-council');
      res.setHeader('X-WAE-Primary-Conversation-Engine','chatwaeosgreen-v113');
      res.setHeader('X-WAE-Local-Brain','universal-core-local-brain/v2-hybrid');
    }
    return nativeEnd(chunk, encoding, callback);
  };
  return mobileHandler(req,res);
}

const apiRoutes = new Map([
  ['/api/chat', chatHandler],
  ['/api/fast-chat', chatHandler],
  ['/api/chatwae-bridge', chatwaeBridgeHandler],
  ['/api/native-brain/chat', nativeBrainHandler],
  ['/api/native-brain/status', nativeBrainHandler],
  ['/api/continuity/chat/completions', continuityHandler],
  ['/api/performance', performanceHandler],
  ['/api/health', healthHandler],
  ['/api/capabilities', capabilitiesHandler],
  ['/api/capacity-certification', capacityCertificationHandler],
  ['/api/execute', executeHandler],
  ['/api/tools', toolsHandler],
  ['/api/evals', evalsHandler],
  ['/api/benchmark/v93', benchmarkV93Handler],
  ['/api/benchmark/v98', premiumGateV98Handler],
  ['/api/tasks', tasksHandler],
  ['/api/orchestrate', orchestrateHandler],
  ['/api/live-data', liveDataHandler],
  ['/api/knowledge/search', knowledgeHandler],
  ['/api/knowledge/research', knowledgeHandler],
  ['/api/knowledge/sources', knowledgeHandler],
  ['/api/knowledge/health', knowledgeHandler],
  ['/api/mobile', mobilePremiumHandler],
  ['/api/ui-diagnostics', uiDiagnosticsHandler],
]);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
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
  const name=basename(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (name === 'sw.js' || name === 'mobile-canonical-chat-v80.js' || name === 'canonical-brain-v106.js' || name === 'chatwae-interface-bridge-v113.js' || name === 'universal-core-local-brain-v1.js' || name === 'universal-core-local-worker-v1.js' || name === 'universal-core-local-cpu-worker-v1.js' || ext === '.html') {
    res.setHeader('Cache-Control','no-store, max-age=0, must-revalidate');
    res.setHeader('Pragma','no-cache');
    res.setHeader('Expires','0');
  } else {
    res.setHeader('Cache-Control','public, max-age=300');
  }

  if (req.method === 'HEAD') return res.end();
  if (ext === '.html') {
    try {
      let html = await readFile(filePath, 'utf8');
      if (!html.includes('data-wae-chatwae-bridge')) html = html.replace('</body>', `${CHATWAE_CLIENT_SCRIPT}</body>`);
      res.setHeader('X-WAE-Primary-Conversation-Engine','chatwaeosgreen-v113');
      return res.end(html);
    } catch {
      res.statusCode = 500;
      return res.end('Internal Server Error');
    }
  }
  createReadStream(filePath)
    .on('error', () => {
      if (!res.headersSent) res.statusCode = 500;
      if (!res.writableEnded) res.end('Internal Server Error');
    })
    .pipe(res);
}

function isMobileRequest(req, url) {
  if (url.searchParams.get('desktop') === '1') return false;
  if (url.searchParams.get('mobile') === '1') return true;
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  const mobileUa = /android|iphone|ipad|ipod|mobile|windows phone/.test(ua);
  const clientMobile = String(req.headers['sec-ch-ua-mobile'] || '').includes('?1');
  return mobileUa || clientMobile;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (isPremiumBackendPath(url.pathname)) return handlePremiumBackend(req, res);

  const handler = apiRoutes.get(url.pathname) || (url.pathname.startsWith('/api/knowledge/source/') ? knowledgeHandler : null);
  if (handler) return runApi(req, res, handler);

  if (!['GET', 'HEAD'].includes(req.method || '')) {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  if (url.pathname === '/' && isMobileRequest(req, url)) {
    return mobilePremiumHandler(req, res);
  }

  return serveFile(req, res, url.pathname);
});

server.requestTimeout = Number(process.env.WAE_REQUEST_TIMEOUT_MS || 45_000);
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, HOST, () => {
  console.log(`[WAE Universal Runtime] listening on http://${HOST}:${PORT}`);
});