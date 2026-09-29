import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import chatHandler from './api/chat.js';
import chatStreamHandler from './api/chat-stream.js';
import researchHandler from './api/research.js';
import collaborationHandler from './api/collaboration.js';
import visionHandler from './api/vision.js';
import healthHandler from './api/health.js';
import capabilitiesHandler from './api/capabilities.js';
import tasksHandler from './api/tasks.js';
import exportHandler from './api/export.js';
import canvasHandler from './api/canvas.js';
import factoryProjectHandler from './api/factory-project.js';
import frontierArenaHandler from './api/frontier-arena-v1.js';
import frontierLearningHandler from './api/frontier-learning-v1.js';
import frontierControlHandler from './api/frontier-control-v1.js';
import frontierEvaluationHandler from './api/frontier-evaluation-v1.js';
import frontierAutonomousHandler from './api/frontier-autonomous-v2.js';
import frontierRunnerHandler from './api/frontier-benchmark-runner-v3.js';
import frontierLiveEvalHandler from './api/frontier-live-eval-v1.js';
import frontierControlLoopHandler from './api/frontier-control-loop-v1.js';
import frontierArenaV2Handler from './api/frontier-arena-v2.js';
import { assertStartupSafety, markRuntimeReady, beginRuntimeDrain, lifecycleSnapshot } from './lib/runtime-lifecycle-v145.js';
import { generateWithFallback } from './lib/providers.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const MAX_BODY_BYTES = Number(process.env.WAE_MAX_BODY_BYTES || 2_000_000);
const REQUEST_TIMEOUT_MS = Number(process.env.WAE_REQUEST_TIMEOUT_MS || 120_000);
const SHUTDOWN_GRACE_MS = Number(process.env.WAE_SHUTDOWN_GRACE_MS || 20_000);

assertStartupSafety({port:PORT,maxBodyBytes:MAX_BODY_BYTES});

const apiRoutes = new Map([
  ['/api/chat', chatHandler],
  ['/api/chat-stream', chatStreamHandler],
  ['/api/research', researchHandler],
  ['/api/collaboration', collaborationHandler],
  ['/api/vision', visionHandler],
  ['/api/health', healthHandler],
  ['/api/health/liveness', healthHandler],
  ['/api/health/readiness', healthHandler],
  ['/api/health/canary', healthHandler],
  ['/api/capabilities', capabilitiesHandler],
  ['/api/capabilities/proof', capabilitiesHandler],
  ['/api/tasks', tasksHandler],
  ['/api/export', exportHandler],
  ['/api/canvas', canvasHandler],
  ['/api/factory-project', factoryProjectHandler],
  ['/api/benchmark/frontier-arena', frontierArenaHandler],
  ['/api/frontier/learning', frontierLearningHandler],
  ['/api/frontier/control', frontierControlHandler],
  ['/api/frontier/evaluation', frontierEvaluationHandler],
  ['/api/frontier/autonomous', frontierAutonomousHandler],
  ['/api/frontier/runner', frontierRunnerHandler],
  ['/api/frontier/live-eval', frontierLiveEvalHandler],
  ['/api/frontier/control-loop', frontierControlLoopHandler],
  ['/api/frontier/arena-v2', frontierArenaV2Handler],
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
    const status = Number(error?.statusCode);
    const publicError = status === 400 && error?.message === 'invalid_json'
      ? 'invalid_json'
      : status === 413 && error?.message === 'request_body_too_large'
      ? 'request_body_too_large'
      : 'internal_error';
    // Once a streamed response has started, a JSON error would corrupt it.
    if (res.headersSent) {
      if (!res.writableEnded) res.destroy();
      return;
    }
    res.statusCode = publicError === 'internal_error' ? 500 : status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    // Never expose raw upstream errors, environment details, or file paths on HTTP 5xx.
    if (!res.writableEnded) res.end(JSON.stringify({ error: publicError }));
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

server.requestTimeout = REQUEST_TIMEOUT_MS;
server.headersTimeout = 65_000;
server.keepAliveTimeout = 5_000;

let shuttingDown=false;
function shutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  const lifecycle=beginRuntimeDrain(signal);
  console.log(`[WAE Universal Runtime] draining (${signal}) phase=${lifecycle.phase}`);
  const forceTimer=setTimeout(()=>{
    console.error('[WAE Universal Runtime] graceful shutdown deadline exceeded');
    process.exit(1);
  },SHUTDOWN_GRACE_MS);
  forceTimer.unref?.();
  server.close(error=>{
    clearTimeout(forceTimer);
    if(error){
      console.error('[WAE Universal Runtime] shutdown error');
      process.exitCode=1;
      return;
    }
    console.log('[WAE Universal Runtime] shutdown complete');
  });
  server.closeIdleConnections?.();
}

process.once('SIGTERM',()=>shutdown('SIGTERM'));
process.once('SIGINT',()=>shutdown('SIGINT'));

async function bootGenerativeProbe(){
  if(process.env.WAE_BOOT_GENERATIVE_PROBE!=='1')return;
  const started=Date.now();
  const base=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=String(process.env.SUPABASE_PUBLISHABLE_KEY||'');
  const edge=String(process.env.WAE_SUPABASE_EDGE_URL||`${base}/functions/v1/wae-local-voice-demo-v61`);
  const stateless=String(process.env.WAE_STATELESS_GROQ_URL||`${base}/functions/v1/wae-model-probe-v73`);
  const headers={'Content-Type':'application/json','apikey':key,'Origin':process.env.PUBLIC_APP_URL||'https://inteligenciauniversal.onrender.com','X-Client-Info':'wae-boot-probe/1.0'};
  const safe=(x)=>String(x||'').replace(/[\\r\\n\\t]+/g,' ').slice(0,240);
  async function call(url,body,timeoutMs=12000){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const res=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal:controller.signal});
      const raw=await res.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
      return {status:res.status,data};
    }finally{clearTimeout(timer)}
  }
  try{
    if(!base||!key){console.warn('[WAE Generative Probe] missing Supabase connection configuration');return}
    const boot=await call(edge,{action:'bootstrap'},6000);
    const sessionId=boot.data?.session_id,sessionSecret=boot.data?.session_secret;
    let edgeResult={status:boot.status,bootstrap:!!sessionId};
    if(sessionId&&sessionSecret){
      const out=await call(edge,{action:'chat',session_id:sessionId,session_secret:sessionSecret,message:'Responde únicamente OK.',mode:'general',web_enabled:false,attachments:[]},12000);
      edgeResult={...edgeResult,status:out.status,reply:!!String(out.data?.reply||'').trim(),provider:safe(out.data?.provider),model:safe(out.data?.model),error:safe(out.data?.error)};
    }
    const stat=await call(stateless,{action:'stateless_chat',message:'Responde únicamente OK.',messages:[{role:'user',content:'Responde únicamente OK.'}],system:'Responde únicamente OK.',max_tokens:32,timeout_ms:8000},12000);
    const routerStarted=Date.now();
    let routerResult={};
    try{
      const generated=await generateWithFallback({provider:'auto',system:'Eres un canario de salud de Universal Core. Responde únicamente con OK.',message:'Responde únicamente: OK',history:[],mode:'general',webEnabled:false,budgetMs:12000,attemptTimeoutMs:4000});
      routerResult={ok:true,provider:safe(generated?.provider),model:safe(generated?.model),reply:!!String(generated?.text||'').trim(),failures:Array.isArray(generated?.failures)?generated.failures.map(x=>({provider:safe(x.provider),model:safe(x.model),error:safe(x.error)})).slice(0,8):[],latencyMs:Date.now()-routerStarted};
    }catch(error){
      routerResult={ok:false,error:safe(error?.code||error?.message||error),failures:Array.isArray(error?.failures)?error.failures.map(x=>({provider:safe(x.provider),model:safe(x.model),error:safe(x.error)})).slice(0,8):[],latencyMs:Date.now()-routerStarted};
    }
    console.info('[WAE Generative Probe]',JSON.stringify({edge:edgeResult,stateless:{status:stat.status,reply:!!String(stat.data?.reply||'').trim(),provider:safe(stat.data?.provider),model:safe(stat.data?.model),error:safe(stat.data?.error),failures:Array.isArray(stat.data?.failures)?stat.data.failures.map(x=>({provider:safe(x.provider),model:safe(x.model),error:safe(x.error)})).slice(0,6):[]},router:routerResult,latencyMs:Date.now()-started}));
  }catch(error){
    console.warn('[WAE Generative Probe]',JSON.stringify({error:safe(error?.message||error),latencyMs:Date.now()-started}));
  }
}

server.listen(PORT, HOST, () => {
  const lifecycle=markRuntimeReady();
  console.log(`[WAE Universal Runtime] listening on http://${HOST}:${PORT} phase=${lifecycle.phase}`);
  void bootGenerativeProbe();
});

export { server, shutdown, lifecycleSnapshot };
