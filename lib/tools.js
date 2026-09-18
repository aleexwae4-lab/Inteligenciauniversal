import { getToolDefinition } from './tool-fabric.js';
import { researchWeb } from './web/research-v1.js';

function compact(value, max = 8000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0,max)}\n…[truncado]` : text;
}

const LEGACY_TOOL_ALIAS=Object.freeze({
  web_search:'web.search',
  github_search:'github.code_search',
});

export function toolRegistry() {
  return Object.entries(LEGACY_TOOL_ALIAS).map(([id,canonicalId])=>{
    const tool=getToolDefinition(canonicalId);
    return {
      id,
      canonicalId,
      configured:Boolean(tool?.configured),
      readonly:tool?.sideEffect==='read',
      description:canonicalId==='web.search'?'Investigación web multi-proveedor con ranking de autoridad, frescura, deduplicación y procedencia.':'Búsqueda de código en repositorios accesibles por GitHub.',
      contractHash:tool?.contractHash||null,
    };
  });
}

export async function executeWebSearch(query) {
  const result = await researchWeb(query,{limit:10});
  return result.evidence.map((item,index)=>({
    title:item.title,
    url:item.url,
    content:item.snippet || '',
    score:Number(item.authority?.trustScore || 0) / 100,
    provider:item.provider,
    source_id:item.registrySource?.id || null,
    source_tier:item.sourceTier,
    authority:item.authority,
    published_at:item.publishedAt || null,
    citation:result.citations[index] || null,
    freshness_requirement:result.freshnessRequirement
  }));
}

function parseRepo(message='') {
  const match = message.match(/(?:repo:|github\.com\/)([\w.-]+\/[\w.-]+)/i);
  return match?.[1] || process.env.DEFAULT_GITHUB_REPO || null;
}

export async function executeGithubSearch(query, message=query) {
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
  const results = [];
  for (const id of desired) {
    const meta = registry[id];
    if (!meta || !meta.configured) continue;
    try {
      let data = null;
      if (id === 'web_search') data = await executeWebSearch(message);
      if (id === 'github_search') data = await executeGithubSearch(message, message);
      if (data) results.push({ tool:id, canonicalTool:meta.canonicalId, contractHash:meta.contractHash, ok:true, data });
    } catch (error) {
      results.push({ tool:id, canonicalTool:meta.canonicalId, contractHash:meta.contractHash, ok:false, error:String(error.message || error) });
    }
  }
  return results;
}

export function formatToolContext(results=[]) {
  if (!results.length) return '';
  return `\n\nEVIDENCIA DE HERRAMIENTAS (usa solo lo observado; no inventes ejecuciones):\n${results.map(r => `\n[${r.tool}] ${r.ok?'OK':'ERROR'}\n${compact(r.ok?r.data:r.error)}`).join('\n')}`;
}
