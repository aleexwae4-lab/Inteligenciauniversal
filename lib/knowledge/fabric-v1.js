import { createKnowledgeConnectors } from './connectors-scientific-v2.js';
import { sourceRegistrySnapshot } from './source-registry-v1.js';
import { untrustedEvidenceFrame } from './retrieval-security-v1.js';
import { applyScientificEvidenceProfiles, detectResearchIntegrityConflicts, scientificEvidenceSummary, isScientificContext } from './scientific-evidence-v2.js';
import { searchGlobalHybridIndex, globalHybridIndexConfigured, privateVectorArchitecture, HYBRID_INDEX_VERSION } from './hybrid-index-v2.js';
import { resolveEntityGrounding, groundEntityRecords, entityEvidenceScore, ENTITY_GROUNDING_VERSION } from '../entity-grounding-v1.js';

export const UNIVERSAL_KNOWLEDGE_FABRIC_VERSION='universal-knowledge-fabric/v70.2-multilingual-reranking';
const CACHE=new Map();
const CACHE_TTL_MS=Number(process.env.WAE_KNOWLEDGE_CACHE_TTL_MS||120000);
const text=(value,max=2000)=>String(value??'').replace(/\u0000/g,'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>text(value,3000).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9./-]+/g,' ').trim();
const arr=value=>Array.isArray(value)?value:[];
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));

const DOMAIN_RULES=[
  ['medicine',/\b(medic|clinical|clinic(?:a|o|as|os)?|health|salud|enfermedad|tratamiento|therapy|drug|farmaco|paciente|diagnostico|biomed|epidemi|cancer|cardio|neuro|hipertens|hypertens|presion arterial|blood pressure|diabet|glucos|oncolog|renal|kidney|pulmon|respirat|randomi[sz]ed controlled trial|ensayo(?:s)? (?:clinico(?:s)? |controlado(?:s)? )?aleatorizado(?:s)?)\b/i],
  ['biology',/\b(biolog|genom|protein|cell|celula|ecolog|evolution|evolucion|species|especie)\b/i],
  ['physics',/\b(fisica|physics|quantum|cuantic|particle|particula|relativ|cosmolog|astrophys|astronom)\b/i],
  ['computer_science',/\b(comput|software|algorithm|algorit|database|programming|machine learning|inteligencia artificial|artificial intelligence|neural|cyber|ciber)\b/i],
  ['mathematics',/\b(matematica|mathemat|theorem|teorema|algebra|calculo|geometry|geometr)\b/i],
  ['economics',/\b(econom|macroecon|microecon|financ|inflacion|gdp|pib|mercado laboral)\b/i],
  ['history',/\b(historia|history|historical|historic|war|guerra|ancient|siglo|century)\b/i],
  ['biography',/\b(biograf|biography|nacio|born|died|fallecio|scientist|cientific|filosofo|author|autor)\b/i],
  ['philosophy',/\b(filosof|philosoph|epistem|ethics|etica|metaphys|metafis)\b/i],
  ['literature',/\b(literat|novel|novela|book|libro|obra|poem|poesia|writer|escritor)\b/i],
  ['engineering',/\b(ingenier|engineering|mechanical|mecanic|electrical|electric|civil|aerospace|industrial)\b/i]
];

const PRIORITY={
  medicine:['pubmed','europe_pmc','openalex','crossref','wikipedia'],
  biology:['pubmed','europe_pmc','openalex','crossref','wikipedia'],
  physics:['arxiv','openalex','crossref','wikidata'],
  computer_science:['openalex','arxiv','crossref','wikidata'],
  mathematics:['arxiv','openalex','crossref','wikidata'],
  economics:['openalex','crossref','arxiv','wikidata'],
  engineering:['openalex','crossref','arxiv','wikipedia'],
  history:['wikidata','wikipedia','open_library','crossref'],
  biography:['wikidata','wikipedia','open_library','openalex'],
  philosophy:['open_library','wikidata','wikipedia','openalex'],
  literature:['open_library','wikidata','wikipedia'],
  general_knowledge:['wikidata','wikipedia','openalex','crossref']
};

const SCIENTIFIC_SOURCES=new Set(['pubmed','europe_pmc','openalex','crossref','arxiv','zenodo']);
const STOPWORDS=new Set('que cual cuales como donde cuando quien quienes tipo tipos existe existen hay sobre frente contra entre desde hasta para por con sin del de la el los las un una unos unas y o e en al a se su sus es son fue fueron ser estar debo debe deben quiero saber explicar interpreta interpretar comparado comparar cientifica cientifico evidence evidencia scientific study studies estudio estudios research investigacion actual current latest reciente recientes the what which how where when who does do is are was were be been of on about versus vs to from for with without and or'.split(' '));
const SCIENTIFIC_ALIASES=[
  [/\bhipertension\b/g,'hypertension'],
  [/\bpresion arterial\b/g,'blood pressure'],
  [/\bensayos? (?:clinicos? )?(?:controlados? )?aleatorizados?\b/g,'randomized controlled trial'],
  [/\brevision sistematica\b/g,'systematic review'],
  [/\bmeta[- ]?analisis\b/g,'meta-analysis'],
  [/\bpreprints?\b/g,'preprint'],
  [/\benfermedad renal\b/g,'kidney disease'],
  [/\binsuficiencia cardiaca\b/g,'heart failure']
];

export function understandKnowledgeQuery(query='',options={}){
  const q=text(query,1500);
  const qNorm=norm(q);
  const domains=DOMAIN_RULES.filter(([,rx])=>rx.test(qNorm)).map(([id])=>id);
  if(!domains.length)domains.push('general_knowledge');
  const language=options.language||(/[áéíóúñ¿¡]/i.test(q)||/\b(el|la|los|las|que|como|cu[aá]l|quien|sobre|investigaci[oó]n)\b/i.test(q)?'es':'en');
  const temporal=/\b(ultimo|reciente|actual|latest|recent|current|202[4-9])\b/i.test(qNorm);
  return{query:q,normalized:qNorm,domains:[...new Set(domains)],language,temporal,request_type:options.mode==='research'?'research':'search'};
}

export function buildSourceQuery(understanding={},sourceId=''){
  const original=text(understanding.query,1500);
  const id=String(sourceId||'').toLowerCase();
  if(!SCIENTIFIC_SOURCES.has(id))return original;
  const doi=original.match(/10\.\d{4,9}\/[\S]+/i)?.[0];
  if(doi)return doi;
  let value=norm(original);
  for(const [rx,replacement] of SCIENTIFIC_ALIASES)value=value.replace(rx,replacement);
  const tokens=value.split(/\s+/).filter(Boolean).filter(token=>!STOPWORDS.has(token));
  const compact=[];
  for(const token of tokens)if(!compact.includes(token))compact.push(token);
  return text(compact.join(' '),500)||original;
}

function buildRerankQuery(understanding={},sourceQueries={}){
  if(!isScientificContext(understanding))return understanding.normalized;
  const candidates=Object.entries(sourceQueries).filter(([id])=>SCIENTIFIC_SOURCES.has(id)).map(([,query])=>norm(query)).filter(Boolean);
  if(!candidates.length)return understanding.normalized;
  const tokens=[];
  for(const candidate of candidates){
    for(const token of candidate.split(/\s+/).filter(Boolean)){
      if(token.length>2&&!STOPWORDS.has(token)&&!tokens.includes(token))tokens.push(token);
    }
  }
  return tokens.join(' ')||understanding.normalized;
}

export function selectKnowledgeSources(understanding={},options={}){
  const connectors=createKnowledgeConnectors(options);
  const requested=arr(options.sources).map(x=>String(x).toLowerCase()).filter(id=>connectors.has(id));
  if(requested.length)return requested.slice(0,Math.max(1,Math.min(Number(options.maxSources)||6,9)));
  const ordered=[];
  const domainOrder=arr(understanding.domains).slice();
  if(domainOrder.includes('literature')&&/\b(libro|novela|obra|book|novel)\b/i.test(String(understanding.query||''))){
    domainOrder.splice(domainOrder.indexOf('literature'),1);domainOrder.unshift('literature');
  }
  for(const domain of domainOrder)for(const id of PRIORITY[domain]||[])if(connectors.has(id)&&!ordered.includes(id))ordered.push(id);
  for(const id of PRIORITY.general_knowledge)if(connectors.has(id)&&!ordered.includes(id))ordered.push(id);
  return ordered.slice(0,Math.max(1,Math.min(Number(options.maxSources)||4,7)));
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
    if(!record?.title)continue;
    const key=canonicalIdentity(record);const existing=map.get(key);
    if(!existing){
      record.provenance={...(record.provenance||{}),canonical_identity:key,cross_source_records:[{source:record.source?.id,source_record_id:record.provenance?.source_record_id,canonical_url:record.source?.canonical_url}]};
      map.set(key,record);
    }else mergeRecord(existing,record);
  }
  return[...map.values()];
}

export function evidenceAuthority(record={},understanding={}){
  const q=record.quality||{};
  const sourceAuthority=clamp(q.source_authority);
  const cross=Math.min(1,Number(q.cross_source_confirmation||0)/3);
  const citationCount=Math.max(0,Number(q.citation_count||0));
  const citationSignal=Math.min(1,Math.log10(citationCount+1)/4);
  const integrity=q.retraction_status&&q.retraction_status!=='unknown'&&/retract/i.test(q.retraction_status)?0:1;
  let recency=0.5;
  if(record.publicationDate){
    const d=new Date(record.publicationDate);
    if(!Number.isNaN(d.getTime())){
      const years=Math.max(0,(Date.now()-d.getTime())/31557600000);
      recency=Math.exp(-years/(understanding.temporal?4:18));
    }
  }
  const licenseConfidence=record.license?.confidence==='explicit'?1:(record.license?.confidence==='policy'?0.75:0.35);
  const components={source_authority:sourceAuthority,peer_review_status:q.peer_review_status==='peer_reviewed'?1:(q.peer_review_status==='preprint'?0.45:0.6),publication_type:q.publication_type||record.type,citation_signal:citationSignal,publication_recency:clamp(recency),retraction_integrity:integrity,author_identity:q.author_identity==='verified'?1:0.6,primary_source:q.primary_vs_secondary_source==='primary'?1:(String(q.primary_vs_secondary_source||'').startsWith('primary_')?0.9:0.65),cross_source_confirmation:cross,license_confidence:licenseConfidence};
  const score=0.30*components.source_authority+0.10*components.peer_review_status+0.10*components.citation_signal+0.10*components.publication_recency+0.15*components.retraction_integrity+0.05*components.author_identity+0.08*components.primary_source+0.07*components.cross_source_confirmation+0.05*components.license_confidence;
  return{score:Number(score.toFixed(4)),components,version:'evidence-authority/v1'};
}

function lexicalRelevance(record,understanding){
  const relevanceText=understanding.rerank_normalized||understanding.normalized||'';
  const wanted=new Set(relevanceText.split(' ').filter(x=>x.length>2&&!STOPWORDS.has(x)));
  const hay=new Set(norm(`${record.title||''} ${record.abstract||''} ${arr(record.topics).join(' ')}`).split(' '));
  if(!wanted.size)return 0;
  let hits=0;for(const token of wanted)if(hay.has(token))hits++;
  return hits/wanted.size;
}

export function rerankKnowledgeRecords(records=[],understanding={}){
  const scientificContext=isScientificContext(understanding);
  const grounding=understanding.entity_grounding||resolveEntityGrounding(understanding.query||'');
  return arr(records).map(record=>{
    const authority=evidenceAuthority(record,understanding);
    const relevance=lexicalRelevance(record,understanding);
    const entity=entityEvidenceScore(record,grounding);
    const indexRank=clamp(record.quality?.index_rank||0);
    const base=0.50*relevance+0.27*authority.score+0.08*indexRank+0.15*entity.score;
    const multiplier=scientificContext?Number(record.quality?.scientific?.ranking_multiplier||1):1;
    const mismatchPenalty=grounding.explicitEntity&&entity.entityMismatch?0.05:1;
    const rerankScore=clamp(base*multiplier*mismatchPenalty);
    return{...record,quality:{...(record.quality||{}),authority,relevance:Number(relevance.toFixed(4)),entity_grounding:entity,rerank_score:Number(rerankScore.toFixed(4)),rerank_query_version:'entity-grounded/v1'}};
  }).sort((a,b)=>(b.quality?.rerank_score||0)-(a.quality?.rerank_score||0));
}

export function citationForRecord(record,index){
  return{key:`K${index+1}`,source:record.source?.id||'',document_id:record.id,title:record.title,author:record.authors?.[0]?.name||'',date:record.publicationDate||'',url:record.source?.canonical_url||'',doi:record.identifiers?.doi||'',retrieved_at:record.source?.retrieved_at||new Date().toISOString(),license:record.license?.license||'unknown',study_type:record.quality?.scientific?.study_type||null,integrity_status:record.quality?.scientific?.integrity?.status||null};
}

async function persistRetrievalLedger(payload={}){
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return false;
  try{
    const url=`${String(process.env.SUPABASE_URL).replace(/\/$/,'')}/rest/v1/wae_knowledge_retrieval_ledger_v1`;
    const res=await fetch(url,{method:'POST',headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload),signal:AbortSignal.timeout(1800)});
    return res.ok;
  }catch{return false}
}

export async function searchKnowledge(query,options={}){
  const started=Date.now();
  const requestId=options.requestId||crypto.randomUUID();
  const understanding=understandKnowledgeQuery(query,options);
  const entityGrounding=resolveEntityGrounding(query);
  if(!understanding.query)throw Object.assign(new Error('knowledge_query_required'),{status:400});
  const sourceIds=selectKnowledgeSources(understanding,options);
  const sourceQueries=Object.fromEntries(sourceIds.map(id=>[id,buildSourceQuery(understanding,id)]));
  const rerankNormalized=buildRerankQuery(understanding,sourceQueries);
  const rankingUnderstanding={...understanding,rerank_normalized:rerankNormalized,entity_grounding:entityGrounding};
  const useGlobalIndex=options.includeGlobalIndex!==false&&globalHybridIndexConfigured();
  const cacheKey=JSON.stringify([understanding.normalized,sourceIds,sourceQueries,rerankNormalized,understanding.language,Number(options.limit)||12,useGlobalIndex]);
  const cached=CACHE.get(cacheKey);
  if(cached&&Date.now()-cached.at<CACHE_TTL_MS)return{...cached.value,request_id:requestId,cache_hit:true,total_latency_ms:Date.now()-started};

  const connectors=createKnowledgeConnectors({fetchImpl:options.fetchImpl||fetch});
  const perSource=Math.max(1,Math.min(Number(options.perSource)||5,8));
  const sourceStarted=new Map(sourceIds.map(id=>[id,Date.now()]));
  const connectorPromise=Promise.allSettled(sourceIds.map(id=>connectors.get(id).search(sourceQueries[id],{limit:perSource,language:understanding.language})));
  const indexPromise=useGlobalIndex?searchGlobalHybridIndex(understanding.query,{limit:Math.min(8,Number(options.limit)||8),fetchImpl:options.indexFetchImpl||fetch}):Promise.resolve({version:HYBRID_INDEX_VERSION,status:'disabled',reason:'not_configured_or_disabled',records:[],latency_ms:0,retrieval_mode:'fts_trigram_graph_authority_v4'});
  const [settled,indexResult]=await Promise.all([connectorPromise,indexPromise]);
  const statuses=[],records=[];
  settled.forEach((result,index)=>{
    const id=sourceIds[index],latency=Date.now()-sourceStarted.get(id);
    if(result.status==='fulfilled'){
      records.push(...result.value);statuses.push({source_id:id,status:'healthy',count:result.value.length,latency_ms:latency,query:sourceQueries[id]});
    }else{
      statuses.push({source_id:id,status:Number(result.reason?.status)===429?'rate_limited':'degraded',count:0,latency_ms:latency,error:text(result.reason?.message||result.reason,180),query:sourceQueries[id]});
    }
  });
  if(useGlobalIndex){
    records.push(...indexResult.records);statuses.push({source_id:'wae_global_index',status:indexResult.status,count:indexResult.records.length,latency_ms:indexResult.latency_ms,retrieval_mode:indexResult.retrieval_mode,error:indexResult.reason||undefined,query:understanding.query});
  }

  const profiled=applyScientificEvidenceProfiles(records,rankingUnderstanding);
  const grounded=groundEntityRecords(profiled,entityGrounding);
  const integrityConflicts=detectResearchIntegrityConflicts(grounded);
  const deduped=deduplicateKnowledgeRecords(grounded);
  const ranked=rerankKnowledgeRecords(deduped,rankingUnderstanding).slice(0,Math.max(1,Math.min(Number(options.limit)||12,30)));
  const citations=ranked.map(citationForRecord);
  const frames=ranked.map(untrustedEvidenceFrame);
  const scientific=scientificEvidenceSummary(ranked);
  const toolsUsed=[...sourceIds.map(id=>`knowledge:${id}`),...(useGlobalIndex?[`knowledge:${HYBRID_INDEX_VERSION}`]:[])];
  const result={version:UNIVERSAL_KNOWLEDGE_FABRIC_VERSION,entity_grounding_version:ENTITY_GROUNDING_VERSION,request_id:requestId,query:understanding.query,understanding:{...understanding,source_queries:sourceQueries,rerank_normalized:rerankNormalized,entity_grounding:entityGrounding},sources_selected:sourceIds,source_status:statuses,index_status:indexResult,documents_retrieved:records.length,documents_after_dedup:deduped.length,documents_used:ranked.length,records:ranked,citations,evidence_frames:frames,scientific_evidence:scientific,integrity_conflicts:integrityConflicts,retrieval_latency_ms:Date.now()-started,total_latency_ms:Date.now()-started,cache_hit:false,provenance:{models_used:[],tools_used:toolsUsed,ranking_version:'scientific-hybrid/v70.2',retrieved_at:new Date().toISOString(),private_vector:privateVectorArchitecture()}};
  CACHE.set(cacheKey,{at:Date.now(),value:{...result,request_id:null}});
  if(CACHE.size>300)for(const[k,v]of CACHE)if(Date.now()-v.at>CACHE_TTL_MS*2)CACHE.delete(k);
  void persistRetrievalLedger({request_id:requestId,organization_id:options.organizationId||null,query:understanding.query,sources_used:[...sourceIds,...(useGlobalIndex?['wae_global_index']:[])],documents_retrieved:records.length,documents_used:ranked.length,ranking_scores:ranked.map(r=>({id:r.id,score:r.quality?.rerank_score,relevance:r.quality?.relevance,study_type:r.quality?.scientific?.study_type,integrity:r.quality?.scientific?.integrity?.status})),citations,models_used:[],tools_used:toolsUsed,retrieval_time_ms:result.retrieval_latency_ms,generation_time_ms:0,total_latency_ms:result.total_latency_ms,metadata:{fabric_version:UNIVERSAL_KNOWLEDGE_FABRIC_VERSION,domains:understanding.domains,language:understanding.language,source_queries:sourceQueries,rerank_normalized:rerankNormalized,scientific_evidence:scientific,integrity_conflicts:integrityConflicts,index_status:indexResult.status}});
  return result;
}

export async function knowledgeSources({live=false,fetchImpl=fetch}={}){
  if(!live)return sourceRegistrySnapshot({});
  const connectors=createKnowledgeConnectors({fetchImpl});const health={};
  const settled=await Promise.allSettled([...connectors.values()].map(c=>c.healthCheck()));
  for(const item of settled)if(item.status==='fulfilled')health[item.value.source_id]=item.value;
  return sourceRegistrySnapshot(health);
}

export async function knowledgeHealth({live=false,fetchImpl=fetch}={}){
  const started=Date.now();const sources=await knowledgeSources({live,fetchImpl});const routable=sources.filter(s=>s.certification==='candidate_integrated');
  return{version:UNIVERSAL_KNOWLEDGE_FABRIC_VERSION,status:live?(routable.some(s=>s.health==='healthy')?'healthy':'degraded'):'configured',live_checked:live,registered_sources:sources.length,routable_sources:routable.length,healthy_sources:routable.filter(s=>s.health==='healthy').length,degraded_sources:routable.filter(s=>['degraded','offline','rate_limited'].includes(s.health)).length,cache_entries:CACHE.size,global_hybrid_index_configured:globalHybridIndexConfigured(),private_vector_architecture:privateVectorArchitecture(),latency_ms:Date.now()-started,sources};
}

export function existingKnowledgeArchitecture(){
  return{reused:['wae_rag_chunks (pgvector + HNSW)','wae_rag_chunks FTS (GIN)','wae_global_documents_v1 (tsvector + trigram + authority ranking)','wae_global_search_v4','wae_retrieve_knowledge_v91 (tenant-aware vector hybrid)','wae_knowledge_entities','wae_knowledge_relationships','wae_knowledge_index_queue','wae_knowledge_manifests','wae_research_runs','wae_research_evidence','wae_library_public_catalog_v52'],legacy_or_duplicated:['embeddings (jsonb embedding)','vectors (jsonb embedding)','wae_semantic_documents.embedding (jsonb)'],new_control_plane:['wae_knowledge_sources_v1','wae_license_registry_v1','wae_knowledge_retrieval_ledger_v1','wae_knowledge_source_health_v1'],scientific_layer:['scientific-evidence/v2','research-integrity/v2','Europe PMC connector','multilingual scientific source query normalization/v70.1','multilingual scientific reranking/v70.2'],vector_policy:privateVectorArchitecture()};
}
