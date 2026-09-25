const configured = () => !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({
  'apikey':process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Authorization':`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type':'application/json'
});

export function memoryStatus() { return { configured:configured(), backend:configured()?'supabase':'none' }; }

export async function recallMemoryDetailed(userKey, query, limit=6) {
  if (!configured()) return {items:[],status:'skipped',code:'not_configured'};
  if (!userKey || !query) return {items:[],status:'skipped',code:'identity_or_query_missing'};
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/search_universal_memory`, {
      method:'POST', headers:headers(),
      body:JSON.stringify({ p_user_key:userKey, p_query:query, p_limit:limit }),
      signal:AbortSignal.timeout(10000)
    });
    if (!res.ok) return {items:[],status:'recovered',code:`http_${res.status}`};
    const rows = await res.json();
    const items=(rows || []).map(r => ({ content:r.content, metadata:r.metadata, created_at:r.created_at, rank:r.rank }));
    return {items,status:'ok',code:null};
  } catch (error) {
    return {items:[],status:'recovered',code:String(error?.name||'memory_unavailable').slice(0,60)};
  }
}

export async function recallMemory(userKey, query, limit=6) {
  return (await recallMemoryDetailed(userKey,query,limit)).items;
}

export async function saveTurnDetailed(userKey, sessionId, userText, assistantText, meta={}) {
  if (!configured()) return {saved:false,status:'skipped',code:'not_configured'};
  if (!userKey || !userText || !assistantText) return {saved:false,status:'skipped',code:'identity_or_content_missing'};
  try {
    const content = `Usuario: ${userText.slice(0,5000)}\nAsistente: ${assistantText.slice(0,8000)}`;
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/universal_memory`, {
      method:'POST', headers:{...headers(), 'Prefer':'return=minimal'},
      body:JSON.stringify({ user_key:userKey, session_id:sessionId || null, content, metadata:{ kind:'turn', ...meta } }),
      signal:AbortSignal.timeout(10000)
    });
    return res.ok?{saved:true,status:'ok',code:null}:{saved:false,status:'recovered',code:`http_${res.status}`};
  } catch (error) {
    return {saved:false,status:'recovered',code:String(error?.name||'memory_write_unavailable').slice(0,60)};
  }
}

export async function saveTurn(userKey, sessionId, userText, assistantText, meta={}) {
  return (await saveTurnDetailed(userKey,sessionId,userText,assistantText,meta)).saved;
}

export function formatMemoryContext(items=[]) {
  if (!items.length) return '';
  return `\n\nMEMORIA RECUPERADA (contexto previo potencialmente relevante):\n${items.map((m,i)=>`${i+1}. ${m.content}`).join('\n')}`;
}
