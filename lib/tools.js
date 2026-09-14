function compact(value, max = 8000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0,max)}\n…[truncado]` : text;
}

export function toolRegistry() {
  return [
    {
      id:'web_search', configured:!!process.env.TAVILY_API_KEY, readonly:true,
      risk:'low', parallelSafe:true, timeoutMs:30000,
      capabilities:['web','research','freshness','sources'],
      description:'Búsqueda web reciente mediante un conector de investigación.'
    },
    {
      id:'github_search', configured:!!process.env.GITHUB_TOKEN, readonly:true,
      risk:'low', parallelSafe:true, timeoutMs:30000,
      capabilities:['github','code','repository','engineering'],
      description:'Búsqueda de código en repositorios accesibles por GitHub.'
    }
  ];
}

async function webSearch(query) {
  if (!process.env.TAVILY_API_KEY) throw new Error('web_search_not_configured');
  const res = await fetch('https://api.tavily.com/search', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ api_key:process.env.TAVILY_API_KEY, query, search_depth:'advanced', max_results:6, include_answer:false }),
    signal:AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`web_search_http_${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => ({ title:r.title, url:r.url, content:compact(r.content || '', 1500), score:r.score }));
}

function parseRepo(message='') {
  const match = message.match(/(?:repo:|github\.com\/)([\w.-]+\/[\w.-]+)/i);
  return match?.[1] || process.env.DEFAULT_GITHUB_REPO || null;
}

async function githubSearch(query, message) {
  if (!process.env.GITHUB_TOKEN) throw new Error('github_search_not_configured');
  const repo = parseRepo(message);
  if (!repo) throw new Error('github_repository_required');
  const cleaned = query.replace(/(?:repo:|https?:\/\/github\.com\/)[\w.-]+\/[\w.-]+/ig,'').trim() || 'TODO';
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(`${cleaned} repo:${repo}`)}&per_page=8`;
  const res = await fetch(url, {
    headers:{ 'Authorization':`Bearer ${process.env.GITHUB_TOKEN}`, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' },
    signal:AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`github_search_http_${res.status}`);
  const data = await res.json();
  return (data.items || []).map(i => ({ name:i.name, path:i.path, repository:i.repository?.full_name, url:i.html_url }));
}

export async function executeTool(id,{message='',query=message}={}) {
  if (id === 'web_search') return webSearch(String(query || message));
  if (id === 'github_search') return githubSearch(String(query || message), String(message));
  throw new Error('unknown_tool');
}

// Compatibility path. The v9 runtime uses Tool Fabric, but legacy callers retain the same contract.
export async function runTools({ agent, message, requestedTools=[] }) {
  const registry = Object.fromEntries(toolRegistry().map(t => [t.id,t]));
  const desired = [...new Set([...(agent.tools || []), ...requestedTools])];
  const results = [];
  for (const id of desired) {
    const meta = registry[id];
    if (!meta || !meta.configured) continue;
    try {
      const data = await executeTool(id,{message,query:message});
      results.push({ tool:id, ok:true, data });
    } catch (error) {
      results.push({ tool:id, ok:false, error:String(error.message || error).slice(0,500) });
    }
  }
  return results;
}

export function formatToolContext(results=[]) {
  if (!results.length) return '';
  return `\n\nEVIDENCIA DE HERRAMIENTAS (usa solo lo observado; no inventes ejecuciones):\n${results.map(r => `\n[${r.tool}] ${r.ok?'OK':'ERROR'}\n${compact(r.ok?r.data:r.error)}`).join('\n')}`;
}
