import { buildToolReceipt, planCapabilities, publicReceipt } from './capability-kernel.js';

function compact(value, max = 8000) {
  let text;
  if (typeof value === 'string') text = value;
  else {
    try { text = JSON.stringify(value); } catch { text = String(value ?? ''); }
  }
  text = String(text ?? '');
  return text.length > max ? `${text.slice(0,max)}\n…[truncado]` : text;
}

export function toolRegistry() {
  return [
    {
      id:'web_search', configured:!!process.env.TAVILY_API_KEY, readonly:true, risk:'low', category:'research',
      requiresApproval:false, timeoutMs:30000, description:'Búsqueda web reciente con evidencia recuperada por Universal Core.'
    },
    {
      id:'github_search', configured:!!process.env.GITHUB_TOKEN, readonly:true, risk:'low', category:'engineering',
      requiresApproval:false, timeoutMs:30000, description:'Búsqueda de código en repositorios GitHub autorizados.'
    }
  ];
}

async function webSearch(query, timeoutMs=30000) {
  if (!process.env.TAVILY_API_KEY) throw new Error('capability_unavailable');
  const res = await fetch('https://api.tavily.com/search', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ api_key:process.env.TAVILY_API_KEY, query, search_depth:'advanced', max_results:6, include_answer:false }),
    signal:AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`upstream_http_${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => ({ title:r.title, url:r.url, content:compact(r.content || '', 1500), score:r.score }));
}

function parseRepo(message='') {
  const match = message.match(/(?:repo:|github\.com\/)([\w.-]+\/[\w.-]+)/i);
  return match?.[1] || process.env.DEFAULT_GITHUB_REPO || null;
}

async function githubSearch(query, message, timeoutMs=30000) {
  if (!process.env.GITHUB_TOKEN) throw new Error('capability_unavailable');
  const repo = parseRepo(message);
  if (!repo) throw new Error('repository_scope_required');
  const cleaned = query.replace(/(?:repo:|https?:\/\/github\.com\/)[\w.-]+\/[\w.-]+/ig,'').trim() || 'TODO';
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(`${cleaned} repo:${repo}`)}&per_page=8`;
  const res = await fetch(url, {
    headers:{ 'Authorization':`Bearer ${process.env.GITHUB_TOKEN}`, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' },
    signal:AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw new Error(`upstream_http_${res.status}`);
  const data = await res.json();
  return (data.items || []).map(i => ({ name:i.name, path:i.path, repository:i.repository?.full_name, url:i.html_url }));
}

export function planTools({ agent, message, requestedTools=[], approval=false, budgetMs } = {}) {
  return planCapabilities({ agent, message, requestedTools, registry:toolRegistry(), approval, budgetMs });
}

async function executeCapability(meta, message, timeoutMs) {
  if (meta.id === 'web_search') return webSearch(message, timeoutMs);
  if (meta.id === 'github_search') return githubSearch(message, message, timeoutMs);
  throw new Error('capability_not_implemented');
}

export async function runTools({ agent, message, requestedTools=[], approval=false, budgetMs, plan } = {}) {
  const registry = Object.fromEntries(toolRegistry().map(t => [t.id,t]));
  const executionPlan = plan || planTools({ agent, message, requestedTools, approval, budgetMs });
  const startedAll = Date.now();

  const runs = executionPlan.tools.map(async item => {
    const meta = registry[item.id] || { id:item.id, readonly:false, risk:'unknown', timeoutMs:1000 };
    const startedAt = new Date().toISOString();
    const started = Date.now();

    if (!item.allowed) {
      const receipt = buildToolReceipt({
        tool:item.id, ok:false, status:item.reason === 'approval_required' ? 'blocked' : 'skipped',
        startedAt, durationMs:Date.now()-started, readonly:item.readonly === true, risk:item.risk, payload:{reason:item.reason}
      });
      return { tool:item.id, ok:false, skipped:true, error:item.reason, receipt:publicReceipt(receipt) };
    }

    const remaining = Math.max(1000, executionPlan.budgetMs - (Date.now() - startedAll));
    const timeoutMs = Math.min(Number(meta.timeoutMs || 30000), remaining);
    try {
      const data = await executeCapability(meta, message, timeoutMs);
      const receipt = buildToolReceipt({
        tool:item.id, ok:true, status:'completed', startedAt, durationMs:Date.now()-started,
        readonly:meta.readonly === true, risk:meta.risk, payload:data
      });
      return { tool:item.id, ok:true, data, receipt:publicReceipt(receipt) };
    } catch (error) {
      const messageCode = String(error?.name === 'TimeoutError' ? 'capability_timeout' : (error?.message || 'capability_failed')).slice(0,120);
      const receipt = buildToolReceipt({
        tool:item.id, ok:false, status:'failed', startedAt, durationMs:Date.now()-started,
        readonly:meta.readonly === true, risk:meta.risk, payload:{error:messageCode}
      });
      return { tool:item.id, ok:false, error:messageCode, receipt:publicReceipt(receipt) };
    }
  });

  const results = await Promise.all(runs);
  Object.defineProperty(results, 'plan', { value:executionPlan, enumerable:false, configurable:false });
  return results;
}

export function formatToolContext(results=[]) {
  if (!results.length) return '';
  return `\n\nEVIDENCIA DE HERRAMIENTAS (usa solo lo observado; no inventes ejecuciones):\n${results.map(r => `\n[${r.tool}] ${r.ok?'OK':String(r.error||'NO DISPONIBLE').toUpperCase()}\n${compact(r.ok?r.data:'Sin evidencia utilizable.')}`).join('\n')}`;
}
