import { createKnowledgeConnectors } from './connectors-live-v1.js';
import { sourceRegistrySnapshot } from './source-registry-v1.js';
import { untrustedEvidenceFrame } from './retrieval-security-v1.js';

export const UNIVERSAL_KNOWLEDGE_FABRIC_VERSION='universal-knowledge-fabric/v1';
const CACHE=new Map();
const CACHE_TTL_MS=Number(process.env.WAE_KNOWLEDGE_CACHE_TTL_MS||120000);
const text=(value,max=2000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>text(value,3000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const arr=value=>Array.isArray(value)?value:[];
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));

const DOMAIN_RULES=[
  ['medicine',/\b(medic|clinical|cl[ií]nic(?:a|o|as|os)?|health|salud|enfermedad|tratamiento|therapy|drug|f[aá]rmaco|paciente|diagn[oó]stico|biomed|epidemi|cancer|cardio|neuro)\b/i],
  ['biology',/\b(biolog|genom|protein|cell|c[eé]lula|ecolog|evolution|evoluci[oó]n|species|especie)\b/i],
  ['physics',/\b(f[ií]sica|physics|quantum|cu[aá]ntic|particle|part[ií]cula|relativ|cosmolog|astrophys|astronom)\b/i],
  ['computer_science',/\b(comput|software|algorithm|algorit|database|programming|machine learning|inteligencia artificial|artificial intelligence|neural|cyber|ciber)\b/i],
  ['mathematics',/\b(matem[aá]tica|mathemat|theorem|teorema|algebra|c[aá]lculo|geometry|geometr)\b/i],
  ['economics',/\b(econom|macroecon|microecon|financ|inflaci[oó]n|gdp|pib|mercado laboral)\b/i],
  ['history',/\b(historia|history|historical|hist[oó]ric|war|guerra|ancient|siglo|century)\b/i],
  ['biography',/\b(biograf|biography|naci[oó]|born|died|falleci[oó]|scientist|cient[ií]fic|fil[oó]sofo|author|autor)\b/i],
  ['philosophy',/\b(filosof|philosoph|epistem|ethics|[eé]tica|metaphys|metaf[ií]s)\b/i],
  ['literature',/\b(literat|novel|novela|book|libro|obra|poem|poes[ií]a|writer|escritor)\b/i],
  ['engineering',/\b(ingenier|engineering|mechanical|mec[aá]nic|electrical|el[eé]ctric|civil|aerospace|industrial)\b/i]
];

const PRIORITY={
  medicine:['pubmed','openalex','crossref','wikipedia'],biology:['pubmed','openalex','crossref','wikipedia'],physics:['arxiv','openalex','crossref','wikidata'],computer_science:['openalex','arxiv','crossref','wikidata'],mathematics:['arxiv','openalex','crossref','wikidata'],economics:['openalex','crossref','arxiv','wikidata'],engineering:['openalex','crossref','arxiv','wikipedia'],history:['wikidata','wikipedia','open_library','crossref'],biography:['wikidata','wikipedia','open_library','openalex'],philosophy:['open_library','wikidata','wikipedia','openalex'],literature:['open_library','wikidata','wikipedia'],general_knowledge:['wikidata','wikipedia','openalex','crossref']
};

export function understandKnowledgeQuery(query='',options={}){
  const q=text(query,1500);const qNorm=norm(q);const domains=DOMAIN_RULES.filter(([,rx])=>rx.test(q)||rx.test(qNorm)).map(([id])=>id);if(!domains.length)domains.push('general_knowledge');
  const language=options.language||(/[áéíóúñ¿¡]/i.test(q)||/\b(el|la|los|las|que|como|cu[aá]l|quien|sobre|investigaci[oó]n)\b/i.test(q)?'es':'en');
  const temporal=/\b(ultimo|reciente|actual|latest|recent|current|202[4-9])\b/i.test(qNorm);
  return{query:q,normalized:qNorm,domains:[...new Set(domains)],language,temporal,request_type:options.mode==='research'?'research':'search'};
}

export function selectKnowledgeSources(understanding={},options={}){
  const connectors=createKnowledgeConnectors(options);
  const requested=arr(options.sources).map(x=>String(x).toLowerCase()).filter(id=>connectors.has(id));
  if(requested.length)return requested.slice(0,Math.max(1,Math.min(Number(options.maxSources)||6,8)));
  const ordered=[];const domainOrder=arr(understanding.domains).slice();
  if(domainOrder.includes('literature')&&/\b(libro|novela|obra|book|novel)\b/i.test(String(understanding.query||''))){domainOrder.splice(domainOrder.indexOf('literature'),1);domainOrder.unshift('literature')}
  for(const domain of domainOrder)for(const id of PRIORITY[domain]||[])if(connectors.has(id)&&!ordered.includes(id))ordered.push(id);
  for(const id of PRIORITY.general_knowledge)if(connectors.has(id)&&!ordered.includes(id))ordered.push(id);
  return ordered.slice(0,Math.max(1,Math.min(Number(options.maxSources)||4,6)));
}

function canonicalIdentity(record={}){
  const ids=record.identifiers||{};
  if(ids.doi)return`doi:${String(ids.doi).toLowerCase()}`;
  if(ids.pmid)return`pmid:${ids.pmid}`;
  if(ids.pmcid)return`pmcid:${ids.pmcid}`;
  if(ids.arxiv)return`arxiv:${String(ids.arxiv).toLowerCase()}`;
  if(ids.isbn)return`isbn:${String(ids.isbn).replace(/[^0-9x]/gi,'').toLowerCase()}`;
  if(ids.wikidata)return`wikidata:${String(ids.wikidata).toUpperCase()}`;
  const author=norm(record.authors?.[0]?.name||'');const year=String(record.publicationDate||'').slice(0,4);
  return`soft:${norm(record.title)}|${author}|${year}`;
}

function mergeRecord(target,record){
  const seenSources=new Set(arr(target.provenance?.cross_source_records).map(x=>x.source));
  const cross=arr(target.provenance?.cross_source_records);
  if(!seenSources.has(record.source?.id))cross.push({source:record.source?.id,source_record_id:record.provenance?.source_record_id,canonical_url:record.source?.canonical_url});
  target.provenance={...(target.provenance||{}),cross_source_records:cross};
  target.quality={...(target.quality||{}),cross_source_confirmation:cross.length};
  if((record.abstract||'').length>(target.abstract||'').length)target.abstract=record.abstract;
  target.topics=[...new Set([...arr(target.topics),...arr(record.topics)])].slice(0,24);
  target.authors=target.authors?.length?target.authors:record.authors;
  return target;
}

export function deduplicateKnowledgeRecords(records=[]){
  const map=new Map();
  for(const record of arr(records)){
    if(!record?.title)continue;const key=canonicalIdentity(record);const existing=map.get(key);
    if(!existing){record.provenance={...(record.provenance||{}),canonical_identity:key,cross_source_records:[{source:record.source?.id,source_record_id:record.provenance?.source_record_id,canonical_url:record.source?.canonical_url}]};map.set(key,record)}else mergeRecord(existing,record);
  }
  return[...map.values()];
}

export function evidenceAuthority(record={},understanding={}){
  const q=record.quality||{};const sourceAuthority=clamp(q.source_authority);const cross=Math.min(1,Number(q.cross_source_confirmation||0)/3);
  const citationCount=Math.max(0,Number(q.citation_count||0));const citationSignal=Math.min(1,Math.log10(citationCount+1)/4);
  const integrity=q.retraction_status&&q.retraction_status!=='unknown'&&/retract/i.test(q.retraction_status)?0:1;
  let recency=0.5;if(record.publicationDate){const d=new Date(record.publicationDate);if(!Number.isNaN(d.getTime())){const years=Math.max(0,(Date.now()-d.getTime())/31557600000);recency=Math.exp(-years/(understanding.temporal?4:18))}}
  const licenseConfidence=record.license?.confidence==='explicit'?1:(record.license?.confidence==='policy'?0.75:0.35);
  const components={source_authority:sourceAuthority,peer_review_status:q.peer_review_status==='peer_reviewed'?1:(q.peer_review_status==='preprint'?0.45:0.6),publication_type:q.publication_type||record.type,citation_signal:citationSignal,publication_recency:clamp(recency),retraction_integrity:integrity,author_identity:q.author_identity==='verified'?1:0.6,primary_source:q.primary_vs_secondary_source==='primary'?1:(String(q.primary_vs_secondary_source||'').startsWith('primary_')?0.9:0.65),cross_source_confirmation:cross,license_confidence:licenseConfidence};
  const score=0.30*components.source_authority+0.10*components.peer_review_status+0.10*components.citation_signal+0.10*components.publication_recency+0.15*components.retraction_integrity+0.05*components.author_identity+0.08*components.primary_source+0.07*components.cross_source_confirmation+0.05*components.license_confidence;
  return{score:Number(score.toFixed(4)),components,version:'evidence-authority/v1'};
}

function lexicalRelevance(record,understanding){
  const wanted=new Set(understanding.normalized.split(' ').filter(x=>x.length>2));const hay=new Set(norm(`${record.title||''} ${record.abstract||''} ${arr(record.topics).join(' ')}`).split(' '));if(!wanted.size)return 0;let hits=0;for(const token of wanted)if(hay.has(token))hits++;return hits/wanted.size;
}

export function rerankKnowledgeRecords(records=[],understanding={}){
  return arr(records).map(record=>{const authority=evidenceAuthority(record,understanding);const relevance=lexicalRelevance(record,understanding);const rerankScore=0.58*relevance+0.42*authority.score;return{...record,quality:{...(record.quality||{}),authority,relevance:Number(relevance.toFixed(4)),rerank_score:Number(rerankScore.toFixed(4))}}}).sort((a,b)=>(b.quality?.rerank_score||0)-(a.quality?.rerank_score||0));
}

export function citationForRecord(record,index){return{key:`K${index+1}`,source:record.source?.id||'',document_id:record.id,title:record.title,author:record.authors?.[0]?.name||'',date:record.publicationDate||'',url:record.source?.canonical_url||'',doi:record.identifiers?.doi||'',retrieved_at:record.source?.retrieved_at||new Date().toISOString(),license:record.license?.license||'unknown'}}

async function persistRetrievalLedger(payload={}){
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return false;
  try{
    const url=`${String(process.env.SUPABASE_URL).replace(/\/$/,'')}/rest/v1/wae_knowledge_retrieval_ledger_v1`;
    const res=await fetch(url,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload),signal:AbortSignal.timeout(1800)});
    return res.ok;
  }catch{return false}
}

export async function searchKnowledge(query,options={}){
  const started=Date.now();const requestId=options.requestId||crypto.randomUUID();const understanding=understandKnowledgeQuery(query,options);if(!understanding.query)throw Object.assign(new Error('knowledge_query_required'),{status:400});
  const sourceIds=selectKnowledgeSources(understanding,options);const cacheKey=JSON.stringify([understanding.normalized,sourceIds,understanding.language,Number(options.limit)||12]);const cached=CACHE.get(cacheKey);if(cached&&Date.now()-cached.at<CACHE_TTL_MS)return{...cached.value,request_id:requestId,cache_hit:true,total_latency_ms:Date.now()-started};
  const connectors=createKnowledgeConnectors({fetchImpl:options.fetchImpl||fetch});const perSource=Math.max(1,Math.min(Number(options.perSource)||5,8));const sourceStarted=new Map(sourceIds.map(id=>[id,Date.now()]));
  const settled=await Promise.allSettled(sourceIds.map(id=>connectors.get(id).search(understanding.query,{limit:perSource,language:understanding.language})));
  const statuses=[],records=[];
  settled.forEach((result,index)=>{const id=sourceIds[index],latency=Date.now()-sourceStarted.get(id);if(result.status==='fulfilled'){records.push(...result.value);statuses.push({source_id:id,status:'healthy',count:result.value.length,latency_ms:latency})}else{statuses.push({source_id:id,status:Number(result.reason?.status)===429?'rate_limited':'degraded',count:0,latency_ms:latency,error:text(result.reason?.message||result.reason,180)})}});
  const deduped=deduplicateKnowledgeRecords(records);const ranked=rerankKnowledgeRecords(deduped,understanding).slice(0,Math.max(1,Math.min(Number(options.limit)||12,30)));const citations=ranked.map(citationForRecord);const frames=ranked.map(untrustedEvidenceFrame);
  const result={version:UNIVERSAL_KNOWLEDGE_FABRIC_VERSION,request_id:requestId,query:understanding.query,understanding,sources_selected:sourceIds,source_status:statuses,documents_retrieved:records.length,documents_after_dedup:deduped.length,documents_used:ranked.length,records:ranked,citations,evidence_frames:frames,retrieval_latency_ms:Date.now()-started,total_latency_ms:Date.now()-started,cache_hit:false,provenance:{models_used:[],tools_used:sourceIds.map(id=>`knowledge:${id}`),ranking_version:'hybrid-lite/v1',retrieved_at:new Date().toISOString()}};
  CACHE.set(cacheKey,{at:Date.now(),value:{...result,request_id:null}});if(CACHE.size>300)for(const[k,v]of CACHE)if(Date.now()-v.at>CACHE_TTL_MS*2)CACHE.delete(k);
  void persistRetrievalLedger({request_id:requestId,organization_id:options.organizationId||null,query:understanding.query,sources_used:sourceIds,documents_retrieved:records.length,documents_used:ranked.length,ranking_scores:ranked.map(r=>({id:r.id,score:r.quality?.rerank_score})),citations,models_used:[],tools_used:sourceIds.map(id=>`knowledge:${id}`),retrieval_time_ms:result.retrieval_latency_ms,generation_time_ms:0,total_latency_ms:result.total_latency_ms,metadata:{fabric_version:UNIVERSAL_KNOWLEDGE_FABRIC_VERSION,domains:understanding.domains,language:understanding.language}});
  return result;
}

export async function knowledgeSources({live=false,fetchImpl=fetch}={}){
  if(!live)return sourceRegistrySnapshot({});const connectors=createKnowledgeConnectors({fetchImpl});const health={};const settled=await Promise.allSettled([...connectors.values()].map(c=>c.healthCheck()));for(const item of settled)if(item.status==='fulfilled')health[item.value.source_id]=item.value;return sourceRegistrySnapshot(health);
}

export async function knowledgeHealth({live=false,fetchImpl=fetch}={}){
  const started=Date.now();const sources=await knowledgeSources({live,fetchImpl});const routable=sources.filter(s=>s.certification==='candidate_integrated');return{version:UNIVERSAL_KNOWLEDGE_FABRIC_VERSION,status:live?(routable.some(s=>s.health==='healthy')?'healthy':'degraded'):'configured',live_checked:live,registered_sources:sources.length,routable_sources:routable.length,healthy_sources:routable.filter(s=>s.health==='healthy').length,degraded_sources:routable.filter(s=>['degraded','offline','rate_limited'].includes(s.health)).length,cache_entries:CACHE.size,latency_ms:Date.now()-started,sources};
}

export function existingKnowledgeArchitecture(){return{reused:['wae_rag_chunks (pgvector)','wae_global_documents_v1 (tsvector)','wae_knowledge_entities','wae_knowledge_relationships','wae_knowledge_index_queue','wae_knowledge_manifests','wae_research_runs','wae_research_evidence','wae_library_public_catalog_v52'],legacy_or_duplicated:['embeddings (jsonb embedding)','vectors (jsonb embedding)','wae_semantic_documents.embedding (jsonb)'],new_control_plane:['wae_knowledge_sources_v1','wae_license_registry_v1','wae_knowledge_retrieval_ledger_v1','wae_knowledge_source_health_v1']}}
