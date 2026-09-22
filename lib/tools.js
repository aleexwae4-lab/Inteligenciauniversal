import {retrieveResearch} from './live-research-v119.js';

function compact(value, max = 8000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0,max)}\n…[truncado]` : text;
}

export function toolRegistry() {
  return [
    { id:'web_search', configured:!!process.env.TAVILY_API_KEY, readonly:true, description:'Búsqueda web reciente mediante Tavily.' },
    { id:'github_search', configured:!!process.env.GITHUB_TOKEN, readonly:true, description:'Búsqueda de código en repositorios accesibles por GitHub.' },
    { id:'public_research', configured:true, readonly:true, description:'Índices públicos OpenAlex y Wikimedia; no sustituyen la búsqueda de noticias en vivo.' }
  ];
}

async function webSearch(query) {
  if (!process.env.TAVILY_API_KEY) throw new Error('TAVILY_API_KEY no configurada');
  const res = await fetch('https://api.tavily.com/search', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ api_key:process.env.TAVILY_API_KEY, query, search_depth:'advanced', max_results:6, include_answer:false }),
    signal:AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(r => ({ title:r.title, url:r.url, content:compact(r.content || '', 1500), score:r.score }));
}

function parseRepo(message='') {
  const match = message.match(/(?:repo:|github\.com\/)([\w.-]+\/[\w.-]+)/i);
  return match?.[1] || process.env.DEFAULT_GITHUB_REPO || null;
}

async function githubSearch(query, message) {
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN no configurado');
  const repo = parseRepo(message);
  if (!repo) throw new Error('Falta repo:owner/name o DEFAULT_GITHUB_REPO');
  const cleaned = query.replace(/(?:repo:|https?:\/\/github\.com\/)[\w.-]+\/[\w.-]+/ig,'').trim() || 'TODO';
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(`${cleaned} repo:${repo}`)}&per_page=8`;
  const res = await fetch(url, {
    headers:{ 'Authorization':`Bearer ${process.env.GITHUB_TOKEN}`, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' },
    signal:AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const data = await res.json();
  return (data.items || []).map(i => ({ name:i.name, path:i.path, repository:i.repository?.full_name, url:i.html_url }));
}

export async function runTools({ agent, message, requestedTools=[] }) {
  const registry = Object.fromEntries(toolRegistry().map(t => [t.id,t]));
  const desired = [...new Set([...(agent.tools || []), ...requestedTools])];
  if(desired.includes('web_search')&&!registry.web_search.configured&&requestedTools.includes('web_search'))desired.push('public_research');
  const results = [];
  for (const id of desired) {
    const meta = registry[id];
    if (!meta || !meta.configured) continue;
    try {
      let data = null;
      if (id === 'web_search') data = await webSearch(message);
      if (id === 'github_search') data = await githubSearch(message, message);
      if (id === 'public_research') {
        const q=String(message||'');
        const mode=/\b(hoy|ahora|noticias|vigente|actualizad|reciente|ultimos|tiempo real|en vivo)\b/i.test(q)?'auto':/\b(cientific|ciencia|research|estudio|paper|academ|investigacion|laboratorio|medic|epidem|science)\b/i.test(q)?'academic':'encyclopedia';
        const result=await retrieveResearch(q,{mode});if(!result.ok)throw new Error(result.code||'public_research_unavailable');data=result.results;
      }
      if (data) results.push({ tool:id, ok:true, data });
    } catch (error) {
      results.push({ tool:id, ok:false, error:String(error.message || error) });
    }
  }
  return results;
}

export function formatToolContext(results=[]) {
  if (!results.length) return '';
  return `\n\nEVIDENCIA DE HERRAMIENTAS (usa solo lo observado; no inventes ejecuciones):\n${results.map(r => `\n[${r.tool}] ${r.ok?'OK':'ERROR'}\n${compact(r.ok?r.data:r.error)}`).join('\n')}`;
}
