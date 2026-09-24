/* Universal Core v122 — isolate factual episodic memory from retrieval policies.
   The system policy belongs in policy(mode), never in retrieved RAG facts. */
export const FACTUAL_MEMORY_VERSION='wae-factual-memory/v122';
const POLICY_ID='00000000-0000-4000-8000-000000000001';
const syntheticSources=new Set(['product_presentation_policy','training_exemplar_v3']);
const historicalCommand=/(?:^|[.!?;]\s*|\n)\s*(?:responde|contesta|devuelve|reply|respond|return)\s+(?:solamente|solo|únicamente|unicamente|exactamente|only|exactly)\b[^\n]*$/i;
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
export function factualMemoryTextV122(raw=''){
  const text=String(raw??'').slice(0,1600).trim();
  if(!text)return'';
  const command=text.match(historicalCommand);
  return (command?text.slice(0,command.index).trim():text).trim();
}
export function factualMemoriesV122(rows=[],question='',max=6){
  if(!Array.isArray(rows))return[];
  const current=norm(question);
  const selected=[],seen=new Set();
  for(const m of rows){
    if(!m||m.id===POLICY_ID||syntheticSources.has(String(m.metadata?.source||'')))continue;
    if(m.kind==='preference'&&m.metadata?.non_factual_authority===true)continue;
    const content=factualMemoryTextV122(m.content);
    const normalized=norm(content);
    if(!normalized||normalized===current||seen.has(normalized))continue;
    seen.add(normalized);
    selected.push({...m,content});
    if(selected.length>=Math.min(12,Math.max(1,Number(max)||6)))break;
  }
  return selected;
}
